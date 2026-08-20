// Pruebas del Durable Object (límites globales) y liberación de reserva.
// Sin llamadas reales ni secretos. Ejecutar con: node --test test/

import './setup-crypto.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiterDO } from '../src/rate-limiter-do.js';
import { crearD1Stub, crearStorageMemoria } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { LIMITES_GROQ, CREDITOS, periodoActual } from '../src/limites.js';

function doInstancia() {
    const obj = new RateLimiterDO({ storage: crearStorageMemoria() }, {});
    return (ruta, body) => obj.fetch(new Request('https://x' + ruta, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    }));
}

// ---- Límite global de tokens por minuto ----
test('DO limita tokens por minuto', async () => {
    const fn = doInstancia();
    const r = await fn('/consume', { tokens: LIMITES_GROQ.tokens_por_minuto, solicitudes: 1 });
    assert.equal((await r.json()).permitido, true);
    const r2 = await fn('/consume', { tokens: 1, solicitudes: 1 });
    assert.equal((await r2.json()).permitido, false, 'supera el límite por minuto');
});

// ---- Límite global de solicitudes por día ----
test('DO limita solicitudes por día', async () => {
    const fn = doInstancia();
    for (let i = 0; i < LIMITES_GROQ.solicitudes_por_dia; i++) {
        const r = await fn('/consume', { tokens: 1, solicitudes: 1 });
        assert.equal((await r.json()).permitido, true);
    }
    const r = await fn('/consume', { tokens: 1, solicitudes: 1 });
    assert.equal((await r.json()).permitido, false);
});

// ---- La prioridad nunca supera límites reales ----
test('prioridad no excede los límites reales del proveedor', async () => {
    const fn = doInstancia();
    const r = await fn('/consume', { tokens: LIMITES_GROQ.tokens_por_dia + 1, solicitudes: 1, prioridad: true });
    assert.equal((await r.json()).permitido, false, 'la prioridad no debe saltar el límite real');
});

// ---- Reserva y liberación de tokens (conciliación en el DO) ----
test('DO libera los tokens sobreservados tras reconciliar', async () => {
    const fn = doInstancia();
    const r = await fn('/consume', { tokens: 100, solicitudes: 1 });
    assert.equal((await r.json()).permitido, true);
    const rel = await fn('/release', { tokens: 80 });
    assert.equal((await rel.json()).liberado, 80);
    const snap = await fn('/snapshot');
    assert.equal((await snap.json()).tokens_dia, 20, 'neto contabilizado tras liberar la diferencia');
});

// ---- Concurrencia global: no se exceden los límites reales ----
test('DO concurrencia: no excede límite por minuto', async () => {
    const fn = doInstancia();
    // Llena el minuto dejando 1000 tokens disponibles (7000 / 8000).
    const r0 = await fn('/consume', { tokens: LIMITES_GROQ.tokens_por_minuto - 1000, solicitudes: 1 });
    assert.equal((await r0.json()).permitido, true);

    // 5 reservas concurrentes de 500: solo caben 2 dentro de los 1000 restantes.
    const respuestas = await Promise.all(
        Array.from({ length: 5 }, () => fn('/consume', { tokens: 500, solicitudes: 1 }))
    );
    const datos = await Promise.all(respuestas.map(r => r.json()));
    const permitidos = datos.filter(d => d.permitido);
    assert.equal(permitidos.length, 2, 'máximo 2 caben en los 1000 restantes');

    const snap = await fn('/snapshot');
    assert.equal((await snap.json()).tokens_minuto, LIMITES_GROQ.tokens_por_minuto, 'no se excede el límite real por minuto');
});

test('DO concurrencia: no excede límite por día (solicitudes)', async () => {
    const fn = doInstancia();
    for (let i = 0; i < LIMITES_GROQ.solicitudes_por_dia - 1; i++) {
        const r = await fn('/consume', { tokens: 1, solicitudes: 1 });
        assert.equal((await r.json()).permitido, true);
    }
    // 3 reservas concurrentes de 1 solicitud: solo 1 cabe (límite real).
    const respuestas = await Promise.all(
        Array.from({ length: 3 }, () => fn('/consume', { tokens: 1, solicitudes: 1 }))
    );
    const datos = await Promise.all(respuestas.map(r => r.json()));
    assert.equal(datos.filter(d => d.permitido).length, 1, 'máximo 1 solicitud cabe en el día');
    const snap = await fn('/snapshot');
    assert.equal((await snap.json()).solicitudes_dia, LIMITES_GROQ.solicitudes_por_dia, 'no se excede el límite real por día');
});

