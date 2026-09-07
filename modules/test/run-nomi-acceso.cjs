// Pruebas de integración cliente "Acceso compartido NoMi" (sin dependencias externas).
// Carga los módulos en un contexto vm con stubs y un hacerPeticion controlado.
// Ejecutar: node modules/test/run-nomi-acceso.cjs

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
    leer('nomi-ui.js'),
    leer('nomi-chat.js'),
    leer('nomi-core.js'),
    leer('nomi-modelos-free.js'),
];

// ---- Entorno simulado del navegador ----
const store = new Map();
const memLocal = new Map();
const memSession = new Map();

// Shared state for avisos (captured by closure in functions below)
const sharedState = {
    _avisos: {
        'nomi-modelo-aviso': null,
        'nomi-modelo-display': { textContent: '', style: {} },
        'nomi-proveedor-display': { textContent: '', style: {} },
        'nomi-hud-status': { textContent: '', style: {} },
        'nomi-hud-quota': { textContent: '', style: { display: 'none' } },
        'nomi-loading': { style: { display: 'none' }, dataset: {}, children: [] },
        'nomi-dots': { textContent: '' },
        'nomi-input': { style: {}, disabled: false, value: '', focus: () => {} },
        'nomi-enviar': { style: {}, disabled: false },
        'nomi-search-btn': { style: {}, disabled: false },
    },
};

let responder = null; // (url, opts) => Promise

const ctx = {
    console,
    assert,
    sharedState,
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
    mostrarNotificacionTemporal: () => {},
    registrarError: () => {},
    obtenerInstalacionId: () => 'nmi-test',
    obtenerContextoTiempo: () => 'Fecha: 2026-09-07',
    obtenerAnclajeTemporal: () => ({ fecha: '2026-09-07', hora: '12:00', zona: 'America/La_Paz', offset: 'UTC-04:00' }),
    extraerInformacionPagina: () => ({ titulo: 'Ejemplo', url: 'https://example.com', metaDesc: '', encabezados: [], texto: '' }),
    requiereBusqueda: () => false,
    agregarMensaje: () => {},
    actualizarStats: () => {},
    mostrarCargando: () => {},
    ocultarCargando: () => {},
    actualizarContextoIndicador: () => {},
    actualizarBarraUbicacion: () => {},
    toggleVentana: () => {},
    toggleBurbuja: () => {},
    cargarHistorial: () => {},
    setContador: () => {},
    setTokens: () => {},
    setResumen: () => {},
    mostrarEstadisticas: () => {},
    mostrarExportacion: () => {},
    mostrarAyuda: () => {},
    guardarHistorial: () => {},
    TextEncoder,
    TextDecoder,
    setTimeout, clearTimeout, setInterval, clearInterval,
    // Stubs para avisos de modelo (cierran sobre sharedState)
    limpiarAvisoModelo: () => { sharedState._avisos['nomi-modelo-aviso'] = null; },
    mostrarAvisoModeloRetirado: () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'retirado', style: {} }; },
    mostrarAvisoModeloNoDisponibleNoMi: () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'NoMi no disponible', style: {} }; },
    mostrarAvisoVerificacion: () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'verificacion', style: {} }; },
    // DOM stub que lee sharedState
    document: {
        getElementById: (id) => {
            if (id in sharedState._avisos) return sharedState._avisos[id];
            return { style: {}, setAttribute() {}, appendChild() {} };
        },
        createElement: (tag) => {
            const el = { tagName: tag.toUpperCase(), style: {}, children: [], setAttribute() {}, appendChild(c) { this.children.push(c); return c; } };
            if (tag === 'option') el.selected = false;
            return el;
        },
        createTextNode: (t) => ({ textContent: String(t) }),
        body: { appendChild() {} },
    },
};
ctx.window = ctx; // en el navegador window es el global; aqui tambien.
vm.createContext(ctx);

