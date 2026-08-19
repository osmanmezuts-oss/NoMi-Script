// Pruebas de la API de acceso (Fase 1). Sin llamadas reales a Groq ni secretos.
// Se ejecutan con: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { crearEnv } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { setReloj, CREDITOS, CAPACIDAD_DIARIA, periodoActual } from '../src/limites.js';

// Reemplaza fetch global por un stub que simula la respuesta de Groq (nunca real).
function simularGroq({ texto = 'respuesta ok', total = 10 } = {}) {
    globalThis.fetch = async (url, init) => {
        assert.ok(url.includes('groq.com'), 'debe llamar a Groq, no a OpenRouter');
        return new Response(JSON.stringify({
            choices: [{ message: { content: texto } }],
            usage: { total_tokens: total, prompt_tokens: 5, completion_tokens: total - 5 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
}

function envNuevo(opts) {
    return crearEnv(opts);
}

async function llamar(env, ruta, { metodo = 'GET', body, token, admin } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    if (admin) headers.authorization = 'Bearer ' + admin;
    const req = new Request('https://nomi-api.workers.dev' + ruta, {
        method: metodo,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    return worker.fetch(req, env);
}

async function crearInvitado(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const resp = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    const data = await resp.json();
    assert.equal(resp.status, 201, 'debe activar correctamente');
    return data.token;
}

// Construye una petición cuyo cuerpo es un ReadableStream SIN Content-Length
// (undici no asigna content-length a cuerpos stream). Ejercita el lector
// streaming con límite real de bytes cuando el cliente omite la cabecera.
function requestStream(ruta, texto, { token, admin, headers = {} } = {}) {
    const h = { 'content-type': 'application/json', ...headers };
    if (token) h.authorization = 'Bearer ' + token;
    if (admin) h.authorization = 'Bearer ' + admin;
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(texto));
            controller.close();
        },
    });
    return new Request('https://nomi-api.workers.dev' + ruta, {
        method: 'POST', headers: h, body: stream, duplex: 'half',
    });
}

// Semilla la bolsa global vía admin (habilita capacidad y ejerza el endpoint admin).
async function llenarBolpa(env, monto = 500000) {
    const r = await llamar(env, '/admin/liberar', {
        metodo: 'POST', admin: env.ADMIN_SECRET,
        body: { operacionId: 'seed-bolsa', monto },
    });
    assert.equal(r.status, 200, 'sembrar bolsa debe tener éxito');
}

// ---- Invitacion de un solo uso ----
test('invitacion solo se puede canjear una vez', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();

    const r1 = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(r1.status, 201);
    const r2 = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(r2.status, 400, 'la misma invitacion no debe activar dos veces');
    const body2 = await r2.json();
    assert.equal(body2.error, 'invitacion-invalida');
});

// ---- Token invalido ----
test('token invalido produce acceso-invalido', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/v1/usage', { token: 'token-inventado' });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'acceso-invalido');
});

// ---- Cuota mensual ----
test('cuota mensual agotada devuelve 429', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const usuario = await db.buscarPorToken(token);
    // Simula haber agotado la cuota del periodo actual.
    await db.sumarUso(usuario.id, { tokens: 420000, solicitudes: 1 });

    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST',
        token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' },
    });
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'cuota-mensual-agotada');
});

// ---- Allowlist ----
test('modelo no permitido devuelve 403', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST',
        token,
        body: { modelo: 'otro/proveedor:free', mensaje: 'hola' },
    });
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, 'modelo-no-permitido');
});

// ---- Chat OK y contabiliza uso real ----
test('chat con modelo permitido responde y contabiliza tokens', async () => {
    simularGroq({ texto: 'hola desde groq', total: 25 });
    const env = envNuevo();
    await llenarBolpa(env);
    const token = await crearInvitado(env);

    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST',
        token,
        body: { modelo: 'openai/gpt-oss-120b', mensaje: 'hola' },
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).respuesta, 'hola desde groq');

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 25, 'debe contabilizar el uso real del proveedor');
});

