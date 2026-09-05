// Pruebas de cliente del bloque de clima NoMi (Fase 2).
// Cubre: detección conservadora (ciudad tras "en …" o ubicación local), envío de
// `herramienta: { tipo: "clima", ubicacion }` en modo NoMi sin Groq, no-activación
// sin ciudad/ubicación, ubicación local, Personal conservando su flujo (sin ruta
// de clima) y defensa en profundidad anti-`!search`. Ejecutar:
//   node modules/test/run-nomi-clima.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const MOD = path.join(ROOT, 'modules');

function leer(nombre) { return fs.readFileSync(path.join(MOD, nombre), 'utf8'); }

// ---- DOM simulado mínimo (reutiliza patrón de run-nomi-ui) ----
function makeEl(tag) {
    const el = {
        tagName: (tag || '').toUpperCase(), nodeType: 1, id: '', className: '',
        children: [], parentNode: null, style: {}, attributes: {}, _text: '',
        value: '', checked: false, selected: false, disabled: false, dataset: {},
        onclick: null, onchange: null, title: '', _listeners: {},
    };
    el.appendChild = (c) => { c.parentNode = el; el.children.push(c); return c; };
    Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
    el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; };
    el.prepend = (c) => { c.parentNode = el; el.children.unshift(c); return c; };
    el.insertBefore = (c, ref) => { c.parentNode = el; const i = el.children.indexOf(ref); if (i < 0) el.children.push(c); else el.children.splice(i, 0, c); return c; };
    el.remove = () => { if (el.parentNode) { const i = el.parentNode.children.indexOf(el); if (i >= 0) el.parentNode.children.splice(i, 1); el.parentNode = null; } };
    el.setAttribute = (k, v) => { el.attributes[k] = String(v); if (k === 'id') el.id = String(v); if (k.startsWith('data-')) el.dataset[k.slice(5)] = String(v); };
    el.getAttribute = (k) => (k in el.attributes ? el.attributes[k] : null);
    Object.defineProperty(el, 'textContent', { get() { return el._text; }, set(v) { el._text = String(v); el.children = []; } });
    Object.defineProperty(el, 'options', { get() { return el.children.filter(c => c.tagName === 'OPTION'); } });
    Object.defineProperty(el, 'value', {
        get() { const sel = el.children.find(c => c.tagName === 'OPTION' && c.selected); if (sel) return sel.value; return el._value !== undefined ? el._value : ''; },
        set(v) { el._value = String(v); for (const c of el.children) if (c.tagName === 'OPTION') c.selected = (c.value === String(v)); },
    });
    el.addEventListener = (type, fn) => { (el._listeners[type] = el._listeners[type] || []).push(fn); };
    el.removeEventListener = () => {};
    el.focus = () => {};
    el.querySelector = (sel) => buscar(el, sel, true);
    el.querySelectorAll = (sel) => buscar(el, sel, false);
    el.closest = (sel) => { let n = el; while (n) { if (matchSel(n, sel)) return n; n = n.parentNode; } return null; };
    return el;
}
function buscar(root, sel, firstOnly) {
    const out = [];
    (function walk(n) {
        for (const c of n.children) {
            if (c.nodeType === 1) {
                if (matchSel(c, sel)) { out.push(c); if (firstOnly) return; }
                walk(c); if (firstOnly && out.length) return;
            }
        }
    })(root);
    return firstOnly ? out[0] || null : out;
}
function matchSel(node, sel) {
    if (!sel) return false; sel = sel.trim();
    if (sel.startsWith('#')) return node.id === sel.slice(1);
    if (sel.startsWith('.')) return (node.className || '').split(/\s+/).includes(sel.slice(1));
    let m = sel.match(/^([a-zA-Z0-9]+)?\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/);
    if (m) { const tagOk = !m[1] || node.tagName === m[1].toUpperCase(); return tagOk && node.getAttribute(m[2]) === m[3]; }
    return node.tagName === sel.toUpperCase();
}
const documento = {
    body: makeEl('body'),
    createElement: (t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, _text: String(t), get textContent() { return this._text; }, set textContent(v) { this._text = String(v); } }),
    getElementById: (id) => buscar(documento.body, '#' + id, true),
    addEventListener: () => {}, querySelector: (sel) => buscar(documento.body, sel, true),
    querySelectorAll: (sel) => buscar(documento.body, sel, false),
};

