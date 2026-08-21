// Pruebas de DOM simulado para la corrección CSP/Trusted Types de la UI.
// Verifica que los constructores de ventana, mensajes, menú y diálogos usan
// createElement/textContent (sin sinks HTML ejecutables) y preservan IDs/claves.
// Ejecutar: node modules/test/run-nomi-ui.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const MOD = path.join(ROOT, 'modules');

function leer(nombre) { return fs.readFileSync(path.join(MOD, nombre), 'utf8'); }

// ---- DOM simulado mínimo pero funcional ----
function makeEl(tag) {
    const el = {
        tagName: (tag || '').toUpperCase(),
        nodeType: 1,
        id: '',
        className: '',
        children: [],
        parentNode: null,
        style: {},
        attributes: {},
        _text: '',
        value: '',
        checked: false,
        selected: false,
        disabled: false,
        dataset: {},
        onclick: null,
        onchange: null,
        title: '',
        _listeners: {},
    };
    el.appendChild = (c) => { c.parentNode = el; el.children.push(c); return c; };
    Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
    el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; };
    el.prepend = (c) => { c.parentNode = el; el.children.unshift(c); return c; };
    el.insertBefore = (c, ref) => { c.parentNode = el; const i = el.children.indexOf(ref); if (i < 0) el.children.push(c); else el.children.splice(i, 0, c); return c; };
    el.remove = () => { if (el.parentNode) { const i = el.parentNode.children.indexOf(el); if (i >= 0) el.parentNode.children.splice(i, 1); el.parentNode = null; } };
    el.setAttribute = (k, v) => { el.attributes[k] = String(v); if (k === 'id') el.id = String(v); if (k.startsWith('data-')) el.dataset[k.slice(5)] = String(v); };
    el.getAttribute = (k) => (k in el.attributes ? el.attributes[k] : null);
    Object.defineProperty(el, 'textContent', {
        get() { return el._text; },
        set(v) { el._text = String(v); el.children = []; },
    });
    Object.defineProperty(el, 'options', {
        get() { return el.children.filter(c => c.tagName === 'OPTION'); },
    });
    Object.defineProperty(el, 'value', {
        get() {
            const sel = el.children.find(c => c.tagName === 'OPTION' && c.selected);
            if (sel) return sel.value;
            return el._value !== undefined ? el._value : '';
        },
        set(v) { el._value = String(v); },
    });
    el.addEventListener = (type, fn) => { (el._listeners[type] = el._listeners[type] || []).push(fn); };
    el.removeEventListener = () => {};
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
                walk(c);
                if (firstOnly && out.length) return;
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
    let m = sel.match(/^([a-zA-Z0-9]+)?\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/);
    if (m) {
        const tagOk = !m[1] || node.tagName === m[1].toUpperCase();
        return tagOk && node.getAttribute(m[2]) === m[3];
    }
    return node.tagName === sel.toUpperCase();
}

const documento = {
    body: makeEl('body'),
    createElement: (t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, _text: String(t), get textContent() { return this._text; }, set textContent(v) { this._text = String(v); } }),
    getElementById: (id) => buscar(documento.body, '#' + id, true),
    addEventListener: () => {},
    querySelector: (sel) => buscar(documento.body, sel, true),
    querySelectorAll: (sel) => buscar(documento.body, sel, false),
};

// ---- Stubs de navegador y helpers no cubiertos por los módulos cargados ----
const memLocal = new Map();
const store = new Map();
const ctx = {
    console, assert,
    document: documento,
    location: { href: 'https://example.com', hostname: 'example.com', reload() {} },
    localStorage: {
        getItem: (k) => (memLocal.has(k) ? memLocal.get(k) : null),
        setItem: (k, v) => memLocal.set(k, String(v)),
        removeItem: (k) => memLocal.delete(k),
        get keysArr() { return [...memLocal.keys()]; },
    },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => store.set(k, v),
    GM_deleteValue: (k) => store.delete(k),
    window: null,
    confirm: () => true,
    alert: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextEncoder, TextDecoder,
};
ctx.window = ctx;
ctx.document = documento;
ctx.limpiarBody = () => { documento.body = makeEl('body'); };
// Tamaños y helpers básicos
ctx.obtenerTamanoReal = () => ({ w: 400, h: 600 });
ctx.calcularEspacioOcupado = () => 1234;
ctx.getPageKey = () => 'test';
ctx.estadoAccesoNoMi = () => 'desactivado';
// Credenciales/estado (lecturas)
ctx.getCredencialesCargadas = () => false;
ctx.getApiKey = () => '';
ctx.getTavilyKey = () => '';
ctx.getModelo = () => 'meta-llama/llama-3.1-8b-instruct:free';
ctx.getUrlBase = () => 'https://openrouter.ai/api/v1';
ctx.getMotorBusqueda = () => 'tavily';
ctx.getDiagnosticoActivo = () => false;
ctx.getNomiModelo = () => 'openai/gpt-oss-20b';
ctx.getNomiToken = () => 'TOK';
// Setters / acciones (no-ops)
['setModoAcceso','setModelo','setMotorBusqueda','setDiagnosticoActivo','setModoLigero','setModoResumen','setBusquedaWeb','setContexto','setUbicacionActivada','setTamanoVentana','setValidado','actualizarBarraUbicacion','actualizarIndicador','mostrarEstadisticas','mostrarExportacion','mostrarMenu','importarCredenciales','guardarCredencialesManual','cargarModelosAlMenu','cargarModelosNoMiAlMenu','cargarModelosAsistente','activarAccesoNoMi','cerrarAccesoNoMi','limpiarHistorialesAntiguos','exportarLogs','exportarChat','actualizarUbicacion','limpiarAvisoModelo'].forEach((n) => { ctx[n] = () => {}; });
ctx.fetchFreeModelos = async () => [];
ctx.obtenerCatalogoNoMi = async () => ({ modelos: [] });
vm.createContext(ctx);

