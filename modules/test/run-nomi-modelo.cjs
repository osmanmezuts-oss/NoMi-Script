// Pruebas de integración cliente: verificación del modelo al iniciar y mapeo de
// las causas de capacidad a mensaje humano + HUD.
//
// Cobertura de los dos defectos corregidos:
//  - Modo NoMi: verificarModeloAlIniciar() valida NoMiState.nomiModelo contra el
//    catálogo real del Worker (GET /v1/catalog) y JAMÁS consulta OpenRouter ni
//    muestra el aviso "retirado gratis" (solo Personal lo conserva).
//  - Cada causa de capacidad (limite-por-minuto, capacidad-diaria, bolsa-agotada,
//    limite-proveedor, cuota-mensual-agotada) produce el mensaje de recuperación y el HUD correctos.
//
// Ejecutar: node modules/test/run-nomi-modelo.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const MOD = path.join(ROOT, 'modules');

function leer(nombre) { return fs.readFileSync(path.join(MOD, nombre), 'utf8'); }

const fuentes = [
    leer('nomi-config-estatica.js'),
    leer('nomi-state.js'),
    leer('nomi-persistencia.js'),
    leer('nomi-red.js'),
    leer('nomi-acceso-nomi.js'),
    leer('nomi-modelos-free.js'),
    leer('nomi-ui.js'),
];

// ---- Entorno simulado del navegador ----
const store = new Map();    // GM_getValue / GM_setValue
const memLocal = new Map(); // localStorage
const memSession = new Map(); // sessionStorage
const elementos = new Map(); // DOM por id

class NodoStub {
    constructor(tag) {
        this.tagName = tag;
        this.style = {};
        this.children = [];
        this.parentNode = null;
        this.nextSibling = null;
        this.textContent = '';
        this._id = '';
    }
    set id(v) { this._id = v; if (v) elementos.set(v, this); }
    get id() { return this._id; }
    setAttribute(k, v) { this[k] = v; }
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    insertBefore(n, ref) { this.children.push(n); if (n) n.parentNode = this; }
    remove() { if (this._id) elementos.delete(this._id); this._id = ''; }
    addEventListener() {}
    removeEventListener() {}
}

// Variables controlables desde el código de la prueba. Se exponen al contexto
// vm mediante getters/setters compartidos (ver defineProperty al final), de modo
// que tanto el stub de GM_xmlhttpRequest (este archivo) como el código de la
// prueba (vm) lean y escriban el MISMO estado.
const controles = {
    responderHacerPeticion: null, // (url, opts) => Promise
    gmStatusOpenRouter: 200,
    gmResponseOpenRouter: '{}',
    gmErrorOpenRouter: false,
    cntOpenRouter: 0, // contador de llamadas GM_xmlhttpRequest a OpenRouter
};

const ctx = {
    console,
    assert,
    location: { href: 'https://example.com', hostname: 'example.com' },
    localStorage: {
        getItem: (k) => (memLocal.has(k) ? memLocal.get(k) : null),
        setItem: (k, v) => memLocal.set(k, String(v)),
        removeItem: (k) => memLocal.delete(k),
    },
    sessionStorage: {
        getItem: (k) => (memSession.has(k) ? memSession.get(k) : null),
        setItem: (k, v) => memSession.set(k, String(v)),
        removeItem: (k) => memSession.delete(k),
    },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => store.set(k, v),
    GM_deleteValue: (k) => store.delete(k),
    // Stub de la petición XHR de los userscripts para la ruta OpenRouter.
    GM_xmlhttpRequest: (opts) => {
        controles.cntOpenRouter++;
        if (controles.gmErrorOpenRouter) {
            if (opts.onerror) opts.onerror({});
            return;
        }
        if (opts.onload) {
            opts.onload({ status: controles.gmStatusOpenRouter, responseText: controles.gmResponseOpenRouter, responseHeaders: '' });
        }
    },
    document: {
        getElementById: (id) => (elementos.has(id) ? elementos.get(id) : null),
        createElement: (tag) => new NodoStub(tag),
        createTextNode: (t) => ({ textContent: t }),
        body: { appendChild() {} },
    },
    TextEncoder,
    TextDecoder,
    obtenerInstalacionId: () => 'nmi-modelo-test',
    registrarError: () => {},
    mostrarNotificacionTemporal: () => {},
};
ctx.window = ctx;
// Expone los controles compartidos al vm: las lecturas/escrituras del código
// de la prueba y del stub de GM_xmlhttpRequest apuntan al mismo estado.
for (const clave of Object.keys(controles)) {
    Object.defineProperty(ctx, clave, {
        get: () => controles[clave],
        set: (valor) => { controles[clave] = valor; },
        configurable: true,
    });
}
vm.createContext(ctx);

