// ======== nomi-diagnostics: worker.js ========
// Cloudflare Worker de telemetría de errores anónima y mínima de NoMi.
//
// Reemplaza el "Hello World":
//   - POST /v1/diagnostics  -> recibe un reporte, lo filtra, y lo reenvía a Slack.
//   - Límite: 10 reportes por instalación / 10 min.
//   - Deduplicación: 5 min usando KV con expiración.
//   - NO almacena reportes, conversaciones ni datos privados. KV sólo guarda
//     contadores (con TTL) y huellas de dedup (con TTL).
//
// Variables de entorno / bindings:
//   - SLACK_WEBHOOK_URL   (secreto) : URL del webhook de Slack entrante.
//   - DIAGNOSTICS_KV      (binding) : namespace KV para límite y dedup.

import { sanitizarReporte, urlSegura, dominioPublico } from './sanitize.js';
import { permitirPorInstalacion, esDuplicado } from './kv.js';
import { huellaReporte } from './hash.js';

const RUTA = '/v1/diagnostics';
const MAX_BODY = 2 * 1024;          // 2 KiB máximo real para evitar abuso.

// Texto del cuerpo acumulado en streaming. Se cancela en cuanto supera maxBytes,
// SIN confiar en Content-Length (que puede ausentarse). No consume el cuerpo completo.
// Cada llamada usa su PROPIO TextDecoder (una petición no comparte estado con otra).
async function leerCuerpoConLimite(request, maxBytes) {
    const dec = new TextDecoder();
    const stream = request.body;
    if (!stream || typeof stream.getReader !== 'function') {
        // Cuerpo no legible como stream: devolvemos texto vacío para parsear más abajo.
        return { texto: '', exceso: false };
    }
    const reader = stream.getReader();
    let bytes = 0;
    let acumulado = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkLen = value ? (value.byteLength || value.length) : 0;
            bytes += chunkLen;
            // En cuanto superamos el límite, cerramos el stream SIN leer el resto.
            if (bytes > maxBytes) {
                try { reader.cancel(); } catch { /* ignore */ }
                return { texto: null, exceso: true };
            }
            acumulado += dec.decode(value, { stream: true });
        }
        acumulado += dec.decode(); // flush final del TextDecoder
        return { texto: acumulado, exceso: false };
    } catch {
        return { texto: null, exceso: true };
    } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
    }
}

function respuestaJson(objeto, status = 200) {
    return new Response(JSON.stringify(objeto), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type'
        }
    });
}

// Envía el reporte a Slack. Slack es un canal de salida; no es almacenamiento nuestro.
async function enviarASlack(webhookUrl, mensaje, fetchFn = fetch) {
    const resp = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mensaje)
    });
    if (!resp.ok) {
        throw new Error('Slack respondió ' + resp.status);
    }
}

// Construye el bloque de Slack (texto plano, sin adjuntos que puedan colar datos).
function construirMensajeSlack(campos) {
    const texto = [
        ':warning: *NoMi · Diagnóstico de error*',
        `*Tipo:* ${campos.type || 'desconocido'}`,
        `*Mensaje:* ${campos.message || ''}`,
        `*Contexto:* ${campos.context || '—'}`,
        campos.dominio ? `*Dominio:* ${campos.dominio}` : null,
        `*Versión:* ${campos.version || '?'}`,
        `*Dispositivo:* ${campos.device || '—'}`,
        `*Plataforma/SO:* ${campos.platform || '—'}`,
        `*Móvil:* ${campoSiNo(campos.mobile) ? 'sí' : 'no'}`,
        `*Red:* ${campos.red || '—'}`,
        `*Batería:* ${campos.bateria || '—'}`,
        `*ID:* ${campos.instalacionId || '—'}`,
        `*Fecha:* ${campos.timestamp || ''}`
    ].filter(Boolean).join('\n');
    return { text: texto.slice(0, 3000) };
}

