// Pruebas de la capacidad diaria real de Groq (Durable Object como única fuente
// de verdad). Sin llamadas reales a Groq ni secretos. Ejecutar: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { RateLimiterDO } from '../src/rate-limiter-do.js';
import { crearEnv, crearStorageMemoria } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { CAPACIDAD_DIARIA, LIMITES_GROQ, periodoActual } from '../src/limites.js';

// ---- Helpers ----
function instanciaDO(storage = crearStorageMemoria()) {
    const obj = new RateLimiterDO({ storage }, {});
    const llamar = (ruta, body) => obj.fetch(new Request('https://x' + ruta, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    }));
    return { obj, storage, llamar };
}

function envConDo(storage) {
    const obj = new RateLimiterDO({ storage }, {});
    const doBinding = { idFromName: () => 'global', get: () => ({ fetch: (u, i) => obj.fetch(new Request(u, i)) }) };
    return crearEnv({ doBinding });
}

function hoy() { return new Date().toISOString().slice(0, 10); }

async function sembrarDia(storage, { protectedUsed = 0, sharedUsed = 0, tokens = null } = {}) {
    await storage.put('dia:' + hoy(), {
        tokens: tokens == null ? protectedUsed + sharedUsed : tokens,
        solicitudes: 0,
        protectedUsed,
        sharedUsed,
        firstUse: {},
    });
}

function simularGroq({ texto = 'ok', total = 10 } = {}) {
    globalThis.fetch = async () => new Response(JSON.stringify({
        choices: [{ message: { content: texto } }],
        usage: { total_tokens: total, prompt_tokens: 5, completion_tokens: total - 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function crearInvitado(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const resp = await worker.fetch(new Request('https://nomi-api.workers.dev/v1/activate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo }),
    }), env);
    const data = await resp.json();
    assert.equal(resp.status, 201);
    return data.token;
}

function sembrarBolsa(env, monto = 500000) {
    env.NOMI_DB._tablas.creditos[0].periodo = periodoActual();
    env.NOMI_DB._tablas.creditos[0].bolsa_global = monto;
}

function chat(env, token, { modelo = 'openai/gpt-oss-20b', mensaje = 'hola' } = {}) {
    return worker.fetch(new Request('https://nomi-api.workers.dev/v1/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ modelo, mensaje }),
    }), env);
}

function usage(env, token) {
    return worker.fetch(new Request('https://nomi-api.workers.dev/v1/usage', {
        method: 'GET', headers: { authorization: 'Bearer ' + token },
    }), env);
}

function snapshotDO(env) {
    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    return doObj.fetch('https://internal/snapshot', { method: 'GET' }).then(r => r.json());
}

// ---- 1) Primer uso válido usa reserva protegida ----
test('primer uso válido usa la reserva protegida', async () => {
    const { llamar } = instanciaDO();
    const r = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    const j = await r.json();
    assert.equal(j.permitido, true);
    assert.equal(j.fuente, 'protegida', 'un primer uso válido consume la reserva protegida');

    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 100);
    assert.equal(snap.compartida_usada, 0, 'no toca la bolsa compartida');
});

// ---- 2) Segundo uso del mismo usuario usa bolsa compartida ----
test('segundo uso del mismo usuario usa la bolsa compartida', async () => {
    const { llamar } = instanciaDO();
    const r1 = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    assert.equal((await r1.json()).fuente, 'protegida');

    const r2 = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    const j2 = await r2.json();
    assert.equal(j2.permitido, true);
    assert.equal(j2.fuente, 'compartida', 'el mismo usuario ya no obtiene reserva protegida');

    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 100, 'la reserva protegida no crece');
    assert.equal(snap.compartida_usada, 100);
});

// ---- 3) Dos solicitudes concurrentes del mismo usuario no obtienen doble reserva ----
test('dos solicitudes concurrentes del mismo usuario no obtienen doble reserva', async () => {
    const { llamar } = instanciaDO();
    const [a, b] = await Promise.all([
        llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true }),
        llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true }),
    ]);
    const ja = await a.json();
    const jb = await b.json();
    const fuentes = [ja.fuente, jb.fuente];
    assert.equal(fuentes.filter(f => f === 'protegida').length, 1, 'solo una reserva protegida');
    assert.equal(fuentes.filter(f => f === 'compartida').length, 1, 'la otra cae en compartida');

    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 100, 'no se duplica la reserva protegida');
});

