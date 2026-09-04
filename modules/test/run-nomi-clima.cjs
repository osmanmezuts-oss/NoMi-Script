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
        NoMiState.ubicacionActivada = false;
        NoMiState.ubicacionActual = null;
        NoMiState.busquedaWebActiva = false;
        NoMiState.climaAutomatico = getClimaAutomatico();
    }

    // ===== 1) Detección conservadora (unidad) =====
    assert.strictEqual(detectarClimaNoMi('como estara el clima hoy en Santa Cruz de la Sierra?'), 'Santa Cruz de la Sierra');
    assert.strictEqual(detectarClimaNoMi('cual sera la temperatura en Cochabamba?'), 'Cochabamba');
    assert.strictEqual(detectarClimaNoMi('habra lluvia en Oruro?'), 'Oruro');
    assert.strictEqual(detectarClimaNoMi('como esta el viento en El Alto?'), 'El Alto');
    assert.strictEqual(detectarClimaNoMi('que pronóstico hay para mañana en La Paz?'), 'La Paz');
    // "tiempo" solo en expresiones meteorológicas claras.
    assert.strictEqual(detectarClimaNoMi('que tiempo hace en La Paz?'), 'La Paz', 'expresion "que tiempo hace"');
    assert.strictEqual(detectarClimaNoMi('que tiempo hará en La Paz mañana?'), 'La Paz', 'expresion "que tiempo hará" + sufijo temporal recortado');
    assert.strictEqual(detectarClimaNoMi('tiempo hoy en Cochabamba'), 'Cochabamba', 'expresion "tiempo hoy"');
    // OBLIGATORIO: normalización de ubicación (solo extremos; apóstrofes internos se conservan).
    assert.strictEqual(normalizarUbicacionClima("Santa Cruz de la Sierra'"), 'Santa Cruz de la Sierra', 'normaliza apóstrofo de cierre');
    assert.strictEqual(normalizarUbicacionClima("'Cochabamba'"), 'Cochabamba', 'normaliza comillas externas');
    assert.strictEqual(normalizarUbicacionClima("Sant'Agata"), "Sant'Agata", 'conserva apóstrofo interno legítimo');
    assert.strictEqual(normalizarUbicacionClima('La Paz?'), 'La Paz', 'normaliza puntuación final');
    assert.strictEqual(detectarClimaNoMi("cual es el clima en Santa Cruz de la Sierra'?"), 'Santa Cruz de la Sierra', 'OBLIGATORIO: ciudad con apóstrofo final se resuelve');
    assert.strictEqual(detectarClimaNoMi('como estara el clima hoy en "Santa Cruz"'), 'Santa Cruz', 'comillas externas limpias en detección');
    // Falsos positivos obligatorios: NUNCA deben llamar a Open-Meteo.
    assert.strictEqual(detectarClimaNoMi('cuanto tiempo tardas en responder?'), null, 'FP: "cuanto tiempo tardas"');
    assert.strictEqual(detectarClimaNoMi('tiempo de ejecución del script'), null, 'FP: "tiempo de ejecución"');
    // Sin ciudad ni ubicación local -> NO se activa clima automáticamente.
    assert.strictEqual(detectarClimaNoMi('que tal el clima hoy?'), null, 'sin ciudad y sin ubicacion -> null');
    assert.strictEqual(detectarClimaNoMi('cuentame un chiste'), null, 'sin palabra de clima -> null');
    assert.strictEqual(detectarClimaNoMi(''), null, 'vacio -> null');
    assert.strictEqual(detectarClimaNoMi(null), null, 'null -> null');
    // Ubicación local habilitada cubre la ausencia de "en …".
    NoMiState.ubicacionActivada = true;
    NoMiState.ubicacionActual = { ciudad: 'Cochabamba', pais: 'Bolivia', fuente: 'gps', timestamp: Date.now() };
    assert.strictEqual(detectarClimaNoMi('que tal el clima hoy?'), 'Cochabamba, Bolivia', 'ubicacion local habilita clima');
    NoMiState.ubicacionActivada = false; NoMiState.ubicacionActual = null;

    // ===== 2) NoMi + ciudad: envía herramienta clima al Worker, sin Groq/OpenRouter =====
    activarNoMi();
    let llamadasChat = 0, cuerpoCliente = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) {
            llamadasChat++;
            cuerpoCliente = JSON.parse(opts.body);
            return { ok: true, respuesta: 'Clima en Santa Cruz de la Sierra, Bolivia: Ahora: despejado, 22°C. Hoy: max 30°C / min 18°C.' };
        }
        throw new Error('inesperado en test 2: ' + url);
    };
    botMsgs = [];
    await preguntar('cual es el clima en Santa Cruz de la Sierra?');
    assert.strictEqual(llamadasChat, 1, 'consulta de clima llama al Worker 1 vez');
    assert.ok(cuerpoCliente.herramienta, 'el cuerpo incluye herramienta');
    assert.strictEqual(cuerpoCliente.herramienta.tipo, 'clima');
    assert.ok(cuerpoCliente.herramienta.ubicacion.includes('Santa Cruz'), 'ubicacion resuelta: ' + cuerpoCliente.herramienta.ubicacion);
    assert.ok(botMsgs.some((m) => m.includes('Ahora:')), 'la respuesta breve del clima se pinta en el chat');

    // ===== 2b) OBLIGATORIO: apóstrofo final se normaliza antes de enviar =====
    activarNoMi();
    let cuerpoApost = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoApost = JSON.parse(opts.body); return { ok: true, respuesta: 'Clima en Santa Cruz de la Sierra, Bolivia: 28°C.', climaEstado: 'ok' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08' };
        throw new Error('inesperado en test 2b clima: ' + url);
    };
    botMsgs = [];
    await preguntar("cual es el clima en Santa Cruz de la Sierra'?");
    assert.ok(cuerpoApost && cuerpoApost.herramienta && cuerpoApost.herramienta.tipo === 'clima', 'apóstrofo final: se envía por la ruta clima');
    assert.strictEqual(cuerpoApost.herramienta.ubicacion, 'Santa Cruz de la Sierra', 'apóstrofo final NUNCA viaja a Open-Meteo');

    // ===== 3) Sin ciudad ni ubicación: el chat NoMi NO activa clima =====
    activarNoMi();
    let llamadasChat3 = 0, cuerpoNormal = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasChat3++; cuerpoNormal = JSON.parse(opts.body); return { ok: true, respuesta: 'respuesta normal' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, tokens_usados: 0, solicitudes_usadas: 1 };
        throw new Error('inesperado en test 3: ' + url);
    };
    botMsgs = [];
    await preguntar('que tal el clima hoy?');
    assert.strictEqual(llamadasChat3, 1, 'consulta sin ciudad sigue el chat normal NoMi');
    assert.ok(cuerpoNormal && !cuerpoNormal.herramienta, 'sin ciudad: NO se envía herramienta');

    // ===== 3b) Clima automático desactivado: la consulta sigue el chat NoMi normal sin herramienta =====
    activarNoMi();
    setClimaAutomatico(false);
    let llamadasCtx = 0, cuerpoCtx = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasCtx++; cuerpoCtx = JSON.parse(opts.body); return { ok: true, respuesta: 'respuesta normal' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, tokens_usados: 0, solicitudes_usadas: 1 };
        throw new Error('inesperado en test 3b: ' + url);
    };
    botMsgs = [];
    await preguntar('cual es el clima en Santa Cruz de la Sierra?');
    assert.strictEqual(llamadasCtx, 1, 'con clima automático desactivado el chat NoMi responde');
    assert.ok(cuerpoCtx && !cuerpoCtx.herramienta, 'desactivado: NO se envía herramienta de clima');
    assert.strictEqual(getClimaAutomatico(), false, 'la preferencia desactivada queda persistida');
    setClimaAutomatico(true);

    // ===== 3c) Asignación directa: NoMiState.climaAutomatico = false =====
    activarNoMi();
    NoMiState.climaAutomatico = false;
    let llamadasDir = 0, cuerpoDir = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasDir++; cuerpoDir = JSON.parse(opts.body); return { ok: true, respuesta: 'respuesta normal' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, tokens_usados: 0, solicitudes_usadas: 1 };
        throw new Error('inesperado en test 3c: ' + url);
    };
    botMsgs = [];
    await preguntar('cual es el clima en Santa Cruz de la Sierra?');
    assert.strictEqual(llamadasDir, 1, 'con climaAutomatico=false (asignacion directa) responde el chat normal');
    assert.ok(cuerpoDir && !cuerpoDir.herramienta, 'climaAutomatico=false directo: el cuerpo no contiene herramienta');

    // ===== 3d) Red caída en clima: reintentarPregunta + reintento vuelve por clima =====
    activarNoMi();
    let llamadasRedClima = 0, cuerpoReintento = null;
    responder = async () => { llamadasRedClima++; throw new Error('red caída'); };
    botMsgs = [];
    await preguntar('cual es el clima en Cochabamba?');
    assert.strictEqual(llamadasRedClima, 1, 'clima intentó llamar al Worker');
    assert.ok(botMsgs.some((m) => m.includes('Reintentar')), 'muestra mensaje humano de conexión');
    assert.strictEqual(NoMiState.reintentarPregunta, 'cual es el clima en Cochabamba?', 'fallo de red en clima guarda la pregunta para Reintentar');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'HUD refleja sin_conexion tras fallo de clima');
    // Reintento explícito (botón "Reintentar" del HUD): debe volver a la ruta clima.
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoReintento = JSON.parse(opts.body); return { ok: true, respuesta: 'Clima en Cochabamba: 20°C.' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, tokens_usados: 0, solicitudes_usadas: 1 };
        throw new Error('inesperado en reintento clima: ' + url);
    };
    await preguntar(NoMiState.reintentarPregunta);
    assert.ok(cuerpoReintento && cuerpoReintento.herramienta && cuerpoReintento.herramienta.tipo === 'clima', 'reintento vuelve a la ruta clima');
    assert.strictEqual(cuerpoReintento.herramienta.ubicacion, 'Cochabamba', 'reintento conserva la ubicación detectada');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'el éxito del reintento limpia reintentarPregunta');

    // ===== 3e) El input se limpia al enviar una consulta de clima =====
    activarNoMi();
    const inputClimaTest = document.getElementById('nomi-input');
    assert.ok(inputClimaTest, 'existe #nomi-input');
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) return { ok: true, respuesta: 'ok' };
        if (url.includes('/v1/usage')) return { periodo: '2026-08' };
        throw new Error('inesperado en test 3e: ' + url);
    };
    inputClimaTest.value = 'habra lluvia en Oruro?';
    await preguntar('habra lluvia en Oruro?');
    assert.strictEqual(inputClimaTest.value, '', 'el input se limpia tras enviar una consulta de clima');

    // ===== 3f) climaEstado='fallo_proveedor': fallo blando reintentable =====
    activarNoMi();
    let cuerpoProv = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoProv = JSON.parse(opts.body); return { ok: true, respuesta: 'No se pudo consultar el clima ahora. Reintenta.', climaEstado: 'fallo_proveedor' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, tokens_usados: 0, solicitudes_usadas: 1 };
        throw new Error('inesperado en test 3f: ' + url);
    };
    botMsgs = [];
    const contadorAntesProv = NoMiState.contadorPreguntas;
    await preguntar('cual es el clima en La Paz?');
    assert.ok(cuerpoProv && cuerpoProv.herramienta && cuerpoProv.herramienta.tipo === 'clima', 'la consulta fue por la ruta clima');
    assert.ok(botMsgs.some((m) => m.includes('No se pudo consultar el clima')), 'conserva el mensaje humano del Worker');
    assert.strictEqual(NoMiState.reintentarPregunta, 'cual es el clima en La Paz?', 'fallo_proveedor ofrece Reintentar para la misma pregunta');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'HUD sin_conexion en fallo_proveedor');
    assert.strictEqual(NoMiState.contadorPreguntas, contadorAntesProv, 'fallo_proveedor NO cuenta como pregunta atendida');
    assert.ok(!NoMiState.historial.some((m) => m.role === 'user'), 'la pregunta sale del historial (el reintento no la duplica)');
    // Reintento con señal 'ok': se atiende como éxito normal.
    responder = async () => ({ ok: true, respuesta: 'Clima en La Paz, Bolivia: 15°C.', climaEstado: 'ok' });
    botMsgs = [];
    await preguntar(NoMiState.reintentarPregunta);
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'el éxito limpia reintentarPregunta');
    assert.strictEqual(NoMiState.contadorPreguntas, contadorAntesProv + 1, 'el éxito sí cuenta la pregunta');
    assert.ok(botMsgs.some((m) => m.includes('Clima en La Paz')), 'reintento pinta la respuesta de clima');

// ===== 4) Ubicación local habilitada: se usa como ubicación =====
    activarNoMi();
    NoMiState.ubicacionActivada = true;
    NoMiState.ubicacionActual = { ciudad: 'Santa Cruz de la Sierra', pais: 'Bolivia', fuente: 'gps', timestamp: Date.now() };
    let cuerpoUbic = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoUbic = JSON.parse(opts.body); return { ok: true, respuesta: 'ok' }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08' };
        throw new Error('inesperado humano: ' + url);
    };
    botMsgs = [];
    await preguntar('habra lluvia hoy?'); // no "en", pero hay ubicacion local
    assert.ok(cuerpoUbic && cuerpoUbic.herramienta && cuerpoUbic.herramienta.tipo === 'clima', 'con ubicacion local si se activa el clima');
    assert.ok(cuerpoUbic.herramienta.ubicacion.includes('Santa Cruz'), 'usa la ubicacion local: ' + cuerpoUbic.herramienta.ubicacion);

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
        if (url.includes('/v1/chat')) return { ok: true, respuesta: '!search Resultado inventado de la web' };
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