// Código que sustituye hacerPeticion por el mock controlado y corre las pruebas.
const pruebas = `
let llamadasHP = 0;
hacerPeticion = async (url, opts) => {
    llamadasHP++;
    if (!responder) throw new Error('No hay mock configurado para hacerPeticion');
    return await responder(url, opts);
};

(async () => {
    // nomi-modelos-free.js redefine las funciones declaradas en ctx al cargarse.
    // Reaplicar stubs observables para comprobar la limpieza de avisos sin DOM real.
    limpiarAvisoModelo = () => { sharedState._avisos['nomi-modelo-aviso'] = null; };
    mostrarAvisoModeloRetirado = () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'retirado', style: {} }; };
    mostrarAvisoModeloNoDisponibleNoMi = () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'NoMi no disponible', style: {} }; };
    mostrarAvisoVerificacion = () => { sharedState._avisos['nomi-modelo-aviso'] = { textContent: 'verificacion', style: {} }; };

    // 1) Modo por defecto es OpenRouter.
    assert.strictEqual(getModoAcceso(), MODO_ACCESO_OPENROUTER, 'modo por defecto debe ser openrouter');
    assert.strictEqual(getModoAcceso(), 'openrouter');

    // 2) No se guardan secretos del Worker: las claves de almacenamiento NoMi
    //    son únicamente URL + token opaco. El módulo no menciona secretos.
    const fuenteAcceso = __FUENTE_ACCESO__;
    assert.ok(!/GROQ_API_KEY|ADMIN_SECRET|ACCESS_TOKEN_SECRET/.test(fuenteAcceso),
        'el modulo de acceso NoMi no debe referenciar secretos del Worker');
    assert.strictEqual(STORAGE_NOMI_TOKEN, 'nomi_token');
    assert.strictEqual(STORAGE_NOMI_WORKER_URL, 'nomi_worker_url');

    // 3) Activación correcta guarda token y marca acceso activo.
    responder = async (url, opts) => {
        if (url.endsWith('/v1/activate')) {
            assert.ok(opts.body && JSON.parse(opts.body).codigo === 'ABCD');
            return { ok: true, token: 'TOK123' };
        }
        if (url.endsWith('/v1/catalog')) {
            return { modelos: [{ proveedor: 'groq', id: 'openai/gpt-oss-20b', estado: 'activo', nombre: 'GPT-OSS 20B' }] };
        }
        throw new Error('endpoint inesperado: ' + url);
    };
    const resultado = await activarAccesoNoMi('abcd');
    assert.strictEqual(resultado.token, 'TOK123');
    assert.ok(resultado.catalogo, 'debe devolver el catálogo sincronizado');
    assert.strictEqual(getNomiToken(), 'TOK123');
    assert.strictEqual(getNomiAccesoActivo(), true);
    // El handler del menu cambia el modo a 'nomi' tras activar (simulado aqui).
    setModoAcceso(MODO_ACCESO_NOMI);
    assert.strictEqual(estadoAccesoNoMi(), 'activo');
    assert.strictEqual(getNomiModelo(), 'openai/gpt-oss-20b');

    // 4) Código inválido (400): lanza y NO guarda token.
    responder = async (url) => {
        if (url.endsWith('/v1/activate')) {
            const e = new Error('Error 400: invalida'); e.status = 400; throw e;
        }
        throw new Error('inesperado');
    };
    setNomiToken('');
    await assert.rejects(() => activarAccesoNoMi('ZZZZ'), /inv.lido|usado|caducado/i);
    assert.strictEqual(getNomiToken(), '', 'no debe guardar token tras fallo de activación');

    // 5) Capacidad llena (503): lanza error claro.
    responder = async (url) => {
        if (url.endsWith('/v1/activate')) {
            const e = new Error('Error 503: capacidad'); e.status = 503; throw e;
        }
        throw new Error('inesperado');
    };
    await assert.rejects(() => activarAccesoNoMi('LLENO'), /capacidad/i);

    // 6) Llamada a /v1/chat usa Bearer y cuerpo correcto.
    let llamada = null;
    responder = async (url, opts) => {
        if (url.endsWith('/v1/chat')) { llamada = { url, opts }; return { ok: true, respuesta: 'hola desde NoMi' }; }
        throw new Error('inesperado: ' + url);
    };
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    const texto = await llamarIANoMi('¿hola?');
    assert.strictEqual(texto, 'hola desde NoMi');
    assert.ok(llamada.url.endsWith('/v1/chat'), 'debe llamar a /v1/chat');
    assert.strictEqual(llamada.opts.headers.Authorization, 'Bearer TOK123');
    assert.strictEqual(JSON.parse(llamada.opts.body).modelo, 'openai/gpt-oss-20b');
    assert.strictEqual(JSON.parse(llamada.opts.body).mensaje, '¿hola?');

    // 7) 401 -> token inválido/revocado, sin fallback a OpenRouter.
    responder = async (url) => {
        if (url.endsWith('/v1/chat')) {
            const e = new Error('Error 401: acceso invalido'); e.status = 401; throw e;
        }
        throw new Error('inesperado');
    };
    let fallo = null;
    try { await llamarIANoMi('x'); } catch (e) { fallo = e; }
    assert.ok(fallo instanceof NoMiTokenInvalidoError, 'debe lanzar NoMiTokenInvalidoError');
    assert.ok(/revoc|inv.lid/i.test(fallo.message), 'mensaje debe indicar revocado/inválido');
    assert.strictEqual(getNomiAccesoActivo(), false, 'acceso debe marcarse inactivo tras 401');
    assert.strictEqual(estadoAccesoNoMi(), 'revocado');

    // 8) Modo OpenRouter intacto: llamarIA usa OpenRouter (sin tocar NoMi).
    setModoAcceso('openrouter');
    setApiKey('sk-or-test');
    NoMiState.apiKeyActual = 'sk-or-test';
    responder = async (url, opts) => {
        assert.ok(url.includes('/chat/completions'), 'OpenRouter debe ir a /chat/completions');
        return { choices: [{ message: { content: 'respuesta openrouter' } }] };
    };
    const r = await llamarIA('hola');
    assert.strictEqual(r, 'respuesta openrouter');

    // 9) Catálogo devuelve modelos sin exponer claves.
    responder = async (url) => {
        if (url.endsWith('/v1/catalog')) return { modelos: [{ proveedor: 'groq', id: 'openai/gpt-oss-120b', estado: 'activo', nombre: 'GPT-OSS 120B' }] };
        throw new Error('inesperado');
    };
    const cat = await obtenerCatalogoNoMi();
    assert.strictEqual(cat.modelos[0].id, 'openai/gpt-oss-120b');

    // 10) Arranque NoMi sin OpenRouter: no exige configuración ni abre asistente.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    setCredencialesCargadas(false);
    setConfigInicial(false);
    assert.strictEqual(debeMostrarConfiguracionInicial(), false, 'modo NoMi activo no debe mostrar asistente de configuracion');
    setModoAcceso('openrouter');
    assert.strictEqual(debeMostrarConfiguracionInicial(), true, 'openrouter sin credenciales debe mostrar asistente');

    // 11) Token revocado: ejecutar preguntar() con DOM mínimo y CERO llamadas a hacerPeticion.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(false);
    NoMiState.isWaiting = false;
    llamadasHP = 0;
    await preguntar('hola');
    assert.strictEqual(llamadasHP, 0, 'preguntar con token revocado no debe llamar a hacerPeticion');
    assert.strictEqual(puedeUsarAccesoNoMi(), false, 'token inactivo no debe permitir usar NoMi');
    setNomiAccesoActivo(true);
    assert.strictEqual(puedeUsarAccesoNoMi(), true, 'token activo sí debe permitir usarlo');

    // 12) Endpoint fijo: nomiWorkerBase ignora URL persistida; reset la corrige.
    setNomiWorkerUrl('https://evil.example.com');
    assert.strictEqual(nomiWorkerBase(), NOMI_WORKER_URL_POR_DEFECTO, 'el endpoint debe ser fijo');
    resetearUrlWorkerNoMi();
    assert.strictEqual(getNomiWorkerUrl(), NOMI_WORKER_URL_POR_DEFECTO, 'URL persistida debe resetearse a la oficial');

    // 13) Catálogo público: GET /v1/catalog NO debe enviar Authorization.
    let headersCatalogo = null;
    responder = async (url, opts) => {
        if (url.endsWith('/v1/catalog')) { headersCatalogo = opts.headers; return { modelos: [] }; }
        throw new Error('inesperado');
    };
    await obtenerCatalogoNoMi();
    assert.strictEqual(headersCatalogo.Authorization, undefined, 'GET /v1/catalog no debe enviar Authorization');

    // 14) Preservación de mensajeFinal (fecha, ubicación, contenido de página) y límites.
    NoMiState.historial = [];
    for (let i = 0; i < 50; i++) NoMiState.historial.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'Turno numero ' + i + ' con contexto.' });
    NoMiState.resumenPersistente = 'Resumen de prueba.';
    NoMiState.contextoSeleccionado = 10;
    NoMiState.modoResumenActivo = true;
    const NL = String.fromCharCode(10);
    const mensajeFinal = ['Fecha: 2026-08-19', 'Ubicación del usuario: Madrid, España', 'INFORMACIÓN DE LA PÁGINA ACTUAL:', 'Título: Ejemplo', 'Contenido principal: texto de la página', 'Pregunta del usuario: ¿Cuál es la capital de Francia?'].join(NL);
    const msgCtx = construirMensajeWorkerNoMi(mensajeFinal);
    assert.ok(msgCtx.includes('¿Cuál es la capital de Francia?'), 'debe incluir la pregunta');
    assert.ok(msgCtx.includes('Madrid, España'), 'debe incluir la ubicación del mensajeFinal');
    assert.ok(msgCtx.includes('texto de la página'), 'debe incluir el contenido de página');
    assert.ok(msgCtx.includes('Resumen de prueba.'), 'debe incluir el resumen');
    assert.ok(msgCtx.includes('Turno numero'), 'debe incluir turnos recientes');
    assert.ok(msgCtx.includes(NOMI_PERSONA_SISTEMA), 'debe incluir la persona de sistema');
    assert.ok(byteLengthUTF8(msgCtx) <= 6000, 'no debe superar 6000 bytes');

    // 15) Resumen enorme se recorta para respetar 6000 bytes, conservando el prompt.
    NoMiState.historial = [];
    NoMiState.resumenPersistente = 'r'.repeat(20000);
    const promptLargo = 'Mi pregunta enorme de contexto';
    const msgResumen = construirMensajeWorkerNoMi(promptLargo);
    assert.ok(byteLengthUTF8(msgResumen) <= 6000, 'con resumen enorme debe respetar 6000 bytes');
    assert.ok(msgResumen.includes('Mi pregunta enorme de contexto'), 'debe conservar el prompt con resumen enorme');

    // 16) Pregunta multibyte enorme: se recorta UTF-8 de forma segura (sin caracteres rotos).
    const preguntaMulti = '😀'.repeat(4000);
    const msgMulti = construirMensajeWorkerNoMi(preguntaMulti);
    assert.ok(byteLengthUTF8(msgMulti) <= 6000, 'pregunta multibyte enorme debe respetar 6000 bytes');
    assert.ok(msgMulti.startsWith(NOMI_PERSONA_SISTEMA), 'debe empezar por la persona');
    assert.ok(msgMulti.includes('😀'), 'debe conservar emojis (recorte UTF-8 seguro, sin caracteres rotos)');

    // 16b) Dentro del límite, la pregunta enriquecida se preserva por completo.
    const promptCorto = 'x'.repeat(200) + ' MARCADOR_FINAL';
    const msgCorto = construirMensajeWorkerNoMi(promptCorto);
    assert.ok(byteLengthUTF8(msgCorto) <= 6000, 'prompt corto debe respetar 6000 bytes');
    assert.ok(msgCorto.includes('MARCADOR_FINAL'), 'dentro del límite debe preservar la pregunta completa');

    // 17) mensajeFinal con contenido de página enorme: la pregunta final distintiva se conserva.
    NoMiState.historial = [];
    NoMiState.resumenPersistente = '';
    NoMiState.modoResumenActivo = false;
    const NL2 = String.fromCharCode(10);
    const paginaEnorme = 'Contenido de pagina ' + 'z'.repeat(30000);
    const mf = [paginaEnorme, 'Pregunta del usuario: MARCADOR_PREGUNTA_DISTINTIVA_123'].join(NL2);
    const msgPg = construirMensajeWorkerNoMi(mf);
    assert.ok(byteLengthUTF8(msgPg) <= 6000, 'con pagina enorme debe respetar 6000 bytes');
    assert.ok(msgPg.includes('MARCADOR_PREGUNTA_DISTINTIVA_123'), 'la pregunta final debe seguir presente');
    assert.ok(msgPg.endsWith('MARCADOR_PREGUNTA_DISTINTIVA_123'), 'la pregunta debe quedar como bloque final');
    assert.ok(msgPg.includes(NOMI_PERSONA_SISTEMA), 'debe incluir la persona');

    // 18) Caso limite: persona + resumen + historial enormes deben respetar <=6000 en cualquier caso.
    NoMiState.historial = [];
    for (let i = 0; i < 20; i++) NoMiState.historial.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'x'.repeat(50000) });
    NoMiState.resumenPersistente = 'r'.repeat(50000);
    NoMiState.contextoSeleccionado = 10;
    NoMiState.modoResumenActivo = true;
    const msgLimite = construirMensajeWorkerNoMi('Pregunta del usuario: pregunta de control');
    assert.ok(byteLengthUTF8(msgLimite) <= 6000, 'debe respetar 6000 bytes con entradas enormes');
    assert.ok(msgLimite.includes(NOMI_PERSONA_SISTEMA), 'persona presente');
    assert.ok(msgLimite.includes('Pregunta del usuario: pregunta de control'), 'pregunta final presente');

    // 19) construirMensajeResumenNoMi con historial enorme y multibyte.
    const hist = [];
    for (let i = 0; i < 50; i++) hist.push({ role: 'user', content: '😀'.repeat(2000) + ' turno ' + i });
    const msgRes = construirMensajeResumenNoMi(hist);
    assert.ok(byteLengthUTF8(msgRes) <= 6000, 'resumen debe respetar 6000 bytes');
    assert.ok(msgRes.includes('Eres un asistente que resume conversaciones'), 'debe incluir la instrucción');
    assert.ok(msgRes.includes('😀'), 'debe incluir contenido multibyte del historial');

    // 20) Prueba de frontera REAL: persona + contexto + historial llenan el
    //     presupuesto disponible hasta el límite. El presupuesto debe contar
    //     EXACTAMENTE todos los bytes concatenados, incluido el separador
    //     inicial de salto de linea doble del bloque de historial. Si ese
    //     separador no se contara, el mensaje rebasaria en 2 bytes (6002 > 6000).
    NoMiState.historial = [];
    NoMiState.resumenPersistente = '';
    NoMiState.contextoSeleccionado = 10;
    NoMiState.modoResumenActivo = false;
    const NLf = String.fromCharCode(10);
    const mfFrontera = ['Fecha: 2026-08-19', 'Ubicación del usuario: Madrid, España', 'INFORMACIÓN DE LA PÁGINA ACTUAL:', 'Título: Ejemplo', 'Contenido principal: contexto de página para frontera', 'Pregunta del usuario: PREGUNTA_FRONTERA_FINAL'].join(NLf);
    const TOK_HIST = 'MARCA_HISTORIAL_UNICA_';
    function incluyeHistorial(L) {
        NoMiState.historial = [{ role: 'user', content: TOK_HIST + 'x'.repeat(L) }];
        return construirMensajeWorkerNoMi(mfFrontera).includes(TOK_HIST);
    }
    // Búsqueda binaria del mayor contenido de historial que aún cabe entero.
    let lo = 0, hi = 6000, Lmax = 0;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (incluyeHistorial(mid)) { Lmax = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    NoMiState.historial = [{ role: 'user', content: TOK_HIST + 'x'.repeat(Lmax) }];
    const msgFrontera = construirMensajeWorkerNoMi(mfFrontera);
    const bytesFrontera = byteLengthUTF8(msgFrontera);
    assert.ok(bytesFrontera <= 6000, 'frontera: con el mayor historial que cabe, debe respetar <= 6000 bytes (incluido el separador inicial). Bytes=' + bytesFrontera);
    assert.ok(bytesFrontera > 5000, 'frontera: el mensaje debe llenar el presupuesto disponible. Bytes=' + bytesFrontera);
    assert.ok(msgFrontera.includes(TOK_HIST), 'frontera: el historial límite debe estar incluido');
    assert.ok(msgFrontera.includes('PREGUNTA_FRONTERA_FINAL'), 'frontera: la pregunta final debe estar presente');
    assert.ok(msgFrontera.includes('Historial reciente'), 'frontera: el bloque de historial debe estar presente');
    // Un solo byte más ya no cabe: el presupuesto (con su separador inicial) se respeta estrictamente.
    NoMiState.historial = [{ role: 'user', content: TOK_HIST + 'x'.repeat(Lmax + 1) }];
    const msgFrontera2 = construirMensajeWorkerNoMi(mfFrontera);
    assert.ok(!msgFrontera2.includes(TOK_HIST), 'frontera: un byte más ya excede el presupuesto y se descarta el historial');
    assert.ok(byteLengthUTF8(msgFrontera2) <= 6000, 'frontera: sin el historial también debe respetar <= 6000 bytes');

    // 20b) Identidad: NoMi se presenta como asistente virtual FEMENINA (persona al Worker).
    assert.ok(/una asistente virtual/.test(NOMI_PERSONA_SISTEMA), 'persona: "una asistente virtual"');
    assert.ok(/est[áa]s dise[ñn]ada/i.test(NOMI_PERSONA_SISTEMA), 'persona: "estás diseñada"');
    assert.ok(/femenino/.test(NOMI_PERSONA_SISTEMA), 'persona: instrucción de género femenino');
    assert.ok(!/un asistente/.test(NOMI_PERSONA_SISTEMA), 'persona: sin masculino genérico');
    assert.ok(!/asistente de navegaci[óo]n/.test(NOMI_PERSONA_SISTEMA), 'persona: sin identidad antigua');
    const msgPersona = construirMensajeWorkerNoMi('Pregunta del usuario: hola');
    assert.ok(msgPersona.includes('una asistente virtual'), 'mensaje al Worker incluye "una asistente virtual"');
    assert.ok(msgPersona.includes('femenino'), 'mensaje al Worker pide género femenino');
    assert.ok(/est[áa]s dise[ñn]ada/i.test(msgPersona), 'mensaje al Worker incluye "estás diseñada"');
    assert.ok(!/asistente de navegaci[óo]n/.test(msgPersona), 'mensaje al Worker sin saludo antiguo');

    // ===== Flujo completo de integración visual/funcional de modos IA =====
    // Mocks de DOM para capturar los indicadores superiores (nomi-proveedor-display
    // y nomi-modelo-display). Los stubs de getElementById del entorno no los tienen;
    // se sustituyen por un mapa real para estas pruebas.
    const __els = {
        'nomi-proveedor-display': { textContent: '', style: {} },
        'nomi-modelo-display': { textContent: '', style: {} },
        'nomi-hud-status': { textContent: '', style: {} },
        'nomi-hud-quota': { textContent: '', style: { display: 'none' } },
    };
    const __origGetElementById = document.getElementById.bind(document);
    // Reemplaza getElementById globalmente SOLO para los ids que capturamos.
    document.getElementById = (id) => (__els[id] ? __els[id] : __origGetElementById(id));

    // 21) Al elegir/activar Acceso compartido NoMi, el indicador muestra
    //     "NoMi Worker / Groq" y el modelo NoMi, de inmediato.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    setNomiModelo('openai/gpt-oss-120b');
    actualizarIndicador(); // se llama al activar/cambiar modo
    assert.strictEqual(__els['nomi-proveedor-display'].textContent, 'NoMi Worker / Groq',
        'indicador: en modo NoMi debe mostrar NoMi Worker / Groq');
    assert.strictEqual(__els['nomi-modelo-display'].textContent, 'openai/gpt-oss-120b',
        'indicador: debe mostrar el modelo NoMi elegido');

    // 22) Al elegir modelo NoMi (onchange del selector), el indicador se actualiza al instante.
    setNomiModelo('openai/gpt-oss-20b'); // onchange llama setNomiModelo + actualizarIndicador()
    actualizarIndicador();
    assert.strictEqual(__els['nomi-modelo-display'].textContent, 'openai/gpt-oss-20b',
        'indicador: elegir un modelo NoMi actualiza el modelo mostrado');

    // 23) preguntar() en modo NoMi llama SOLO a llamarIANoMi (Worker /v1/chat) y CERO OpenRouter.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.isWaiting = false;
    NoMiState.historial = [];
    let llamadasWorker = 0, llamadasOpenRouter = 0;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasWorker++; return { ok: true, respuesta: 'respuesta NoMi', busquedaProtocolo: 1, herramientasProtocolo: 1 }; }
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, solicitudes_usadas: 2, bolsa_global_disponible: 999, tokens_usados: 10 };
        if (url.includes('openrouter') || url.includes('/chat/completions')) { llamadasOpenRouter++; return { choices: [{ message: { content: 'x' } }] }; }
        throw new Error('inesperado: ' + url);
    };
    await preguntar('hola en modo NoMi');
    assert.strictEqual(llamadasWorker, 1, 'flujo nomi: debe llamar al Worker /v1/chat');
    assert.strictEqual(llamadasOpenRouter, 0, 'flujo nomi: NUNCA debe llamar a OpenRouter');
    // Tras respuesta exitosa, el HUD queda en "NoMi · Activo" y la cuota visible.
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'NoMi · Activo', 'tras respuesta NoMi el HUD debe decir Activo');
    assert.strictEqual(__els['nomi-hud-quota'].style.display, 'inline', 'cuota visible tras obtener uso');
    assert.ok(__els['nomi-hud-quota'].textContent.includes('10/50'), 'cuota muestra tokens/cuota: ' + __els['nomi-hud-quota'].textContent);
    assert.ok(__els['nomi-hud-quota'].textContent.includes('Créditos'), 'cuota usa etiqueta Créditos (no solicitudes): ' + __els['nomi-hud-quota'].textContent);

    // 24) Flujo inverso OpenRouter intacto: al volver a OpenRouter el indicador muestra OpenRouter.
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.urlBaseActual = 'https://openrouter.ai/api/v1';
    NoMiState.apiKeyActual = 'clave-or-test';
    NoMiState.credencialesCargadas = true;
    NoMiState.modeloActual = 'nvidia/nemotron-nano-8b-v1:free';
    actualizarIndicador();
    assert.strictEqual(__els['nomi-proveedor-display'].textContent, 'OpenRouter',
        'indicador: en modo OpenRouter debe mostrar OpenRouter');
    assert.strictEqual(__els['nomi-modelo-display'].textContent, 'nvidia/nemotron-nano-8b-v1:free',
        'indicador: en modo OpenRouter debe mostrar el modelo OpenRouter elegido');
    // preguntar en OpenRouter usa OpenRouter (no worker).
    NoMiState.isWaiting = false;
    NoMiState.historial = [];
    llamadasWorker = 0; llamadasOpenRouter = 0;
    responder = async (url) => {
        if (url.includes('/chat/completions')) { llamadasOpenRouter++; return { choices: [{ message: { content: 'resp OR' } }] }; }
        if (url.includes('/v1/chat')) { llamadasWorker++; return { ok: true, respuesta: 'x' }; }
        throw new Error('inesperado: ' + url);
    };
    await preguntar('hola openrouter');
    assert.strictEqual(llamadasOpenRouter, 1, 'flujo openrouter: debe llamar a OpenRouter');
    assert.strictEqual(llamadasWorker, 0, 'flujo openrouter: NO debe llamar al Worker');

    // 25) Al cambiar de modo, la sección OpenRouter del menú se deshabilita en NoMi.
    setModoAcceso(MODO_ACCESO_NOMI);
    assert.strictEqual(NoMiState.modoAcceso, MODO_ACCESO_NOMI, 'cambiar a nomi persiste el modo');
    // El indicador de proveedor debe seguir siendo NoMi tras el cambio de modo.
    actualizarIndicador();
    assert.strictEqual(__els['nomi-proveedor-display'].textContent, 'NoMi Worker / Groq',
        'indicador: tras cambiar a NoMi el proveedor se actualiza');

    // ===== HUD de estado NoMi / Personal =====
    // 26) HUD NoMi activo -> "NoMi · Activo".
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.isWaiting = false;
    NoMiState.estadoHud = null;
    establecerEstadoHud(null);
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'NoMi · Activo', 'HUD NoMi activo');

    // 27) HUD NoMi sin acceso -> "NoMi · Sin acceso".
    setNomiAccesoActivo(false);
    establecerEstadoHud(null);
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'NoMi · Sin acceso', 'HUD NoMi sin acceso');

    // 28) HUD Personal (OpenRouter) activo -> "Personal · Activo".
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.credencialesCargadas = true;
    NoMiState.apiKeyActual = 'sk-or-test';
    establecerEstadoHud(null);
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Personal · Activo', 'HUD Personal activo');

    // 29) Durante el envío (isWaiting) -> "Pensando…".
    NoMiState.isWaiting = true;
    actualizarHud();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Pensando…', 'HUD pensando');
    NoMiState.isWaiting = false;

    // 30) consultarUsoNoMi exitoso pinta cuota (tokens/cuota) y NO la bolsa global.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.usoNoMi = null;
    establecerEstadoHud(null);
    responder = async (url) => {
        if (url.includes('/v1/usage')) return { periodo: '2026-08', cuota_mensual_invitado: 50, solicitudes_usadas: 7, bolsa_global_disponible: 999, tokens_usados: 1234 };
        throw new Error('inesperado: ' + url);
    };
    await consultarUsoNoMi();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'NoMi · Activo', 'tras usage: NoMi Activo');
    assert.ok(__els['nomi-hud-quota'].textContent.includes('1234/50'), 'cuota muestra tokens/cuota: ' + __els['nomi-hud-quota'].textContent);
    assert.ok(__els['nomi-hud-quota'].textContent.includes('Créditos'), 'cuota usa etiqueta Créditos: ' + __els['nomi-hud-quota'].textContent);
    assert.ok(!__els['nomi-hud-quota'].textContent.includes('999'), 'NO debe mostrar bolsa global');
    assert.strictEqual(__els['nomi-hud-quota'].style.display, 'inline', 'cuota visible en NoMi');

    // 31) 401 en /v1/usage -> "Acceso no válido", acceso inactivo, limpia reintento.
    setNomiAccesoActivo(true);
    NoMiState.reintentarPregunta = 'x';
    responder = async (url) => { if (url.includes('/v1/usage')) { const e = new Error('401'); e.status = 401; throw e; } throw new Error('inesperado'); };
    await consultarUsoNoMi();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Acceso no válido', 'HUD 401');
    assert.strictEqual(getNomiAccesoActivo(), false, '401 marca acceso inactivo');
    assert.strictEqual(NoMiState.reintentarPregunta, '', '401 limpia reintento (no reusa token revocado)');

    // 32) 429 -> "Límite alcanzado".
    establecerEstadoHud(null);
    setNomiAccesoActivo(true);
    responder = async (url) => { if (url.includes('/v1/usage')) { const e = new Error('429'); e.status = 429; throw e; } throw new Error('inesperado'); };
    await consultarUsoNoMi();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Límite alcanzado', 'HUD 429');

    // 33) 503 -> "Capacidad limitada".
    establecerEstadoHud(null);
    responder = async (url) => { if (url.includes('/v1/usage')) { const e = new Error('503'); e.status = 503; throw e; } throw new Error('inesperado'); };
    await consultarUsoNoMi();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Capacidad limitada', 'HUD 503');

    // 34) Fallo de red (sin status) -> "No se pudo conectar" y conserva reintento.
    establecerEstadoHud(null);
    NoMiState.reintentarPregunta = 'pregunta fallida';
    responder = async (url) => { if (url.includes('/v1/usage')) { throw new Error('network'); } throw new Error('inesperado'); };
    await consultarUsoNoMi();
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'No se pudo conectar', 'HUD red');
    assert.strictEqual(NoMiState.reintentarPregunta, 'pregunta fallida', 'rede conserva la pregunta para reintento');

    // 35) mapearErrorHudNoMi en chat (NoMiTokenInvalidoError) -> "Acceso no válido".
    setNomiAccesoActivo(true);
    establecerEstadoHud(null);
    mapearErrorHudNoMi(new NoMiTokenInvalidoError('revocado'));
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Acceso no válido', 'chat 401');
    assert.strictEqual(getNomiAccesoActivo(), false, 'chat 401 inactivo');

    // 36) Aislamiento: en modo Personal, consultarUsoNoMi NO consulta el Worker ni muestra cuota.
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.usoNoMi = { solicitudes_usadas: 3 };
    establecerEstadoHud(null);
    let llamadasUso = 0;
    responder = async (url) => { if (url.includes('/v1/usage')) { llamadasUso++; throw new Error('no debio llamar'); } throw new Error('inesperado'); };
    await consultarUsoNoMi();
    assert.strictEqual(llamadasUso, 0, 'Personal no debe consultar /v1/usage');
    assert.strictEqual(__els['nomi-hud-quota'].style.display, 'none', 'cuota oculta en Personal');
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Personal · Activo', 'HUD Personal tras aislamiento');

    // 37) Reintento explícito: tras error de red, preguntar() reenvía al Worker.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    establecerEstadoHud('sin_conexion');
    NoMiState.reintentarPregunta = 'REINTENTO_MARCADOR';
    NoMiState.isWaiting = false;
    NoMiState.historial = [];
    let llamadasWorker2 = 0;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasWorker2++; return { ok: true, respuesta: 'ok retry' }; }
        if (url.includes('/v1/usage')) return { solicitudes_usadas: 1, cuota_mensual_invitado: 50 };
        throw new Error('inesperado: ' + url);
    };
    await preguntar(NoMiState.reintentarPregunta);
    assert.strictEqual(llamadasWorker2, 1, 'reintento reenvia al Worker /v1/chat');

    // 38) Aislamiento al cambiar de modo: limpia estadoHud y cuota obsoleta.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    establecerEstadoHud('limite');
    NoMiState.usoNoMi = { tokens_usados: 30, cuota_mensual_invitado: 50 };
    actualizarQuotaHud();
    assert.strictEqual(__els['nomi-hud-quota'].style.display, 'inline', 'cuota visible en NoMi antes del cambio');
    // Cambio a Personal (misma secuencia del handler del menú).
    setModoAcceso(MODO_ACCESO_OPENROUTER);
    NoMiState.usoNoMi = null;
    establecerEstadoHud(null);
    actualizarQuotaHud();
    assert.strictEqual(__els['nomi-hud-quota'].style.display, 'none', 'Personal oculta cuota obsoleta de NoMi');
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Personal · Activo', 'Personal no hereda limite de NoMi');
    NoMiState.credencialesCargadas = false; NoMiState.apiKeyActual = '';
    establecerEstadoHud(null);
    assert.strictEqual(__els['nomi-hud-status'].textContent, 'Personal · Sin acceso', 'Personal sin acceso (no hereda estado NoMi)');

    // 39) Reintento seguro: fallo de chat red guarda la pregunta y no duplica historial.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.historial = [];
    NoMiState.reintentarPregunta = '';
    establecerEstadoHud(null);
    let llamadasChat = 0;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasChat++; const e = new Error('network'); e.status = 0; throw e; }
        if (url.includes('/v1/usage')) return { tokens_usados: 1, cuota_mensual_invitado: 50 };
        throw new Error('inesperado: ' + url);
    };
    await preguntar('PREGUNTA_RED_MARCADOR');
    assert.strictEqual(llamadasChat, 1, 'chat NoMi intentado 1 vez');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'fallo de red -> sin_conexion');
    assert.strictEqual(NoMiState.reintentarPregunta, 'PREGUNTA_RED_MARCADOR', 'reintento guarda la pregunta fallida');
    assert.strictEqual(NoMiState.historial.length, 0, 'historial NO duplicado tras fallo (se hizo pop)');
    // Reintento explícito reenvía y, al responder, limpia reintentarPregunta.
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasChat++; return { ok: true, respuesta: 'ok' }; }
        if (url.includes('/v1/usage')) return { tokens_usados: 2, cuota_mensual_invitado: 50 };
        throw new Error('inesperado: ' + url);
    };
    await preguntar(NoMiState.reintentarPregunta);
    assert.strictEqual(llamadasChat, 2, 'reintento reenvia el chat');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'tras respuesta exitosa se limpia reintentarPregunta');
    assert.strictEqual(NoMiState.historial.length, 2, 'historial: 1 usuario + 1 asistente (sin duplicar)');

    // 40) Fallo solo de /v1/usage tras respuesta exitosa: HUD conexión, sin reenviar.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.historial = [];
    NoMiState.reintentarPregunta = '';
    establecerEstadoHud(null);
    let llamadasChat2 = 0, llamadasUso2 = 0;
    responder = async (url, opts) => {
        if (url.includes('/v1/chat')) { llamadasChat2++; return { ok: true, respuesta: 'ok' }; }
        if (url.includes('/v1/usage')) { llamadasUso2++; const e = new Error('network'); e.status = 0; throw e; }
        throw new Error('inesperado: ' + url);
    };
    await preguntar('PREGUNTA_OK');
    assert.strictEqual(llamadasChat2, 1, 'chat respondio 1 vez');
    assert.strictEqual(llamadasUso2, 1, 'usage consultado tras respuesta');
    assert.strictEqual(NoMiState.reintentarPregunta, '', 'respuesta exitosa limpia reintentarPregunta');
    assert.strictEqual(NoMiState.estadoHud, 'sin_conexion', 'fallo de usage informa conexion');
    assert.strictEqual(NoMiState.historial.length, 2, 'no se reenvia ni duplica historial');

    // 41) Errores NoMi: un único mensaje humano, sin error crudo ni duplicado.
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiToken('TOK123');
    setNomiAccesoActivo(true);
    NoMiState.historial = [];
    let mensajesBot = [];
    const _agregar = agregarMensaje;
    agregarMensaje = (quien, texto) => { if (quien === 'bot') mensajesBot.push(texto); };
    // 401
    let llamadas41 = 0;
    responder = async (url) => { if (url.includes('/v1/chat')) { llamadas41++; const e = new Error('401'); e.status = 401; throw e; } throw new Error('inesperado'); };
    await preguntar('PREG_401');
    assert.strictEqual(mensajesBot.length, 1, '401: un único mensaje (sin duplicado)');
    assert.ok(mensajesBot[0].includes('inválido') || mensajesBot[0].includes('revocado'), '401: mensaje humano');
    assert.ok(!mensajesBot[0].includes('❌'), '401: sin prefijo crudo ❌');
    assert.ok(!mensajesBot[0].includes('401'), '401: sin código técnico en el chat');
    mensajesBot = [];
    setNomiAccesoActivo(true);
    // 429
    responder = async (url) => { if (url.includes('/v1/chat')) { llamadas41++; const e = new Error('429'); e.status = 429; throw e; } throw new Error('inesperado'); };
    await preguntar('PREG_429');
    assert.strictEqual(mensajesBot.length, 1, '429: un único mensaje');
    assert.ok(mensajesBot[0].toLowerCase().includes('límite'), '429: mensaje humano de límite');
    assert.ok(!mensajesBot[0].includes('❌'), '429: sin prefijo crudo ❌');
    mensajesBot = [];
    setNomiAccesoActivo(true);
    // 503
    responder = async (url) => { if (url.includes('/v1/chat')) { llamadas41++; const e = new Error('503'); e.status = 503; throw e; } throw new Error('inesperado'); };
    await preguntar('PREG_503');
    assert.strictEqual(mensajesBot.length, 1, '503: un único mensaje');
    assert.ok(mensajesBot[0].toLowerCase().includes('capacidad'), '503: mensaje humano de capacidad');
    assert.ok(!mensajesBot[0].includes('❌'), '503: sin prefijo crudo ❌');
    mensajesBot = [];
    setNomiAccesoActivo(true);
    // red (sin status)
    responder = async (url) => { if (url.includes('/v1/chat')) { llamadas41++; const e = new Error('network'); throw e; } throw new Error('inesperado'); };
    await preguntar('PREG_RED');
    assert.strictEqual(mensajesBot.length, 1, 'red: un único mensaje');
    assert.ok(mensajesBot[0].includes('conectar') || mensajesBot[0].includes('Reintentar'), 'red: mensaje humano de conexión');
    assert.ok(!mensajesBot[0].includes('❌'), 'red: sin prefijo crudo ❌');
    assert.strictEqual(NoMiState.reintentarPregunta, 'PREG_RED', 'red: guarda pregunta para Reintentar');
    agregarMensaje = _agregar;

    // 42) Onboarding sin recarga: activación usa catálogo devuelto, limpia avisos previos y revalida.
    // Simula flujo completo: instalación limpia → código válido → activación exitosa.
    sessionStorage.removeItem('nomi_modelo_verificado');
    mostrarAvisoModeloRetirado(); // Aviso previo que debe limpiarse
    const avisoPrevio = document.getElementById('nomi-modelo-aviso');
    assert.ok(avisoPrevio, 'debe haber aviso previo antes de activar');
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiModelo('openai/gpt-oss-20b');
    responder = async (url, opts) => {
        if (url.endsWith('/v1/activate')) {
            assert.ok(opts.body && JSON.parse(opts.body).codigo === 'ABCD1234');
            return { ok: true, token: 'TOK_ONBOARD' };
        }
        if (url.endsWith('/v1/catalog')) {
            return { modelos: [{ proveedor: 'groq', id: 'openai/gpt-oss-20b', estado: 'activo', nombre: 'GPT-OSS 20B' }] };
        }
        throw new Error('endpoint inesperado: ' + url);
    };
    const resultadoOnboard = await activarAccesoNoMi('ABCD1234');
    assert.strictEqual(resultadoOnboard.token, 'TOK_ONBOARD');
    assert.ok(resultadoOnboard.catalogo, 'debe devolver catálogo');
    assert.strictEqual(getNomiToken(), 'TOK_ONBOARD');
    assert.strictEqual(getNomiAccesoActivo(), true);
    // Debe limpiar aviso previo y revalidar contra catálogo devuelto
    const avisoDespues = document.getElementById('nomi-modelo-aviso');
    assert.strictEqual(avisoDespues, null, 'debe limpiar aviso previo tras activación exitosa');
    assert.strictEqual(sessionStorage.getItem('nomi_modelo_verificado'), 'true', 'debe marcar sesión verificada tras catálogo OK');
    console.log('  [42] Onboarding sin recarga: usa catálogo, limpia avisos, revalida');

    // 43) Catálogo temporalmente fallido: conserva token y acceso, NO marca verificada, muestra estado recuperable.
    sessionStorage.removeItem('nomi_modelo_verificado');
    mostrarAvisoModeloRetirado();
    setNomiToken('');
    setNomiAccesoActivo(false);
    responder = async (url, opts) => {
        if (url.endsWith('/v1/activate')) {
            return { ok: true, token: 'TOK_CAT_FAIL' };
        }
        if (url.endsWith('/v1/catalog')) {
            const e = new Error('red caída'); throw e;
        }
        throw new Error('inesperado');
    };
    const resultadoCatFail = await activarAccesoNoMi('FAILCAT');
    assert.strictEqual(resultadoCatFail.token, 'TOK_CAT_FAIL');
    assert.strictEqual(resultadoCatFail.catalogo, null, 'catálogo fallido debe ser null');
    assert.strictEqual(getNomiToken(), 'TOK_CAT_FAIL', 'debe conservar token');
    assert.strictEqual(getNomiAccesoActivo(), true, 'debe conservar acceso activo');
    assert.strictEqual(sessionStorage.getItem('nomi_modelo_verificado'), null, 'NO debe marcar sesión verificada si catálogo falla');
    // El handler del menú/onboarding muestra "Verificando catálogo…"; aquí el
    // núcleo debe dejar limpio el aviso anterior, sin falso modelo inválido.
    const avisoCatFail = document.getElementById('nomi-modelo-aviso');
    assert.strictEqual(avisoCatFail, null, 'no debe conservar aviso de modelo inválido tras un fallo temporal');
    console.log('  [43] Catálogo fallido: conserva acceso, no marca verificada, estado recuperable en UI');

    // 44) Limpia avisos de modelo ANTES de revalidar en activación.
    sessionStorage.removeItem('nomi_modelo_verificado');
    mostrarAvisoModeloNoDisponibleNoMi(); // Aviso NoMi específico
    setModoAcceso(MODO_ACCESO_NOMI);
    setNomiModelo('openai/gpt-oss-120b');
    responder = async (url, opts) => {
        if (url.endsWith('/v1/activate')) return { ok: true, token: 'TOK_CLEAR' };
        if (url.endsWith('/v1/catalog')) {
            return { modelos: [{ proveedor: 'groq', id: 'openai/gpt-oss-120b', estado: 'activo', nombre: 'GPT-OSS 120B' }] };
        }
        throw new Error('inesperado');
    };
    await activarAccesoNoMi('CLEAR123');
    const avisoLimpio = document.getElementById('nomi-modelo-aviso');
    assert.strictEqual(avisoLimpio, null, 'debe limpiar aviso NoMi previo antes de revalidar');
    console.log('  [44] Limpia avisos antes de revalidar en activación');

    console.log('OK: todas las pruebas de acceso NoMi pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const fuenteAcceso = leer('nomi-acceso-nomi.js');
const combinado = fuentes.join('\n') + '\n' +
    pruebas.replace('__FUENTE_ACCESO__', JSON.stringify(fuenteAcceso));

vm.runInContext(combinado, ctx, { filename: 'nomi-acceso-nomi-test.js' });