// ---- No persistencia de prompts ----
test('no se guarda el prompt ni la respuesta en D1', async () => {
    simularGroq({ texto: 'secreto-respuesta', total: 8 });
    const env = envNuevo();
    await llenarBolpa(env);
    const token = await crearInvitado(env);

    await llamar(env, '/v1/chat', {
        metodo: 'POST',
        token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'mensaje-muy-secreto' },
    });

    const json = JSON.stringify(env.NOMI_DB._tablas);
    assert.ok(!json.includes('mensaje-muy-secreto'), 'no debe persistirse el prompt');
    assert.ok(!json.includes('secreto-respuesta'), 'no debe persistirse la respuesta');
});

// ---- Reserva y conciliacion de tokens (endpoint) ----
test('chat reserve y concilia: el DO contabiliza el uso real neto', async () => {
    simularGroq({ texto: 'ok', total: 25 });
    const env = envNuevo();
    await llenarBolpa(env);
    const token = await crearInvitado(env);

    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' },
    });
    assert.equal(r.status, 200);

    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const snapResp = await doObj.fetch('https://internal/snapshot', { method: 'GET' });
    const snap = await snapResp.json();
    assert.equal(snap.tokens_minuto, 25, 'el DO libera la sobre-reserva; queda el uso real');
    assert.equal(snap.tokens_dia, 25);
});

// ---- Catalogo y CORS ----
test('catalogo expone modelos sin credenciales', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/v1/catalog');
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.ok(data.modelos.some(m => m.id === 'openai/gpt-oss-120b' && m.estado === 'activo'));
    assert.ok(data.modelos.some(m => m.proveedor === 'openrouter' && m.estado === 'experimental'));
    assert.ok(r.headers.get('cache-control').includes('no-store'));
});

// ---- Admin: requieren ADMIN_SECRET (rechazo incluido) ----
test('endpoints admin son rechazados sin secret y con secret erroneo', async () => {
    const env = envNuevo();

    const r1 = await llamar(env, '/admin/invitacion', { metodo: 'POST', body: {} });
    assert.equal(r1.status, 401);
    assert.equal((await r1.json()).error, 'admin-no-autorizado');

    const r2 = await llamar(env, '/admin/liberar', { metodo: 'POST', body: { operacionId: 'x', monto: 1 } });
    assert.equal(r2.status, 401);
    assert.equal((await r2.json()).error, 'admin-no-autorizado');

    const r3 = await llamar(env, '/admin/invitacion', { metodo: 'POST', admin: 'otro', body: {} });
    assert.equal(r3.status, 401);
});

// ---- Bolsa global: descuento real por chat concurrente ----
test('bolsa global se descuenta por el uso real del chat (concurrente)', async () => {
    simularGroq({ texto: 'ok', total: 100 });
    const env = envNuevo();
    await llenarBolpa(env, 500000);
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const antes = (await db.obtenerCreditos()).bolsa;

    const hacer = () => llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    const respuestas = await Promise.all(Array.from({ length: 3 }, hacer));
    for (const r of respuestas) assert.equal(r.status, 200, 'las 3 chat concurrentes deben responder');

    const despues = (await db.obtenerCreditos()).bolsa;
    assert.equal(despues, antes - 300, 'la bolsa se descuenta por el uso real neto (3 x 100)');
    assert.ok(despues >= 0);
});

// ---- Primer uso diario en días distintos ----
test('primer uso diario se marca correctamente en días distintos', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const dia1 = '2026-08-10';
    const dia2 = '2026-08-11';

    setReloj(() => new Date(dia1 + 'T10:00:00Z'));
    simularGroq({ texto: 'ok', total: 10 });

    let r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    assert.equal(r.status, 200);
    assert.equal((await db.buscarPorToken(token)).primer_uso_dia, dia1, 'marca el primer día');

    r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    assert.equal(r.status, 200);
    assert.equal((await db.buscarPorToken(token)).primer_uso_dia, dia1, 'no cambia dentro del mismo día');

    setReloj(() => new Date(dia2 + 'T10:00:00Z'));
    r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    assert.equal(r.status, 200);
    assert.equal((await db.buscarPorToken(token)).primer_uso_dia, dia2, 'marca el nuevo día');

    setReloj(() => new Date());
});

