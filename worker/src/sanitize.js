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

export function esClaveSensible(nombre) {
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
export function urlSegura(url) {
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
export function dominioPublico(url) {
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
export function sanitizarReporte(entrada) {
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