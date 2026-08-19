// Pruebas de la fase administrativa de invitaciones (Fase 1, backend admin).
// Sin llamadas reales a Groq ni secretos. Ejecutar con: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { crearEnv } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { CAPACIDAD_DIARIA } from '../src/limites.js';

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

// Crea y activa una invitación devolviendo token e id de la invitación.
async function crearInvitadoConId(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo, id } = await db.crearInvitacion();
    const resp = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(resp.status, 201, 'debe activar correctamente');
    const data = await resp.json();
    return { token: data.token, invitacionId: id };
}

// ---- Etiqueta opcional, limitada y validada al crear invitación ----
test('admin/invitacion acepta etiqueta valida y la refleja en el listado', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitacion', {
        metodo: 'POST', admin: env.ADMIN_SECRET, body: { etiqueta: 'Beta Probadora' },
    });
    assert.equal(r.status, 201);
    const data = await r.json();
    assert.ok(data.ok && data.codigo && data.id, 'devuelve codigo e id');

    const lista = await llamar(env, '/admin/invitaciones', { admin: env.ADMIN_SECRET });
    const filas = (await lista.json()).invitaciones;
    const creada = filas.find(f => f.id === data.id);
    assert.ok(creada, 'la invitación aparece en el listado');
    assert.equal(creada.etiqueta, 'Beta Probadora');
});

test('admin/invitacion: etiqueta ausente es permitida (queda nula)', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitacion', { metodo: 'POST', admin: env.ADMIN_SECRET, body: {} });
    assert.equal(r.status, 201);
    const id = (await r.json()).id;
    const lista = await llamar(env, '/admin/invitaciones', { admin: env.ADMIN_SECRET });
    const creada = (await lista.json()).invitaciones.find(f => f.id === id);
    assert.equal(creada.etiqueta, null);
});

test('admin/invitacion rechaza etiqueta con caracteres no permitidos', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitacion', {
        metodo: 'POST', admin: env.ADMIN_SECRET, body: { etiqueta: 'mala|etiqueta' },
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
});

test('admin/invitacion rechaza etiqueta demasiado larga', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitacion', {
        metodo: 'POST', admin: env.ADMIN_SECRET, body: { etiqueta: 'x'.repeat(65) },
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
});

// ---- Listado administrativo no expone secretos ----
test('listado administrativo no incluye codigos, hashes ni tokens', async () => {
    const env = envNuevo();
    await crearInvitadoConId(env); // una invitación canjeada con usuario
    await llamar(env, '/admin/invitacion', { metodo: 'POST', admin: env.ADMIN_SECRET, body: {} });

    const r = await llamar(env, '/admin/invitaciones', { admin: env.ADMIN_SECRET });
    assert.equal(r.status, 200);
    const texto = JSON.stringify(await r.json());
    assert.ok(!texto.includes('codigo_hash'), 'no debe incluir codigo_hash');
    assert.ok(!texto.includes('token_hash'), 'no debe incluir token_hash');
    assert.ok(!texto.includes('token'), 'no debe incluir token de instalación');
    // Sí debe incluir campos no secretos.
    assert.ok(texto.includes('"estado"'));
    assert.ok(texto.includes('"etiqueta"'));
    assert.ok(texto.includes('"usuario_id"'));
});

test('listado requiere ADMIN_SECRET', async () => {
    const env = envNuevo();
    const r = await llamar(env, '/admin/invitaciones', { admin: 'secreto-malo' });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'admin-no-autorizado');
});

// ---- Revocar una invitación pendiente la invalida (no activa) ----
test('pendiente revocada no activa', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo, id } = await db.crearInvitacion();

    const rev = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id } });
    assert.equal(rev.status, 200, 'la revocación debe tener éxito');
    assert.equal((await rev.json()).usuarioRevocado, false, 'una pendiente no tiene usuario que revocar');

    const act = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(act.status, 400, 'el código revocado no debe activar');
    assert.equal((await act.json()).error, 'invitacion-invalida');
    assert.equal(env.NOMI_DB._tablas.usuarios.length, 0, 'no se crea ningún usuario');
    const inv = env.NOMI_DB._tablas.invitaciones.find(i => i.id === id);
    assert.equal(inv.estado, 'revocada');
});