// 'campoSiNo': interpreta booleano/cadena/número de forma tolerante y evita 'no' falso.
function campoSiNo(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true', '1', 'sí', 'si', 'yes'].includes(v.trim().toLowerCase());
    return !!v;
}

export async function manejarPeticion(request, env, deps = {}) {
    const fetchFn = deps.fetch || fetch;
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type',
                'access-control-max-age': '86400'
            }
        });
    }
    if (request.method !== 'POST' || new URL(request.url).pathname !== RUTA) {
        return respuestaJson({ error: 'no-encontrado' }, 404);
    }

    const webhookUrl = (env && env.SLACK_WEBHOOK_URL) || '';
    if (!webhookUrl) {
        return respuestaJson({ error: 'slack-no-configurado' }, 500);
    }

    // 1) Límite real de cuerpo (2 KB) ANTES del parseo. Se lee como stream por fragmentos
    //    y se cancela en cuanto se supera el límite, SIN confiar en Content-Length
    //    (que puede ausentarse): nunca se consume el cuerpo completo de un invitado.
    if (request.headers.get('content-length') && Number(request.headers.get('content-length') || 0) > MAX_BODY) {
        return respuestaJson({ error: 'demasiado-grande' }, 413);
    }
    let resultado;
    try {
        resultado = await leerCuerpoConLimite(request, MAX_BODY);
    } catch {
        return respuestaJson({ error: 'cuerpo-ilegible' }, 400);
    }
    if (resultado.exceso) {
        return respuestaJson({ error: 'demasiado-grande' }, 413);
    }
    const cuerpoTexto = resultado.texto || '';

    let crudo;
    try {
        crudo = JSON.parse(cuerpoTexto);
    } catch {
        return respuestaJson({ error: 'json-invalido' }, 400);
    }
    if (!crudo || typeof crudo !== 'object') {
        return respuestaJson({ error: 'payload-invalido' }, 400);
    }

    // 2) Filtrado fuerte ANTES de usar nada del cliente.
    const saneado = sanitizarReporte(crudo);

    const instalacionId = String(saneado.instalacionId || 'anónimo').slice(0, 64);
    // Límite: 10 / 10 min por instalación.
    const limite = await permitirPorInstalacion(env.DIAGNOSTICS_KV, instalacionId);
    if (!limite.permitido) {
        return respuestaJson({ error: 'límite-alcanzado', permitidos: limite.permitidos }, 429);
    }

    // 3) Deduplicación 5 min.
    const huella = await huellaReporte(saneado);
    const dup = await esDuplicado(env.DIAGNOSTICS_KV, huella);
    if (dup) {
        return respuestaJson({ ok: true, estado: 'duplicado-omitido' }, 200);
    }

    // 4) Preparar campos finales (sólo datos ya saneados y no sensibles).
    const urlRaw = typeof crudo.url === 'string' ? crudo.url : '';
    const urlSeg = urlSegura(urlRaw);
    const campos = {
        type: saneado.type,
        message: saneado.message,
        context: saneado.context,
        dominio: dominioPublico(urlSeg),
        version: saneado.version,
        device: saneado.device,
        platform: saneado.platform,
        mobile: saneado.mobile,
        red: saneado.red,
        bateria: saneado.bateria,
        instalacionId: instalacionId.slice(0, 8),
        timestamp: saneado.timestamp || new Date().toISOString()
    };

    // 5) Envío inmediato a Slack.
    try {
        await enviarASlack(webhookUrl, construirMensajeSlack(campos), fetchFn);
    } catch (e) {
        // No propagamos detalles a Slack; devolvemos error genérico al cliente.
        return respuestaJson({ error: 'error-envio-slack' }, 502);
    }

    return respuestaJson({ ok: true, estado: 'enviado' }, 202);
}

// Entry point estándar de Cloudflare Workers.
export default {
    async fetch(request, env) {
        return manejarPeticion(request, env);
    }
};