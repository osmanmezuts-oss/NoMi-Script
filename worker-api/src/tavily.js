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
const MAX_TITULO_COMPACTO_CHARS = 70;
const MAX_TITULO_SINTESIS_CHARS = 90;
const MAX_TITULO_SINTESIS_BYTES = 180;
// La síntesis necesita evidencia suficiente; el navegador mostrará solo la
// respuesta y los enlaces, no este contenido completo.
const MAX_CONTENIDO_COMPACTO_CHARS = 110;
const MAX_CONTENIDO_SINTESIS_CHARS = 300;
const MAX_CONTENIDO_SINTESIS_BYTES = 600;
const MAX_FECHA_BYTES = 80;
const MAX_URL_CHARS = 500;
const TEMAS = new Set(['general', 'news', 'finance']);
const RECENCIAS = new Set(['day', 'week', 'month', 'year']);

// Sanitiza una URL del proveedor: solo absolutas http/https (descarta
// javascript:, data:, ftp:, etc.) y SIN query ni hash (privacidad y brevedad:
// la fuente queda como página limpia).
function urlSegura(u) {
    if (typeof u !== 'string' || !u.trim() || u.trim().length > MAX_URL_CHARS) return null;
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
function textoCorto(v, maxChars, maxBytes = maxChars * 2) {
    if (typeof v !== 'string') return '';
    const limpio = v.replace(/\s+/g, ' ').trim();
    const porCaracteres = limpio.length <= maxChars
        ? limpio
        : limpio.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
    const bytes = new TextEncoder().encode(porCaracteres);
    if (bytes.length <= maxBytes) return porCaracteres;
    const elipsis = new TextEncoder().encode('…');
    let fin = Math.max(0, maxBytes - elipsis.length);
    while (fin > 0 && (bytes[fin] & 0xC0) === 0x80) fin--;
    return new TextDecoder().decode(bytes.subarray(0, fin)).trimEnd() + '…';
}

// Devuelve { resultados: [{ titulo, url, contenido }] } (máx. 3) o
// { error: 'sin_resultados' | 'fallo_proveedor' }. No lanza: el caller traduce a
// mensaje humano y decide el rollback del cupo. Sin logs de query/resultados.
export async function consultarBusqueda(env, consulta, opciones = {}) {
    // Secreto no configurado en el Worker: fallo del lado del servidor/proveedor
    // (revierte cupo y permite reintento cuando se configure).
    if (!env.TAVILY_API_KEY) return { error: 'fallo_proveedor' };
    // Timeout server-side (P2): Tavily debe responder en ≤10 s (configurable
    // solo vía env para pruebas). Vencido -> fallo_proveedor, y el caller
    // revierte el cupo del usuario.
    const timeoutMs = Number(env.TAVILY_TIMEOUT_MS) > 0 ? Number(env.TAVILY_TIMEOUT_MS) : 10000;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    const tema = TEMAS.has(opciones.tema) ? opciones.tema : 'general';
    const recencia = RECENCIAS.has(opciones.recencia) ? opciones.recencia : null;
    const paraSintesis = opciones.detalle === 'sintesis';
    const maxTituloChars = paraSintesis ? MAX_TITULO_SINTESIS_CHARS : MAX_TITULO_COMPACTO_CHARS;
    const maxTituloBytes = paraSintesis ? MAX_TITULO_SINTESIS_BYTES : MAX_TITULO_COMPACTO_CHARS * 2;
    const maxContenidoChars = paraSintesis ? MAX_CONTENIDO_SINTESIS_CHARS : MAX_CONTENIDO_COMPACTO_CHARS;
    const maxContenidoBytes = paraSintesis ? MAX_CONTENIDO_SINTESIS_BYTES : MAX_CONTENIDO_COMPACTO_CHARS * 2;
    const cuerpo = {
        query: consulta,
        max_results: MAX_RESULTADOS,
        search_depth: 'basic',
        topic: tema,
        include_answer: false,
        include_raw_content: false,
    };
    if (recencia) cuerpo.time_range = recencia;
    let r;
    try {
        r = await fetch(TAVILY_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + env.TAVILY_API_KEY,
            },
            body: JSON.stringify(cuerpo),
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
    const urlsVistas = new Set();
    for (const item of brutos) {
        if (!item || typeof item !== 'object') continue;
        const url = urlSegura(item.url);
        const contenido = textoCorto(item.content, maxContenidoChars, maxContenidoBytes);
        if (!url || !contenido || urlsVistas.has(url)) continue;
        urlsVistas.add(url);
        resultados.push({
            titulo: textoCorto(item.title, maxTituloChars, maxTituloBytes),
            url,
            contenido,
            fecha: textoCorto(item.published_date, 40, MAX_FECHA_BYTES),
        });
        if (resultados.length >= MAX_RESULTADOS) break;
    }
    if (resultados.length === 0) return { error: 'sin_resultados' };
    return { resultados };
}

export const _internosBusqueda = { urlSegura, textoCorto, TEMAS, RECENCIAS };
