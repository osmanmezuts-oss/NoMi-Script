/*
 * nomi-diagnostics - Worker unico para pegar en el editor web de Cloudflare.
 * Auto-contenido (sin imports relativos).
 *
 * REQUISITOS EN CLOUDFLARE (ya existentes, NO incluyen valores):
 *   - Secreto:  SLACK_WEBHOOK_URL
 *   - Binding:  DIAGNOSTICS_KV
 *
 * Ruta: POST /v1/diagnostics
 */


// ===== sanitize.js =====
// ======== nomi-diagnostics: sanitize.js ========
// Filtrado fuerte y defensivo de datos sensibles ANTES de construir el payload.
// No almacenamos reportes: esta capa solo reduce el contenido a lo mínimo no privado.

const CLAVES_SENSIBLES = new Set([
    'apikey', 'api_key', 'apikeyactual', 'accesskey', 'access_key',
    'token', 'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
    'secret', 'clientsecret', 'client_secret', 'password', 'passwd', 'pwd',
    'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
    'webhook', 'webhookurl', 'webhook_url', 'slackwebhook', 'slack_webhook',
    'x-api-key', 'x-auth-token', 'x-apikey'
]);

// Detecta "secreto" por forma de valor (cabeceras con autorización, secretos de API).
// El prefijo ya es suficientemente específico (sk-or-v1-, tvly-...), por lo que basta
// con al menos 1 carácter después; así también se enmascaran valores cortos.
const REGEX_SECRETOS = /(sk-or-v1-|tvly-|gh[pousr]_|sk-[A-Za-z0-9]{6,}|hooks\.slack\.com\/services\/)[A-Za-z0-9_\-./=?&%]{1,}/gi;

// Reemplazos para cifras tipo número de tarjeta o CVV (nunca deberían aparecer, pero por si acaso).
const REGEX_TARJETA = /\b(?:\d[ -]*?){13,16}\b/g;

// Detecta cookies / tokens tipo JWT.
const REGEX_JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

function normalizarNombreClave(nombre) {
    return String(nombre || '').toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/[_-]+/g, '_');
}

function esClaveSensible(nombre) {
    const n = normalizarNombreClave(nombre);
    if (CLAVES_SENSIBLES.has(n)) return true;
    // "query", "url" con parámetros los tratamos aparte en el valor.
    return /key|token|secret|pass|pwd|auth|cookie|webhook|credential/.test(n);
}

function redactarValorSensible(valor) {
    return String(valor)
        .replace(REGEX_SECRETOS, '[REDACTADO]')
        .replace(REGEX_JWT, '[REDACTADO]')
        .replace(REGEX_TARJETA, '[REDACTADO]')
        .slice(0, 500);
}

function sanitizarCadena(valor, nombreClave) {
    let s = String(valor);
    s = s.replace(REGEX_SECRETOS, '[REDACTADO]')
         .replace(REGEX_JWT, '[REDACTADO]')
         .replace(REGEX_TARJETA, '[REDACTADO]');
    // Quitar claves tipo "clave=valor" en cadenas libres (p. ej. dentro de texto de contexto).
    s = s.replace(/(api[_-]?key|secret|token|password|passwd|pwd|cookie|webhook|authorization)\s*[=:|]\s*[^\s,;]+/gi, '[REDACTADO]');
    // Quitar parámetros de URL con valores (URL completa nunca se envía).
    s = s.replace(/([?&](?:key|token|secret|password|api[_-]?key|auth|signature|sig)=)[^&\s]+/gi, '$1[REDACTADO]');
    // Limpiar query en URLs genéricas (se queda el origin+path para diagnóstico no sensible).
    s = s.replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/g, '$1[parametros-omitidos]');
    return s.trim().slice(0, 500);
}