const memLocal = new Map();
const store = new Map();
const ctx = {
    console, assert, document: documento,
    location: { href: 'https://example.com', hostname: 'example.com', reload() {} },
    localStorage: { getItem: (k) => (memLocal.has(k) ? memLocal.get(k) : null), setItem: (k, v) => memLocal.set(k, String(v)), removeItem: (k) => memLocal.delete(k) },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => store.set(k, v),
    GM_deleteValue: (k) => store.delete(k),
    window: null, confirm: () => true, alert: () => {},
    navigator: { userAgent: 'test', language: 'es-ES', platform: 'linux' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, TextDecoder, URL,
};
ctx.window = ctx;
ctx.document = documento;
ctx.limpiarBody = () => { documento.body = makeEl('body'); };
vm.createContext(ctx);

// Módulos en orden de build.
const fuentes = [
    leer('nomi-config-estatica.js'), leer('nomi-deteccion-sistema.js'), leer('nomi-criptografia.js'),
    leer('nomi-procesamiento-lenguaje.js'), leer('nomi-state.js'), leer('nomi-utilities.js'),
    leer('nomi-limpieza.js'), leer('nomi-persistencia.js'), leer('nomi-logging.js'),
    leer('nomi-estadisticas.js'), leer('nomi-chat.js'), leer('nomi-red.js'),
    leer('nomi-acceso-nomi.js'), leer('nomi-modelos-free.js'), leer('nomi-credenciales.js'),
    leer('nomi-ubicacion.js'), leer('nomi-ui.js'), leer('nomi-asistente-config.js'),
    leer('nomi-menu-config.js'), leer('nomi-core.js'),
];

const pruebas = `
(async () => {
    let botMsgs = [];
    const _agregar = agregarMensaje;
    agregarMensaje = (quien, texto) => { if (quien === 'bot') botMsgs.push(texto); };

    crearVentanaChat();

    function activarNoMi() {
        setModoAcceso(MODO_ACCESO_NOMI);
        setNomiToken('TOK123');
        setNomiAccesoActivo(true);
        NoMiState.modoAcceso = MODO_ACCESO_NOMI;
        NoMiState.nomiToken = 'TOK123';
        NoMiState.nomiAccesoActivo = true;
        NoMiState.isWaiting = false;
        NoMiState.historial = [];
        NoMiState.reintentarPregunta = '';
        NoMiState.reintentarBusquedaForzada = false;
        NoMiState.ubicacionActivada = false;
        NoMiState.ubicacionActual = null;
        NoMiState.busquedaWebActiva = false;
        NoMiState.climaAutomatico = getClimaAutomatico();
    }

    // ===== 1) La decisión climática no vive en el cliente =====
    assert.strictEqual(typeof detectarClimaNoMi, 'undefined', 'sin detector léxico/regex en producción');
    assert.strictEqual(typeof normalizarUbicacionClima, 'undefined', 'la ubicación explícita la extrae semánticamente el modelo');

    // ===== 2) NoMi envía herramientas, anclaje local y fallbacks estructurados =====
    activarNoMi();
    setUbicacionHabitual('Cochabamba, Bolivia');
    NoMiState.ubicacionHabitual = getUbicacionHabitual();
    NoMiState.ubicacionActivada = true;
    NoMiState.ubicacionActual = { ciudad: 'La Paz', pais: 'Bolivia', fuente: 'gps', timestamp: Date.now() };
    let cuerpoCliente = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) {
            cuerpoCliente = JSON.parse(opts.body);
            return { ok: true, respuesta: 'Mañana en Santa Cruz: lluvias probables.\\nMañana (06–11): 20°C.\\nTarde (12–17): 28°C.\\nNoche (18–23): 22°C.\\nRecomendación: lleve paraguas.', climaEstado: 'ok', busquedaProtocolo: 1, herramientasProtocolo: 1 };
        }
        if (url.includes('/v1/usage')) return { periodo: '2026-09', cuota_mensual_invitado: 50, tokens_usados: 1, solicitudes_usadas: 1 };
        throw new Error('inesperado en test semántico: ' + url);
    };
    botMsgs = [];
    await preguntar('¿Necesitaré paraguas al salir mañana en Santa Cruz?');
    assert.ok(cuerpoCliente, 'consulta NoMi enviada');
    assert.strictEqual(cuerpoCliente.herramienta, undefined, 'el cliente no decide ni construye la herramienta');
    assert.strictEqual(cuerpoCliente.permitirClima, true, 'habilita decisión climática semántica');
    assert.ok(cuerpoCliente.contextoTemporal && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(cuerpoCliente.contextoTemporal.fecha), 'fecha local estructurada');
    assert.ok(/^[0-9]{2}:[0-9]{2}$/.test(cuerpoCliente.contextoTemporal.hora), 'hora local estructurada');
    assert.ok(cuerpoCliente.contextoTemporal.zona, 'zona IANA estructurada');
    assert.match(cuerpoCliente.contextoTemporal.offset, /^UTC[+-][0-9]{2}:[0-9]{2}$/);
    assert.strictEqual(cuerpoCliente.ubicacionHabitual, 'Cochabamba, Bolivia');
    assert.strictEqual(cuerpoCliente.ubicacionDispositivo, 'La Paz, Bolivia');
    assert.ok(botMsgs.some(m => m.includes('Mañana (06–11)')), 'pinta el pronóstico por franjas');

    // ===== 3) Sin ubicación: conserva la pregunta única del Worker para continuar =====
    activarNoMi();
    setUbicacionHabitual('');
    let cuerpoSinUbicacion = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) {
            cuerpoSinUbicacion = JSON.parse(opts.body);
            return { ok: true, respuesta: '¿En qué ciudad y país quieres consultar el clima?', climaEstado: 'falta_ubicacion', busquedaProtocolo: 1, herramientasProtocolo: 1 };
        }
        if (url.includes('/v1/usage')) return { periodo: '2026-09' };
        throw new Error('inesperado sin ubicación: ' + url);
    };
    botMsgs = [];
    await preguntar('¿Podré salir mañana?');
    assert.strictEqual(cuerpoSinUbicacion.ubicacionHabitual, undefined);
    assert.strictEqual(cuerpoSinUbicacion.ubicacionDispositivo, undefined);
    assert.ok(botMsgs.includes('¿En qué ciudad y país quieres consultar el clima?'));
    assert.ok(NoMiState.historial.some(m => m.role === 'assistant' && m.content.includes('En qué ciudad')), 'la aclaración queda en contexto para la respuesta siguiente');

    // ===== 4) Fallo del proveedor: reintento sin forzar búsqueda web =====
    activarNoMi();
    const contadorAntesProv = NoMiState.contadorPreguntas;
    responder = async (url) => {
        if (url.includes('/v1/chat')) return { ok: true, respuesta: 'No se pudo consultar el clima ahora. Reintenta.', climaEstado: 'fallo_proveedor', busquedaProtocolo: 1, herramientasProtocolo: 1 };
        throw new Error('inesperado fallo clima: ' + url);
    };
    botMsgs = [];
    await preguntar('¿Necesitaré abrigo mañana en Tarija?');
    assert.strictEqual(NoMiState.reintentarPregunta, '¿Necesitaré abrigo mañana en Tarija?');
    assert.strictEqual(NoMiState.reintentarBusquedaForzada, false, 'reintentar clima no fuerza Tavily');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion');
    assert.strictEqual(NoMiState.contadorPreguntas, contadorAntesProv);

    // ===== 4b) Preferencia apagada: no ofrece clima =====
    activarNoMi();
    NoMiState.climaAutomatico = false;
    let cuerpoApagado = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoApagado = JSON.parse(opts.body); return { ok: true, respuesta: 'respuesta normal', busquedaProtocolo: 1, herramientasProtocolo: 1 }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-09' };
        throw new Error('inesperado preferencia apagada: ' + url);
    };
    await preguntar('¿Necesitaré paraguas mañana?');
    assert.strictEqual(cuerpoApagado.permitirClima, false);

    // ===== 5) Personal (openrouter): conserva su flujo y NO usa la ruta clima =====
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    setApiKey('sk-or'); setUrlBase('https://openrouter.ai/api/v1');
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER; NoMiState.apiKeyActual = 'sk-or';
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1'; NoMiState.credencialesCargadas = true;
    NoMiState.busquedaWebActiva = false; NoMiState.historial = [];
    let capturaPersonal = null, llamadasPersonal = 0;
    responder = async (url, opts) => {
        if (url.includes('/chat/completions')) { llamadasPersonal++; capturaPersonal = { url, opts }; return { choices: [{ message: { content: 'resp personal' } }] }; }
        throw new Error('inesperado Personal: ' + url);
    };
    await preguntar('cual es el clima en Madrid hoy');
    assert.strictEqual(llamadasPersonal, 1, 'Personal sigue usando su API');
    assert.ok(capturaPersonal && capturaPersonal.url.includes('/chat/completions'), 'Personal usa /chat/completions');
    const bPersonal = JSON.parse(capturaPersonal.opts.body);
    assert.ok(!bPersonal.herramienta, 'Personal NO envía herramienta de clima');

    // ===== 6) Defensa anti-!search =====
    assert.strictEqual(esRespuestaComandoInseguro('!search foo'), true);
    assert.strictEqual(esRespuestaComandoInseguro('!search Resultado'), true);
    assert.strictEqual(esRespuestaComandoInseguro('   !search  bar'), true);
    assert.strictEqual(esRespuestaComandoInseguro('respuesta normal'), false);

    botMsgs = [];
    // Defensa SOLO en modo NoMi: la respuesta empieza por !search y NO se muestra.
    activarNoMi();
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) return { ok: true, respuesta: '!search Resultado inventado de la web', busquedaProtocolo: 1, herramientasProtocolo: 1 };
        throw new Error('inesperado en defensa NoMi: ' + url);
    };
    await preguntar('dime algo sobre X');
    assert.ok(botMsgs.some((m) => m.includes('Reformula')), 'NoMi: muestra mensaje humano de seguridad');
        assert.ok(!botMsgs.some((m) => m.includes('!search')), 'NoMi: no muestra la línea !search');
    assert.ok(!botMsgs.some((m) => m.includes('Resultado inventado')), 'NoMi: no muestra el resultado de la supuesta búsqueda');
    // La defensa !search conserva el indicador/modelo NoMi (no el de Personal).
    const dispDefensa = document.getElementById('nomi-modelo-display');
    assert.ok(dispDefensa, 'NoMi: indicador de modelo presente tras defensa anti-!search');
    assert.strictEqual(dispDefensa.textContent, NoMiState.nomiModelo, 'NoMi: !search bloqueada conserva modelo NoMi (no modelo Personal)');
    assert.notStrictEqual(dispDefensa.textContent, NoMiState.modeloActual, 'NoMi: !search bloqueada no muestra modelo Personal');

    // Personal (OpenRouter): la defensa !search NO se aplica (auditoría hallazgo 4).
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    setApiKey('sk-or'); setUrlBase('https://openrouter.ai/api/v1');
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER; NoMiState.apiKeyActual = 'sk-or';
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1'; NoMiState.credencialesCargadas = true;
    NoMiState.busquedaWebActiva = false; NoMiState.historial = [];
    botMsgs = [];
    responder = async (url, opts) => ({ choices: [{ message: { content: '!search Resultado experimental' } }] });
    await preguntar('dime algo sobre X');
    assert.ok(botMsgs.some((m) => m.includes('!search')), 'Personal: la respuesta con !search sí se muestra');
    assert.ok(!botMsgs.some((m) => m.includes('Reformula')), 'Personal: no se aplica la defensa NoMi');

    agregarMensaje = _agregar;
    console.log('OK: todas las pruebas de clima (cliente) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const combinado = fuentes.join('\n') + '\n' + `
let responder = async (url, opts) => { throw new Error('no hay mock para ' + url); };
hacerPeticion = async (url, opts) => { return await responder(url, opts); };
` + pruebas;

vm.runInContext(combinado, ctx, { filename: 'nomi-clima-test.js' });