// ---- Liberación de reserva sin doble gasto ----
test('liberar reserva es idempotente (sin doble gasto)', async () => {
    const db = new BaseDatos(crearD1Stub(), 'secret-test');
    const antes = await db.obtenerCreditos();
    assert.equal(antes.reserva, 1800000);
    assert.equal(antes.bolsa, 4200000, 'la bolsa global inicia en 4.200.000 créditos');

    const r1 = await db.liberarReserva('op-1', 500000, 'primer lote');
    assert.equal(r1.repetida, false);
    const r2 = await db.liberarReserva('op-1', 500000, 'intento duplicado');
    assert.equal(r2.repetida, true, 'la misma operación no debe gastar dos veces');

    const despues = await db.obtenerCreditos();
    assert.equal(despues.reserva, 1800000 - 500000);
    assert.equal(despues.bolsa, 4200000 + 500000, 'liberar mueve la reserva a la bolsa');
});

// ---- No liberar más de lo que hay en la reserva ----
test('no se puede liberar más de la reserva disponible', async () => {
    const db = new BaseDatos(crearD1Stub(), 'secret-test');
    await assert.rejects(() => db.liberarReserva('op-grande', 999999999, 'x'), /no dispone/);
    const creditos = await db.obtenerCreditos();
    assert.equal(creditos.reserva, 1800000, 'la reserva no debe cambiar');
});

// ---- Bolsa global inicia en 4.200.000 (10 invitados x 420.000) ----
test('bolsa global inicia en 4.200.000 créditos', async () => {
    const db = new BaseDatos(crearD1Stub(), 'secret-test');
    const c = await db.obtenerCreditos();
    assert.equal(c.bolsa, 4200000, 'bolsa inicial = 10 x 420.000');
    assert.equal(c.reserva, 1800000, 'reserva del propietario = 1.800.000');
});

// ---- Bolsa global: reinicio mensual sin rollover ----
test('bolsa global se reinicia mensualmente sin rollover', async () => {
    const db = new BaseDatos(crearD1Stub(), 'secret-test');
    const tablas = db.db._tablas;
    // Fuerza el periodo actual de la fila a un mes distinto al real.
    tablas.creditos[0].periodo = '2000-01';
    const c1 = await db.obtenerCreditos();
    assert.equal(c1.bolsa, 4200000, 'reset al inicio del periodo');

    // Simula consumo: libera de la reserva a la bolsa y descuenta de la bolsa.
    await db.liberarReserva('op-reset', 500000, 'x');
    const antes = await db.obtenerCreditos();
    assert.equal(antes.bolsa, 4200000 + 500000);

    // Cambia el periodo de la fila a otro mes: debe reiniciar (sin acumular lo previo).
    tablas.creditos[0].periodo = '2000-03';
    const despues = await db.obtenerCreditos();
    assert.equal(despues.bolsa, 4200000, 'sin rollover: vuelve al inicial');
    assert.equal(despues.reserva, 1800000, 'la reserva del propietario también se reinicia');
});

// ---- Reserva de bolsa atómica: concurrencia no supera la bolsa ----
test('reserva de bolsa atómica: concurrencia no supera la bolsa', async () => {
    const db = new BaseDatos(crearD1Stub(), 'secret-test');
    const tablas = db.db._tablas;
    // Deja la bolsa en 3000 créditos (periodo ya fijado para evitar reset).
    tablas.creditos[0].periodo = periodoActual();
    tablas.creditos[0].bolsa_global = 3000;
    // 10 reservas concurrentes de 1000: solo caben 3 dentro de los 3000 restantes.
    const resultados = await Promise.all(
        Array.from({ length: 10 }, () => db.reservarBolsa(1000))
    );
    const ok = resultados.filter(Boolean);
    assert.equal(ok.length, 3, 'máximo 3 reservas caben en la bolsa restante');
    const c = await db.obtenerCreditos();
    assert.equal(c.bolsa, 0, 'la bolsa no se excede por concurrencia');
});