const pruebas = `
let peticionesNoMi = [];          // urls consultadas vía hacerPeticion

function reiniciarSesion() {
    sessionStorage.removeItem('nomi_modelo_verificado');
    sessionStorage.removeItem('nomi_modelos_free_cache');
}

// Mock determinista de hacerPeticion (la red real no existe en las pruebas).
hacerPeticion = async (url, opts) => {
    peticionesNoMi.push(String(url));
    if (!responderHacerPeticion) throw new Error('No hay mock para hacerPeticion');
    return await responderHacerPeticion(String(url), opts);
};

(async () => {
    // =========== A) Modo NoMi ===========
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiAccesoActivo(true);
    setNomiToken('TOK-NOMI-1');
    setNomiModelo('openai/gpt-oss-120b');
    setModelo('modelo/personal-inexistente:free'); // no debe influir en NoMi
    peticionesNoMi = [];
    cntOpenRouter = 0;
    gmStatusOpenRouter = 200; gmResponseOpenRouter = '{}'; gmErrorOpenRouter = false;
    responderHacerPeticion = async (url) => {
        if (url.endsWith('/v1/catalog')) {
            return { modelos: [
                { proveedor: 'groq', id: 'openai/gpt-oss-120b', estado: 'activo', nombre: 'GPT-OSS 120B' },
                { proveedor: 'groq', id: 'openai/gpt-oss-20b', estado: 'activo', nombre: 'GPT-OSS 20B' },
            ] };
        }
        if (url.includes('openrouter.ai')) throw new Error('OpenRouter NO debe consultarse en modo NoMi');
        throw new Error('URL inesperada en modo NoMi: ' + url);
    };
    reiniciarSesion();
    await verificarModeloAlIniciar();
assert.strictEqual(peticionesNoMi.length, 1, 'NoMi consulta UNA sola vez (catálogo del Worker)');
    assert.ok(peticionesNoMi[0].endsWith('/v1/catalog'), 'NoMi usa el catálogo real del Worker');
    assert.ok(!peticionesNoMi.some(u => u.includes('openrouter.ai')), 'NoMi NUNCA consulta OpenRouter');
    assert.strictEqual(cntOpenRouter, 0, 'NoMi no llama al endpoint gratuito de OpenRouter');
    assert.strictEqual(document.getElementById('nomi-modelo-aviso'), null, 'GPT-OSS 120B activo: sin aviso falso');
    console.log('  [A1] NoMi + GPT-OSS 120B activo: no consulta OpenRouter ni muestra aviso falso');

    // Modelo NoMi NO activo en el catálogo del Worker -> aviso NoMi (no el de OpenRouter).
    setNomiModelo('openai/gpt-oss-40b');
    peticionesNoMi = [];
    responderHacerPeticion = async (url) => {
        if (url.endsWith('/v1/catalog')) {
            return { modelos: [{ proveedor: 'groq', id: 'openai/gpt-oss-120b', estado: 'activo' }] };
        }
        if (url.includes('openrouter.ai')) throw new Error('OpenRouter NO debe consultarse en modo NoMi');
        throw new Error('URL inesperada: ' + url);
    };
    reiniciarSesion();
    await verificarModeloAlIniciar();
    const avisoNoMi = document.getElementById('nomi-modelo-aviso');
    assert.ok(avisoNoMi, 'modelo no activo en NoMi muestra aviso');
    assert.ok(!avisoNoMi.textContent.includes('ya no está disponible gratis'), 'no usa el aviso retirado de OpenRouter');
    assert.ok(avisoNoMi.textContent.includes('catálogo NoMi'), 'aviso específico del catálogo NoMi');
    assert.ok(peticionesNoMi.every(u => !u.includes('openrouter.ai')), 'sigue sin consultar OpenRouter');
    console.log('  [A2] NoMi con modelo no activo: aviso NoMi propio y cero OpenRouter');

    // Catálogo NoMi inalcanzable -> aviso de verificación, sin marcar retirado.
    setNomiModelo('openai/gpt-oss-120b');
    peticionesNoMi = [];
    responderHacerPeticion = async (url) => {
        if (url.endsWith('/v1/catalog')) throw new Error('red caída');
        throw new Error('URL inesperada: ' + url);
    };
    reiniciarSesion();
    await verificarModeloAlIniciar();
    const avisoFallido = document.getElementById('nomi-modelo-aviso');
    assert.ok(avisoFallido && avisoFallido.textContent.includes('No se pudo verificar disponibilidad'),
        'fallo de catálogo NoMi -> aviso de verificación');
    assert.ok(peticionesNoMi.every(u => !u.includes('openrouter.ai')), 'fallo de red NoMi tampoco cae en OpenRouter');
    console.log('  [A3] NoMi sin catálogo disponible: aviso de verificación, sin OpenRouter ni retirado');
// =========== B) Modo Personal conserva la comprobación OpenRouter ===========
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    setNomiAccesoActivo(false);
    setModelo('openai/gpt-oss-20b:free');
    // Catálogo OpenRouter SIN el modelo actual -> aviso retirado.
    peticionesNoMi = [];
    cntOpenRouter = 0;
    gmStatusOpenRouter = 200;
    gmResponseOpenRouter = JSON.stringify({ data: [
        { id: 'otro-modelo:free', pricing: { prompt: 0, completion: 0 } },
    ] });
    gmErrorOpenRouter = false;
    reiniciarSesion();
    await verificarModeloAlIniciar();
    assert.strictEqual(cntOpenRouter, 1, 'Personal consulta OpenRouter');
    assert.ok(peticionesNoMi.every(u => !u.endsWith('/v1/catalog')), 'Personal no consulta el catálogo del Worker');
    const avisoRetirado = document.getElementById('nomi-modelo-aviso');
    assert.ok(avisoRetirado && avisoRetirado.textContent.includes('ya no está disponible gratis'),
        'Personal conserva el aviso de modelo retirado de OpenRouter');
    console.log('  [B1] Personal: comprueba OpenRouter y avisa del modelo retirado');

    // Catálogo OpenRouter CON el modelo actual -> sin aviso.
    gmStatusOpenRouter = 200;
    gmResponseOpenRouter = JSON.stringify({ data: [
        { id: 'openai/gpt-oss-20b:free', pricing: { prompt: 0, completion: 0 } },
    ] });
    cntOpenRouter = 0;
    reiniciarSesion();
    await verificarModeloAlIniciar();
    assert.strictEqual(cntOpenRouter, 1, 'Personal vuelve a comprobar OpenRouter');
    assert.strictEqual(document.getElementById('nomi-modelo-aviso'), null, 'modelo disponible en Personal: sin aviso');
    console.log('  [B2] Personal: modelo disponible en OpenRouter -> sin aviso');

    // OpenRouter con rate limit (429) -> aviso limitado, no retirado.
    gmStatusOpenRouter = 429;
    gmResponseOpenRouter = 'rate limit';
    reiniciarSesion();
    await verificarModeloAlIniciar();
    const avisoLimitado = document.getElementById('nomi-modelo-aviso');
    assert.ok(avisoLimitado && avisoLimitado.textContent.includes('limitado'), '429 de OpenRouter -> aviso limitado');
    assert.ok(!avisoLimitado.textContent.includes('retirado'), '429 no marca modelo retirado');
    console.log('  [B3] Personal: 429 de OpenRouter -> aviso limitado (no retirado)');

// =========== C) Causas de capacidad -> mensaje y HUD correctos ===========
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiAccesoActivo(true);
    function eHttp(status, codigo) {
        const e = new Error(status + (codigo ? ' ' + codigo : ''));
        e.status = status;
        if (codigo) e.codigo = codigo;
        return e;
    }

    let msj = mensajeHumanoErrorNoMi(eHttp(503, 'limite-por-minuto'));
    assert.ok(msj.includes('Espera un minuto y reintenta'), 'TPM: mensaje de recuperación concreto');
    mapearErrorHudNoMi(eHttp(503, 'limite-por-minuto'));
    assert.strictEqual(NoMiState.estadoHud, 'capacidad', 'TPM: HUD de capacidad');
    console.log('  [C1] limite-por-minuto -> "Espera un minuto y reintenta" + HUD capacidad');

    msj = mensajeHumanoErrorNoMi(eHttp(503, 'capacidad-diaria'));
    assert.ok(msj.includes('capacidad diaria') && msj.includes('mañana'), 'capacidad diaria: mensaje concreto');
    mapearErrorHudNoMi(eHttp(503, 'capacidad-diaria'));
    assert.strictEqual(NoMiState.estadoHud, 'capacidad');
    console.log('  [C2] capacidad-diaria -> mensaje diario + HUD capacidad');

    msj = mensajeHumanoErrorNoMi(eHttp(503, 'bolsa-agotada'));
    assert.ok(msj.includes('bolsa compartida'), 'bolsa agotada: mensaje concreto');
    mapearErrorHudNoMi(eHttp(503, 'bolsa-agotada'));
    assert.strictEqual(NoMiState.estadoHud, 'capacidad');
    console.log('  [C3] bolsa-agotada -> mensaje de bolsa + HUD capacidad');

    msj = mensajeHumanoErrorNoMi(eHttp(429, 'cuota-mensual-agotada'));
    assert.ok(msj.toLowerCase().includes('límite'), 'cuota mensual: mensaje de límite de uso');
    mapearErrorHudNoMi(eHttp(429, 'cuota-mensual-agotada'));
    assert.strictEqual(NoMiState.estadoHud, 'limite', 'cuota mensual: HUD de límite');
    console.log('  [C4] cuota-mensual-agotada -> mensaje de límite de uso + HUD límite');

    // límite-proveedor (HTTP 429 real de Groq: TPM/RPM/TPD/RPD) -> mensaje y HUD diferenciados.
    msj = mensajeHumanoErrorNoMi(eHttp(429, 'limite-proveedor'));
    assert.ok(msj.includes('proveedor') && msj.includes('Espera'), 'limite-proveedor: mensaje de límite del proveedor');
    mapearErrorHudNoMi(eHttp(429, 'limite-proveedor'));
    assert.strictEqual(NoMiState.estadoHud, 'capacidad', 'limite-proveedor: HUD de capacidad (no límite personal)');
    console.log('  [C5] limite-proveedor -> mensaje de límite del proveedor + HUD capacidad');

    // Respaldo por status (Worker antiguo sin código estable).
    msj = mensajeHumanoErrorNoMi(eHttp(503, ''));
    assert.ok(msj.includes('capacidad'), '503 legacy: mensaje de capacidad');
    mapearErrorHudNoMi(eHttp(503, ''));
    assert.strictEqual(NoMiState.estadoHud, 'capacidad', '503 legacy: HUD capacidad');
    msj = mensajeHumanoErrorNoMi(eHttp(429, ''));
    assert.ok(msj.toLowerCase().includes('límite'), '429 legacy: mensaje de límite');
    console.log('  [C6] Respaldo por status sin código estable conserva 429/503');

    console.log('OK: todas las pruebas de modelo al iniciar y capacidad pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

vm.runInContext(fuentes.join('\n') + '\n' + pruebas, ctx, { filename: 'run-nomi-modelo-test.js' });