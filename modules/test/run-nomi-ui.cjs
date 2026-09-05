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
                style: (() => {
            // Mock de CSSStyleDeclaration: cssText parsea `display` y props comunes.
            const st = { display: '', cssText: '' };
            Object.defineProperty(st, 'cssText', {
                get() { return st._cssText || ''; },
                set(v) {
                    st._cssText = v;
                    const m = (v || '').match(/\bdisplay\s*:\s*([^;]+)/);
                    st.display = m ? m[1].trim() : '';
                },
            });
            return st;
        })(),
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
        set(v) {
            el._value = String(v);
            // Emula el <select> real: fijar value selecciona la opción coincidente.
            for (const c of el.children) {
                if (c.tagName === 'OPTION') c.selected = (c.value === String(v));
            }
        },
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

// Stubs fieles para onboarding: reflejan estado en NoMiState y persistencia simulada.
ctx.setNomiToken = (t) => { NoMiState.nomiToken = t; GM_setValue(STORAGE_NOMI_TOKEN, t); };
ctx.setNomiAccesoActivo = (v) => { NoMiState.nomiAccesoActivo = !!v; GM_setValue(STORAGE_NOMI_ACCESO_ACTIVO, !!v); };
ctx.setNomiModelo = (m) => { NoMiState.nomiModelo = m; GM_setValue(STORAGE_NOMI_MODELO, m); };
ctx.mostrarNotificacionTemporal = (m) => { NoMiState.__ultimaNotificacion = m; };
ctx.toggleVentana = (mostrar) => { NoMiState.ventanaAbierta = !!mostrar; };
ctx.cargarHistorial = () => {};
ctx.guardarHistorial = () => {};
ctx.actualizarStats = () => {};
ctx.agregarMensaje = () => {};
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
    // Stub de estadoAccesoNoMi fiel al de nomi-acceso-nomi.js, para que el
    // menú refleje correctamente el CTA Activar (visible solo sin acceso).
    estadoAccesoNoMi = () => {
        if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI) return 'desactivado';
        if (!NoMiState.nomiToken) return 'pendiente';
        return NoMiState.nomiAccesoActivo ? 'activo' : 'revocado';
    };
    // setModoAcceso fiel: persiste en el almacenamiento simulado (GM_*),
    // de modo que getModoAcceso() refleje el cambio tras click del CTA.
    setModoAcceso = (m) => { NoMiState.modoAcceso = m; GM_setValue(STORAGE_MODO_ACCESO, m); };

    // Los stubs "fieles" asignados a ctx antes de cargar los módulos son
    // sobrescritos por las declaraciones function de nomi-chat.js/nomi-persistencia.js
    // al ejecutarse con vm.runInContext. Se reaplican aquí (tras la carga) para que
    // los tests de onboarding lean estado en NoMiState: el toggleVentana real no
    // abre nada sin #nomi-chat (ausente en estas pruebas aisladas) y el real de
    // notificaciones no registra __ultimaNotificacion.
    toggleVentana = (mostrar) => { NoMiState.ventanaAbierta = !!mostrar; };
    mostrarNotificacionTemporal = (m) => { NoMiState.__ultimaNotificacion = m; };

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

    // 1b) HUD de estado: existe y refleja modo/estado; cuota solo en NoMi sin bolsa global.
    assert.ok(document.getElementById('nomi-hud-status'), 'falta #nomi-hud-status');
    assert.ok(document.getElementById('nomi-hud-quota'), 'falta #nomi-hud-quota');
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.credencialesCargadas = true;
    NoMiState.apiKeyActual = 'sk-or';
    NoMiState.nomiAccesoActivo = false;
    NoMiState.isWaiting = false;
    NoMiState.estadoHud = null;
    actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'Personal · Activo', 'HUD Personal activo');
    NoMiState.isWaiting = true; actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'Pensando…', 'HUD pensando');
    NoMiState.isWaiting = false;
    NoMiState.estadoHud = 'limite'; actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'Límite alcanzado', 'HUD limite');
    NoMiState.estadoHud = null;
    NoMiState.modoAcceso = MODO_ACCESO_NOMI;
    // Rama Créditos: tokens_usados/cuota_mensual_invitado (créditos/tokens).
    NoMiState.usoNoMi = { tokens_usados: 12, cuota_mensual_invitado: 50, solicitudes_usadas: 5, bolsa_global_disponible: 999 };
    actualizarQuotaHud();
    const q = document.getElementById('nomi-hud-quota');
    assert.strictEqual(q.style.display, 'inline', 'cuota visible en NoMi');
    assert.ok(q.textContent.includes('12/50'), 'cuota tokens/cuota: ' + q.textContent);
    assert.ok(q.textContent.includes('Créditos'), 'cuota usa etiqueta Créditos: ' + q.textContent);
    assert.ok(!q.textContent.includes('999'), 'no muestra bolsa global');
    // Rama fallback: sin tokens_usados -> solo "Consultas usadas: N".
    NoMiState.usoNoMi = { solicitudes_usadas: 3 };
    actualizarQuotaHud();
    assert.ok(q.textContent.includes('Consultas usadas: 3'), 'fallback muestra Consultas usadas: ' + q.textContent);
    assert.ok(!q.textContent.includes('/'), 'fallback no muestra ratio de cuota');
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.usoNoMi = { solicitudes_usadas: 3 };
    actualizarQuotaHud();
    assert.strictEqual(document.getElementById('nomi-hud-quota').style.display, 'none', 'cuota oculta en Personal');

    // 1c) Acción del HUD (click) según estado.
    const hud = document.getElementById('nomi-hud-status');
    assert.ok(hud && typeof hud.onclick === 'function', 'HUD debe tener handler de click');
    let llamadasHud = {};
    const _preg = typeof preguntar !== 'undefined' ? preguntar : null;
    const _menu = typeof mostrarMenu !== 'undefined' ? mostrarMenu : null;
    const _uso = typeof consultarUsoNoMi !== 'undefined' ? consultarUsoNoMi : null;
    preguntar = (p) => { llamadasHud.preguntar = p; };
    mostrarMenu = () => { llamadasHud.menu = true; };
    consultarUsoNoMi = () => { llamadasHud.usage = true; };
    const btn = document.getElementById('nomi-hud-accion');
    assert.ok(btn, 'debe existir #nomi-hud-accion');
    // Normal: botón oculto.
    NoMiState.modoAcceso = MODO_ACCESO_NOMI;
    NoMiState.nomiAccesoActivo = true;
    NoMiState.estadoHud = null;
    NoMiState.reintentarPregunta = '';
    actualizarHud();
    assert.strictEqual(btn.style.display, 'none', 'normal: botón oculto');
    // 401 / sin acceso -> "Activar" abre Configuración, no reenvía.
    NoMiState.estadoHud = 'acceso_invalido';
    actualizarHud();
    assert.strictEqual(btn.style.display, 'inline-block', 'acceso_invalido: botón visible');
    assert.strictEqual(btn.textContent, 'Activar', 'acceso_invalido: botón Activar');
    btn.onclick();
    assert.strictEqual(llamadasHud.menu, true, 'Activar abre Configuración');
    assert.strictEqual(llamadasHud.preguntar, undefined, 'Activar no reenvía');
    llamadasHud = {};
    hud.onclick();
    assert.strictEqual(llamadasHud.menu, true, 'click HUD en acceso_invalido abre Configuración');
    // sin_conexion + pregunta -> "Reintentar" reenvía.
    llamadasHud = {};
    NoMiState.nomiAccesoActivo = true;
    NoMiState.estadoHud = 'sin_conexion';
    NoMiState.reintentarPregunta = 'REINTENTO_X';
    actualizarHud();
    assert.strictEqual(btn.textContent, 'Reintentar', 'sin_conexion+pregunta: botón Reintentar');
    btn.onclick();
    assert.strictEqual(llamadasHud.preguntar, 'REINTENTO_X', 'Reintentar reenvía la pregunta');
    llamadasHud = {};
    NoMiState.reintentarPregunta = 'REINTENTO_X';
    hud.onclick();
    assert.strictEqual(llamadasHud.preguntar, 'REINTENTO_X', 'click HUD reenvía la pregunta');
    // sin_conexion sin pregunta (solo falló usage) -> "Actualizar" refresca usage.
    llamadasHud = {};
    NoMiState.estadoHud = 'sin_conexion';
    NoMiState.reintentarPregunta = '';
    actualizarHud();
    assert.strictEqual(btn.textContent, 'Actualizar', 'sin_conexion sin pregunta: botón Actualizar');
    btn.onclick();
    assert.strictEqual(llamadasHud.usage, true, 'Actualizar refresca usage');
    assert.strictEqual(llamadasHud.preguntar, undefined, 'Actualizar no reenvía chat');
    llamadasHud = {};
    hud.onclick();
    assert.strictEqual(llamadasHud.usage, true, 'click HUD refresca usage');
    // Personal -> ni botón ni acciones NoMi.
    llamadasHud = {};
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.estadoHud = 'sin_conexion';
    actualizarHud();
    assert.strictEqual(btn.style.display, 'none', 'Personal: botón oculto');
    hud.onclick();
    assert.strictEqual(llamadasHud.preguntar, undefined, 'Personal: click no reenvía');
    assert.strictEqual(llamadasHud.usage, undefined, 'Personal: click no refresca NoMi');
    if (_preg) preguntar = _preg;
    if (_menu) mostrarMenu = _menu;
    if (_uso) consultarUsoNoMi = _uso;

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
    assert.ok(document.getElementById('nomi-input-ubicacion-habitual'), 'falta ciudad habitual');
    assert.ok(document.getElementById('nomi-guardar-ubicacion-habitual'), 'falta botón para guardar ciudad habitual');
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

    // ===== Jerarquía de acceso (NoMi primero, API Personal avanzada/colapsable) =====
    // Recolecta los ids en orden DFS del menú para verificar el orden visual.
    function recolectarIds(n) {
        const out = [];
        (function w(x) { for (const c of x.children) { if (c.nodeType === 1) { if (c.id) out.push(c.id); w(c); } } })(n);
        return out;
    }

    // 9a) Orden: Acceso NoMi (nomi-select-modo) aparece ANTES que API Personal (nomi-personal-toggle).
    limpiarBody();
    mostrarMenu();
    const menuEl = document.getElementById('nomi-menu');
    const idsOrden = recolectarIds(menuEl);
    const iNomi = idsOrden.indexOf('nomi-select-modo');
    const iPers = idsOrden.indexOf('nomi-personal-toggle');
    assert.ok(iNomi >= 0 && iPers >= 0, 'deben existir los ids de NoMi y de API Personal');
    assert.ok(iNomi < iPers, 'Acceso NoMi debe aparecer ANTES que API Personal en el DOM');

    // 9b) Selector de modo: primero "NoMi — acceso con invitación", segundo "API Personal — avanzada".
    const selModoT = document.getElementById('nomi-select-modo');
    assert.strictEqual(selModoT.options[0].value, 'nomi', 'selector: primer modo debe ser nomi');
    assert.strictEqual(selModoT.options[1].value, 'openrouter', 'selector: segundo modo debe ser openrouter (API Personal)');
    assert.ok(selModoT.options[0].textContent.includes('invitación'), 'opción NoMi menciona invitación');
    assert.ok(selModoT.options[1].textContent.includes('avanzada'), 'opción Personal menciona avanzada');

    // 9c) CTA "Activar acceso NoMi" presente y visible cuando no hay acceso.
    const cta = document.getElementById('nomi-cta-activar');
    assert.ok(cta, 'debe existir el CTA Activar (#nomi-cta-activar)');
    assert.notStrictEqual(cta.style.display, 'none', 'CTA visible cuando no hay acceso NoMi');

    // 9d) Colapsado: sin credenciales y modo NoMi -> API Personal cerrada (▸).
    NoMiState.modoAcceso = MODO_ACCESO_NOMI;
    limpiarBody();
    mostrarMenu();
    assert.strictEqual(document.getElementById('nomi-personal-content').style.display, 'none', 'Personal cerrada sin credenciales ni modo Personal');
    assert.strictEqual(document.getElementById('nomi-personal-indicador').textContent, '▸', 'indicador colapsado ▸');

    // 9e) Abierta automáticamente si el modo Personal (openrouter) está activo.
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    limpiarBody();
    mostrarMenu();
    assert.strictEqual(document.getElementById('nomi-personal-content').style.display, 'block', 'Personal abierta con modo Personal activo (sin credenciales)');
    // Toggle colapsa/expande.
    document.getElementById('nomi-personal-toggle').onclick();
    assert.strictEqual(document.getElementById('nomi-personal-content').style.display, 'none', 'toggle colapsa Personal');
    document.getElementById('nomi-personal-toggle').onclick();
    assert.strictEqual(document.getElementById('nomi-personal-content').style.display, 'block', 'toggle expande Personal');

    // 9f) Preservación de modo persistido: abrir el menú NO cambia el modo del usuario existente.
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    const modoAntes = NoMiState.modoAcceso;
    limpiarBody();
    mostrarMenu();
    assert.strictEqual(NoMiState.modoAcceso, modoAntes, 'abrir menú no cambia el modo en NoMiState');
    assert.strictEqual(getModoAcceso(), MODO_ACCESO_OPENROUTER, 'modo sigue siendo openrouter tras abrir menú');

    // 9g) Regresión HUD: tras abrir/cerrar el menú el indicador sigue pintando Personal/NoMi.
    limpiarBody();
    crearVentanaChat();
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.credencialesCargadas = true; NoMiState.apiKeyActual = 'sk-or';
    NoMiState.estadoHud = null; NoMiState.isWaiting = false;
    actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'Personal · Activo', 'HUD Personal intacto tras la jerarquía');
    NoMiState.modoAcceso = MODO_ACCESO_NOMI;
    NoMiState.nomiToken = 'TOK'; NoMiState.nomiAccesoActivo = true;
    establecerEstadoHud(null);
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'NoMi · Activo', 'HUD NoMi intacto tras la jerarquía');
    // Con acceso activo, el CTA debe ocultarse al construir el menú.
    limpiarBody();
    mostrarMenu();
    assert.strictEqual(document.getElementById('nomi-cta-activar').style.display, 'none', 'CTA oculto cuando hay acceso NoMi activo');

    // 9h) Sin sinks HTML: el CTA y la sección Personal usan textContent (no innerHTML).
    assert.ok(!('innerHTML' in (document.getElementById('nomi-cta-activar'))), 'CTA no usa innerHTML');

    // 9i) Click del CTA "Activar" desde modo Personal sincroniza todo a NoMi.
    limpiarBody();
    crearVentanaChat();
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.credencialesCargadas = false;
    NoMiState.nomiToken = ''; NoMiState.nomiAccesoActivo = false;
    NoMiState.estadoHud = null; NoMiState.isWaiting = false;
    mostrarMenu();
    const ctaClick = document.getElementById('nomi-cta-activar');
    assert.ok(ctaClick, 'existe el CTA para simular click');
    ctaClick.onclick();
    // 1) Modo en NoMiState.
    assert.strictEqual(NoMiState.modoAcceso, MODO_ACCESO_NOMI, 'click CTA: NoMiState.modoAcceso === nomi');
    // 2) Modo persistido.
    assert.strictEqual(getModoAcceso(), MODO_ACCESO_NOMI, 'click CTA: getModoAcceso() === nomi');
    // 3) Selector sincronizado.
    const selClick = document.getElementById('nomi-select-modo');
    assert.strictEqual(selClick.value, 'nomi', 'click CTA: selector.value === nomi');
    // 4) Sección Worker visible.
    const workerClick = document.getElementById('nomi-seccion-worker');
    assert.strictEqual(workerClick.style.display, 'block', 'click CTA: sección Worker visible');
    // 5) HUD y CTA coherentes con NoMi (sin acceso aún).
    actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'NoMi · Sin acceso', 'click CTA: HUD refleja NoMi (sin acceso)');
    assert.notStrictEqual(document.getElementById('nomi-cta-activar').style.display, 'none', 'click CTA: CTA sigue visible (aún sin activar)');

    // 9k-a) Búsqueda web NoMi: existe en Configuración, default activado,
    // visible/deshabilitable sin API Personal (captura antes de remover menú).
    const chkBusqNomi = document.getElementById('nomi-check-busqueda-nomi');
    assert.ok(chkBusqNomi, 'debe existir #nomi-check-busqueda-nomi en Configuración');
    assert.strictEqual(chkBusqNomi.checked, true, 'búsqueda web NoMi activada por defecto');
    assert.strictEqual(chkBusqNomi.disabled, false, 'visible y deshabilitable sin API Personal');
    // 9j) Clima automático NoMi: toggle independiente, sin credenciales, default activado.
    const chkClima = document.getElementById('nomi-check-clima-nomi');
    assert.ok(chkClima, 'debe existir #nomi-check-clima-nomi en Configuración');
    assert.strictEqual(chkClima.checked, true, 'clima automático NoMi activado por defecto');
    assert.strictEqual(chkClima.disabled, false, 'no se deshabilita por falta de API Personal/Tavily');
    // Desactivar persiste la preferencia (getClimaAutomatico refleja el cambio).
        chkClima.checked = false;
    chkClima.onchange({ target: chkClima });
    assert.strictEqual(getClimaAutomatico(), false, 'desactivar persiste clima automático = false');
    assert.strictEqual(NoMiState.climaAutomatico, false, 'NoMiState.climaAutomatico = false tras toggle');
    chkClima.checked = true;
    chkClima.onchange({ target: chkClima });
    assert.strictEqual(getClimaAutomatico(), true, 'reactivar persiste clima automático = true');

    // 9k) Búsqueda web NoMi: toggle independiente, visible sin API Personal,
    // activado por defecto y persistente (usa la referencia ya capturada).
        chkBusqNomi.checked = false;
    chkBusqNomi.onchange({ target: chkBusqNomi });
    assert.strictEqual(getBusquedaWebNomi(), false, 'desactivar persiste búsqueda web NoMi = false');
    assert.strictEqual(NoMiState.busquedaWebNomi, false, 'NoMiState.busquedaWebNomi = false tras toggle');
    chkBusqNomi.checked = true;
    chkBusqNomi.onchange({ target: chkBusqNomi });
    assert.strictEqual(getBusquedaWebNomi(), true, 'reactivar persiste búsqueda web NoMi = true');

    // ---- Pruebas de onboarding (click/onboarding) ----
    // 10a) En instalación limpia: API Personal (.enc) está COLAPSADA por defecto
    //      en el asistente de configuración (solo "Acceso NoMi" visible).
    limpiarBody();
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    NoMiState.credencialesCargadas = false;
    NoMiState.nomiToken = ''; NoMiState.nomiAccesoActivo = false;
    NoMiState.ventanaAbierta = false;
    mostrarAsistenteConfiguracion();
    assert.ok(document.getElementById('nomi-config-seccion-nomi'), 'asistente: sección Acceso NoMi presente');
    assert.ok(document.getElementById('nomi-config-activar'), 'asistente: #nomi-config-activar presente');
    assert.ok(document.getElementById('nomi-config-recuperar-propietario'), 'asistente: #nomi-config-recuperar-propietario presente');
    assert.ok(document.getElementById('nomi-config-clave-propietario'), 'asistente: input de clave propietaria presente');
    const contCreds = document.getElementById('nomi-config-credenciales-contenido');
    assert.ok(contCreds, 'asistente: contenedor de credenciales visible como toggle');
    assert.strictEqual(contCreds.style.display, 'none', 'asistente: API Personal (.enc) COLAPSADA por defecto');

    // 10b) Toggle colapsa/expande la caja de credenciales (API Personal avanzada).
    const toggleCreds = document.getElementById('nomi-config-toggle-credenciales');
    assert.ok(toggleCreds, 'asistente: toggle de credenciales presente');
    assert.strictEqual(toggleCreds.textContent, '▸', 'asistente: toggle ícono colapsado ▸');
    toggleCreds.onclick();
    assert.strictEqual(contCreds.style.display, 'block', 'asistente: toggle expande API Personal');
    assert.strictEqual(toggleCreds.textContent, '▾', 'asistente: toggle ícono ▾ al expandir');
    toggleCreds.onclick();
    assert.strictEqual(contCreds.style.display, 'none', 'asistente: toggle colapsa API Personal');
        assert.strictEqual(toggleCreds.textContent, '▸', 'asistente: toggle ícono ▸ al colapsar');

    // 10c) Click "Activar con código de invitación": deshabilita el botón, establece
    //      modo NoMi, actualiza HUD, cierra el asistente, limpia el input y no persiste
    //      la clave (no hay clave aquí, pero el input de código se limpia).
    limpiarBody();
    NoMiState.ventanaAbierta = false;
    mostrarAsistenteConfiguracion();
    const inputCodigo = document.getElementById('nomi-config-codigo');
    const btnActivar = document.getElementById('nomi-config-activar');
    inputCodigo.value = 'ABCD';
    activarAccesoNoMi = (codigo) => {
        assert.strictEqual(codigo.toUpperCase(), 'ABCD', 'activar: envía código en mayúsculas');
        setNomiToken('TOK_ACTIVAR');
        setNomiAccesoActivo(true);
        return Promise.resolve('TOK_ACTIVAR');
    };
    assert.strictEqual(btnActivar.disabled, false, 'asistente: botón activar habilitado antes del click');
    btnActivar.onclick();
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(NoMiState.modoAcceso, MODO_ACCESO_NOMI, 'activar: establece modo NoMi');
    assert.strictEqual(getModoAcceso(), MODO_ACCESO_NOMI, 'activar: persiste modo NoMi');
    assert.strictEqual(getNomiToken(), 'TOK_ACTIVAR', 'activar: guarda el token opaco');
    assert.strictEqual(NoMiState.ventanaAbierta, true, 'activar: abre la ventana de chat (toggleVentana(true))');
    assert.strictEqual(document.getElementById('nomi-asistente-config'), null, 'activar: cierra el asistente (modal removido)');
    assert.strictEqual(inputCodigo.value, '', 'activar: limpia el input de código tras éxito');
    assert.strictEqual(btnActivar.disabled, false, 'activar: restaura el botón tras completarse');

    // 10d) Click "Recuperar acceso propietario": análogo y la CLAVE se limpia
    //      de los inputs (nunca persistida).
    limpiarBody();
    NoMiState.ventanaAbierta = false;
    NoMiState.nomiToken = ''; NoMiState.nomiAccesoActivo = false;
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    mostrarAsistenteConfiguracion();
    const inputClave = document.getElementById('nomi-config-clave-propietario');
    const btnRecuperar = document.getElementById('nomi-config-recuperar-propietario');
    inputClave.value = 'nomi-pro-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    recuperarAccesoPropietario = (clave) => {
        assert.ok(clave.startsWith('nomi-pro-'), 'recuperar: envía clave con prefijo nomi-pro-');
        setNomiToken('TOK_PROP');
        setNomiAccesoActivo(true);
        return Promise.resolve('TOK_PROP');
    };
    assert.strictEqual(btnRecuperar.disabled, false, 'asistente: botón recuperar habilitado antes del click');
    btnRecuperar.onclick();
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(NoMiState.modoAcceso, MODO_ACCESO_NOMI, 'recuperar: establece modo NoMi');
    assert.strictEqual(getNomiToken(), 'TOK_PROP', 'recuperar: guarda el token opaco');
    assert.strictEqual(NoMiState.ventanaAbierta, true, 'recuperar: abre la ventana de chat');
    assert.strictEqual(document.getElementById('nomi-asistente-config'), null, 'recuperar: cierra el asistente (modal removido)');
    assert.strictEqual(inputClave.value, '', 'recuperar: LIMPIA la clave de los inputs (nunca persistida)');
    assert.strictEqual(btnRecuperar.disabled, false, 'recuperar: restaura el botón tras completarse');
    assert.ok(!String(GM_getValue(STORAGE_NOMI_TOKEN, '')).includes('nomi-pro-'), 'recuperar: la clave NO se persiste en storage');

    // 10e) Mientras opera: botón deshabilitado; tras error se restaura y se muestra
    //      mensaje de error humano.
    limpiarBody();
    NoMiState.ventanaAbierta = false;
    NoMiState.nomiToken = ''; NoMiState.nomiAccesoActivo = false;
    NoMiState.modoAcceso = MODO_ACCESO_OPENROUTER;
    mostrarAsistenteConfiguracion();
    const inputCod2 = document.getElementById('nomi-config-codigo');
    const btnAct2 = document.getElementById('nomi-config-activar');
    const estadoNoMi = document.getElementById('nomi-config-estado-nomi');
    inputCod2.value = 'ZZZZ';
    activarAccesoNoMi = () => Promise.reject(new Error('Código de invitación inválido o ya usado.'));
    btnAct2.onclick();
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(btnAct2.disabled, false, 'error: botón restaurado tras fallo');
    assert.strictEqual(estadoNoMi.textContent, '', 'error: estado limpio tras fallo');
    assert.ok(/inv.lido|usado|caducado/.test(NoMiState.__ultimaNotificacion), 'error: notificación humana visible');

        console.log('OK: todas las pruebas de UI (DOM simulado, sin innerHTML) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const combinado = fuentes.join('\n') + '\n' + pruebas;
vm.runInContext(combinado, ctx, { filename: 'nomi-ui-test.js' });