// ---- 4) Diez usuarios no superan los 50000 tokens protegidos ----
// La reserva protegida total es 50000 = 10 invitados x 5000. El límite por minuto
// (8000) es ortogonal y no permite llenarla en una sola ventana, así que se prueba
// el tope total y el tope por usuario de forma determinista.
test('reserva protegida se limita a 50000 tokens totales (10 invitados x 5000)', async () => {
    const storage = crearStorageMemoria();
    const { llamar } = instanciaDO(storage);
    // 9 invitados ya ocupan 45000 de la reserva protegida (9 x 5000).
    await storage.put('dia:' + hoy(), { tokens: 45000, solicitudes: 0, protectedUsed: 45000, sharedUsed: 0, firstUse: {} });
    // El décimo invitado llena el tope exacto (45000 + 5000 = 50000).
    const r0 = await llamar('/reservar', { usuarioId: 'u10', tokens: 5000, solicitudes: 1, primerUso: true });
    assert.equal((await r0.json()).fuente, 'protegida');

    // Cualquier invitado adicional ya no obtiene protegida (la reserva está llena).
    for (let i = 1; i <= 5; i++) {
        const r = await llamar('/reservar', { usuarioId: 'extra' + i, tokens: 1, solicitudes: 1, primerUso: true });
        const j = await r.json();
        assert.equal(j.fuente, 'compartida', 'la reserva protegida no debe superar 50000');
    }
    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 50000, 'tope total de la reserva protegida');
    assert.ok(snap.protegida_usada <= CAPACIDAD_DIARIA.RESERVA_PROTEGIDA);
});

// Un mismo invitado no puede reservar más de 5000 tokens de la reserva protegida.
test('un invitado no puede reservar más de 5000 tokens de protegida', async () => {
    const { llamar } = instanciaDO();
    const r = await llamar('/reservar', { usuarioId: 'uX', tokens: 6000, solicitudes: 1, primerUso: true });
    const j = await r.json();
    assert.equal(j.fuente, 'compartida', 'excede el tope por usuario (5000)');
    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 0, 'no consume reserva protegida');
});

// ---- 5) Usuarios no prioritarios no consumen reserva protegida ----
test('usuarios no prioritarios no consumen la reserva protegida', async () => {
    const { llamar } = instanciaDO();
    const r = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: false });
    const j = await r.json();
    assert.equal(j.permitido, true);
    assert.equal(j.fuente, 'compartida', 'un no prioritario usa la bolsa compartida');
    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 0, 'la reserva protegida queda intacta');

    // Un primer uso posterior sí puede usar la reserva protegida (no fue tocada).
    const r2 = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    assert.equal((await r2.json()).fuente, 'protegida');
});

// ---- 6) Fallo de Groq devuelve la reserva y permite reintento como primer uso ----
test('fallo de Groq devuelve la reserva y permite reintento como primer uso', async () => {
    const { llamar } = instanciaDO();
    const r = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    const reserva = await r.json();
    assert.equal(reserva.fuente, 'protegida');

    // Simula fallo de Groq -> liberar la reserva (revertir tokens y marca de primer uso).
    await llamar('/liberar', { reservaId: reserva.reservaId });
    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.protegida_usada, 0, 'la reserva protegida se devuelve');
    assert.equal(snap.compartida_usada, 0);

    // Reintento como primer uso -> vuelve a obtener la reserva protegida.
    const r2 = await llamar('/reservar', { usuarioId: 'u1', tokens: 100, solicitudes: 1, primerUso: true });
    const j2 = await r2.json();
    assert.equal(j2.permitido, true);
    assert.equal(j2.fuente, 'protegida', 'puede reintentar como primer uso');
});

// ---- 7) Estados devueltos por /v1/usage ----
test('/v1/usage devuelve estado_capacidad y prioridad de primer uso', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);

    // Normal (bolsa compartida vacía).
    let data = await (await usage(env, token)).json();
    assert.equal(data.estado_capacidad, 'normal');
    assert.equal(data.mantiene_prioridad_primer_uso, true, 'invitado nuevo conserva prioridad');
    assert.ok(data.capacidad_diaria_disponible > 0);
    assert.equal(data.capacidad_diaria_disponible, CAPACIDAD_DIARIA.TOTAL_GROQ - CAPACIDAD_DIARIA.MARGEN_SEGURIDAD);

    // Compartida (uso medio de la bolsa compartida).
    await sembrarDia(storage, { sharedUsed: Math.floor(CAPACIDAD_DIARIA.BOLSA_COMPARTIDA * 0.6) });
    assert.equal((await (await usage(env, token)).json()).estado_capacidad, 'compartida');

    // Limitada (poca bolsa compartida).
    await sembrarDia(storage, { sharedUsed: Math.floor(CAPACIDAD_DIARIA.BOLSA_COMPARTIDA * 0.9) });
    assert.equal((await (await usage(env, token)).json()).estado_capacidad, 'limitada');

    // Reserva protegida (bolsa compartida agotada).
    await sembrarDia(storage, { sharedUsed: CAPACIDAD_DIARIA.BOLSA_COMPARTIDA });
    assert.equal((await (await usage(env, token)).json()).estado_capacidad, 'reserva-protegida');
});