// ---- Revocar una invitación canjeada revoca el usuario y bloquea su token ----
test('canjeada revocada revoca el usuario y bloquea el token', async () => {
    const env = envNuevo();
    const { token, invitacionId } = await crearInvitadoConId(env);

    const rev = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id: invitacionId } });
    assert.equal(rev.status, 200);
    assert.equal((await rev.json()).usuarioRevocado, true, 'debe revocar el usuario vinculado');

    const u = env.NOMI_DB._tablas.usuarios.find(x => x.invitacion_id === invitacionId);
    assert.equal(u.estado, 'revocado', 'el usuario queda revocado (token no autentica)');
    const inv = env.NOMI_DB._tablas.invitaciones.find(i => i.id === invitacionId);
    assert.equal(inv.estado, 'revocada');

    // El token revocado ya no autentica.
    const uso = await llamar(env, '/v1/usage', { token });
    assert.equal(uso.status, 401);
    assert.equal((await uso.json()).error, 'acceso-invalido');
});

// ---- Revocar conserva historial (no borra usuarios ni hashes) ----
test('revocar mantiene historial: el usuario y la invitación siguen existiendo', async () => {
    const env = envNuevo();
    const { invitacionId } = await crearInvitadoConId(env);
    await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id: invitacionId } });

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const inv = await db.first('SELECT id, estado, codigo_hash FROM invitaciones WHERE id = ?', invitacionId);
    assert.ok(inv, 'la invitación no se borra');
    assert.ok(inv.codigo_hash, 'el hash se conserva');
    assert.equal(env.NOMI_DB._tablas.usuarios.filter(u => u.invitacion_id === invitacionId).length, 1, 'el usuario no se borra');
});

// ---- Una revocación libera cupo (cuenta solo invitados activos) ----
test('revocar un invitado canjeado libera cupo y permite un nuevo activado', async () => {
    const env = envNuevo();
    // Llenar el tope de 10 invitados activos.
    const ids = [];
    for (let i = 0; i < CAPACIDAD_DIARIA.MAX_INVITADOS; i++) {
        const x = await crearInvitadoConId(env);
        ids.push(x.invitacionId);
    }
    assert.equal(env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado' && u.estado === 'activo').length, 10);

    // Revocar uno de los canjeados libera cupo.
    const rev = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id: ids[0] } });
    assert.equal(rev.status, 200);
    assert.equal(env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado' && u.estado === 'activo').length, 9);

    // La activación número 11 (un nuevo cupo liberado) debe ser posible.
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const act = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    assert.equal(act.status, 201, 'el cupo liberado permite un nuevo invitado');
    assert.equal(env.NOMI_DB._tablas.usuarios.filter(u => u.rol === 'invitado' && u.estado === 'activo').length, 10);
});

// ---- Revocar id inexistente o ya revocada ----
test('revocar id inexistente devuelve 404 y ya revocada devuelve 409', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { id } = await db.crearInvitacion();

    const noExiste = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id: 'inexistente-xyz' } });
    assert.equal(noExiste.status, 404);

    const ok = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id } });
    assert.equal(ok.status, 200);
    const otra = await llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id } });
    assert.equal(otra.status, 409);
    assert.equal((await otra.json()).error, 'invitacion-ya-revocada');
});

// ---- Carrera activación/revocación sin estado parcial ----
test('carrera activacion/revocacion: sin estado parcial', async () => {
    const env = envNuevo();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo, id } = await db.crearInvitacion();

    const [act, rev] = await Promise.all([
        llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } }),
        llamar(env, '/admin/revocar', { metodo: 'POST', admin: env.ADMIN_SECRET, body: { id } }),
    ]);

    const inv = env.NOMI_DB._tablas.invitaciones.find(i => i.id === id);
    assert.equal(inv.estado, 'revocada', 'la invitación queda revocada en cualquier orden de la carrera');

    const vinculados = env.NOMI_DB._tablas.usuarios.filter(u => u.invitacion_id === id);
    // Sin estado parcial: o no hay usuario, o existe pero está revocado (nunca activo).
    assert.equal(vinculados.filter(u => u.estado === 'activo').length, 0, 'ningún usuario activo vinculado a una revocada');
    for (const u of vinculados) {
        assert.equal(u.estado, 'revocado', 'si existe usuario vinculado, está revocado');
    }
    // Al menos una de las dos operaciones tuvo éxito (ambas rutas terminan coherentes).
    assert.ok(act.status === 201 || act.status === 400, 'activación terminó en un estado definido');
    assert.ok(rev.status === 200 || rev.status === 409 || rev.status === 404, 'revocación terminó en un estado definido');
});
