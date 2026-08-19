// Integración con la API de Groq (compatible con chat completions de OpenAI).
// En tests se usa un stub (nunca se llama a la API real). Solo contabiliza usage real del proveedor.

import { E } from './errores.js';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Llama a Groq. Devuelve { texto, usage } con usage del proveedor.
// Lanza E.proveedorNoDisponible en fallo de red o 5xx; E.parametrosInvalidos en 4xx.
export async function llamarGroq(env, { modelo, mensajes, max_tokens }) {
    const resp = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + env.GROQ_API_KEY,
        },
        body: JSON.stringify({ model: modelo, messages: mensajes, max_tokens, stream: false }),
    });

    if (!resp.ok) {
        // 429 = límite del proveedor (capacidad temporal). 5xx = proveedor no disponible.
        if (resp.status === 429 || resp.status >= 500) {
            throw E.proveedorNoDisponible();
        }
        throw E.parametrosInvalidos('El proveedor rechazó la solicitud.');
    }

    const datos = await resp.json();
    const texto = (datos.choices && datos.choices[0] && datos.choices[0].message
        && datos.choices[0].message.content) || '';
    // Solo usage REAL devuelto por el proveedor.
    const usage = datos.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return { texto, usage: { tokens: usage.total_tokens || 0, solicitudes: 1 } };
}