// ---- Uso real que excede la reserva: se contabiliza y deja evidencia ----
test('uso real que excede la reserva se contabiliza (nunca se descarta)', async () => {
    const env = envNuevo();
    await llenarBolpa(env, 500000);
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const antes = (await db.obtenerCreditos()).bolsa;

    const warns = [];
    const orig = console.warn;
    console.warn = (...a) => warns.push(a.join(' '));
    try {
        simularGroq({ texto: 'ok', total: 100000 }); // real muy superior a la reserva (~1282)
        const r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
        assert.equal(r.status, 200);
    } finally {
        console.warn = orig;
    }

    const u = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(u.id);
    assert.equal(uso.tokens, 100000, 'el uso real se contabiliza aunque supere la reserva');

    const despues = (await db.obtenerCreditos()).bolsa;
    assert.equal(despues, antes - 100000, 'la bolsa refleja el descuento real (sin doble gasto)');
    assert.ok(warns.some(w => w.includes('[nomi-api][evidencia]')), 'debe quedar evidencia técnica');
    assert.ok(!warns.some(w => w.includes('hola')), 'la evidencia no contiene el contenido del usuario');
});

// ---- Cuerpo HTTP demasiado grande se rechaza ANTES de Groq ----
test('cuerpo HTTP demasiado grande se rechaza antes de Groq', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }], usage: { total_tokens: 5 } }), { status: 200 }); };

    const req = new Request('https://nomi-api.workers.dev/v1/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024), authorization: 'Bearer ' + token },
        body: JSON.stringify({ modelo: 'openai/gpt-oss-20b', mensaje: 'hola' }),
    });
    const r = await worker.fetch(req, env);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
    assert.equal(contador.llamadas, 0, 'Groq no debe ser llamado');
});

// ---- Mensaje grande que excede tokens/minuto se rechaza ANTES de Groq (sin Math.min) ----
test('mensaje que excede tokens/minuto se rechaza antes de Groq', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }], usage: { total_tokens: 5 } }), { status: 200 }); };

    const mensaje = 'a'.repeat(8000); // 8000 bytes -> peor caso 8000 tokens + salida + margen > 8000/min
    const r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje } });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
    assert.equal(contador.llamadas, 0, 'Groq no debe ser llamado');
});

// ---- Rollback: fallo de reservarUso libera el DO y no llama a Groq ----
test('rollback: fallo de reservarUso libera el DO y no llama a Groq', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const usuario = await db.buscarPorToken(token);
    // Casi agota la cuota mensual para que la reserva individual falle (pasa el chequeo previo).
    await db.sumarUso(usuario.id, { tokens: CREDITOS.INVITADO_POR_MES - 100, solicitudes: 1 });

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no deberia llamarse'); };

    const r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    assert.equal(r.status, 429);
    assert.equal(contador.llamadas, 0, 'Groq no debe ser llamado');

    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const snap = await (await doObj.fetch('https://internal/snapshot', { method: 'GET' })).json();
    assert.equal(snap.tokens_minuto, 0, 'la reserva del DO debe liberarse tras el fallo');
});

// ---- Rollback: fallo de reservarBolsa libera DO y cuota individual, y no llama a Groq ----
test('rollback: fallo de reservarBolsa libera DO y cuota, y no llama a Groq', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    // Deja la bolsa global pequeña sin disparar el reset mensual (periodo = mes actual).
    const tablas = db.db._tablas;
    tablas.creditos[0].periodo = periodoActual();
    tablas.creditos[0].bolsa_global = 100; // menor que la reserva (~1284)

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no deberia llamarse'); };

    const r = await llamar(env, '/v1/chat', { metodo: 'POST', token, body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' } });
    assert.equal(r.status, 503);
    assert.equal(contador.llamadas, 0, 'Groq no debe ser llamado');

    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const snap = await (await doObj.fetch('https://internal/snapshot', { method: 'GET' })).json();
    assert.equal(snap.tokens_minuto, 0, 'la reserva del DO debe liberarse');

    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 0, 'la cuota individual debe liberarse (rollback)');
});

