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
    leer('nomi-core.js'),
];

// ---- Entorno simulado del navegador ----
const store = new Map();
const memLocal = new Map();

let responder = null; // (url, opts) => Promise

const ctx = {
    console,
    assert,
    location: { href: 'https://example.com', hostname: 'example.com' },
    localStorage: {
        getItem: (k) => (memLocal.has(k) ? memLocal.get(k) : null),
        setItem: (k, v) => memLocal.set(k, String(v)),
        removeItem: (k) => memLocal.delete(k),
    },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => store.set(k, v),
    GM_deleteValue: (k) => store.delete(k),
    mostrarNotificacionTemporal: () => {},
    registrarError: () => {},
    obtenerInstalacionId: () => 'nmi-test',
    TextEncoder,
    TextDecoder,
    // Stubs mínimos de DOM/UI para ejecutar preguntar() sin navegador real.
    document: { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: { appendChild() {} } },
    agregarMensaje: () => {},
    actualizarStats: () => {},
    mostrarCargando: () => {},
    ocultarCargando: () => {},
    actualizarContextoIndicador: () => {},
    actualizarBarraUbicacion: () => {},
    toggleVentana: () => {},
    toggleBurbuja: () => {},
    cargarHistorial: () => {},
    // Auxiliares usados por preguntar() que viven en otros módulos (utilities/chat/etc.).
    obtenerContextoTiempo: () => 'Fecha: 2026-08-19',
    extraerInformacionPagina: () => ({ titulo: 'Ejemplo', url: 'https://example.com', metaDesc: '', encabezados: [], texto: '' }),
    requiereBusqueda: () => false,
    setContador: () => {},
    setTokens: () => {},
    setResumen: () => {},
    mostrarEstadisticas: () => {},
    mostrarExportacion: () => {},
    mostrarAyuda: () => {},
    guardarHistorial: () => {},
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
    const token = await activarAccesoNoMi('abcd');
    assert.strictEqual(token, 'TOK123');
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

    // ===== Flujo completo de integración visual/funcional de modos IA =====
    // Mocks de DOM para capturar los indicadores superiores (nomi-proveedor-display
    // y nomi-modelo-display). Los stubs de getElementById del entorno no los tienen;
    // se sustituyen por un mapa real para estas pruebas.
    const __els = {
        'nomi-proveedor-display': { textContent: '', style: {} },
        'nomi-modelo-display': { textContent: '', style: {} },
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
        if (url.includes('/v1/chat')) { llamadasWorker++; return { ok: true, respuesta: 'respuesta NoMi' }; }
        if (url.includes('openrouter') || url.includes('/chat/completions')) { llamadasOpenRouter++; return { choices: [{ message: { content: 'x' } }] }; }
        throw new Error('inesperado: ' + url);
    };
    await preguntar('hola en modo NoMi');
    assert.strictEqual(llamadasWorker, 1, 'flujo nomi: debe llamar al Worker /v1/chat');
    assert.strictEqual(llamadasOpenRouter, 0, 'flujo nomi: NUNCA debe llamar a OpenRouter');

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

    console.log('OK: todas las pruebas de acceso NoMi pasaron');
})().catch((e) => { console.error('FALLO:', e && e.message); throw e; });
`;

const fuenteAcceso = leer('nomi-acceso-nomi.js');
const combinado = fuentes.join('\n') + '\n' +
    pruebas.replace('__FUENTE_ACCESO__', JSON.stringify(fuenteAcceso));

vm.runInContext(combinado, ctx, { filename: 'nomi-acceso-nomi-test.js' });
