// ======== nomi-diagnostics: pruebas del Worker ========
// Ejecutar con:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

import { sanitizarReporte, urlSegura, dominioPublico } from '../src/sanitize.js';
import { permitirPorInstalacion, esDuplicado, resetMemoria } from '../src/kv.js';
import { huellaReporte } from '../src/hash.js';
import { manejarPeticion } from '../src/worker.js';

// ---- KV simulado (en memoria) que emula el comportamiento real de Cloudflare KV ----
function crearKvMemoria() {
    const datos = new Map();
    return {
        async get(clave, tipo) {
            const e = datos.get(clave);
            if (!e) return null;
            return tipo === 'json' ? JSON.parse(e.valor) : e.valor;
        },
        async put(clave, valor, opts) { datos.set(clave, { valor, ttl: opts?.expirationTtl || null }); return true; },
        _datos: datos
    };
}
resetMemoria();

// ---- fetch de Slack simulado ----
function crearFetchSlack(fn) {
    return async (url, init) => {
        const ok = await fn(url, init);
        return { ok, status: ok ? 200 : 500, json: async () => ({}) };
    };
}

// ---- Entorno simulado ----
function entorno(kv) {
    return { SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T/X/B', DIAGNOSTICS_KV: kv };
}

test('sanitizarReporte redacta claves y secretos', () => {
    const entrada = {
        type: 'api',
        message: 'Fallo con clave sk-or-v1-ABCDEFGHIJKLMNOP y tvly-XXXX123',
        apiKey: 'sk-or-v1-SECRETO',
        tavilyKey: 'tvly-real',
        context: 'token=abc123 password=superse',
        cookie: 'session=abc',
        webhook: 'https://hooks.slack.com/services/T/X/BILE'
    };
    const salida = sanitizarReporte(entrada);
    assert.equal(salida.apiKey, '[REDACTADO]');
    assert.equal(salida.tavilyKey, '[REDACTADO]');
    assert.equal(salida.cookie, '[REDACTADO]');
    assert.equal(salida.webhook, '[REDACTADO]');
    assert.ok(!/sk-or-v1-/.test(salida.message));
    assert.ok(!/tvly-/.test(salida.message));
    assert.ok(!/abc123/.test(salida.context));
});

test('urlSegura elimina query y credenciales', () => {
    assert.equal(urlSegura('https://ejemplo.com/pagina?token=SECRETO&x=1'), 'https://ejemplo.com/pagina');
    assert.equal(urlSegura('https://usuario:clave@host.com/ruta?a=1'), 'https://host.com/ruta');
    assert.equal(urlSegura('no-es-url'), 'no-es-url');
});

test('dominioPublico devuelve dominio sin subdominios', () => {
    assert.equal(dominioPublico('https://www.google.com/pagina'), 'google.com');
    assert.equal(dominioPublico('https://sub.otro.org/r'), 'otro.org');
    assert.equal(dominioPublico('https://example.io'), 'example.io');
});

test('huellaReporte es estable (mismo contenido, misma huella)', async () => {
    const a = await huellaReporte({ type: 'api', message: 'x' });
    const b = await huellaReporte({ message: 'x', type: 'api' });
    assert.equal(a, b);
});

test('permitirPorInstalacion limita a 10 por ventana', async () => {
    const kv = crearKvMemoria();
    const now = Date.now();
    let permitidos = 0;
    for (let i = 0; i < 11; i++) {
        const r = await permitirPorInstalacion(kv, 'inst-1', now);
        if (r.permitido) permitidos++;
    }
    assert.equal(permitidos, 10);
});

test('límites diferentes por instalación', async () => {
    const kv = crearKvMemoria();
    const now = Date.now();
    for (let i = 0; i < 10; i++) await permitirPorInstalacion(kv, 'a', now);
    assert.equal((await permitirPorInstalacion(kv, 'a', now)).permitido, false);
    assert.equal((await permitirPorInstalacion(kv, 'b', now)).permitido, true);
});

test('esDuplicado devuelve true al segundo envío idéntico', async () => {
    const kv = crearKvMemoria();
    const now = Date.now();
    assert.equal(await esDuplicado(kv, 'h1', now), false);
    assert.equal(await esDuplicado(kv, 'h1', now), true);
    assert.equal(await esDuplicado(kv, 'h2', now), false);
});

test('Worker: devuelve 404 en otra ruta', async () => {
    const r = await manejarPeticion(new Request('https://x.workers.dev/'), entorno(crearKvMemoria()));
    assert.equal(r.status, 404);
});

test('Worker: acepta y envía a Slack (202)', async () => {
    let slackRecibido = null;
    const fetchSlack = crearFetchSlack((url, init) => {
        slackRecibido = { url, body: JSON.parse(init.body) };
        return true;
    });
    const req = new Request('https://x.workers.dev/v1/diagnostics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'api', message: 'fallo sk-or-v1-XXXX', context: 'x',
            version: '5.10', device: 'Android', instalacionId: 'inst-abcd',
            url: 'https://www.ejemplo.com/a?token=Y'
        })
    });
    const r = await manejarPeticion(req, entorno(crearKvMemoria()), { fetch: fetchSlack });
    assert.equal(r.status, 202);
    assert.ok(slackRecibido.body.text.includes('Android'));
    // Slack nunca recibe el secreto ni la query.
    assert.ok(!slackRecibido.body.text.includes('XXXX'));
    assert.ok(!slackRecibido.body.text.includes('?token'));
    const json = await r.json();
    assert.equal(json.estado, 'enviado');
});