// Reduce una URL a "origin + pathname" (sin query ni fragment, sin credenciales incrustadas).
function urlSegura(url) {
    if (!url || typeof url !== 'string') return '';
    const t = url.trim();
    // Si no parece una URL, devolvemos el texto tal cual (no lo interpretamos con una base).
    if (!/^https?:\/\//i.test(t)) return t.slice(0, 300);
    try {
        const u = new URL(t);
        u.username = ''; u.password = ''; u.search = ''; u.hash = '';
        return u.protocol + '//' + u.host + u.pathname;
    } catch {
        return t.slice(0, 300);
    }
}

// Distingue el dominio principal ("example.com") sin subdominios.
function dominioPublico(url) {
    try {
        const u = new URL(url);
        const partes = u.hostname.split('.').filter(Boolean);
        if (partes.length <= 2) return u.hostname;
        // quita un único subdominio genérico (www) o confía en TLD de 2 partes
        const tld = partes.slice(-2).join('.');
        if (partes.length === 3 && ['www'].includes(partes[0])) return partes.slice(-2).join('.');
        return partes.slice(-2).join('.');
    } catch {
        return '';
    }
}

// Recorre recursivamente un objeto y devuelve una COPIA saneada.
function sanitizarReporte(entrada) {
    if (entrada === null || entrada === undefined) return null;
    if (typeof entrada !== 'object') {
        return sanitizarCadena(String(entrada), '');
    }
    if (Array.isArray(entrada)) {
        return entrada.map((x) => sanitizarReporte(x));
    }
    const salida = {};
    for (const clave of Object.keys(entrada)) {
        const valor = entrada[clave];
        const nombreNorm = normalizarNombreClave(clave);
        if (esClaveSensible(clave)) {
            // Nunca transmitimos el valor de una clave que represente un secreto.
            salida[clave] = '[REDACTADO]';
            continue;
        }
        if (valor !== undefined && valor !== null) {
            salida[clave] = sanitizarReporte(valor);
        }
    }
    return salida;
}

// ===== kv.js =====
// ======== nomi-diagnostics: kv.js ========
// Límite (rate limit) y deduplicación usando Cloudflare KV con expiración.
// No almacenamos reportes ni datos de usuario: las claves KV son sólo
// (1) contador por instalación y (2) huella del reporte ya visto.

const VENTANA_LIMITE_MS = 10 * 60 * 1000; // 10 minutos
const MAX_POR_INSTALACION = 10;           // máx. reportes distintos
const TTL_DEDUP_S = 5 * 60;               // 5 minutos

// Almacena en memoria el estado cuando no hay KV (uso en pruebas o en entornos
// sin binding). En producción siempre se usa DIAGNOSTICS_KV.
const memoria = new Map();

function kvUsable(kv) {
    return kv && typeof kv.get === 'function' && typeof kv.put === 'function';
}

async function leerClave(kv, clave) {
    if (kvUsable(kv)) {
        try { const v = await kv.get(clave, 'json'); return v; }
        catch { return null; }
    }
    return memoria.get(clave)?.valor ?? null;
}

async function escribirConTtl(kv, clave, valor, ttlS, now) {
    if (kvUsable(kv)) {
        try { await kv.put(clave, JSON.stringify(valor), { expirationTtl: ttlS }); }
        catch { /* si KV falla, el límite es blando */ }
        return;
    }
    memoria.set(clave, { valor, expira: now + ttlS * 1000 });
}

// Devuelve false si la instalación ya superó el límite; si pasa, incrementa y devuelve { ok:true, permitidos }.
async function permitirPorInstalacion(kv, instalacionId, now = Date.now()) {
    const clave = 'rl:' + instalacionId;
    let estado = await leerClave(kv, clave);
    if (!estado || (now - (estado.inicio || 0)) > VENTANA_LIMITE_MS) {
        estado = { inicio: now, contador: 0 };
    }
    estado.contador += 1;
    await escribirConTtl(kv, clave, estado, Math.ceil(VENTANA_LIMITE_MS / 1000), now);
    if (estado.contador > MAX_POR_INSTALACION) return { permitido: false, permitidos: estado.contador };
    return { permitido: true, permitidos: estado.contador };
}

// Deduplicación: si el reporte ya se envió hace < 5 min, no se reenvía.
// Devuelve true si es duplicado (debe omitirse).
async function esDuplicado(kv, huella, now = Date.now()) {
    const clave = 'dd:' + huella;
    const existente = await leerClave(kv, clave);
    if (existente !== null && existente !== undefined) return true;
    await escribirConTtl(kv, clave, { visto: true }, TTL_DEDUP_S, now);
    return false;
}

// En pruebas: reinicia la memoria interna (para poder testear de forma aislada).
function resetMemoria() {
    memoria.clear();
}

// ===== hash.js =====
// ======== nomi-diagnostics: hash.js ========
// Huella criptográfica (SHA-256) para deduplicación.
// Se usa sólo el hash, nunca el contenido, y la clave de dedup expira a los 5 min.

async function sha256(texto) {
    const data = new TextEncoder().encode(String(texto));
    // En Cloudflare Workers existe globalThis.crypto.subtle.
    // En entornos de prueba (Node 18) puede no estar global: se usa node:crypto.
    const cripto = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
        ? globalThis.crypto
        : (await import('node:crypto')).webcrypto;
    const buf = await cripto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function huellaReporte(payloadSaneado) {
    // Ordenamos claves para que dos envíos con el mismo contenido produzcan la misma huella.
    const ordenar = (o) => {
        if (Array.isArray(o)) return o.map(ordenar);
        if (o && typeof o === 'object') {
            const r = {};
            Object.keys(o).sort().forEach((k) => { r[k] = ordenar(o[k]); });
            return r;
        }
        return o;
    };
    const canon = JSON.stringify(ordenar(payloadSaneado));
    return sha256(canon);
}

// ===== worker.js =====
// ======== nomi-diagnostics: worker.js ========
// Cloudflare Worker de telemetría de errores anónima y mínima de NoMi.
//
// Reemplaza el "Hello World":
//   - POST /v1/diagnostics  -> recibe un reporte, lo filtra, y lo reenvía a Slack.
//   - Límite: 10 reportes por instalación / 10 min.
//   - Deduplicación: 5 min usando KV con expiración.
//   - NO almacena reportes, conversaciones ni datos privados. KV sólo guarda
//     contadores (con TTL) y huellas de dedup (con TTL).
//
// Variables de entorno / bindings:
//   - SLACK_WEBHOOK_URL   (secreto) : URL del webhook de Slack entrante.
//   - DIAGNOSTICS_KV      (binding) : namespace KV para límite y dedup.

const RUTA = '/v1/diagnostics';
const MAX_BODY = 2 * 1024;          // 2 KiB máximo real para evitar abuso.

// Texto del cuerpo acumulado en streaming. Se cancela en cuanto supera maxBytes,
// SIN confiar en Content-Length (que puede ausentarse). No consume el cuerpo completo.
// Cada llamada usa su PROPIO TextDecoder (una petición no comparte estado con otra).
async function leerCuerpoConLimite(request, maxBytes) {
    const dec = new TextDecoder();
    const stream = request.body;
    if (!stream || typeof stream.getReader !== 'function') {
        // Cuerpo no legible como stream: devolvemos texto vacío para parsear más abajo.
        return { texto: '', exceso: false };
    }
    const reader = stream.getReader();
    let bytes = 0;
    let acumulado = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkLen = value ? (value.byteLength || value.length) : 0;
            bytes += chunkLen;
            // En cuanto superamos el límite, cerramos el stream SIN leer el resto.
            if (bytes > maxBytes) {
                try { reader.cancel(); } catch { /* ignore */ }
                return { texto: null, exceso: true };
            }
            acumulado += dec.decode(value, { stream: true });
        }
        acumulado += dec.decode(); // flush final del TextDecoder
        return { texto: acumulado, exceso: false };
    } catch {
        return { texto: null, exceso: true };
    } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
    }
}

