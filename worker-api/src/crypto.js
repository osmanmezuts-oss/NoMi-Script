// Criptografía: hashes de códigos/tokens y generación segura.
// Se guarda SOLO el hash (HMAC-SHA256 con ACCESS_TOKEN_SECRET como pepper).
// Nunca se guarda ni se devuelve el valor original de una invitación o token (salvo al emitirlo).

const enc = new TextEncoder();

// Web Crypto: Cloudflare Workers expone `crypto` como global. En Node 18 (donde se
// ejecutan las pruebas) ese global no está habilitado por defecto, así que se vale
// del shim `node:crypto` (webcrypto). La importación es perezosa y sólo se evalúa en
// Node: en el Worker, la rama `else` nunca se ejecuta y no se carga el módulo node.
// Toda la entropía proviene de getRandomValues (CSPRNG); no se usan RNG no criptográficos.
let cryptoGlobal;
if (typeof crypto !== 'undefined') {
    cryptoGlobal = crypto;
} else {
    const { webcrypto } = await import('node:crypto');
    cryptoGlobal = webcrypto;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToB64url(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// HMAC-SHA256(secreto, valor) en hex. Usado como "hash" irreversible con pepper.
export async function hmacHash(secret, valor) {
    const key = await cryptoGlobal.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await cryptoGlobal.subtle.sign('HMAC', key, enc.encode(String(valor)));
    return bytesToHex(new Uint8Array(sig));
}

export function hashCodigo(secret, codigo) {
    return hmacHash(secret, 'invitacion:' + codigo);
}

export function hashToken(secret, token) {
    return hmacHash(secret, 'token:' + token);
}

// Genera un código de invitación opaco (A-Z0-9, sin caracteres ambiguos).
export function generarCodigoInvitacion() {
    const bytes = new Uint8Array(6); // ~36 bits de entropía, suficiente para invitaciones.
    cryptoGlobal.getRandomValues(bytes);
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (const b of bytes) s += alfabeto[b % alfabeto.length];
    return s;
}

// Genera un token de instalación opaco de 32 bytes (~256 bits).
export function generarTokenInstalacion() {
    const bytes = new Uint8Array(32);
    cryptoGlobal.getRandomValues(bytes);
    return bytesToB64url(bytes);
}

export function igualEnTiempoConstante(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export function generarIdOpaque() {
    const bytes = new Uint8Array(16);
    cryptoGlobal.getRandomValues(bytes);
    return bytesToB64url(bytes);
}
