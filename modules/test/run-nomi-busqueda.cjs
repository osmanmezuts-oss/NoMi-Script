// Pruebas de cliente de búsqueda web semántica NoMi (Tavily SOLO vía Worker).
// Cubre: decisión delegada al modelo sin palabras obligatorias, continuidad,
// pregunta no duplicada, prioridad del clima, preferencia desactivada, API
// Personal intacta, reintento y render seguro/compacto de fuentes.
// Ejecutar: node modules/test/run-nomi-busqueda.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const MOD = path.join(ROOT, 'modules');

function leer(nombre) { return fs.readFileSync(path.join(MOD, nombre), 'utf8'); }

// ---- DOM simulado mínimo (reutiliza patrón de run-nomi-clima) ----
function makeEl(tag) {
    const el = {
        tagName: (tag || '').toUpperCase(), nodeType: 1, id: '', className: '',
        children: [], parentNode: null, style: {}, attributes: {}, _text: '',
        value: '', checked: false, selected: false, disabled: false, dataset: {},
        onclick: null, onchange: null, title: '', _listeners: {},
        href: '', target: '', rel: '',
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
    if (!sel) return false;
    sel = sel.trim();
    if (sel.startsWith('#')) return node.id === sel.slice(1);
    if (sel.startsWith('.')) return (node.className || '').split(/\s+/).includes(sel.slice(1));
    const m = sel.match(/^([a-zA-Z0-9]+)?\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/);
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
vm.createContext(ctx);

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
        setNomiToken('TOK456');
        setNomiAccesoActivo(true);
        NoMiState.modoAcceso = MODO_ACCESO_NOMI;
        NoMiState.nomiToken = 'TOK456';
        NoMiState.nomiAccesoActivo = true;
        NoMiState.isWaiting = false;
        NoMiState.historial = [];
        NoMiState.reintentarPregunta = '';
        NoMiState.reintentarBusquedaForzada = false;
        NoMiState.estadoHud = null;
        NoMiState.busquedaWebActiva = false;
        setBusquedaWebNomi(true);
    }

    function conUso(handler) {
        responder = async (url, opts) => {
            if (url.includes('/v1/usage')) return { periodo: '2026-09', tokens_usados: 10, cuota_mensual_invitado: 420000 };
            return await handler(url, opts);
        };
    }

    function ocurrencias(texto, fragmento) {
        return String(texto).split(fragmento).length - 1;
    }

    // 1) No hay heurística léxica; cualquier turno habilita decisión semántica.
    assert.strictEqual(typeof detectarBusquedaNoMi, 'undefined', 'sin detector por palabras en el cliente');
    activarNoMi();
    let cuerpoNormal = null;
    conUso(async (url, opts) => {
        assert.ok(url.includes('/v1/chat'));
        cuerpoNormal = JSON.parse(opts.body);
        return { ok: true, respuesta: 'Respuesta conversacional normal.', busquedaProtocolo: 1 };
    });
    await preguntar('¿Sigue disponible el nuevo subsidio municipal?');
    assert.strictEqual(cuerpoNormal.permitirBusqueda, true, 'decisión semántica sin palabra obligatoria');
    assert.ok(!cuerpoNormal.herramienta, 'el cliente no construye una búsqueda');
    assert.ok(new TextEncoder().encode(cuerpoNormal.mensaje).length <= 5000, 'contrato semántico cabe con schema bajo 8000 TPM');
    assert.strictEqual(ocurrencias(cuerpoNormal.mensaje, '¿Sigue disponible el nuevo subsidio municipal?'), 1, 'pregunta actual exactamente una vez');
    const mensajeSemanticoLargo = construirMensajeWorkerNoMi('Pregunta del usuario: ' + 'á'.repeat(4000), 5000);
    assert.ok(new TextEncoder().encode(mensajeSemanticoLargo).length <= 5000, 'recorte UTF-8 respeta el máximo semántico real');

    // 2) Historial cronológico: un seguimiento conserva tema, lugar y respuesta.
    activarNoMi();
    const cuerpos = [];
    let turno = 0;
    conUso(async (url, opts) => {
        const cuerpo = JSON.parse(opts.body);
        cuerpos.push(cuerpo);
        turno++;
        if (turno === 1) return {
            ok: true,
            respuesta: 'La economía cruceña registró dos novedades relevantes [1].',
            busquedaEstado: 'ok',
            busquedaProtocolo: 1,
            fuentes: [
                { titulo: 'Economía de Santa Cruz', url: 'https://ejemplo.com/economia?utm=x#top', fecha: '2026-09-04' },
                { titulo: 'URL insegura', url: 'javascript:alert(1)', fecha: '' },
            ],
        };
        return {
            ok: true,
            respuesta: 'Sí: estas son las novedades actuales de ese mismo tema [1].',
            busquedaEstado: 'ok',
            busquedaProtocolo: 1,
            fuentes: [{ titulo: 'Actualización económica', url: 'https://ejemplo.com/actual', fecha: '2026-09-04' }],
        };
    });
    await preguntar('Cuéntame qué está ocurriendo con la economía en Santa Cruz');
    await preguntar('esas noticias tienen que ser actuales');
    assert.strictEqual(cuerpos.length, 2, 'una petición cliente por turno');
    assert.ok(cuerpos.every(c => c.permitirBusqueda === true && !c.herramienta));
    const seguimiento = cuerpos[1].mensaje;
    const iTema = seguimiento.indexOf('Cuéntame qué está ocurriendo con la economía en Santa Cruz');
    const iRespuesta = seguimiento.indexOf('La economía cruceña registró dos novedades');
    const iActual = seguimiento.lastIndexOf('esas noticias tienen que ser actuales');
    assert.ok(iTema >= 0 && iRespuesta > iTema && iActual > iRespuesta, 'historial cronológico antes del seguimiento');
    assert.strictEqual(ocurrencias(seguimiento, 'esas noticias tienen que ser actuales'), 1, 'seguimiento actual no duplicado');
    assert.strictEqual(ocurrencias(seguimiento, 'Historial reciente:'), 1, 'cabecera única del historial');
    assert.ok(!JSON.stringify(cuerpos).includes('tvly-') && !JSON.stringify(cuerpos).includes('sk-or'), 'sin claves personales en NoMi');

    const enlaces = document.querySelectorAll('a');
    assert.ok(enlaces.some(a => a.href === 'https://ejemplo.com/economia'), 'fuente normalizada sin query/hash');
    assert.ok(enlaces.some(a => a.href === 'https://ejemplo.com/actual'), 'fuente del seguimiento visible');
    assert.ok(!enlaces.some(a => String(a.href).startsWith('javascript:')), 'URL insegura descartada');
    enlaces.filter(a => a.href.indexOf('ejemplo.com') >= 0).forEach((a) => {
        assert.strictEqual(a.target, '_blank');
        assert.strictEqual(a.rel, 'noopener noreferrer');
    });
    const histFinal = NoMiState.historial[NoMiState.historial.length - 1];
    assert.ok(histFinal.content.includes('https://ejemplo.com/actual'), 'historial conserva respuesta y fuente');
    assert.ok(!histFinal.content.includes('contenido Tavily'), 'sin volcado de evidencia Tavily');

    // 3) Preferencia OFF: chat NoMi normal, sin herramienta ni Tavily local.
    activarNoMi();
    setBusquedaWebNomi(false);
    NoMiState.tavilyKeyActual = 'tvly-user-key-que-no-debe-salir';
    let cuerpoOff = null;
    let llamadasLegado = 0;
    const _buscarWeb = buscarWeb;
    buscarWeb = async () => { llamadasLegado++; return { results: [] }; };
    conUso(async (url, opts) => {
        cuerpoOff = JSON.parse(opts.body);
        return { ok: true, respuesta: 'Respuesta sin búsqueda.' };
    });
    await preguntar('Dime qué cambió recientemente en Bolivia');
    assert.strictEqual(cuerpoOff.permitirBusqueda, false, 'preferencia OFF explícita');
    assert.ok(!cuerpoOff.herramienta);
    assert.strictEqual(llamadasLegado, 0, 'NoMi no usa búsqueda Personal local');
    assert.ok(!JSON.stringify(cuerpoOff).includes('tvly-user-key'));
    buscarWeb = _buscarWeb;

    // 3b) La lupa fuerza búsqueda en NoMi incluso con preferencia OFF, siempre
    // vía Worker y sin tocar Tavily Personal.
    activarNoMi();
    setBusquedaWebNomi(false);
    NoMiState.busquedaForzada = true;
    let cuerpoForzado = null;
    conUso(async (url, opts) => {
        cuerpoForzado = JSON.parse(opts.body);
        return {
            ok: true,
            respuesta: 'Resultado web verificado [1].',
            busquedaEstado: 'ok',
            busquedaProtocolo: 1,
            fuentes: [{ titulo: 'Fuente', url: 'https://fuente.example/noticia' }],
        };
    });
    await preguntar('Comprueba este dato');
    assert.strictEqual(cuerpoForzado.permitirBusqueda, true, 'forzar habilita la herramienta');
    assert.strictEqual(cuerpoForzado.forzarBusqueda, true, 'el Worker recibe la orden explícita');
    assert.strictEqual(NoMiState.busquedaForzada, false, 'la orden se consume una sola vez');

    // 3c) Bundle nuevo + Worker antiguo: no presenta una respuesta sin protocolo
    // como si fuera información actual verificada.
    activarNoMi();
    botMsgs = [];
    const contadorAntesWorkerViejo = NoMiState.contadorPreguntas;
    conUso(async () => ({ ok: true, respuesta: 'Dato actual no verificable del Worker viejo.' }));
    await preguntar('¿Qué cambió hoy en el municipio?');
    assert.ok(botMsgs.some(m => /necesita[n]? actualizar el servidor/.test(m)), 'degradación explícita por versión');
    assert.ok(!botMsgs.some(m => m.includes('Dato actual no verificable')), 'no muestra el dato no verificable');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'actualizar Worker no es un fallo reintentable');
    assert.strictEqual(NoMiState.contadorPreguntas, contadorAntesWorkerViejo, 'una respuesta no verificable no cuenta como atendida');

    // 4) La lupa es una orden explícita de búsqueda: deshabilita clima solo en
    // ese envío; el cliente nunca extrae ciudad ni construye herramienta clima.
    activarNoMi();
    NoMiState.busquedaForzada = true;
    let cuerpoClima = null;
    conUso(async (url, opts) => {
        cuerpoClima = JSON.parse(opts.body);
        return { ok: true, respuesta: 'Información web verificada [1].', busquedaEstado: 'ok', busquedaProtocolo: 1, herramientasProtocolo: 1, fuentes: [] };
    });
    await preguntar('busca el clima en La Paz hoy');
    assert.strictEqual(cuerpoClima.herramienta, undefined);
    assert.strictEqual(cuerpoClima.forzarBusqueda, true);
    assert.strictEqual(cuerpoClima.permitirClima, false);
    assert.strictEqual(NoMiState.busquedaForzada, false, 'la lupa no se filtra a la pregunta posterior si clima gana');

    // 5) Fallo Tavily es reintentable; estados definitivos no lo son.
    activarNoMi();
    setBusquedaWebNomi(false);
    NoMiState.busquedaForzada = true;
    responder = async () => ({ ok: true, respuesta: 'No se pudo consultar la web ahora. Reintenta.', busquedaEstado: 'fallo_proveedor', busquedaProtocolo: 1 });
    botMsgs = [];
    const antesFallo = NoMiState.contadorPreguntas;
    await preguntar('¿Qué ocurrió con esa medida?');
    assert.ok(botMsgs.some(m => m.includes('No se pudo consultar la web')));
    assert.strictEqual(NoMiState.reintentarPregunta, '¿Qué ocurrió con esa medida?');
    assert.deepStrictEqual(NoMiState.historial.slice(-2), [
        { role: 'user', content: '¿Qué ocurrió con esa medida?' },
        { role: 'assistant', content: 'No se pudo consultar la web ahora. Reintenta.' },
    ], 'el fallo visible queda en historial para permitir preguntas de seguimiento');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion');
    assert.strictEqual(NoMiState.contadorPreguntas, antesFallo);
    assert.strictEqual(NoMiState.reintentarBusquedaForzada, true, 'Tavily falló: el reintento no vuelve a decidir');
    let cuerpoReintento = null;
    conUso(async (url, opts) => {
        cuerpoReintento = JSON.parse(opts.body);
        return { ok: true, respuesta: 'Reintento completado.', busquedaProtocolo: 1 };
    });
    actualizarBotonAccionHud();
    await document.getElementById('nomi-hud-accion').onclick();
    assert.strictEqual(cuerpoReintento.forzarBusqueda, true, 'el HUD reintenta obligando la búsqueda');
    assert.strictEqual((cuerpoReintento.mensaje.match(/¿Qué ocurrió con esa medida\?/g) || []).length, 1, 'el reintento no duplica la pregunta fallida');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'éxito limpia reintento');

    activarNoMi();
    responder = async () => ({ ok: true, respuesta: 'Encontré fuentes, pero no pude preparar la respuesta. Reintenta.', busquedaEstado: 'fallo_sintesis', busquedaProtocolo: 1 });
    await preguntar('¿Qué ocurrió con las noticias de Santa Cruz?');
    let cuerpoSeguimiento = null;
    conUso(async (url, opts) => {
        cuerpoSeguimiento = JSON.parse(opts.body);
        return { ok: true, respuesta: 'Se refiere al fallo de la respuesta anterior.', busquedaProtocolo: 1 };
    });
    await preguntar('¿Por qué?');
    assert.match(cuerpoSeguimiento.mensaje, /Encontré fuentes, pero no pude preparar la respuesta/, 'el seguimiento recibe el motivo anterior');
    assert.match(cuerpoSeguimiento.mensaje, /Pregunta del usuario: ¿Por qué\?/, 'la pregunta de seguimiento se conserva');

    activarNoMi();
    responder = async () => ({
        ok: true,
        respuesta: 'Encontré fuentes, pero no pude preparar la respuesta. Reintenta.',
        busquedaEstado: 'fallo_sintesis',
        busquedaProtocolo: 1,
    });
    botMsgs = [];
    const antesSintesis = NoMiState.contadorPreguntas;
    await preguntar('continúa con las noticias anteriores');
    assert.ok(botMsgs.some(m => m.includes('no pude preparar la respuesta')));
    assert.strictEqual(NoMiState.reintentarBusquedaForzada, true, 'fallo de síntesis reintenta sin perder la búsqueda');
    assert.strictEqual(NoMiState.contadorPreguntas, antesSintesis, 'fallo de síntesis no cuenta como respuesta atendida');

    for (const caso of [
        { estado: 'limite_diario', texto: 'Has superado el límite de búsquedas web por hoy (20).' },
        { estado: 'sin_resultados', texto: 'No encontré fuentes útiles para responder.' },
        { estado: 'consulta_invalida', texto: 'No pude preparar una búsqueda web segura.' },
    ]) {
        activarNoMi();
        const contadorAntesEstado = NoMiState.contadorPreguntas;
        conUso(async () => ({ ok: true, respuesta: caso.texto, busquedaEstado: caso.estado, busquedaProtocolo: 1 }));
        botMsgs = [];
        await preguntar('consulta de control');
        assert.ok(botMsgs.some(m => m.includes(caso.texto)));
        assert.strictEqual(NoMiState.reintentarPregunta, '', caso.estado + ': sin reintento');
        const debeContar = caso.estado === 'limite_diario' || caso.estado === 'sin_resultados';
        assert.strictEqual(NoMiState.contadorPreguntas, contadorAntesEstado + (debeContar ? 1 : 0), caso.estado + ': contador coherente');
    }

    // 6) Un fallo de red conserva el manejo general del HUD NoMi.
    activarNoMi();
    responder = async () => { throw new Error('red caída'); };
    botMsgs = [];
    await preguntar('continúa con el tema');
    assert.ok(botMsgs.some(m => m.includes('Reintentar')));
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion');

    // 7) Personal/OpenRouter queda intacto y conserva su Tavily local.
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.apiKeyActual = 'sk-or-test';
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1';
    NoMiState.credencialesCargadas = true;
    NoMiState.tavilyKeyActual = 'tvly-user-key';
    NoMiState.motorBusqueda = 'tavily';
    NoMiState.busquedaWebActiva = false;
    NoMiState.historial = [];
    NoMiState.isWaiting = false;
    NoMiState.reintentarPregunta = '';
    let llamadasBuscarWeb = 0;
    let llamadasPersonal = 0;
    let llamadasWorker = 0;
    const _buscarWebPersonal = buscarWeb;
    buscarWeb = async () => { llamadasBuscarWeb++; return { results: [{ title: 'T', content: 'C', url: 'https://personal.example/x' }] }; };
    responder = async (url) => {
        if (url.includes('/chat/completions')) { llamadasPersonal++; return { choices: [{ message: { content: 'resp personal' } }] }; }
        if (url.includes('/v1/chat')) { llamadasWorker++; throw new Error('NoMi Worker no debe intervenir'); }
        throw new Error('URL Personal inesperada: ' + url);
    };
    await preguntar('busca datos de tiwanaku');
    assert.strictEqual(llamadasBuscarWeb, 1, 'Personal usa Tavily local');
    assert.strictEqual(llamadasPersonal, 1, 'Personal sintetiza con su API');
    assert.strictEqual(llamadasWorker, 0, 'sin Worker NoMi en Personal');
    buscarWeb = _buscarWebPersonal;

    agregarMensaje = _agregar;
    console.log('OK: todas las pruebas de búsqueda web semántica NoMi (cliente) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const combinado = fuentes.join('\n') + '\n' + `
let responder = async (url, opts) => { throw new Error('no hay mock para ' + url); };
hacerPeticion = async (url, opts) => {
    const datos = await responder(url, opts);
    // Los fixtures de búsqueda anteriores al contrato climático representan al
    // Worker actual; completa únicamente la señal común para evitar repetirla.
    if (datos && datos.busquedaProtocolo === 1 && datos.herramientasProtocolo === undefined) datos.herramientasProtocolo = 1;
    return datos;
};
` + pruebas;

vm.runInContext(combinado, ctx, { filename: 'nomi-busqueda-test.js' });

// Auditoría estática del bundle distribuible.
const bundle = fs.readFileSync(path.join(ROOT, 'NoMi Asistente V5.8.user.js'), 'utf8');
assert.ok(/@connect\s+api\.tavily\.com/.test(bundle), '@connect Tavily preserva la búsqueda Personal');
assert.ok(/@connect\s+nomi-api-worker\./.test(bundle), '@connect del Worker NoMi presente');
assert.ok(!/TAVILY_API_KEY/.test(bundle), 'el bundle nunca contiene TAVILY_API_KEY');
assert.ok(!/function detectarBusquedaNoMi/.test(bundle), 'bundle sin detector léxico NoMi');
assert.ok(/permitirBusqueda/.test(bundle), 'bundle incluye el contrato semántico');
assert.ok(/forzarBusqueda/.test(bundle), 'bundle conserva la lupa como búsqueda obligatoria vía Worker');
assert.ok(/herramientasProtocolo/.test(bundle), 'bundle detecta versiones antiguas del Worker para búsqueda y clima');
assert.ok(/su asistente virtual\./.test(bundle), 'saludo inicial femenino');
assert.ok(/Estoy dise[ñn]ada/.test(bundle), 'identidad femenina preservada');
console.log('OK: cabecera y bundle verificados (sin secretos, identidad femenina, búsqueda semántica)');
