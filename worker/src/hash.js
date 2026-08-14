// ======== nomi-diagnostics: hash.js ========
// Huella criptográfica (SHA-256) para deduplicación.
// Se usa sólo el hash, nunca el contenido, y la clave de dedup expira a los 5 min.

async function sha256(texto) {
    const data = new TextEncoder().encode(String(texto));
    // En Cloudflare Workers existe globalThis.crypto.subtle.
    // En entornos de prueba (Node 18) puede no estar global: se usa node:crypto.
    const cripto = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
        ? globalThis.crypto
        : (await import('node:crypto')).webcrypto;
    const buf = await cripto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function huellaReporte(payloadSaneado) {
    // Ordenamos claves para que dos envíos con el mismo contenido produzcan la misma huella.
    const ordenar = (o) => {
        if (Array.isArray(o)) return o.map(ordenar);
        if (o && typeof o === 'object') {
            const r = {};
            Object.keys(o).sort().forEach((k) => { r[k] = ordenar(o[k]); });
            return r;
        }
        return o;
    };
    const canon = JSON.stringify(ordenar(payloadSaneado));
    return sha256(canon);
}