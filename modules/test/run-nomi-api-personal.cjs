// Pruebas del nivel 1 de "API Personal" (OpenAI-compatible, sin Gemini/Anthropic).
// Cubre: Tavily opcional, modelo manual en URL propia, headers HTTP-Referer/X-Title
// solo en OpenRouter, catálogo solo en OpenRouter, búsqueda sin Tavily no bloquea,
// y regresión de NoMi/HUD/credenciales. Ejecutar:
//   node modules/test/run-nomi-api-personal.cjs

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
    // ===== 0) Helper: limpia el body (para volver a abrir el menú) =====
    crearVentanaChat(); // asegura ids de HUD/chat para preguntar().

    // ===== 1) esOpenRouter / construirHeadersPersonal =====
    assert.strictEqual(esOpenRouter('https://openrouter.ai/api/v1'), true, 'openrouter.ai es OpenRouter');
    assert.strictEqual(esOpenRouter('https://api.openrouter.ai/v1'), true, 'subdominio openrouter cuenta');
    assert.strictEqual(esOpenRouter('https://api.deepseek.com/v1'), false, 'deepseek NO es OpenRouter');
    assert.strictEqual(esOpenRouter('https://api.mistral.ai/v1'), false, 'mistral NO es OpenRouter');
    assert.strictEqual(esOpenRouter('https://api.together.xyz/v1'), false, 'together NO es OpenRouter');

    const hOR = construirHeadersPersonal('KEY', 'https://openrouter.ai/api/v1');
    assert.strictEqual(hOR['Authorization'], 'Bearer KEY', 'OR: Authorization presente');
    assert.strictEqual(hOR['HTTP-Referer'], 'https://example.com', 'OR: HTTP-Referer SI se envía');
    assert.strictEqual(hOR['X-Title'], 'NoMi Asistente', 'OR: X-Title SI se envía');

    const hDS = construirHeadersPersonal('KEY', 'https://api.deepseek.com/v1');
    assert.strictEqual(hDS['Authorization'], 'Bearer KEY', 'DeepSeek: Authorization presente');
    assert.strictEqual(hDS['HTTP-Referer'], undefined, 'DeepSeek: HTTP-Referer NO se envía');
    assert.strictEqual(hDS['X-Title'], undefined, 'DeepSeek: X-Title NO se envía');

    const hGroq = construirHeadersPersonal('KEY', 'https://api.groq.com/openai/v1');
    assert.strictEqual(hGroq['HTTP-Referer'], undefined, 'Groq: HTTP-Referer NO se envía');

    // 1c) esOpenRouter por hostname real (seguro contra dominios falsos).
    assert.strictEqual(esOpenRouter('https://openrouter.ai/api/v1'), true, 'hostname exacto openrouter.ai');
    assert.strictEqual(esOpenRouter('https://api.openrouter.ai/v1'), true, 'subdominio *.openrouter.ai');
    assert.strictEqual(esOpenRouter('https://openrouter.ai.evil.com/v1'), false, 'dominio falso openrouter.ai.evil.com -> false');
    assert.strictEqual(esOpenRouter('https://evil.com/openrouter.ai'), false, 'path/trampa en evil.com -> false');
    assert.strictEqual(esOpenRouter('https://openrouter.ai.attacker.net'), false, 'sufijo distinto -> false');
    assert.strictEqual(esOpenRouter('openrouter.ai'), false, 'sin protocolo (URL inválida) -> false');
    assert.strictEqual(esOpenRouter('no es url'), false, 'URL inválida -> false (fallback)');
    assert.strictEqual(esOpenRouter(''), false, 'vacío -> false');
    assert.strictEqual(esOpenRouter(null), false, 'null -> false (fallback)');

    // 1d) URLs maliciosas NO reciben HTTP-Referer/X-Title (solo dominio real OR).
    const hFalso = construirHeadersPersonal('KEY', 'https://openrouter.ai.evil.com/v1');
    assert.strictEqual(hFalso['HTTP-Referer'], undefined, 'dominio falso: SIN HTTP-Referer');
    assert.strictEqual(hFalso['X-Title'], undefined, 'dominio falso: SIN X-Title');
    const hTrampa = construirHeadersPersonal('KEY', undefined); // url undefined -> no OR
    assert.strictEqual(hTrampa['HTTP-Referer'], undefined, 'url undefined: SIN HTTP-Referer');
    assert.strictEqual(hTrampa['X-Title'], undefined, 'url undefined: SIN X-Title');

    // ===== 2) Guardar API key SIN Tavily (Tavily opcional) =====
    // Limpia storage previo.
    ['nomi_api_key','nomi_tavily_key','nomi_modelo','nomi_url','nomi_credenciales_cargadas','nomi_config_inicial'].forEach(k => eliminarValor(k));
    NoMiState.apiKeyActual = ''; NoMiState.tavilyKeyActual = ''; NoMiState.modeloActual = ''; NoMiState.urlBaseActual = '';
    const okSinTavily = guardarCredencialesManual('sk-propia-123', '', 'gpt-4o-mini', 'https://api.deepseek.com/v1');
    assert.strictEqual(okSinTavily, true, 'guardar SIN Tavily debe retornar true');
    assert.strictEqual(getApiKey(), 'sk-propia-123', 'api key guardada');
    assert.strictEqual(getTavilyKey(), '', 'tavily queda vacío (no obligatorio)');
    assert.strictEqual(getCredencialesCargadas(), true, 'credenciales marcadas como cargadas sin Tavily');
    assert.strictEqual(getModelo(), 'gpt-4o-mini', 'modelo manual guardado');
    assert.strictEqual(getUrlBase(), 'https://api.deepseek.com/v1', 'url base propia guardada');

    // Sin API key -> debe fallar (sigue siendo obligatoria).
    const okVacio = guardarCredencialesManual('', '', 'm', 'u');
    assert.strictEqual(okVacio, false, 'guardar sin API key debe retornar false');

    // Compatibilidad: OpenRouter + Tavily sigue funcionando.
    const okCompleto = guardarCredencialesManual('sk-or-1', 'tvly-1', 'openai/gpt-oss-20b:free', 'https://openrouter.ai/api/v1');
    assert.strictEqual(okCompleto, true, 'OpenRouter + Tavily sigue funcionando');
    assert.strictEqual(getTavilyKey(), 'tvly-1', 'tavily conservado en configuración completa');

    // 2d) Guardar con Tavily VACÍO elimina la Tavily anterior.
    setTavilyKey('tvly-anterior');
    assert.strictEqual(getTavilyKey(), 'tvly-anterior', 'precondición: hay Tavily anterior');
    guardarCredencialesManual('sk-nueva', '', 'gpt-4o-mini', 'https://api.deepseek.com/v1');
    assert.strictEqual(getTavilyKey(), '', 'guardar vacío deja Tavily vacío');
    assert.strictEqual(GM_getValue('nomi_tavily_key', '__ausente__'), '__ausente__', 'guardar vacío ELIMINA la clave Tavily del storage');

    // 2e) Importar JSON/.enc SIN campo tavily elimina la Tavily previa.
    setTavilyKey('tvly-import-antes');
    assert.strictEqual(getTavilyKey(), 'tvly-import-antes', 'precondición: hay Tavily antes de importar');
    aplicarCredencialesImportadas({ openrouter: 'sk-importado' });
    assert.strictEqual(getTavilyKey(), '', 'importar sin tavily deja Tavily vacío');
    assert.strictEqual(GM_getValue('nomi_tavily_key', '__ausente__'), '__ausente__', 'importar sin tavily ELIMINA la clave del storage');
    assert.strictEqual(getApiKey(), 'sk-importado', 'importar sin tavily conserva la API key');

    // 2f) Importar JSON/.enc CON tavily lo conserva (no se elimina).
    setTavilyKey('');
    aplicarCredencialesImportadas({ openrouter: 'sk-2', tavily: 'tvly-2', modelo: 'm', url: 'https://openrouter.ai/api/v1' });
    assert.strictEqual(getTavilyKey(), 'tvly-2', 'importar con tavily lo conserva');
    assert.strictEqual(getApiKey(), 'sk-2', 'importar con tavily conserva API key');
    assert.strictEqual(getModelo(), 'm', 'importar con tavily conserva modelo');
    assert.strictEqual(getUrlBase(), 'https://openrouter.ai/api/v1', 'importar con tavily conserva URL');

    // ===== 3) Request OpenAI-compatible con URL/modelo propio =====
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    setApiKey('sk-propia-123');
    setTavilyKey('');
    setModelo('gpt-4o-mini');
    setUrlBase('https://api.deepseek.com/v1');
    NoMiState.apiKeyActual = 'sk-propia-123';
    NoMiState.tavilyKeyActual = '';
    NoMiState.modeloActual = 'gpt-4o-mini';
    NoMiState.urlBaseActual = 'https://api.deepseek.com/v1';
    NoMiState.credencialesCargadas = true;
    NoMiState.isWaiting = false;
    NoMiState.historial = [];

    let captura = null;
    responder = async (url, opts) => {
        captura = { url, opts };
        return { choices: [{ message: { content: 'respuesta propia' } }] };
    };
    await preguntar('hola api propia');
    assert.ok(captura, 'debe realizar la petición');
    assert.strictEqual(captura.url, 'https://api.deepseek.com/v1/chat/completions', 'url propia + /chat/completions');
    assert.strictEqual(JSON.parse(captura.opts.body).model, 'gpt-4o-mini', 'usa el modelo manual propio');
    assert.strictEqual(captura.opts.headers['HTTP-Referer'], undefined, 'request propio: SIN HTTP-Referer');
    assert.strictEqual(captura.opts.headers['X-Title'], undefined, 'request propio: SIN X-Title');
    assert.strictEqual(captura.opts.headers['Authorization'], 'Bearer sk-propia-123', 'request propio: Bearer correcto');
    assert.strictEqual(captura.opts.headers['Content-Type'], 'application/json', 'request propio: Content-Type json');

    // En OpenRouter SÍ se envían los headers.
    setUrlBase('https://openrouter.ai/api/v1');
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1';
    captura = null;
    await preguntar('hola openrouter');
    assert.strictEqual(captura.opts.headers['HTTP-Referer'], 'https://example.com', 'OR request: HTTP-Referer SÍ');
    assert.strictEqual(captura.opts.headers['X-Title'], 'NoMi Asistente', 'OR request: X-Title SÍ');

    // ===== 4) Sin consulta al catálogo OpenRouter para URL externa =====
    // 4a) URL externa: cargarModelosAlMenu NO llama fetchFreeModelos.
    setUrlBase('https://api.deepseek.com/v1');
    limpiarBody();
    mostrarMenu();
    let catalogoLlamado = false;
    fetchFreeModelos = async () => { catalogoLlamado = true; throw new Error('NO DEBE llamarse'); };
    await cargarModelosAlMenu();
    assert.strictEqual(catalogoLlamado, false, 'URL externa: NO se consulta el catálogo OpenRouter');
    const manualExt = document.getElementById('nomi-input-modelo-manual');
    assert.ok(manualExt, 'debe existir el input manual de modelo');
    assert.strictEqual(manualExt.style.display, 'block', 'input manual visible en URL externa');
    const selExt = document.getElementById('nomi-input-modelo');
    assert.strictEqual(selExt.style.display, 'none', 'select de catálogo oculto en URL externa');

    // 4b) URL OpenRouter: SÍ se consulta el catálogo (regresión).
    setUrlBase('https://openrouter.ai/api/v1');
    limpiarBody();
    mostrarMenu();
    let catalogoOR = 0;
    fetchFreeModelos = async () => { catalogoOR++; return []; };
    await cargarModelosAlMenu();
    assert.strictEqual(catalogoOR, 1, 'OpenRouter: SÍ se consulta el catálogo');

    // ===== 5) Búsqueda sin Tavily no bloquea el chat =====
    limpiarBody();
    crearVentanaChat();
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    setApiKey('sk-propia-123');
    setTavilyKey('');
    setUrlBase('https://api.deepseek.com/v1');
    NoMiState.apiKeyActual = 'sk-propia-123';
    NoMiState.tavilyKeyActual = '';
    NoMiState.urlBaseActual = 'https://api.deepseek.com/v1';
    NoMiState.credencialesCargadas = true;
    NoMiState.motorBusqueda = 'tavily';
    NoMiState.busquedaWebActiva = true;
    NoMiState.historial = [];
    // Chat normal (sin palabras de búsqueda) funciona sin Tavily.
    let capturaChat = null;
    responder = async (url, opts) => { capturaChat = { url, opts }; return { choices: [{ message: { content: 'ok sin tavily' } }] }; };
    await preguntar('cuéntame un chiste');
    assert.ok(capturaChat, 'chat normal funciona sin Tavily');
    assert.strictEqual(capturaChat.url, 'https://api.deepseek.com/v1/chat/completions', 'chat sin tavily usa /chat/completions');

    // Búsqueda web explícita sin Tavily: muestra mensaje claro y NO rompe.
    NoMiState.busquedaWebActiva = false;
    let mensajesBot = [];
    const _ag = agregarMensaje;
    agregarMensaje = (quien, texto) => { if (quien === 'bot') mensajesBot.push(texto); };
    await procesarBusqueda('clima hoy');
    agregarMensaje = _ag;
    assert.ok(mensajesBot.length >= 1, 'búsqueda sin Tavily produce un mensaje');
    assert.ok(/Tavily/i.test(mensajesBot[0]), 'búsqueda sin Tavily informa claramente sobre Tavily: ' + mensajesBot[0]);

    // ===== 6) Regresión NoMi / HUD / credenciales =====
    // 6a) Modo por defecto sigue siendo openrouter.
    eliminarValor(STORAGE_MODO_ACCESO);
    assert.strictEqual(getModoAcceso(), MODO_ACCESO_OPENROUTER, 'modo por defecto sigue siendo openrouter');

    // 6b) HUD Personal activo cuando hay credenciales en modo openrouter.
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.credencialesCargadas = true; NoMiState.apiKeyActual = 'sk'; NoMiState.nomiAccesoActivo = false;
    NoMiState.isWaiting = false; NoMiState.estadoHud = null;
    actualizarHud();
    assert.strictEqual(document.getElementById('nomi-hud-status').textContent, 'Personal · Activo', 'HUD Personal activo (regresión)');

    // 6c) llamarIA usa /chat/completions (OpenAI-compatible) sin tocar NoMi.
    setApiKey('sk-or-x'); NoMiState.apiKeyActual = 'sk-or-x'; NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1';
    let urlIA = null;
    responder = async (url) => { urlIA = url; return { choices: [{ message: { content: 'x' } }] }; };
    const rIA = await llamarIA('hola');
    assert.strictEqual(urlIA, 'https://openrouter.ai/api/v1/chat/completions', 'llamarIA va a /chat/completions');
    assert.strictEqual(rIA, 'x');

    // 6d) NoMi intacto: chat NoMi no hace fallback a OpenRouter.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123'); setNomiAccesoActivo(true);
    NoMiState.isWaiting = false; NoMiState.historial = [];
    let llamadasOR = 0, llamadasWorker = 0;
    responder = async (url) => {
        if (url.includes('/v1/chat')) { llamadasWorker++; return { ok: true, respuesta: 'NoMi ok' }; }
        if (url.includes('openrouter') || url.includes('/chat/completions')) { llamadasOR++; return { choices: [{ message: { content: 'x' } }] }; }
        throw new Error('inesperado: ' + url);
    };
    await preguntar('hola nomi');
    assert.strictEqual(llamadasWorker, 1, 'NoMi: llama al Worker');
    assert.strictEqual(llamadasOR, 0, 'NoMi: NUNCA llama a OpenRouter');

    // 6e) Importación .enc con solo API key (sin Tavily) es válida.
    const jsonSoloApi = JSON.stringify({ openrouter: 'sk-importada', modelo: 'gpt-4o-mini', url: 'https://api.mistral.ai/v1' });
    const creds = JSON.parse(jsonSoloApi);
    assert.ok(creds.openrouter, 'validación de importación acepta solo API key');
    setApiKey(creds.openrouter);
    if (creds.tavily) setTavilyKey(creds.tavily); else setTavilyKey('');
    if (creds.modelo) setModelo(creds.modelo);
    if (creds.url) setUrlBase(creds.url);
    assert.strictEqual(getApiKey(), 'sk-importada', 'importación solo-api guarda la key');
    assert.strictEqual(getUrlBase(), 'https://api.mistral.ai/v1', 'importación solo-api guarda url propia');

    console.log('OK: todas las pruebas de API Personal (OpenAI-compatible) pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

// Conecta hacerPeticion al mock controlado.
const combinado = fuentes.join('\n') + '\n' + `
let responder = null;
hacerPeticion = async (url, opts) => {
    if (!responder) throw new Error('No hay mock configurado para hacerPeticion');
    return await responder(url, opts);
};
` + pruebas;

vm.runInContext(combinado, ctx, { filename: 'nomi-api-personal-test.js' });
