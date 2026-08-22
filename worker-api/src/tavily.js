// ======== nomi-api Worker · Búsqueda web vía Tavily (sin claves de usuario) ====
// La clave vive SOLO como secreto del Worker (TAVILY_API_KEY); nunca viaja en el
// bundle ni se acepta del cliente. El Worker es el único intermediario: recibe la
// consulta ya validada, llama a Tavily y devuelve hasta 3 resultados saneados
// (título, URL http/https absoluta y snippet corto).
// PRIVACIDAD: no se guarda ni se loguea la consulta, los snippets ni las URLs.
// Tavily recibe la consulta como proveedor externo; el cliente lo comunica al
// usuario. La API Personal de cada usuario conserva su propia clave y flujo.

const TAVILY_URL = 'https://api.tavily.com/search';
const MAX_RESULTADOS = 3;
const MAX_TITULO_CHARS = 70;
const MAX_CONTENIDO_CHARS = 110;

// Sanitiza una URL del proveedor: solo absolutas http/https (descarta
// javascript:, data:, ftp:, etc.) y SIN query ni hash (privacidad y brevedad:
// la fuente queda como página limpia).
function urlSegura(u) {
    if (typeof u !== 'string' || !u.trim()) return null;
    try {
        const parsed = new URL(u.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return null;
    }
}

// Normaliza y recorta un campo de texto del proveedor (sin cortar palabras a la
// bruta: recorte limpio con elipsis).
function textoCorto(v, maxChars) {
    if (typeof v !== 'string') return '';
    const limpio = v.replace(/\s+/g, ' ').trim();
    if (limpio.length <= maxChars) return limpio;
    return limpio.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

// Devuelve { resultados: [{ titulo, url, contenido }] } (máx. 3) o
// { error: 'sin_resultados' | 'fallo_proveedor' }. No lanza: el caller traduce a
// mensaje humano y decide el rollback del cupo. Sin logs de query/resultados.
export async function consultarBusqueda(env, consulta) {
    // Secreto no configurado en el Worker: fallo del lado del servidor/proveedor
    // (revierte cupo y permite reintento cuando se configure).
    if (!env.TAVILY_API_KEY) return { error: 'fallo_proveedor' };
    // Timeout server-side (P2): Tavily debe responder en ≤10 s (configurable
    // solo vía env para pruebas). Vencido -> fallo_proveedor, y el caller
    // revierte el cupo del usuario.
    const timeoutMs = Number(env.TAVILY_TIMEOUT_MS) > 0 ? Number(env.TAVILY_TIMEOUT_MS) : 10000;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    let r;
    try {
        r = await fetch(TAVILY_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + env.TAVILY_API_KEY,
            },
            body: JSON.stringify({
                query: consulta,
                max_results: MAX_RESULTADOS,
                search_depth: 'basic',
                include_answer: false,
                include_raw_content: false,
            }),
            signal: controlador.signal,
        });
    } catch {
        return { error: 'fallo_proveedor' }; // red caída / DNS / timeout
    } finally {
        clearTimeout(temporizador);
    }
    if (!r.ok) return { error: 'fallo_proveedor' }; // 401/403/429/5xx: fallo del proveedor o de configuración del servidor
    let data;
    try {
        data = await r.json();
    } catch {
        return { error: 'fallo_proveedor' };
    }
    const brutos = Array.isArray(data && data.results) ? data.results : [];
    const resultados = [];
    for (const item of brutos) {
        if (!item || typeof item !== 'object') continue;
        const url = urlSegura(item.url);
        if (!url) continue;
        resultados.push({
            titulo: textoCorto(item.title, MAX_TITULO_CHARS),
            url,
            contenido: textoCorto(item.content, MAX_CONTENIDO_CHARS),
        });
        if (resultados.length >= MAX_RESULTADOS) break;
    }
    if (resultados.length === 0) return { error: 'sin_resultados' };
    return { resultados };
}

export const _internosBusqueda = { urlSegura, textoCorto };
