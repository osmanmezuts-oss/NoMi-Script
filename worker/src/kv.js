// ======== nomi-diagnostics: kv.js ========
// Límite (rate limit) y deduplicación usando Cloudflare KV con expiración.
// No almacenamos reportes ni datos de usuario: las claves KV son sólo
// (1) contador por instalación y (2) huella del reporte ya visto.

const VENTANA_LIMITE_MS = 10 * 60 * 1000; // 10 minutos
const MAX_POR_INSTALACION = 10;           // máx. reportes distintos
const TTL_DEDUP_S = 5 * 60;               // 5 minutos

// Almacena en memoria el estado cuando no hay KV (uso en pruebas o en entornos
// sin binding). En producción siempre se usa DIAGNOSTICS_KV.
const memoria = new Map();

function kvUsable(kv) {
    return kv && typeof kv.get === 'function' && typeof kv.put === 'function';
}

async function leerClave(kv, clave) {
    if (kvUsable(kv)) {
        try { const v = await kv.get(clave, 'json'); return v; }
        catch { return null; }
    }
    return memoria.get(clave)?.valor ?? null;
}

async function escribirConTtl(kv, clave, valor, ttlS, now) {
    if (kvUsable(kv)) {
        try { await kv.put(clave, JSON.stringify(valor), { expirationTtl: ttlS }); }
        catch { /* si KV falla, el límite es blando */ }
        return;
    }
    memoria.set(clave, { valor, expira: now + ttlS * 1000 });
}

// Devuelve false si la instalación ya superó el límite; si pasa, incrementa y devuelve { ok:true, permitidos }.
export async function permitirPorInstalacion(kv, instalacionId, now = Date.now()) {
    const clave = 'rl:' + instalacionId;
    let estado = await leerClave(kv, clave);
    if (!estado || (now - (estado.inicio || 0)) > VENTANA_LIMITE_MS) {
        estado = { inicio: now, contador: 0 };
    }
    estado.contador += 1;
    await escribirConTtl(kv, clave, estado, Math.ceil(VENTANA_LIMITE_MS / 1000), now);
    if (estado.contador > MAX_POR_INSTALACION) return { permitido: false, permitidos: estado.contador };
    return { permitido: true, permitidos: estado.contador };
}

// Deduplicación: si el reporte ya se envió hace < 5 min, no se reenvía.
// Devuelve true si es duplicado (debe omitirse).
export async function esDuplicado(kv, huella, now = Date.now()) {
    const clave = 'dd:' + huella;
    const existente = await leerClave(kv, clave);
    if (existente !== null && existente !== undefined) return true;
    await escribirConTtl(kv, clave, { visto: true }, TTL_DEDUP_S, now);
    return false;
}

// En pruebas: reinicia la memoria interna (para poder testear de forma aislada).
export function resetMemoria() {
    memoria.clear();
}