function respuestaJson(objeto, status = 200) {
    return new Response(JSON.stringify(objeto), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type'
        }
    });
}

// Envía el reporte a Slack. Slack es un canal de salida; no es almacenamiento nuestro.
async function enviarASlack(webhookUrl, mensaje, fetchFn = fetch) {
    const resp = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mensaje)
    });
    if (!resp.ok) {
        throw new Error('Slack respondió ' + resp.status);
    }
}

// Construye el bloque de Slack (texto plano, sin adjuntos que puedan colar datos).
function construirMensajeSlack(campos) {
    const texto = [
        ':warning: *NoMi · Diagnóstico de error*',
        `*Tipo:* ${campos.type || 'desconocido'}`,
        `*Mensaje:* ${campos.message || ''}`,
        `*Contexto:* ${campos.context || '—'}`,
        campos.dominio ? `*Dominio:* ${campos.dominio}` : null,
        `*Versión:* ${campos.version || '?'}`,
        `*Dispositivo:* ${campos.device || '—'}`,
        `*Plataforma/SO:* ${campos.platform || '—'}`,
        `*Móvil:* ${campoSiNo(campos.mobile) ? 'sí' : 'no'}`,
        `*Red:* ${campos.red || '—'}`,
        `*Batería:* ${campos.bateria || '—'}`,
        `*ID:* ${campos.instalacionId || '—'}`,
        `*Fecha:* ${campos.timestamp || ''}`
    ].filter(Boolean).join('\n');
    return { text: texto.slice(0, 3000) };
}

