// Pruebas de las causas de capacidad diferenciadas en /v1/chat.
// El Worker ya no convierte todos los rechazos internos de capacidad en el mismo
// 503 ambiguo: cada causa lleva un código estable y su mensaje de recuperación
// concreto (sin exponer estadísticas de otros usuarios).
//   - limite-por-minuto -> 503 "limite-por-minuto"   "Espera un minuto y reintenta."
//   - capacidad-diaria  -> 503 "capacidad-diaria"    "La capacidad diaria de NoMi está agotada. Reintenta mañana."
//   - bolsa-agotada     -> 503 "bolsa-agotada"       "La bolsa compartida de NoMi está agotada por ahora."
//   - cuota-mensual     -> 429 "cuota-mensual-agotada"
//
// Ejecutar: node --test test/

import './setup-crypto.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { RateLimiterDO } from '../src/rate-limiter-do.js';
import { crearEnv, crearStorageMemoria } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { CAPACIDAD_DIARIA, LIMITES_GROQ, CREDITOS, periodoActual } from '../src/limites.js';

// ---- Helpers (mismos patrones que capacidad-diaria.test.js) ----
function envConDo(storage) {
    const obj = new RateLimiterDO({ storage }, {});
    const doBinding = { idFromName: () => 'global', get: () => ({ fetch: (u, i) => obj.fetch(new Request(u, i)) }) };
    return crearEnv({ doBinding });
}

function hoy() { return new Date().toISOString().slice(0, 10); }
function minuto() { return Math.floor(Date.now() / 60000); }

async function crearInvitado(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const resp = await worker.fetch(new Request('https://nomi-api.workers.dev/v1/activate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo }),
    }), env);
    assert.equal(resp.status, 201);
    return (await resp.json()).token;
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
// ---- 1) Límite por minuto (TPM) ----
test('TPM: 503 "limite-por-minuto" con mensaje "Espera un minuto y reintenta."', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    // Lleno el minuto actual (y el siguiente por si el reloj cruza el borde de 60 s).
    for (const m of [minuto(), minuto() + 1]) {
        await storage.put('min:' + m, { tokens: LIMITES_GROQ.tokens_por_minuto });
    }

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no debe llamarse'); };

    const r = await chat(env, token);
    assert.equal(r.status, 503);
    const data = await r.json();
    assert.equal(data.error, 'limite-por-minuto', 'código estable de TPM');
    assert.equal(data.mensaje, 'Espera un minuto y reintenta.', 'recuperación concreta para TPM');
    assert.equal(contador.llamadas, 0, 'no llama a Groq al superar TPM');
});

// ---- 2) Capacidad diaria (tope usable del día alcanzado) ----
test('capacidad diaria: 503 "capacidad-diaria" con mensaje de mañana', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    // Tope usable diario completo: TOTAL_GROQ - MARGEN_SEGURIDAD (180000).
    await storage.put('dia:' + hoy(), {
        tokens: CAPACIDAD_DIARIA.TOTAL_GROQ - CAPACIDAD_DIARIA.MARGEN_SEGURIDAD,
        solicitudes: 0, protectedUsed: 0, sharedUsed: 0, firstUse: {},
    });

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no debe llamarse'); };

    const r = await chat(env, token);
    assert.equal(r.status, 503);
    const data = await r.json();
    assert.equal(data.error, 'capacidad-diaria', 'código estable de capacidad diaria');
    assert.equal(data.mensaje, 'La capacidad diaria de NoMi está agotada. Reintenta mañana.');
    assert.equal(contador.llamadas, 0);
});

// ---- 3) Reserva protegida agotada para quien ya usó hoy ----
test('reserva protegida sin primer uso: 503 "capacidad-diaria"', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    // Bolsa compartida agotada -> decidirModo = reserva-protegida.
    await storage.put('dia:' + hoy(), {
        tokens: CAPACIDAD_DIARIA.BOLSA_COMPARTIDA,
        solicitudes: 0, protectedUsed: 0, sharedUsed: CAPACIDAD_DIARIA.BOLSA_COMPARTIDA, firstUse: {},
    });

    // El usuario ya usó NoMi hoy -> no es candidato a la reserva protegida.
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const u = await db.buscarPorToken(token);
    await db.marcarUsoHoy(u.id);

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no debe llamarse'); };

    const r = await chat(env, token);
    assert.equal(r.status, 503);
    const data = await r.json();
    assert.equal(data.error, 'capacidad-diaria', 'quien ya usó hoy sin bolsa compartida recibe la causa diaria');
    assert.equal(contador.llamadas, 0);
});

