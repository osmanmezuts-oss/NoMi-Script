// Setup SOLO del entorno de pruebas (nunca se usa en el runtime del Worker).
// Node 18 no expone `globalThis.crypto` por defecto; se inyecta con Web Crypto de
// node:crypto ANTES de importar src/crypto.js (que usa `globalThis.crypto` como en
// Cloudflare Workers). En Node 20+ / Workers el global ya existe y NO se sobrescribe.
// Este archivo es el ÚNICO lugar de la suite que referencia node:crypto; src/ debe
// seguir usando globalThis.crypto únicamente (ver test estático en crypto.test.js).
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
}