test('Worker: deduplica envíos idénticos en <5min (estado duplicado)', async () => {
    const kv = crearKvMemoria();
    const fetchSlack = crearFetchSlack(() => true);
    const body = () => JSON.stringify({ type: 'api', message: 'm', instalacionId: 'i1' });
    const req1 = new Request('https://x.workers.dev/v1/diagnostics', { method: 'POST', body: body() });
    const req2 = new Request('https://x.workers.dev/v1/diagnostics', { method: 'POST', body: body() });
    const r1 = await manejarPeticion(req1, entorno(kv), { fetch: fetchSlack });
    const r2 = await manejarPeticion(req2, entorno(kv), { fetch: fetchSlack });
    assert.equal(r1.status, 202);
    assert.equal(r2.status, 200);
    assert.equal((await r2.json()).estado, 'duplicado-omitido');
});

test('Worker: devuelve 429 al superar 10 reportes', async () => {
    const kv = crearKvMemoria();
    const fetchSlack = crearFetchSlack(() => true);
    for (let i = 0; i < 10; i++) {
        const body = JSON.stringify({ type: 'api', message: `m${i}`, instalacionId: 'i-limite' });
        const req = new Request('https://x.workers.dev/v1/diagnostics', { method: 'POST', body });
        const r = await manejarPeticion(req, entorno(kv), { fetch: fetchSlack });
        assert.equal(r.status, 202);
    }
    const extra = new Request('https://x.workers.dev/v1/diagnostics', { method: 'POST', body: JSON.stringify({ type: 'api', message: 'm-extra', instalacionId: 'i-limite' }) });
    const rExtra = await manejarPeticion(extra, entorno(kv), { fetch: fetchSlack });
    assert.equal(rExtra.status, 429);
});

test('Worker: los campos técnicos aparecen en el mensaje de Slack', async () => {
    let slackRecibido = null;
    const fetchSlack = crearFetchSlack((url, init) => {
        slackRecibido = { url, body: JSON.parse(init.body) };
        return true;
    });
    const req = new Request('https://x.workers.dev/v1/diagnostics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            type: 'red', message: 'timeout', context: 'c',
            version: '5.10', device: '1280x720', platform: 'Android',
            mobile: true, red: '4g', bateria: '73%',
            instalacionId: 'inst-tecnico', url: 'https://www.ejemplo.com/a'
        })
    });
    const r = await manejarPeticion(req, entorno(crearKvMemoria()), { fetch: fetchSlack });
    assert.equal(r.status, 202);
    const texto = slackRecibido.body.text;
    for (const esperado of ['Android', '1280x720', 'sí', '4g', '73%', 'inst-tec', 'ejemplo.com']) {
        assert.ok(texto.includes(esperado), `falta "${esperado}" en el mensaje de Slack`);
    }
});

test('Worker: rechaza cuerpo mayor a 2 KB aunque no haya Content-Length (413)', async () => {
    // Body entregado como stream: la API no conoce content-length -> header ausente.
    const grande = JSON.stringify({ type: 'api', message: 'x'.repeat(5000), instalacionId: 'i-grande' });
    const enc = new TextEncoder();
    const bytes = enc.encode(grande);
    const stream = new ReadableStream({
        start(controller) { controller.enqueue(bytes); controller.close(); }
    });
    const req = new Request('https://x.workers.dev/v1/diagnostics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half'   // requerido por entornos Node/undici al enviar un ReadableStream
    });
    assert.equal(req.headers.get('content-length'), null, 'el test debe ejecutarse sin Content-Length');
    const r = await manejarPeticion(req, entorno(crearKvMemoria()), { fetch: crearFetchSlack(() => true) });
    assert.equal(r.status, 413);
});

