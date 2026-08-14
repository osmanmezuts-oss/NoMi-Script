// ======== MÓDULO: Catálogo de Modelos Gratuitos (OpenRouter) ========
// NoMi Assistant – Listado de modelos gratuitos (:free, precio 0) para selección guiada.
//
// NO envía ni registra datos sensibles, chats, claves ni historial.
// NO llama a la telemetría/IA ni a Slack.
// Cachea en sessionStorage (una sola consulta por pestaña).
// Nunca usa Math.random ni Date.now() como generador de identificadores: es solo catálogo.

const MODELO_FREE_CACHE = 'nomi_modelos_free_cache';
const MODELO_FREE_TTL = 5 * 60 * 1000; // 5 minutos de validez en sessionStorage.
const MODELO_FREE_URL = 'https://openrouter.ai/api/v1/models?sort=latency-low-to-high';

// OpenRouter responde 429 cuando se supera la cuota. No confundimos 429 con baja de modelo.
class OpenRouterRateLimitError extends Error {
    constructor(message, retryAfter) {
        super(message);
        this.name = 'OpenRouterRateLimitError';
        this.retryAfter = retryAfter;
    }
}
class OpenRouterHttpError extends Error {
    constructor(status) {
        super('Error ' + status);
        this.name = 'OpenRouterHttpError';
        this.status = status;
    }
}
class OpenRouterNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OpenRouterNetworkError';
    }
}

// Filtra: chat/texto, id :free y precio 0. No inventa cifras de latencia numérica.
function parsearModelosFree(datos) {
    const arr = Array.isArray(datos) ? datos : (datos && Array.isArray(datos.data) ? datos.data : []);
    return arr
        .filter(m => {
            if (!m || typeof m.id !== 'string') return false;
            if (!m.id.endsWith(':free')) return false;
            const precio = m.pricing || {};
            const request = precio.request;
            if (precio.prompt === undefined || precio.prompt === null || Number(precio.prompt) !== 0) return false;
            if (precio.completion === undefined || precio.completion === null || Number(precio.completion) !== 0) return false;
            if (request !== undefined && request !== null && Number(request) !== 0) return false;
            return true;
        })
        .map((m, i) => ({
            id: m.id,
            name: m.name || m.id,
            context: m.context_length ? Number(m.context_length) : null,
            // Posición relativa según el orden devuelto por OpenRouter (sort=latency-low-to-high).
            // No es una medición en milisegundos: solo indica orden relativo de latencia estimada.
            posicion: i + 1,
            peralmb: null
        }));
}

// Consulta compatible con userscripts: GM_xmlhttpRequest evita depender de CORS.
function solicitarCatalogoOpenRouter() {
    return new Promise((resolve, reject) => {
        const procesarRespuesta = (status, texto, retryAfter) => {
            if (status === 429) return reject(new OpenRouterRateLimitError('429 (rate limit)', retryAfter));
            if (status < 200 || status >= 300) return reject(new OpenRouterHttpError(status));
            try { resolve(JSON.parse(texto)); }
            catch { reject(new OpenRouterNetworkError('Respuesta inválida de OpenRouter')); }
        };
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: MODELO_FREE_URL,
                headers: { Accept: 'application/json' },
                onload: (resp) => procesarRespuesta(resp.status, resp.responseText, resp.responseHeaders?.match(/retry-after:\s*([^\r\n]+)/i)?.[1]),
                onerror: () => reject(new OpenRouterNetworkError('Sin conexión a OpenRouter')),
                ontimeout: () => reject(new OpenRouterNetworkError('Tiempo de espera agotado'))
            });
            return;
        }
        fetch(MODELO_FREE_URL, { method: 'GET', headers: { Accept: 'application/json' } })
            .then(async (resp) => procesarRespuesta(resp.status, await resp.text(), resp.headers.get('retry-after')))
            .catch((e) => reject(e instanceof OpenRouterHttpError || e instanceof OpenRouterRateLimitError || e instanceof OpenRouterNetworkError ? e : new OpenRouterNetworkError((e && e.message) || 'Sin conexión a OpenRouter')));
    });
}