// 'campoSiNo': interpreta booleano/cadena/número de forma tolerante y evita 'no' falso.
function campoSiNo(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true', '1', 'sí', 'si', 'yes'].includes(v.trim().toLowerCase());
    return !!v;
}

async function manejarPeticion(request, env, deps = {}) {
    const fetchFn = deps.fetch || fetch;
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type',
                'access-control-max-age': '86400'
            }
        });
    }
    if (request.method !== 'POST' || new URL(request.url).pathname !== RUTA) {
        return respuestaJson({ error: 'no-encontrado' }, 404);
    }

    const webhookUrl = (env && env.SLACK_WEBHOOK_URL) || '';
    if (!webhookUrl) {
        return respuestaJson({ error: 'slack-no-configurado' }, 500);
    }

    // 1) Límite real de cuerpo (2 KB) ANTES del parseo. Se lee como stream por fragmentos
    //    y se cancela en cuanto se supera el límite, SIN confiar en Content-Length
    //    (que puede ausentarse): nunca se consume el cuerpo completo de un invitado.
    if (request.headers.get('content-length') && Number(request.headers.get('content-length') || 0) > MAX_BODY) {
        return respuestaJson({ error: 'demasiado-grande' }, 413);
    }
    let resultado;
    try {
        resultado = await leerCuerpoConLimite(request, MAX_BODY);
    } catch {
        return respuestaJson({ error: 'cuerpo-ilegible' }, 400);
    }
    if (resultado.exceso) {
        return respuestaJson({ error: 'demasiado-grande' }, 413);
    }
    const cuerpoTexto = resultado.texto || '';

    let crudo;
    try {
        crudo = JSON.parse(cuerpoTexto);
    } catch {
        return respuestaJson({ error: 'json-invalido' }, 400);
    }
    if (!crudo || typeof crudo !== 'object') {
        return respuestaJson({ error: 'payload-invalido' }, 400);
    }

    // 2) Filtrado fuerte ANTES de usar nada del cliente.
    const saneado = sanitizarReporte(crudo);

    const instalacionId = String(saneado.instalacionId || 'anónimo').slice(0, 64);
    // Límite: 10 / 10 min por instalación.
    const limite = await permitirPorInstalacion(env.DIAGNOSTICS_KV, instalacionId);
    if (!limite.permitido) {
        return respuestaJson({ error: 'límite-alcanzado', permitidos: limite.permitidos }, 429);
    }

    // 3) Deduplicación 5 min.
    const huella = await huellaReporte(saneado);
    const dup = await esDuplicado(env.DIAGNOSTICS_KV, huella);
    if (dup) {
        return respuestaJson({ ok: true, estado: 'duplicado-omitido' }, 200);
    }

    // 4) Preparar campos finales (sólo datos ya saneados y no sensibles).
    const urlRaw = typeof crudo.url === 'string' ? crudo.url : '';
    const urlSeg = urlSegura(urlRaw);
    const campos = {
        type: saneado.type,
        message: saneado.message,
        context: saneado.context,
        dominio: dominioPublico(urlSeg),
        version: saneado.version,
        device: saneado.device,
        platform: saneado.platform,
        mobile: saneado.mobile,
        red: saneado.red,
        bateria: saneado.bateria,
        instalacionId: instalacionId.slice(0, 8),
        timestamp: saneado.timestamp || new Date().toISOString()
    };

    // 5) Envío inmediato a Slack.
    try {
        await enviarASlack(webhookUrl, construirMensajeSlack(campos), fetchFn);
    } catch (e) {
        // No propagamos detalles a Slack; devolvemos error genérico al cliente.
        return respuestaJson({ error: 'error-envio-slack' }, 502);
    }

    return respuestaJson({ ok: true, estado: 'enviado' }, 202);
}

// Entry point estándar de Cloudflare Workers.
export default {
    async fetch(request, env) {
        return manejarPeticion(request, env);
    }
};
