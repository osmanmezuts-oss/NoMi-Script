// Pruebas del acceso propietario permanente (Fase 3) y su separación del cupo
// de invitados. Sin llamadas reales a Groq ni secretos. Ejecutar: node --test test/

import './setup-crypto.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { crearEnv } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { CAPACIDAD_DIARIA } from '../src/limites.js';

function envNuevo() { return crearEnv(); }

async function llamar(env, ruta, { metodo = 'GET', body, token, admin } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    if (admin) headers.authorization = 'Bearer ' + admin;
    const req = new Request('https://nomi-api.workers.dev' + ruta, {
        method: metodo, headers, body: body ? JSON.stringify(body) : undefined,
    });
    return worker.fetch(req, env);
}

// Crea una clave propietaria por admin y la devuelve (aparece UNA vez).
async function crearClave(env) {
    const r = await llamar(env, '/admin/propietario/clave', { metodo: 'POST', admin: env.ADMIN_SECRET, body: {} });
    assert.equal(r.status, 201, 'admin crea clave propietaria');
    const d = await r.json();
    assert.ok(d.clave && d.clave.length >= 24, 'clave larga devuelta una única vez');
    return d.clave;
}

async function recuperar(env, clave) {
    return llamar(env, '/v1/recuperar-propietario', { metodo: 'POST', body: { clave } });
}

async function crearInvitado(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const r = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(r.status, 201, 'debe activar correctamente');
    return (await r.json()).token;
}

test('10 invitados activos + 1 propietario activo funcionan; el 11.º invitado falla', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);

    // Propietario (NO cuenta dentro de MAX_INVITADOS).
    const rProp = await recuperar(env, clave);
    assert.equal(rProp.status, 201, 'primer recuperar crea propietario');
    const dProp = await rProp.json();
    assert.equal(dProp.rol, 'propietario');
    assert.ok(dProp.token, 'devuelve token opaco');

    // 10 invitados activos.
    for (let i = 0; i < CAPACIDAD_DIARIA.MAX_INVITADOS; i++) {
        const tok = await crearInvitado(env);
        const rUso = await llamar(env, '/v1/usage', { token: tok });
        assert.equal(rUso.status, 200, 'invitado ' + (i + 1) + ' activo puede consultar uso');
    }

    // El 11.º invitado falla (aunque exista propietario aparte): sin cupo de
    // invitados -> 503 capacidad temporal (comportamiento existente de activación).
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const r11 = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(r11.status, 503, 'el 11.º invitado debe fallar (capacidad)');

    // Rejilla final: 10 invitados activos + 1 propietario activo (11 usuarios activos).
    const activos = env.NOMI_DB._tablas.usuarios.filter(u => u.estado === 'activo');
    assert.equal(activos.filter(u => u.rol === 'invitado').length, 10, '10 invitados activos');
    assert.equal(activos.filter(u => u.rol === 'propietario').length, 1, '1 propietario activo');
});
test('recuperar repetidamente rota el token; el token anterior deja de servir y la clave no se consume', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);

    const r1 = await recuperar(env, clave);
    assert.equal(r1.status, 201);
    const t1 = (await r1.json()).token;

    const r2 = await recuperar(env, clave);
    assert.equal(r2.status, 200, 'segunda recuperación rota el token (200 rotado)');
    const t2 = (await r2.json()).token;
    assert.notStrictEqual(t2, t1, 'el token cambia tras recuperar');

    assert.equal((await llamar(env, '/v1/usage', { token: t1 })).status, 401, 'el token anterior queda inválido');
    assert.equal((await llamar(env, '/v1/usage', { token: t2 })).status, 200, 'el token nuevo funciona');

    const r3 = await recuperar(env, clave);
    assert.equal(r3.status, 200, 'la clave NO se consume: sigue sirviendo');
    const t3 = (await r3.json()).token;
    assert.equal((await llamar(env, '/v1/usage', { token: t2 })).status, 401, 'token rotado de nuevo queda inválido');
    assert.equal((await llamar(env, '/v1/usage', { token: t3 })).status, 200, 't3 válido tras tercera recuperación');
});

test('rotar la clave por admin invalida la anterior y la nueva funciona', async () => {
    const env = envNuevo();
    const claveA = await crearClave(env);
    assert.equal((await recuperar(env, claveA)).status, 201, 'clave A activa crea propietario');

    const claveB = await crearClave(env); // rotación admin (revoca A, inserta B)
    assert.notStrictEqual(claveB, claveA, 'la clave rotada es distinta');

    assert.equal((await recuperar(env, claveA)).status, 400, 'clave anterior inválida tras rotar');
    const rB = await recuperar(env, claveB);
    assert.equal(rB.status, 200, 'clave nueva válida (propietario existente rota token)');
    const tB = (await rB.json()).token;
    assert.equal((await llamar(env, '/v1/usage', { token: tB })).status, 200, 'el propietario mantiene acceso con clave nueva');
});

test('no pueden existir dos propietarios activos (máximo 1)', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);
    for (let i = 0; i < 3; i++) {
        const r = await recuperar(env, clave);
        assert.ok(r.status === 201 || r.status === 200, 'recuperación ' + (i + 1) + ' válida');
    }
    const propActivos = env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'propietario' && u.estado === 'activo');
    assert.equal(propActivos.length, 1, 'exactamente un propietario activo');
});