// Consulta el catálogo de modelos gratuitos. Resuelve con [{id,name,context,...}].
// Lanza OpenRouterRateLimitError (429) / OpenRouterHttpError / OpenRouterNetworkError.
async function fetchFreeModelos(force) {
    const ahora = Date.now();
    if (!force) {
        const cached = sessionStorage.getItem(MODELO_FREE_CACHE);
        if (cached) {
            try {
                const obj = JSON.parse(cached);
                if (obj && obj.expira > ahora && Array.isArray(obj.data)) return obj.data;
            } catch { /* cache corrupto: se descarta */ }
        }
    }
    try {
        const datos = await solicitarCatalogoOpenRouter();
        const modelos = parsearModelosFree(datos);
        sessionStorage.setItem(MODELO_FREE_CACHE, JSON.stringify({ data: modelos, expira: ahora + MODELO_FREE_TTL }));
        return modelos;
    } catch (e) {
        sessionStorage.removeItem(MODELO_FREE_CACHE);
        throw e instanceof OpenRouterHttpError || e instanceof OpenRouterRateLimitError || e instanceof OpenRouterNetworkError
            ? e
            : new OpenRouterNetworkError((e && e.message) || 'Sin conexión a OpenRouter');
    }
}

// Indica si un id está presente como gratuito en la lista.
function modeloDisponible(modelo, lista) {
    return Array.isArray(lista) && lista.some(m => m.id === modelo);
}

// ---- Avisos en la cabecera (debajo del nombre técnico del modelo) ----
// No altera estructura existente: crea un <span id="nomi-modelo-aviso"> hermano al display.
function _crearAvisoModelo() {
    let aviso = document.getElementById('nomi-modelo-aviso');
    if (!aviso) {
        aviso = document.createElement('span');
        aviso.id = 'nomi-modelo-aviso';
        aviso.style.cssText = 'display:block;font-size:9px;margin-top:2px;';
        const display = document.getElementById('nomi-modelo-display');
        if (display && display.parentNode) display.parentNode.insertBefore(aviso, display.nextSibling);
    }
    return aviso;
}
function limpiarAvisoModelo() {
    const aviso = document.getElementById('nomi-modelo-aviso');
    if (aviso) aviso.remove();
}
function mostrarAvisoModeloRetirado() {
    const aviso = _crearAvisoModelo();
    aviso.style.color = '#f55036';
    aviso.textContent = '⚠️ Este modelo ya no está disponible gratis. Elige otro en Configuración.';
}
function mostrarAvisoVerificacion(tipo) {
    const aviso = _crearAvisoModelo();
    aviso.style.color = '#aaa';
    aviso.textContent = tipo === 'limit'
        ? 'No se pudo verificar disponibilidad (limitado). Inténtalo más tarde.'
        : 'No se pudo verificar disponibilidad del modelo.';
}

// Verificación de disponibilidad al abrir NoMi. Se ejecuta en segundo plano (no bloquea)
// y se consulta una sola vez por pestaña/sesión (sessionStorage).
async function verificarModeloAlIniciar() {
    if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('nomi_modelo_verificado') === 'true') return;
    const modelo = (typeof getModelo === 'function' ? getModelo() : '') || (NoMiState && NoMiState.modeloActual);
    if (!modelo) return;
    // Marcamos la sesión como verificada ANTES: no se reintenta en la misma pestaña aunque falle.
    sessionStorage.setItem('nomi_modelo_verificado', 'true');
    try {
        const lista = await fetchFreeModelos();
        if (!modeloDisponible(modelo, lista)) {
            mostrarAvisoModeloRetirado();
            return;
        }
        // Disponible → sin aviso; se retira cualquier aviso previo de la sesión.
        limpiarAvisoModelo();
    } catch (e) {
        if (e instanceof OpenRouterRateLimitError) mostrarAvisoVerificacion('limit');
        else mostrarAvisoVerificacion('fail');
        // No marcamos el modelo como retirado ante 429 ni error de red.
    }
    // No se envía diagnóstico ni se registra error por retirada normal de un modelo.
}
