// Pruebas de cliente del bloque de búsqueda web NoMi (Tavily SOLO vía Worker).
// Cubre: detector conservador (comandos siempre; auto-detección temporal
// inequívoca), prioridad del clima, envío de herramienta 'busqueda' sin
// credenciales personales ni clave Tavily local, preferencia desactivada,
// Personal intacto, Worker antiguo (actualización requerida sin crash ni
// fallback), reintento único en fallo_proveedor/red y render seguro de fuentes.
// Ejecutar:
//   node modules/test/run-nomi-busqueda.cjs

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
        setNomiToken('TOK456');
        setNomiAccesoActivo(true);
        NoMiState.modoAcceso = MODO_ACCESO_NOMI;
        NoMiState.nomiToken = 'TOK456';
        NoMiState.nomiAccesoActivo = true;
        NoMiState.isWaiting = false;
        NoMiState.historial = [];
        NoMiState.reintentarPregunta = '';
        NoMiState.busquedaWebActiva = false;
        NoMiState.busquedaWebNomi = getBusquedaWebNomi();
    }

    // ===== 1) Detector conservador (unidad) =====
    assert.strictEqual(detectarBusquedaNoMi('busca precio del dolar en Bolivia'), 'precio del dolar en Bolivia', 'comando busca');
    assert.strictEqual(detectarBusquedaNoMi('Buscar: historia de Tiwanaku'), 'historia de Tiwanaku', 'comando con dos puntos');
    assert.strictEqual(detectarBusquedaNoMi('investiga las causas de la revolucion'), 'las causas de la revolucion', 'comando investiga');
    assert.strictEqual(detectarBusquedaNoMi('noticias de Santa Cruz hoy'), 'noticias de Santa Cruz hoy', 'auto: noticias + lugar');
    assert.strictEqual(detectarBusquedaNoMi('ultimas noticias'), 'ultimas noticias', 'auto: ultimas noticias');
    assert.strictEqual(detectarBusquedaNoMi('quien gano el partido ayer'), 'quien gano el partido ayer', 'auto: ganador + recencia');
    // Falsos positivos obligatorios (palabras genéricas aisladas NO activan).
    assert.strictEqual(detectarBusquedaNoMi('me gustan las noticias antiguas'), null, 'FP: noticias suelta');
    assert.strictEqual(detectarBusquedaNoMi('el precio de la casa era alto'), null, 'FP: precio suelto');
    assert.strictEqual(detectarBusquedaNoMi('cuentame un chiste'), null, 'FP: sin intención');
    assert.strictEqual(detectarBusquedaNoMi('que tiempo hara manana'), null, 'FP: eso es clima, no búsqueda');
    assert.strictEqual(detectarBusquedaNoMi('busca'), null, 'FP: comando sin consulta');
    assert.strictEqual(detectarBusquedaNoMi(''), null, 'vacío -> null');

    // ===== 2) Clima tiene prioridad sobre búsqueda general =====
    assert.strictEqual(detectarClimaNoMi('busca el clima en La Paz'), 'La Paz', 'clima detectado aunque haya comando');

    // ===== 3) Comando busca → ruta búsqueda NoMi (sin credenciales personales) =====
    activarNoMi();
    let cuerpoBusq = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) {
            cuerpoBusq = JSON.parse(opts.body);
            return { ok: true, busquedaEstado: 'ok', resultados: [
                { titulo: 'Fuente Confiable', url: 'https://ejemplo.com/a', contenido: 'Dato útil uno.' },
                { titulo: 'Otra Fuente', url: 'https://ejemplo.com/b', contenido: 'Dato útil dos.' },
            ] };
        }
        throw new Error('inesperado en test 3: ' + url);
    };
    botMsgs = [];
    const contAntes = NoMiState.contadorPreguntas;
    await preguntar('busca datos de Tiwanaku');
    assert.ok(cuerpoBusq && cuerpoBusq.herramienta && cuerpoBusq.herramienta.tipo === 'busqueda', 'envía herramienta busqueda al Worker');
    assert.strictEqual(cuerpoBusq.herramienta.consulta, 'datos de Tiwanaku', 'consulta extraída del comando');
    const cuerpoSerializado = JSON.stringify(cuerpoBusq);
    assert.ok(!cuerpoSerializado.includes('tvly-') && !cuerpoSerializado.includes('tavilyKeyActual'), 'NO expone clave Tavily del usuario');
    assert.ok(!cuerpoSerializado.includes('sk-or'), 'sin claves de API Personal');
    assert.strictEqual(NoMiState.contadorPreguntas, contAntes + 1, 'cuenta la pregunta atendida');
    const enlaces = document.querySelectorAll('a').filter((a) => a.href && a.href.indexOf('https://ejemplo.com') === 0);
    assert.ok(enlaces.length >= 2, 'renderiza enlaces de fuentes: ' + enlaces.length);
    enlaces.forEach((a) => {
        assert.strictEqual(a.target, '_blank', 'target=_blank');
        assert.strictEqual(a.rel, 'noopener noreferrer', 'rel=noopener noreferrer');
        assert.ok(/^https?:\\/\\//.test(a.href), 'enlace solo http/https');
    });
    const ultimoHist = NoMiState.historial[NoMiState.historial.length - 1];
    assert.ok(ultimoHist.role === 'assistant' && ultimoHist.content.includes('https://ejemplo.com/a'), 'historial conserva fuentes en texto plano');

    // ===== 3b) P2-5: cliente re-valida URLs con new URL (sin query/hash) =====
    activarNoMi();
    responder = async () => ({ ok: true, busquedaEstado: 'ok', resultados: [
        { titulo: 'Con query', url: 'https://limpia.test/p?utm_source=x#seccion', contenido: 'contenido' },
        { titulo: 'Maliciosa', url: 'javascript:alert(1)', contenido: 'contenido' },
    ] });
    botMsgs = [];
    await preguntar('busca verificacion urls');
    const enlaces3b = document.querySelectorAll('a');
    assert.strictEqual(enlaces3b.filter((a) => a.href === 'https://limpia.test/p').length, 1, 'URL normalizada sin query/hash');
    assert.ok(!enlaces3b.some((a) => String(a.href).indexOf('javascript:') === 0), 'sin enlaces javascript:');

    // ===== 4) P1-1: NoMi con búsqueda desactivada NUNCA cae al flujo legado =====
    // motorBusqueda=tavily + clave local realista: buscarWeb debe ser 0 y el
    // chat normal del Worker 1, para comando, auto-detección y busquedaForzada.
    activarNoMi();
    NoMiState.motorBusqueda = 'tavily';
    NoMiState.tavilyKeyActual = 'tvly-user-key-abc123';
    setBusquedaWebNomi(false);
    let llamadasBuscarWebLegado = 0, llamadasChatNormal = 0, cuerpoLegado = null;
    const _buscarWebLegado = buscarWeb;
    buscarWeb = async () => { llamadasBuscarWebLegado++; return { results: [] }; };
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasChatNormal++; cuerpoLegado = JSON.parse(opts.body); return { ok: true, respuesta: 'respuesta normal NoMi' }; }
        if (url.includes('api.tavily.com')) { llamadasBuscarWebLegado++; return { results: [] }; }
        throw new Error('inesperado en test 4: ' + url);
    };
    botMsgs = [];
    await preguntar('busca datos de Tiwanaku');
    assert.strictEqual(llamadasBuscarWebLegado, 0, 'P1-1 comando: buscarWeb/Tavily local = 0');
    assert.strictEqual(llamadasChatNormal, 1, 'P1-1 comando: chat Worker normal = 1');
    assert.ok(cuerpoLegado && !cuerpoLegado.herramienta, 'P1-1 comando: sin herramienta');
    botMsgs = []; llamadasChatNormal = 0; cuerpoLegado = null;
    await preguntar('noticias de Santa Cruz hoy');
    assert.strictEqual(llamadasBuscarWebLegado, 0, 'P1-1 auto-detección: buscarWeb = 0');
    assert.strictEqual(llamadasChatNormal, 1, 'P1-1 auto-detección: chat normal = 1');
    NoMiState.busquedaForzada = true;
    botMsgs = []; llamadasChatNormal = 0; cuerpoLegado = null;
    await preguntar('dime lo que sea');
    assert.strictEqual(llamadasBuscarWebLegado, 0, 'P1-1 busquedaForzada: buscarWeb = 0');
    assert.strictEqual(llamadasChatNormal, 1, 'P1-1 busquedaForzada: chat normal = 1');
    assert.strictEqual(NoMiState.busquedaForzada, false, 'busquedaForzada se consume (no se fuga a Personal)');
    buscarWeb = _buscarWebLegado;
    setBusquedaWebNomi(true);

    // ===== 5) Clima prioritario aunque empiece con comando de búsqueda =====
    activarNoMi();
    let cuerpoClimaPrio = null;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { cuerpoClimaPrio = JSON.parse(opts.body); return { ok: true, respuesta: 'Clima en La Paz: 12°C.', climaEstado: 'ok' }; }
        throw new Error('inesperado en test 5: ' + url);
    };
    botMsgs = [];
    await preguntar('busca el clima en La Paz');
    assert.ok(cuerpoClimaPrio && cuerpoClimaPrio.herramienta && cuerpoClimaPrio.herramienta.tipo === 'clima', 'clima gana a búsqueda general');

    // ===== 6) Worker antiguo (400) → mensaje claro, sin crash ni fallback =====
    activarNoMi();
    responder = async () => {
        const e = new Error('Error 400: parametros-invalidos');
        e.status = 400;
        throw e;
    };
    botMsgs = [];
    await preguntar('busca novedades del servidor');
    assert.ok(botMsgs.some((m) => m.includes('actualización del servidor')), 'mensaje claro de actualización requerida');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'no ofrece reintento contra Worker antiguo');

    // ===== 6b) P1-2: 400 distinguido por código estable del cuerpo JSON =====
    activarNoMi();
    // a) Pre-validación local: consulta inválida NUNCA viaja al Worker.
    let llamadasRed6b = 0;
    responder = async () => { llamadasRed6b++; throw new Error('no debe llamarse'); };
    botMsgs = [];
    const res6b = await llamarBusquedaNoMi('x');
    assert.strictEqual(res6b.estado, 'consulta_invalida', 'pre-validación local: consulta inválida');
    assert.ok(res6b.texto.includes('no es válida'), 'mensaje humano de validación');
    assert.strictEqual(llamadasRed6b, 0, 'consulta inválida: sin red');
    // b) 400 del Worker ACTUAL (consulta-busqueda-invalida): validación, no actualización.
    responder = async () => {
        const e = new Error('Error 400: {"error":"consulta-busqueda-invalida","mensaje":"Indica qué buscar"}');
        e.status = 400;
        throw e;
    };
    botMsgs = [];
    await preguntar('busca yy');
    assert.ok(botMsgs.some((m) => m.includes('no es válida')), '400 consulta-busqueda-invalida: mensaje de validación');
    assert.ok(!botMsgs.some((m) => m.includes('actualización')), 'sin falso aviso de actualización');
    assert.strictEqual(NoMiState.reintentarPregunta, '', '400 validación: sin reintento');
    // c) 400 del Worker ANTIGUO (parametros-invalidos): actualización requerida.
    responder = async () => {
        const e = new Error('Error 400: {"error":"parametros-invalidos","mensaje":"Herramienta no soportada."}');
        e.status = 400;
        throw e;
    };
    botMsgs = [];
    await preguntar('busca zz');
    assert.ok(botMsgs.some((m) => m.includes('actualización del servidor')), '400 antiguo: aviso de actualización');

    // ===== 7) fallo_proveedor: mensaje humano, HUD y Reintentar (reintento único) =====
    activarNoMi();
    responder = async () => ({ ok: true, respuesta: 'No se pudo realizar la búsqueda ahora. Reintenta.', busquedaEstado: 'fallo_proveedor' });
    botMsgs = [];
    const contProv = NoMiState.contadorPreguntas;
    await preguntar('busca resultados de la eleccion');
    assert.ok(botMsgs.some((m) => m.includes('No se pudo realizar la búsqueda')), 'conserva el mensaje humano del Worker');
    assert.strictEqual(NoMiState.reintentarPregunta, 'busca resultados de la eleccion', 'guarda la pregunta para Reintentar');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'HUD sin_conexion en fallo_proveedor');
    assert.strictEqual(NoMiState.contadorPreguntas, contProv, 'no cuenta pregunta fallida');
    // Reintento único exitoso (botón Reintentar reenvía la misma pregunta).
    responder = async () => ({ ok: true, busquedaEstado: 'ok', resultados: [{ titulo: 'OK', url: 'https://ok.test/x', contenido: 'bien' }] });
    botMsgs = [];
    await preguntar(NoMiState.reintentarPregunta);
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'el éxito limpia reintentarPregunta');

    // ===== 8) Red caída: mismo tratamiento blando que clima =====
    activarNoMi();
    responder = async () => { throw new Error('red caída'); };
    botMsgs = [];
    await preguntar('noticias de Cochabamba esta semana');
    assert.ok(botMsgs.some((m) => m.includes('Reintentar')), 'mensaje humano de conexión');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'HUD refleja red caída');

    // ===== 9) Personal/OpenRouter intacto: su Tavily local y su flujo no cambian =====
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.apiKeyActual = 'sk-or-test';
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1';
    NoMiState.credencialesCargadas = true;
    NoMiState.tavilyKeyActual = 'tvly-user-key';
    NoMiState.motorBusqueda = 'tavily';
    NoMiState.busquedaWebActiva = false;
    NoMiState.historial = []; NoMiState.isWaiting = false; NoMiState.reintentarPregunta = '';
    let llamadasBuscarWeb = 0, llamadasPersonal = 0, llamadasLlamarBusq = 0;
    const _buscarWeb = buscarWeb;
    buscarWeb = async () => { llamadasBuscarWeb++; return { results: [{ title: 'T', content: 'C', url: 'https://personal.example/x' }] }; };
    const _llamarBusq = llamarBusquedaNoMi;
    llamarBusquedaNoMi = async (c) => { llamadasLlamarBusq++; return _llamarBusq(c); };
    responder = async (url) => {
        if (url.includes('/chat/completions')) { llamadasPersonal++; return { choices: [{ message: { content: 'resp personal' } }] }; }
        throw new Error('Personal no debe llamar al Worker: ' + url);
    };
    await preguntar('busca datos de tiwanaku');
    assert.strictEqual(llamadasBuscarWeb, 1, 'Personal usa SU Tavily local (clave tvly-user-key)');
    assert.strictEqual(llamadasPersonal, 1, 'Personal resume con SU API');
    assert.strictEqual(llamadasLlamarBusq, 0, 'la ruta búsqueda NoMi NO interviene en Personal');
    buscarWeb = _buscarWeb;
    llamarBusquedaNoMi = _llamarBusq;

    // ===== 10) límite_diario y sin_resultados pintan su mensaje sin reintento =====
    activarNoMi();
    responder = async () => ({ ok: true, respuesta: 'Has superado el límite de búsquedas web por hoy (20). Inténtalo mañana.', busquedaEstado: 'limite_diario' });
    botMsgs = [];
    await preguntar('busca algo mas');
    assert.ok(botMsgs.some((m) => m.includes('límite de búsquedas')), 'limite_diario informado');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'limite_diario no ofrece reintento');
    responder = async () => ({ ok: true, respuesta: 'No encontré resultados útiles para esa búsqueda. Prueba con otros términos.', busquedaEstado: 'sin_resultados' });
    botMsgs = [];
    await preguntar('busca otra cosa rara xyz');
    assert.ok(botMsgs.some((m) => m.includes('No encontré resultados')), 'sin_resultados informado');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'sin_resultados no ofrece reintento');

    agregarMensaje = _agregar;
    console.log('OK: todas las pruebas de búsqueda web NoMi (cliente) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const combinado = fuentes.join('\n') + '\n' + `
let responder = async (url, opts) => { throw new Error('no hay mock para ' + url); };
hacerPeticion = async (url, opts) => { return await responder(url, opts); };
` + pruebas;

vm.runInContext(combinado, ctx, { filename: 'nomi-busqueda-test.js' });

// ===== Auditoría de cabecera del bundle (P2-6) =====
const bundle = fs.readFileSync(path.join(ROOT, 'NoMi Asistente V5.8.user.js'), 'utf8');
assert.ok(/@connect\s+api\.tavily\.com/.test(bundle), '@connect api.tavily.com presente (preserva búsqueda Personal directa en TM/VM)');
assert.ok(/@connect\s+nomi-api-worker\./.test(bundle), '@connect del Worker NoMi presente');
assert.ok(!/TAVILY_API_KEY/.test(bundle), 'el bundle NUNCA contiene TAVILY_API_KEY');
console.log('OK: cabecera del bundle verificada (@connect api.tavily.com, sin secretos)');