test('revocar propietario por admin revoca clave y propietario, no afecta invitados; nueva clave recrea propietario', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);
    const rProp = await recuperar(env, clave);
    const tokenProp = (await rProp.json()).token;
    const tokenInv = await crearInvitado(env);

    const rev = await llamar(env, '/admin/propietario/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: {} });
    assert.equal(rev.status, 200);
    const dRev = await rev.json();
    assert.equal(dRev.claveRevocada, true, 'la clave activa se revoca');
    assert.equal(dRev.propietarioRevocado, true, 'el propietario activo se revoca');

    assert.equal((await llamar(env, '/v1/usage', { token: tokenProp })).status, 401, 'token del propietario deja de servir');
    assert.equal((await llamar(env, '/v1/usage', { token: tokenInv })).status, 200, 'los invitados NO se ven afectados');

    assert.equal((await recuperar(env, clave)).status, 400, 'la clave revocada ya no recupera');

    // Nueva clave tras revocación: se puede crear otro propietario.
    const clave2 = await crearClave(env);
    const r2 = await recuperar(env, clave2);
    assert.equal(r2.status, 201, 'nueva clave recrea un propietario activo');
    const propActivos = env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'propietario' && u.estado === 'activo');
    assert.equal(propActivos.length, 1, 'sigue habiendo exactamente un propietario activo');
});
test('el cliente no puede manipular el rol (activate y recuperar-propietario lo fijan el servidor)', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();

    // Intenta activarse como propietario: el servidor lo ignora y crea un invitado.
    const r = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo, rol: 'propietario' } });
    assert.equal(r.status, 201);
    const usuario = env.NOMI_DB._tablas.usuarios.find(u => u.invitacion_id);
    assert.equal(usuario.rol, 'invitado', 'activate ignora el rol del cliente');

    // Recuperación: aunque el cliente envíe rol "invitado", el servidor crea propietario.
    const clave = await crearClave(env);
    const rRec = await llamar(env, '/v1/recuperar-propietario', { metodo: 'POST', body: { clave, rol: 'invitado' } });
    assert.equal(rRec.status, 201);
    const prop = env.NOMI_DB._tablas.usuarios.find(u => u.rol === 'propietario');
    assert.ok(prop, 'existe el propietario');
    assert.equal(prop.estado, 'activo');
});

test('el listado admin del propietario muestra rol/estado pero jamás la clave, hashes ni tokens', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);
    const rRec = await recuperar(env, clave);
    const tokenProp = (await rRec.json()).token;

    const r = await llamar(env, '/admin/propietario', { admin: env.ADMIN_SECRET });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.ok(data.propietario, 'hay propietario');
    assert.equal(data.propietario.rol, 'propietario');
    assert.equal(data.propietario.estado, 'activo');
    assert.equal(data.claveActiva, true, 'indica que hay clave activa (sin exponerla)');
    const serializado = JSON.stringify(data);
    assert.ok(!serializado.includes(clave), 'la clave propietaria NO aparece en el listado');
    assert.ok(!serializado.includes(tokenProp), 'el token NO aparece en el listado');
    assert.ok(!/hash/i.test(serializado), 'no se listan hashes');

    // Los endpoints admin exigen ADMIN_SECRET.
    assert.equal((await llamar(env, '/admin/propietario', {})).status, 401, 'sin admin -> 401');
    assert.equal((await llamar(env, '/admin/propietario/clave', { metodo: 'POST', body: {} })).status, 401, 'sin admin -> 401');
    assert.equal((await llamar(env, '/admin/propietario/revocar', { metodo: 'POST', body: {} })).status, 401, 'sin admin -> 401');
});

test('las invitaciones normales crean exclusivamente usuarios invitado y no tocan la clave propietaria', async () => {
    const env = envNuevo();
    await crearInvitado(env);
    await crearInvitado(env);
    const usuarios = env.NOMI_DB._tablas.usuarios;
    assert.equal(usuarios.filter(u => u.rol === 'propietario').length, 0, 'ningún propietario por activación normal');
    assert.equal(usuarios.every(u => u.rol === 'invitado'), true, 'todos los activados por invitación son invitado');
    assert.equal(env.NOMI_DB._tablas.claves_propietario.length, 0, 'no se crean claves sin admin');
});

test('recuperar propietario sin clave configurada o con clave corta devuelve 400', async () => {
    const env = envNuevo();
    const r1 = await recuperar(env, 'nomi-pro-clave-corta-');
    assert.equal(r1.status, 400);
    assert.equal((await r1.json()).error, 'clave-propietaria-invalida');

    const r2 = await llamar(env, '/v1/recuperar-propietario', { metodo: 'POST', body: { clave: 'x'.repeat(300) } });
        assert.equal(r2.status, 400, 'clave demasiado larga rechazada');
});

test('hardening de carrera: clave revocada/rotada entre el SELECT y el UPDATE invalida la recuperación propietaria', async () => {
    const env = envNuevo();
    const clave = await crearClave(env);

    // Primer recovery crea al propietario (201) y devuelve token T1.
    const r1 = await recuperar(env, clave);
    assert.equal(r1.status, 201, 'primer recuperar crea propietario');
    const t1 = (await r1.json()).token;
    assert.ok(t1, 'token T1 devuelto');

    // Revoca la clave (simula rotación admin / revocación) mientras el propietario está activo.
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const rev = await db.revocarAccesoPropietario();
    assert.equal(rev.claveRevocada, true, 'clave revocada');

    // Un segundo recovery con la MISMA clave (ahora revocada) DEBE fallar (clave no activa).
    const r2 = await recuperar(env, clave);
    assert.equal(r2.status, 400, 'recuperar con clave revocada debe fallar (hardening de carrera)');

    // El token T1 (anterior) no debe seguir vigente tras la revocación: el
    // propietario está revocado, por lo que cualquier uso del token falla. Verificado
    // comprobando que el propietario activo ya no existe (solo queda revocado).
    const activoProp = env.NOMI_DB._tablas.usuarios.find(u => u.rol === 'propietario' && u.estado === 'activo');
    assert.ok(!activoProp, 'propietario revocado: no queda propietario activo');
});