// ---- 4) Bolsa global mensual agotada ----
test('bolsa global agotada: 503 "bolsa-agotada" con mensaje de bolsa', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env, 0); // bolsa global sin créditos

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no debe llamarse'); };

    const r = await chat(env, token);
    assert.equal(r.status, 503);
    const data = await r.json();
    assert.equal(data.error, 'bolsa-agotada', 'código estable de bolsa mensual');
    assert.ok(data.mensaje.includes('bolsa compartida'), 'mensaje concreto de bolsa');
    assert.equal(contador.llamadas, 0);
});

// ---- 5) Cuota mensual individual agotada (429, inalterado) ----
test('cuota mensual agotada: 429 "cuota-mensual-agotada"', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const u = await db.buscarPorToken(token);
    await db.sumarUso(u.id, { tokens: CREDITOS.INVITADO_POR_MES, solicitudes: 1 });

    const contador = { llamadas: 0 };
    globalThis.fetch = async () => { contador.llamadas++; throw new Error('Groq no debe llamarse'); };

    const r = await chat(env, token);
    assert.equal(r.status, 429);
    const data = await r.json();
    assert.equal(data.error, 'cuota-mensual-agotada', 'la cuota mensual mantiene su código 429');
    assert.equal(contador.llamadas, 0);
    // No expone estadísticas de otros usuarios.
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'uso'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'bolsa'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'otros'), false);
});

// ---- 6) Groq HTTP 429 real (TPM/RPM/TPD/RPD) -> 429 "limite-proveedor" ----
test('Groq 429 real (TPM/RPM/TPD/RPD): 429 "limite-proveedor"', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    const contador = { llamadas: 0 };
    globalThis.fetch = async (url) => {
        contador.llamadas++;
        assert.ok(String(url).includes('groq.com'), 'debe llamar a Groq');
        return new Response('rate limit', {
            status: 429,
            headers: { 'content-type': 'application/json' },
        });
    };

    const r = await chat(env, token);
    assert.equal(r.status, 429);
    const data = await r.json();
    assert.equal(data.error, 'limite-proveedor', 'código estable de límite del proveedor');
    assert.equal(data.mensaje, 'NoMi alcanzó temporalmente un límite del proveedor. Espera y reintenta.');
    assert.equal(contador.llamadas, 1, 'llama a Groq una vez');
});

// ---- 7) Groq 5xx (p.ej. 503) -> 502 "proveedor-no-disponible" ----
test('Groq 5xx: 502 "proveedor-no-disponible"', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    const contador = { llamadas: 0 };
    globalThis.fetch = async (url) => {
        contador.llamadas++;
        assert.ok(String(url).includes('groq.com'), 'debe llamar a Groq');
        return new Response('service unavailable', {
            status: 503,
            headers: { 'content-type': 'application/json' },
        });
    };

    const r = await chat(env, token);
    assert.equal(r.status, 502);
    const data = await r.json();
    assert.equal(data.error, 'proveedor-no-disponible', 'código estable de proveedor no disponible');
    assert.equal(data.mensaje, 'El proveedor no está disponible ahora.');
    assert.equal(contador.llamadas, 1, 'llama a Groq una vez');
});

// ---- 8) Groq fallo de red -> 502 "proveedor-no-disponible" ----
test('Groq fallo de red: 502 "proveedor-no-disponible"', async () => {
    const storage = crearStorageMemoria();
    const env = envConDo(storage);
    const token = await crearInvitado(env);
    sembrarBolsa(env);

    const contador = { llamadas: 0 };
    globalThis.fetch = async (url) => {
        contador.llamadas++;
        assert.ok(String(url).includes('groq.com'), 'debe llamar a Groq');
        throw new Error('network error');
    };

    const r = await chat(env, token);
    assert.equal(r.status, 502);
    const data = await r.json();
    assert.equal(data.error, 'proveedor-no-disponible', 'código estable de proveedor no disponible');
    assert.equal(data.mensaje, 'El proveedor no está disponible ahora.');
    assert.equal(contador.llamadas, 1, 'llama a Groq una vez');
});
}