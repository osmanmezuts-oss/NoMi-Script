// Lector de cuerpo HTTP con límite REAL de bytes, incluso sin Content-Length.
//
// Antes de parsear JSON se confía en Content-Length para un rechazo rápido, pero
// SIEMPRE se aplica un límite de bytes al leer el stream. Así no dependemos de
// que el cliente envíe Content-Length (puede omitirlo o mentir) y nunca
// bufferizamos un cuerpo sin límite en request.json().

import { E } from './errores.js';

const DECODIFICADOR = new TextDecoder();

function concatenar(partes, total) {
    if (partes.length === 1) return partes[0];
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const p of partes) {
        buf.set(p, offset);
        offset += p.byteLength;
    }
    return buf;
}

// Lee el cuerpo y lo parsea como JSON, respetando `limiteBytes`.
// - Rechazo rápido si Content-Length presente y supera el límite.
// - Lector streaming: si el total supera el límite EN CUALQUIER momento, cancela
//   la lectura y lanza (el cuerpo nunca se bufferiza por completo ni se parsea).
// - Si no hay cuerpo, devuelve {} (mismo comportamiento que request.json() fallido).
export async function leerJsonLimitado(request, limiteBytes) {
    const cl = Number(request.headers.get('content-length'));
    if (Number.isFinite(cl) && cl > limiteBytes) {
        throw E.parametrosInvalidos('Cuerpo de la petición demasiado grande.');
    }

    const body = request.body;
    if (!body) return {};

    const reader = body.getReader();
    const partes = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            total += value.byteLength;
            if (total > limiteBytes) {
                await reader.cancel().catch(() => {});
                throw E.parametrosInvalidos('Cuerpo de la petición demasiado grande.');
            }
            partes.push(value);
        }
    }

    if (total === 0) return {};
    try {
        return JSON.parse(DECODIFICADOR.decode(concatenar(partes, total)));
    } catch {
        return {};
    }
}
