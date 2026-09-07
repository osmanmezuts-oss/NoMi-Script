// Integración con la API de Groq (compatible con chat completions de OpenAI).
// En tests se usa un stub (nunca se llama a la API real). Solo contabiliza usage real del proveedor.

import { E } from './errores.js';
// El mensaje de sistema se define en limites.js como fuente única: ahí se reserva
// su presupuesto de tokens (SISTEMA_TOKENS) para no superar tokens_por_minuto.
import {
    SISTEMA_SIN_HERRAMIENTAS,
    SISTEMA_CON_BUSQUEDA,
    SISTEMA_SINTESIS_BUSQUEDA,
} from './limites.js';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const MODO_GROQ = Object.freeze({
    NORMAL: 'normal',
    DECISION_BUSQUEDA: 'decision_busqueda',
    BUSQUEDA_FORZADA: 'busqueda_forzada',
    SINTESIS_BUSQUEDA: 'sintesis_busqueda',
});

// Herramientas locales. Groq decide por significado; el Worker valida todos los
// argumentos y ejecuta los proveedores. Nunca se depende de palabras clave.
export const HERRAMIENTA_BUSQUEDA = Object.freeze({
    type: 'function',
    function: {
        name: 'busqueda_web',
        description: 'Busca información real en la web cuando la respuesta dependa de datos externos actuales, cambiantes o que deban verificarse. Úsala sin exigir que el usuario diga busca, actual o hoy. En seguimientos, reconstruye una consulta completa usando el tema, lugar y periodo de la conversación.',
        parameters: {
            type: 'object',
            properties: {
                consulta: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 300,
                    description: 'Consulta autosuficiente: incluye el tema heredado, ubicación y periodo relevantes.',
                },
                tema: {
                    type: 'string',
                    enum: ['general', 'news', 'finance'],
                    description: 'Categoría de Tavily más adecuada.',
                },
                recencia: {
                    type: 'string',
                    enum: ['day', 'week', 'month', 'year'],
                    description: 'Ventana temporal si la intención exige actualidad.',
                },
            },
            required: ['consulta'],
            additionalProperties: false,
        },
    },
});

export const HERRAMIENTA_CLIMA = Object.freeze({
    type: 'function',
    function: {
        name: 'consultar_clima',
        description: 'Consulta un pronóstico meteorológico real. Úsala cuando la intención sea saber condiciones, riesgos o conveniencia meteorológica, aunque el usuario no diga clima. Resuelve hoy, mañana o fechas relativas con el anclaje local incluido en el mensaje. No inventes una ubicación: omítela si no fue mencionada.',
        parameters: {
            type: 'object',
            properties: {
                ubicacion: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 120,
                    description: 'Lugar mencionado por el usuario. Omite este campo si no mencionó uno; el Worker aplicará la ubicación habitual o del dispositivo.',
                },
                fecha: {
                    type: 'string',
                    description: 'Fecha local exacta solicitada en formato YYYY-MM-DD, resuelta desde la fecha y zona horaria del contexto.',
                },
            },
            required: ['fecha'],
            additionalProperties: false,
        },
    },
});

export const HERRAMIENTAS_BUSQUEDA = Object.freeze([HERRAMIENTA_BUSQUEDA]);

export function crearHerramientasNoMi({ permitirBusqueda, permitirClima, forzarBusqueda } = {}) {
    if (forzarBusqueda === true) return [HERRAMIENTA_BUSQUEDA];
    const herramientas = [];
    if (permitirBusqueda === true) herramientas.push(HERRAMIENTA_BUSQUEDA);
    if (permitirClima === true) herramientas.push(HERRAMIENTA_CLIMA);
    return herramientas;
}

function sistemaParaModo(modo) {
    if (modo === MODO_GROQ.DECISION_BUSQUEDA || modo === MODO_GROQ.BUSQUEDA_FORZADA) return SISTEMA_CON_BUSQUEDA;
    if (modo === MODO_GROQ.SINTESIS_BUSQUEDA) return SISTEMA_SINTESIS_BUSQUEDA;
    return SISTEMA_SIN_HERRAMIENTAS;
}

// Llama a Groq. Devuelve { texto, usage } con usage del proveedor.
// Lanza E.limiteProveedor() en HTTP 429 real del proveedor (TPM/RPM/TPD/RPD);
// E.proveedorNoDisponible() en fallo de red o 5xx; E.parametrosInvalidos en 4xx.
export async function llamarGroq(env, { modelo, mensajes, max_tokens, modo = MODO_GROQ.NORMAL, herramientas = [] }) {
    // Mensajes completos con la instrucción de sistema al inicio (sin duplicar si
    // ya viniera una; el handler solo envía un mensaje de usuario).
    const mensajesCompletos = [{ role: 'system', content: sistemaParaModo(modo) }, ...(mensajes || [])];
    const cuerpo = { model: modelo, messages: mensajesCompletos, max_tokens, stream: false };
    // GPT-OSS razona por defecto con esfuerzo medio. En el paso de decidir una
    // herramienta y, sobre todo, en la síntesis breve, eso puede gastar el
    // presupuesto de salida antes de escribir una respuesta completa. "low"
    // conserva la decisión semántica y deja margen para el texto visible.
    if (modo === MODO_GROQ.DECISION_BUSQUEDA
        || modo === MODO_GROQ.BUSQUEDA_FORZADA
        || modo === MODO_GROQ.SINTESIS_BUSQUEDA) {
        cuerpo.reasoning_effort = 'low';
        // Groq exige hidden o parsed al combinar razonamiento con tool calling.
        cuerpo.reasoning_format = 'hidden';
    }
    if (modo === MODO_GROQ.DECISION_BUSQUEDA || modo === MODO_GROQ.BUSQUEDA_FORZADA) {
        cuerpo.tools = Array.isArray(herramientas) && herramientas.length ? herramientas : HERRAMIENTAS_BUSQUEDA;
        cuerpo.tool_choice = modo === MODO_GROQ.BUSQUEDA_FORZADA
            ? { type: 'function', function: { name: 'busqueda_web' } }
            : 'auto';
        cuerpo.parallel_tool_calls = false;
    }
    let resp;
    try {
        resp = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: 'Bearer ' + env.GROQ_API_KEY,
            },
            body: JSON.stringify(cuerpo),
        });
    } catch {
        throw E.proveedorNoDisponible();
    }

    if (!resp.ok) {
        // 429 del proveedor = límite real (TPM/RPM/TPD/RPD): límite-proveedor.
        // 5xx = proveedor no disponible (502).
        if (resp.status === 429) {
            throw E.limiteProveedor();
        }
        if (resp.status >= 500) {
            throw E.proveedorNoDisponible();
        }
        throw E.parametrosInvalidos('El proveedor rechazó la solicitud.');
    }

    let datos;
    try {
        datos = await resp.json();
    } catch {
        throw E.proveedorNoDisponible();
    }
    const mensaje = datos.choices && datos.choices[0] && datos.choices[0].message
        ? datos.choices[0].message
        : {};
    const texto = typeof mensaje.content === 'string' ? mensaje.content : '';
    const toolCalls = Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls : [];
    // Solo usage REAL devuelto por el proveedor.
    const usage = datos.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return {
        texto,
        mensaje,
        toolCalls,
        finishReason: typeof (datos.choices && datos.choices[0] && datos.choices[0].finish_reason) === 'string'
            ? datos.choices[0].finish_reason
            : '',
        usage: { tokens: usage.total_tokens || 0, solicitudes: 1 },
    };
}