// Reserva protegida agotada: quien ya usó hoy es rechazado; primer uso válido sí pasa.
test('reserva protegida: no prioritario rechazado, primer uso válido usa la reserva', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    await sembrarBolsa(env);
    await sembrarDia(storage, { sharedUsed: CAPACIDAD_DIARIA.BOLSA_COMPARTIDA });

    simularGroq({ texto: 'ok', total: 25 });

    // Usuario que ya usó hoy (no candidato) -> 503.
    const tokenA = await crearInvitado(env);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const uA = await db.buscarPorToken(tokenA);
    await db.marcarUsoHoy(uA.id);
    let r = await chat(env, tokenA);
    assert.equal(r.status, 503, 'quien ya usó hoy no tiene capacidad en reserva protegida');

    // Usuario nuevo (candidato) -> 200 y consume la reserva protegida.
    const tokenB = await crearInvitado(env);
    r = await chat(env, tokenB);
    assert.equal(r.status, 200, 'primer uso válido pasa desde la reserva protegida');
    const snap = await snapshotDO(env);
    assert.ok(snap.protegida_usada > 0, 'consumió la reserva protegida');
    assert.equal(snap.compartida_usada, CAPACIDAD_DIARIA.BOLSA_COMPARTIDA, 'la bolsa compartida sigue agotada');
});

// ---- 8) No superar 200000 diarios ni 8000 por minuto ----
test('no supera 8000 tokens por minuto (concurrencia)', async () => {
    const { llamar } = instanciaDO();
    // 10 reservas concurrentes de 1000: solo caben 8 en el minuto (8000).
    const respuestas = await Promise.all(
        Array.from({ length: 10 }, (_, i) => llamar('/reservar', { usuarioId: 'u-conc-' + i, tokens: 1000, solicitudes: 1, primerUso: false }))
    );
    const datos = await Promise.all(respuestas.map(r => r.json()));
    assert.equal(datos.filter(d => d.permitido).length, 8, 'máximo 8 caben en 8000/min');
    const snap = await (await llamar('/snapshot')).json();
    assert.ok(snap.tokens_minuto <= LIMITES_GROQ.tokens_por_minuto, 'no supera el límite por minuto');
    assert.ok(snap.tokens_dia <= CAPACIDAD_DIARIA.TOTAL_GROQ, 'no supera el límite diario');
});

test('no supera el límite diario real (el margen de seguridad nunca se asigna)', async () => {
    const storage = crearStorageMemoria();
    const { llamar } = instanciaDO(storage);
    // Casi al tope diario usable (180000). Una reserva de 1 debe ser rechazada.
    await storage.put('dia:' + hoy(), { tokens: 180000, solicitudes: 0, protectedUsed: 0, sharedUsed: 0, firstUse: {} });
    const r = await llamar('/reservar', { usuarioId: 'u1', tokens: 1, solicitudes: 1, primerUso: false });
    const j = await r.json();
    assert.equal(j.permitido, false, 'el tope diario (sin margen) se respeta');
    const snap = await (await llamar('/snapshot')).json();
    assert.ok(snap.tokens_dia <= CAPACIDAD_DIARIA.TOTAL_GROQ, 'nunca supera 200000 diarios');
    assert.ok(snap.tokens_dia <= CAPACIDAD_DIARIA.TOTAL_GROQ - CAPACIDAD_DIARIA.MARGEN_SEGURIDAD, 'el margen de seguridad queda libre');
});

// ---- CSPRNG: el reservaId no usa Math.random ----
test('generarReservaId no usa Math.random (el flujo sigue funcionando si falla)', async () => {
    const origRandom = Math.random;
    Math.random = () => { throw new Error('Math.random no debe usarse (CSPRNG)'); };
    try {
        const { llamar } = instanciaDO();
        const r = await llamar('/reservar', { usuarioId: 'u-csprng', tokens: 100, solicitudes: 1, primerUso: true });
        const j = await r.json();
        assert.equal(j.permitido, true, 'la reserva debe funcionar sin Math.random');
        assert.ok(j.reservaId && j.reservaId.length > 0, 'se genera un reservaId CSPRNG');
        const snap = await (await llamar('/snapshot')).json();
        assert.equal(snap.protegida_usada, 100, 'la reserva se contabiliza correctamente');
    } finally {
        Math.random = origRandom;
    }
});

// ---- Límite real de solicitudes por día en /reservar (1000) ----
test('/reservar respeta el límite de 1000 solicitudes por día', async () => {
    const { llamar } = instanciaDO();
    for (let i = 0; i < LIMITES_GROQ.solicitudes_por_dia; i++) {
        const r = await llamar('/reservar', { usuarioId: 'u-req', tokens: 1, solicitudes: 1, primerUso: false });
        assert.equal((await r.json()).permitido, true);
    }
    const r2 = await llamar('/reservar', { usuarioId: 'u-req', tokens: 1, solicitudes: 1, primerUso: false });
    const j2 = await r2.json();
    assert.equal(j2.permitido, false, 'la solicitud 1001 del día debe rechazarse');
    assert.equal(j2.motivo, 'solicitudes', 'motivo identificable');
    const snap = await (await llamar('/snapshot')).json();
    assert.equal(snap.solicitudes_dia, LIMITES_GROQ.solicitudes_por_dia, 'no se excede el límite real por día');
});
