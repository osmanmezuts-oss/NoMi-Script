// Pruebas de compatibilidad crypto (Fase 1).
// Validan Web Crypto bajo Node 18 (global o fallback node:crypto) y que no se usa Math.random.
// Sin secretos reales ni llamadas a Groq. Ejecutar con: node --test test/

import './setup-crypto.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    hmacHash,
    hashCodigo,
    hashToken,
    generarCodigoInvitacion,
    generarTokenInstalacion,
    generarIdOpaque,
    igualEnTiempoConstante,
} from '../src/crypto.js';

const SECRET = 'pepper-test'; // solo para tests, nunca real

test('crypto: compatibilidad Cloudflare + Node (HMAC-SHA256 determinista, 64 hex)', async () => {
    const h1 = await hmacHash(SECRET, 'dato');
    const h2 = await hmacHash(SECRET, 'dato');
    const h3 = await hmacHash(SECRET, 'otro');
    assert.equal(h1, h2, 'mismo input -> mismo hash');
    assert.notEqual(h1, h3, 'input distinto -> hash distinto');
    assert.match(h1, /^[0-9a-f]{64}$/);
    assert.ok(!h1.includes('dato'), 'el hash no contiene el valor original');
});

test('crypto: hashCodigo y hashToken separan espacios de nombres', async () => {
    const a = await hashCodigo(SECRET, 'ABC123');
    const b = await hashToken(SECRET, 'ABC123');
    assert.notEqual(a, b, 'mismo dato como invitacion vs token -> hashes distintos');
});

test('crypto: generacion usa Web Crypto (no Math.random), formatos correctos', () => {
    const cod = generarCodigoInvitacion();
    assert.match(cod, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.ok(generarTokenInstalacion().length > 0);
    assert.ok(generarIdOpaque().length > 0);
    // La entropia proviene de getRandomValues: dos tokens casi siempre difieren.
    assert.notEqual(generarTokenInstalacion(), generarTokenInstalacion());
});

test('crypto: funciona con Web Crypto inyectado por el setup (globalThis.crypto)', async () => {
    // El setup de la suite debe haber inyectado el global Web Crypto en Node 18.
    assert.ok(globalThis.crypto, 'el setup debe proveer globalThis.crypto en Node 18');
    assert.equal(typeof globalThis.crypto.subtle, 'object', 'subtle disponible');
    assert.equal(typeof globalThis.crypto.getRandomValues, 'function', 'getRandomValues disponible');
    // crypto.js debe funcionar end-to-end con el crypto inyectado.
    const h1 = await hmacHash(SECRET, 'dato-inyectado');
    const h2 = await hmacHash(SECRET, 'dato-inyectado');
    assert.equal(h1, h2, 'HMAC determinista con Web Crypto inyectado');
    assert.match(generarCodigoInvitacion(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    assert.ok(generarTokenInstalacion().length > 0, 'genera token de instalación');
});

test('crypto: igualEnTiempoConstante', () => {
    assert.equal(igualEnTiempoConstante('abc', 'abc'), true);
    assert.equal(igualEnTiempoConstante('abc', 'abd'), false);
    assert.equal(igualEnTiempoConstante('abc', 'ab'), false);
    assert.equal(igualEnTiempoConstante(null, 'abc'), false);
});

test('crypto: origen de entropia es Web Crypto global y no Math.random (statico)', () => {
    const src = readFileSync(new URL('../src/crypto.js', import.meta.url), 'utf8');
    assert.ok(src.includes('cryptoGlobal'), 'debe usar el acceso normalizado a Web Crypto');
    assert.ok(src.includes('globalThis.crypto'), 'debe usar el global Web Crypto (Workers y Node 20+)');
    assert.equal(src.includes('node:crypto'), false, 'no debe depender de node:crypto (evita nodejs_compat)');
    assert.equal(src.includes('Math.random'), false, 'prohibido usar Math.random');
});