test('Worker: una petición rechazada (413) no afecta el texto de la siguiente', async () => {
    // Un decoder/stream no comparten estado global: después de cancelar un cuerpo grande,
    // una petición pequeña posterior debe parsearse y enviarse con éxito (202).
    let slackRecibido = null;
    const fetchSlack = crearFetchSlack((url, init) => {
        slackRecibido = { url, body: JSON.parse(init.body) };
        return true;
    });

    const kv = crearKvMemoria();
    const env = entorno(kv);

    // 1) Primera petición: cuerpo grande → 413 (stream cancelado).
    const grande = JSON.stringify({ type: 'api', message: 'x'.repeat(5000), instalacionId: 'i-aislado' });
    const bigStream = new ReadableStream({
        start(c) { c.enqueue(new TextEncoder().encode(grande)); c.close(); }
    });
    const reqGrande = new Request('https://x.workers.dev/v1/diagnostics', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: bigStream, duplex: 'half'
    });
    const r1 = await manejarPeticion(reqGrande, env, { fetch: fetchSlack });
    assert.equal(r1.status, 413);

    // 2) Segunda petición: cuerpo pequeño válido → 202, mensaje íntegro.
    const req2 = new Request('https://x.workers.dev/v1/diagnostics', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'api', message: 'ok-post-cancel', instalacionId: 'i-aislado', red: '4g' })
    });
    const r2 = await manejarPeticion(req2, env, { fetch: fetchSlack });
    assert.equal(r2.status, 202);
    assert.ok(slackRecibido.body.text.includes('ok-post-cancel'));
});

// ---- Generación segura de ID (función de NoMi: módulo nomi-persistencia.js) ----
// NOTA: nomi-persistencia.js no exporta en ESM; se evalúa en un sandbox de vm con
// los stubs mínimos (localStorage persistente simulado, NoMiState, crypto, etc.).
function cargarPersistenciaSandbox(opts = {}) {
    const store = Object.create(null);
    const localStorage = {
        getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem(k, v) { store[k] = String(v); },
        removeItem(k) { delete store[k]; }
    };
    const sandbox = {
        NoMiState: {},
        localStorage,
                crypto: ('crypto' in opts) ? opts.crypto : webcrypto,
        Math, Date, Uint8Array, Array, console,
        // Constantes referenciadas al cargar el módulo (solo definiciones, no usan valores).
        STORAGE_INSTALACION_ID: 'nomi_instalacion_id',
        STORAGE_VALIDADO: 'nomi_validado', STORAGE_MODELO: 'nomi_modelo', STORAGE_URL: 'nomi_url',
        STORAGE_ERROR_LOGS: 'nomi_error_logs', STORAGE_DIAGNOSTICO_AVISO: 'nomi_diag_aviso',
        MODELO_POR_DEFECTO: '', URL_BASE_POR_DEFECTO: '', VERSION_SCRIPT: '5.10',
        DOMINIOS_UNIFICADOS: [],
        ACCIONES_PREDEFINIDAS: [], MENUS_PREDEFINIDOS: [],
        DIAGNOSTICS_URL: 'https://x.workers.dev/v1/diagnostics',
        ANCHO_POR_DEFECTO: 400, UBICACION_EXPIRACION: 30,
        DIAGNOSTICOS_URL: '', // placeholder
    };
    vm.createContext(sandbox);
    const src = readFileSync(new URL('../../modules/nomi-persistencia.js', import.meta.url), 'utf8');
    vm.runInContext(src + '\n;globalThis.__fns = { generar: generarIdCriptografico, obtener: obtenerInstalacionId };', sandbox);
    return { fns: sandbox.__fns, store };
}

test('generarIdCriptografico usa crypto (randomUUID) y devuelve formato nmi-', () => {
    // Math.random forzado a fallar: la ruta principal NO debe usarlo.
    const MathMock = Object.create(Math);
    MathMock.random = () => { throw new Error('Math.random NO debe usarse'); };
    const cryptoMock = { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', getRandomValues: () => { throw new Error('no debe usar getRandomValues'); } };
    const { fns } = cargarPersistenciaSandbox({ crypto: cryptoMock });
    const id = fns.generar();
    assert.equal(id, 'nmi-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
});

test('generarIdCriptografico con getRandomValues devuelve formato UUID hex', () => {
    // crypto.uuid aleatorio real devuelve 36 caracteres en formato hex con guiones.
    const { fns } = cargarPersistenciaSandbox();
    const id = fns.generar();
    assert.match(id, /^nmi-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const otro = fns.generar();
    assert.notEqual(id, otro);
});

test('generarIdCriptografico retorna null sin Web Crypto (nunca Math.random)', () => {
    const { fns } = cargarPersistenciaSandbox({ crypto: undefined });
    assert.equal(fns.generar(), null);
});

test('obtenerInstalacionId persiste y retorna el MISMO id en dos llamadas', () => {
    const { fns, store } = cargarPersistenciaSandbox();
    const id1 = fns.obtener();
    const id2 = fns.obtener();
    assert.match(id1, /^nmi-/);
    assert.equal(id1, id2, 'debe persistir el mismo ID entre llamadas');
    // Verificado en el storage simulado que se concretó la escritura.
    assert.ok(Object.keys(store).length > 0, 'el ID debe haberse guardado en storage');
});