test('endpoints admin funcionan con ADMIN_SECRET correcto', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitacion', {
        metodo: 'POST', admin: env.ADMIN_SECRET, body: {},
    });
    assert.equal(r.status, 201);
    const data = await r.json();
    assert.ok(data.ok);
    assert.ok(data.codigo, 'crea un codigo de invitacion');
});

// ---- Lector streaming SIN Content-Length: cuerpo válido se procesa y llama a Groq ----
test('chat con ReadableStream sin Content-Length procesa y llama a Groq', async () => {
    const llamadas = { n: 0 };
    globalThis.fetch = async () => {
        llamadas.n++;
        return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }], usage: { total_tokens: 8 } }), { status: 200 });
    };
    const env = envNuevo();
    await llenarBolpa(env);
    const token = await crearInvitado(env);

    const req = requestStream('/v1/chat', JSON.stringify({ modelo: 'openai/gpt-oss-20b', mensaje: 'hola' }), { token });
    assert.equal(req.headers.get('content-length'), null, 'la peticion no debe traer Content-Length');

    const r = await worker.fetch(req, env);
    assert.equal(r.status, 200);
    assert.equal(llamadas.n, 1, 'debe llamar a Groq (cuerpo dentro del límite)');
});

// ---- Lector streaming SIN Content-Length: cuerpo que excede el límite se rechaza (400) y no llama a Groq ----
test('cuerpo ReadableStream sin Content-Length que excede el límite se rechaza y no llama a Groq', async () => {
    const env = envNuevo();
    const token = await crearInvitado(env);
    const llamadas = { n: 0 };
    globalThis.fetch = async () => { llamadas.n++; throw new Error('Groq no debería llamarse'); };

    const grande = JSON.stringify({ modelo: 'openai/gpt-oss-20b', mensaje: 'a'.repeat((1 << 20) + 100) });
    const req = requestStream('/v1/chat', grande, { token });

    const r = await worker.fetch(req, env);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
    assert.equal(llamadas.n, 0, 'Groq no debe ser llamado');
});

// ---- Admin: cuerpo ReadableStream sin Content-Length que excede el límite se rechaza (400) ----
test('admin/liberar con ReadableStream sin Content-Length que excede el límite se rechaza', async () => {
    const env = envNuevo();
    const grande = JSON.stringify({ operacionId: 'x', monto: 1 }) + 'x'.repeat((1 << 20) + 100);
    const req = requestStream('/admin/liberar', grande, { admin: env.ADMIN_SECRET });

    const r = await worker.fetch(req, env);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
});

// ---- MAX_ENTRADA_BYTES efectivo: entrada + salida + margen cabe bajo tokens/minuto ----
test('MAX_ENTRADA_BYTES garantiza entrada + salida + margen bajo tokens_por_minuto', async () => {
    const { RESERVA, LIMITES_GROQ } = await import('../src/limites.js');
    assert.equal(
        RESERVA.MAX_ENTRADA_BYTES * RESERVA.TOKENS_POR_BYTE_ENTRADA + RESERVA.MAX_SALIDA_TOKENS + RESERVA.MARGEN_TOKEN,
        LIMITES_GROQ.tokens_por_minuto,
        'el peor caso debe caber exactamente bajo el límite del proveedor'
    );
    assert.ok(RESERVA.MAX_ENTRADA_BYTES > 0);
});

// ---- Límite global de invitados: no se activa el usuario número 11 ----
test('MAX_INVITADOS: no se crea ni activa el invitado 11', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    // Se activan exactamente MAX_INVITADOS invitados (10).
    for (let i = 0; i < CAPACIDAD_DIARIA.MAX_INVITADOS; i++) {
        const t = await crearInvitado(env);
        assert.ok(t, 'cada invitado válido debe activarse');
    }
    // El undécimo intento con una invitación válida debe rechazarse de forma segura.
    const { codigo } = await db.crearInvitacion();
    const r = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(r.status, 503, 'el invitado 11 no debe activarse');
    assert.equal((await r.json()).error, 'capacidad-temporal-limitada');
    // No debe haberse creado ni insertado un undécimo usuario en D1.
    const total = env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado').length;
    assert.equal(total, CAPACIDAD_DIARIA.MAX_INVITADOS, 'solo quedan 10 invitados en D1');
});

