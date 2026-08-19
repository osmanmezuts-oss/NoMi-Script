// Modos de capacidad: normal, compartida, limitada, reserva protegida.
// Estados derivados del uso diario REAL (el Durable Object es la única fuente de
// verdad para los contadores diarios). NO se usa la bolsa mensual para decidir
// el estado diario: la reserva del propietario y la bolsa global mensual son
// independientes de esta capacidad diaria de Groq.

import { CAPACIDAD_DIARIA, RESERVA } from './limites.js';

export const CAPACIDAD = {
    NORMAL: 'normal',
    COMPARTIDA: 'compartida',
    LIMITADA: 'limitada',
    RESERVA_PROTEGIDA: 'reserva-protegida',
};

// Decide el modo y la prioridad a partir del uso real de la bolsa compartida diaria.
// - primerUsoCandidato: el invitado aún no usó NoMi hoy (puede usar la reserva protegida).
// - compartidaUsada: tokens ya consumidos de la bolsa compartida diaria (del DO).
// El Durable Object decide finalmente la fuente (protegida/compartida) de forma atómica.
export function decidirModo({ primerUsoCandidato, compartidaUsada = 0 }) {
    const compartida = CAPACIDAD_DIARIA.BOLSA_COMPARTIDA;
    const ratio = compartida > 0 ? compartidaUsada / compartida : 0;
    const prioridad = !!primerUsoCandidato;

    if (ratio >= 1) {
        // Bolsa compartida agotada: solo un primer uso válido desde su reserva de 5000.
        return {
            modo: CAPACIDAD.RESERVA_PROTEGIDA,
            prioridad,
            max_tokens: prioridad ? RESERVA.MAX_SALIDA_TOKENS : 0,
        };
    }
    if (ratio >= 0.85) {
        // Poca bolsa compartida: reducir la respuesta máxima según política existente.
        return { modo: CAPACIDAD.LIMITADA, prioridad, max_tokens: 512 };
    }
    if (ratio >= 0.5) {
        return { modo: CAPACIDAD.COMPARTIDA, prioridad, max_tokens: RESERVA.MAX_SALIDA_TOKENS };
    }
    return { modo: CAPACIDAD.NORMAL, prioridad, max_tokens: RESERVA.MAX_SALIDA_TOKENS };
}