// ---- Carga de módulos (config/state/utilities/persistencia/logging/chat + UI) ----
const fuentes = [
    leer('nomi-config-estatica.js'),
    leer('nomi-state.js'),
    leer('nomi-utilities.js'),
    leer('nomi-persistencia.js'),
    leer('nomi-logging.js'),
    leer('nomi-chat.js'),
    leer('nomi-ui.js'),
    leer('nomi-asistente-config.js'),
    leer('nomi-menu-config.js'),
    leer('nomi-estadisticas.js'),
];

const pruebas = `
(async () => {
    // 1) crearVentanaChat construye la ventana con todos los IDs requeridos.
    limpiarBody();
    crearVentanaChat();
    const win = document.getElementById('nomi-chat');
    assert.ok(win, 'debe existir #nomi-chat');
    assert.ok(document.getElementById('nomi-chat-body'), 'falta #nomi-chat-body');
    assert.ok(document.getElementById('nomi-input'), 'falta #nomi-input');
    assert.ok(document.getElementById('nomi-enviar'), 'falta #nomi-enviar');
    assert.ok(document.getElementById('nomi-menu-btn'), 'falta #nomi-menu-btn');
    assert.ok(document.getElementById('nomi-stats-btn'), 'falta #nomi-stats-btn');
    assert.ok(document.getElementById('nomi-export-btn'), 'falta #nomi-export-btn');
    assert.ok(document.getElementById('nomi-web-btn'), 'falta #nomi-web-btn');
    assert.ok(document.getElementById('nomi-token-counter'), 'falta #nomi-token-counter');
    assert.ok(document.getElementById('nomi-ubicacion-display'), 'falta #nomi-ubicacion-display');
    assert.ok(document.getElementById('nomi-modelo-display'), 'falta #nomi-modelo-display');
    assert.ok(document.getElementById('nomi-proveedor-display'), 'falta #nomi-proveedor-display');
    // El texto del modelo se renderiza (antes venía en innerHTML).
    assert.strictEqual(document.getElementById('nomi-modelo-display').textContent, NoMiState.modeloActual, 'modelo-display debe mostrar el modelo actual');

    // 2) agregarMensaje renderiza como texto (sin HTML) y conserva nombre en <b>.
    const body = document.getElementById('nomi-chat-body');
    body.children = [];
    agregarMensaje('yo', 'Hola <script>alert(1)</script>');
    const ultimo = body.children[body.children.length - 1];
    assert.ok(ultimo, 'debe agregar un mensaje');
    const b = ultimo.querySelector('b');
    assert.ok(b, 'el mensaje debe tener un <b> con el nombre');
    assert.strictEqual(b.textContent, 'Tú:', 'el <b> debe decir Tú:');
    // El contenido peligroso NO debe interpretarse como HTML: no se crea <script>.
    assert.strictEqual(ultimo.querySelector('script'), null, 'no debe crear un elemento <script> desde el texto del usuario');
    const textoPlano = ultimo.children.map(c => c.nodeType === 3 ? c.textContent : (c.textContent || '')).join('');
    assert.ok(textoPlano.includes('Hola <script>alert(1)</script>'), 'el texto del usuario debe quedar literal (sin ejecutar)');

    // 3) cargarHistorial limpia y repuebla con createElement.
    NoMiState.historial = [
        { role: 'user', content: 'Pregunta de prueba' },
        { role: 'assistant', content: 'Respuesta de prueba' },
    ];
    const bodyHist = document.getElementById('nomi-chat-body');
    bodyHist.children = [];
    cargarHistorial();
    const hijos = document.getElementById('nomi-chat-body').children;
    assert.strictEqual(hijos.length, 2, 'debe pintar 2 mensajes del historial');
    assert.ok(hijos[0].querySelector('b').textContent === 'Tú:', 'primer mensaje es del usuario');
    assert.ok(hijos[1].querySelector('b').textContent === NOMBRE_ASISTENTE + ':', 'segundo mensaje es del asistente');

    // 4) mostrarMenu construye el menú completo con IDs y radios de contexto.
    limpiarBody();
    mostrarMenu();
    assert.ok(document.getElementById('nomi-menu'), 'falta #nomi-menu');
    assert.ok(document.getElementById('nomi-input-openrouter'), 'falta input openrouter');
    assert.ok(document.getElementById('nomi-input-tavily'), 'falta input tavily');
    assert.ok(document.getElementById('nomi-input-modelo'), 'falta select modelo');
    assert.ok(document.getElementById('nomi-select-motor'), 'falta select motor');
    assert.ok(document.getElementById('nomi-select-modo'), 'falta select modo');
    assert.ok(document.getElementById('nomi-check-ubicacion'), 'falta check ubicacion');
    assert.ok(document.getElementById('nomi-check-ligero'), 'falta check ligero');
    assert.ok(document.getElementById('nomi-check-resumen'), 'falta check resumen');
    assert.ok(document.getElementById('nomi-check-busqueda'), 'falta check busqueda');
    assert.ok(document.getElementById('nomi-check-diagnostico'), 'falta check diagnostico');
    assert.ok(document.getElementById('nomi-width-input'), 'falta width');
    assert.ok(document.getElementById('nomi-height-input'), 'falta height');
    assert.ok(document.getElementById('nomi-menu-eliminar-global'), 'falta boton eliminar global');
    assert.ok(document.getElementById('nomi-menu-cerrar'), 'falta boton cerrar');
    const radios = document.querySelectorAll('input[name="contexto"]');
    assert.strictEqual(radios.length, CONTEXTOS_DISPONIBLES.length, 'debe haber un radio por contexto disponible');
    assert.ok(document.getElementById('nomi-seccion-worker'), 'falta seccion worker');

    // 5) Diálogo "Eliminar datos globales": checkboxes con IDs nomi-del-N y marcados.
    limpiarBody();
    mostrarMenu();
    document.getElementById('nomi-menu-eliminar-global').onclick();
    const dialog = document.getElementById('nomi-dialog-global');
    assert.ok(dialog, 'debe crear #nomi-dialog-global');
    assert.ok(document.getElementById('nomi-dialog-confirmar'), 'falta confirmar');
    assert.ok(document.getElementById('nomi-dialog-cancelar'), 'falta cancelar');
    for (let i = 0; i < 6; i++) {
        const chk = document.getElementById('nomi-del-' + i);
        assert.ok(chk, 'falta checkbox nomi-del-' + i);
        assert.strictEqual(chk.checked, true, 'nomi-del-' + i + ' debe estar marcado');
    }

    // 6) mostrarEstadisticas y mostrarExportacion usan createElement.
    limpiarBody();
    NoMiState.contadorPreguntas = 3;
    NoMiState.tokens = { total: 100, input: 40, output: 60 };
    NoMiState.historial = [{ role: 'user', content: 'x' }];
    mostrarEstadisticas();
    assert.ok(document.getElementById('nomi-stats-panel'), 'falta panel de estadisticas');
    assert.ok(document.getElementById('nomi-stats-close'), 'falta cerrar estadisticas');
    limpiarBody();
    mostrarExportacion();
    assert.ok(document.getElementById('nomi-export-panel'), 'falta panel de exportacion');
    assert.ok(document.getElementById('nomi-export-close'), 'falta cerrar exportacion');

    // 7) Asistente de configuración inicial: selects/inputs con IDs correctos.
    limpiarBody();
    mostrarAsistenteConfiguracion();
    assert.ok(document.getElementById('nomi-asistente-config'), 'falta asistente');
    assert.ok(document.getElementById('nomi-config-openrouter'), 'falta config openrouter');
    assert.ok(document.getElementById('nomi-config-tavily'), 'falta config tavily');
    assert.ok(document.getElementById('nomi-config-modelo'), 'falta config modelo');
    assert.ok(document.getElementById('nomi-config-url'), 'falta config url');
    assert.ok(document.getElementById('nomi-config-guardar'), 'falta guardar');

    // 8) nomiVaciarNodo vacía un nodo sin replaceChildren ni innerHTML (Android antiguo).
    const vacio = document.createElement('div');
    vacio.appendChild(document.createElement('span'));
    vacio.appendChild(document.createElement('span'));
    assert.strictEqual(vacio.children.length, 2, 'precondición: el nodo tiene 2 hijos');
    nomiVaciarNodo(vacio);
    assert.strictEqual(vacio.children.length, 0, 'nomiVaciarNodo debe dejar el nodo vacío');
    // También con un único hijo y llamadas repetidas (idempotente).
    const vacio2 = document.createElement('div');
    vacio2.appendChild(document.createElement('b'));
    nomiVaciarNodo(vacio2);
    nomiVaciarNodo(vacio2);
    assert.strictEqual(vacio2.children.length, 0, 'nomiVaciarNodo es idempotente y seguro');

    console.log('OK: todas las pruebas de UI (DOM simulado, sin innerHTML) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const combinado = fuentes.join('\n') + '\n' + pruebas;
vm.runInContext(combinado, ctx, { filename: 'nomi-ui-test.js' });