// ---- Activación atómica: con 9 usuarios, dos concurrentes terminan en exactamente 10 ----
test('activacion atomica: 9 + 2 concurrentes -> 10 usuarios (1 exito, 1 rechazo, invitacion no quemada)', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);

    // Sembrar 9 usuarios mediante invitaciones válidas (queda exactamente 1 cupo).
    for (let i = 0; i < CAPACIDAD_DIARIA.MAX_INVITADOS - 1; i++) {
        await crearInvitado(env);
    }
    assert.equal(env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado').length, 9);

    // Dos invitaciones nuevas, ambas pendientes y reutilizables al inicio.
    const i1 = (await db.crearInvitacion()).codigo;
    const i2 = (await db.crearInvitacion()).codigo;
    assert.equal(env.NOMI_DB._tablas.invitaciones.filter(inv => inv.estado === 'pendiente').length, 2);

    const [r1, r2] = await Promise.all([
        llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo: i1 } }),
        llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo: i2 } }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort((a, b) => a - b), [201, 503],
        'solo un cupo restante: exactamente una activación exitosa y una rechazada');

    // Tope respetado incluso bajo concurrencia: exactamente 10 usuarios.
    const total = env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado').length;
    assert.equal(total, CAPACIDAD_DIARIA.MAX_INVITADOS, 'exactamente 10 usuarios, sin superar el tope');

    // Sin invitación quemada: el código que no obtuvo cupo sigue 'pendiente' (reutilizable).
    const pendientes = env.NOMI_DB._tablas.invitaciones.filter(inv => inv.estado === 'pendiente').length;
    assert.equal(pendientes, 1, 'la invitación sin cupo queda pendiente y reutilizable');
    const canjeadas = env.NOMI_DB._tablas.invitaciones.filter(inv => inv.estado === 'canjeada').length;
    assert.equal(canjeadas, CAPACIDAD_DIARIA.MAX_INVITADOS, '9 del seed + 1 del ganador');
});

// ---- Código inválido: no crea usuario ni consume cupo ----
test('codigo invalido: no crea usuario ni consume cupo', async () => {
    const env = envNuevo();
    const antes = env.NOMI_DB._tablas.usuarios.length;
    const r = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo: 'CODIGOINVALIDO1' } });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'invitacion-invalida');
    assert.equal(env.NOMI_DB._tablas.usuarios.length, antes, 'no debe crearse ningún usuario');
});

// ---- Mismo código concurrente: solo se crea un usuario ----
test('mismo codigo concurrente: solo se crea un usuario', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();

    const [r1, r2] = await Promise.all([
        llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } }),
        llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort((a, b) => a - b), [201, 400],
        'una activación tiene éxito y la otra ve la invitación ya usada');

    const total = env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado').length;
    assert.equal(total, 1, 'exactamente un usuario para una invitación');
    const canjeadas = env.NOMI_DB._tablas.invitaciones.filter(inv => inv.estado === 'canjeada').length;
    assert.equal(canjeadas, 1, 'la invitación se canjea una sola vez');
});

// ---- Rollback ante fallo de sentencia: DB.batch no deja estado parcial ----
test('batch: fallo de una sentencia revierte todo (sin estado parcial)', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const antes = JSON.stringify(db.db._tablas);

    await assert.rejects(
        async () => {
            await db.db.batch([
                db.db.prepare("INSERT INTO invitaciones (id, codigo_hash, estado, creada_en) VALUES (?, ?, 'pendiente', ?)").bind('inv-ok', 'hash-ok', 1),
                db.db.prepare("INSERT INTO invitaciones (id, codigo_hash, estado, creada_en) VALUES (?, ?, 'pendiente', ?) FORCE_FAIL").bind('inv-fail', 'hash-fail', 1),
            ]);
        },
        /fallo simulado/
    );

    assert.equal(JSON.stringify(db.db._tablas), antes, 'la transacción no deja ningún cambio parcial');
});
