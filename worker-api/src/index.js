// ======== nomi-api Worker · Fase 1 ========
// NoMi -> nomi-api Worker -> Groq. Independiente del Worker de diagnósticos.
//
// Endpoints:
//   POST /v1/activate                -> canjear invitación, devolver token opaco
//   GET  /v1/catalog                 -> catálogo de modelos (sin credenciales)
//   GET  /v1/usage                   -> uso/cuota del invitado autenticado
//   POST /v1/chat                    -> chat vía Groq (modelo allowlist)
//   POST /admin/invitacion           -> crear invitación (requiere ADMIN_SECRET)
//   POST /admin/liberar              -> liberar reserva -> bolsa (requiere ADMIN_SECRET, idempotente)
//
// Seguridad: invitaciones y tokens se guardan SOLO como hash (HMAC con ACCESS_TOKEN_SECRET).
// NO se guardan prompts, respuestas, URLs, historial ni conversaciones.
// NO se acepta proveedor, URL, API key ni modelo arbitrario del cliente.

import { ApiError, E } from './errores.js';
import { CATALOGO, modeloPermitido, catalogoPublico } from './catalogo.js';
import { BaseDatos } from './db.js';
import { llamarGroq, MODO_GROQ, crearHerramientasNoMi } from './groq.js';
import { consultarClima } from './clima.js';
import { consultarBusqueda } from './tavily.js';
import { RateLimiterDO } from './rate-limiter-do.js';
export { RateLimiterDO };
import { decidirModo, CAPACIDAD } from './capacidad.js';
import { CREDITOS, LIMITES_GROQ, RESERVA, CAPACIDAD_DIARIA, periodoActual, diaActual } from './limites.js';
import { igualEnTiempoConstante, generarCodigoInvitacion, generarTokenInstalacion } from './crypto.js';
import { leerJsonLimitado } from './cuerpo.js';

// Límites de tamaño de entrada/salida (máximos conservadores por llamada).
// La entrada se limita por BYTES UTF-8 (ver RESERVA en limites.js); la reserva de
// tokens es un máximo conservador que cabe de forma segura bajo tokens_por_minuto.

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'cache-control': 'no-store',
};

function json(objeto, status = 200) {
    return new Response(JSON.stringify(objeto), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
    });
}

function errorHandler(err) {
    if (err instanceof ApiError) return json({ error: err.code, mensaje: err.message }, err.status);
    // Logging mínimo y seguro: SOLO tipo y mensaje. Nunca headers, cuerpo, tokens, secretos ni stack.
    try {
        console.error('[nomi-api][error]', err && err.constructor && err.constructor.name, err && err.message);
    } catch { /* nunca debe romper el flujo */ }
    return json({ error: 'interno', mensaje: 'Error interno.' }, 500);
}

// --- Auth ---
function autenticarAdmin(env, request) {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!env.ADMIN_SECRET || !igualEnTiempoConstante(token, env.ADMIN_SECRET)) {
        throw E.adminNoAutorizado();
    }
}

// --- Autenticación de invitado ---
async function autenticarInvitado(env, request) {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw E.accesoInvalido();
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const usuario = await db.buscarPorToken(token);
    if (!usuario || usuario.estado !== 'activo') throw E.accesoInvalido();
    return { db, usuario };
}

// --- Endpoints ---
async function handlerActivacion(env, request) {
    const body = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const codigo = String(body.codigo || '').trim().toUpperCase();
    if (!codigo) throw E.invitacionInvalida();

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);

    // Activación atómica en D1 (DB.batch): crea el usuario y canjea la invitación
    // en una sola transacción o no aplica nada. Sin cupo -> invitación queda
    // pendiente/reutilizable; código inválido -> no crea usuario ni consume cupo.
    const resultado = await db.activarInvitacion(codigo);
    if (!resultado.ok) {
        throw resultado.motivo === 'capacidad' ? E.capacidadTemporal() : E.invitacionInvalida();
    }

    return json({
        ok: true,
        token: resultado.token,
        aviso: 'Token de instalación. Consúltalo cada vez que actives NoMi.',
    }, 201);
}

function handlerCatalogo(env, request) {
    return json({
        proveedores: ['groq'],
        openrouter: 'experimental/no-incluido',
        modelos: catalogoPublico(),
        aviso: 'Lista ordenada por latencia estimada de OpenRouter.',
    });
}

async function handlerUso(env, request) {
    const { db, usuario } = await autenticarInvitado(env, request);
    const uso = await db.obtenerUso(usuario.id);
    const creditos = await db.obtenerCreditos();

    // Estado de capacidad diaria real (fuente de verdad: el DO).
    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const snap = await (await doObj.fetch('https://internal/snapshot', { method: 'GET' })).json();

    const hoy = diaActual();
    const primerUsoCandidato = !usuario.primer_uso_dia || usuario.primer_uso_dia !== hoy;
    const cap = decidirModo({ primerUsoCandidato, compartidaUsada: snap.compartida_usada });

    // Capacidad diaria disponible general (sin revelar datos de otros usuarios).
    const disponibleDiaria = Math.max(0, (CAPACIDAD_DIARIA.TOTAL_GROQ - CAPACIDAD_DIARIA.MARGEN_SEGURIDAD) - snap.tokens_dia);

    return json({
        periodo: periodoActual(),
        cuota_mensual_invitado: CREDITOS.INVITADO_POR_MES,
        tokens_usados: uso.tokens,
        solicitudes_usadas: uso.solicitudes,
        bolsa_global_disponible: creditos.bolsa,
        estado_capacidad: cap.modo,
        capacidad_diaria_disponible: disponibleDiaria,
        mantiene_prioridad_primer_uso: primerUsoCandidato,
    });
}

const TEMAS_BUSQUEDA = new Set(['general', 'news', 'finance']);
const RECENCIAS_BUSQUEDA = new Set(['day', 'week', 'month', 'year']);

function bytesTexto(valor) {
    return new TextEncoder().encode(String(valor || '')).length;
}

function recortarUtf8(valor, maxBytes) {
    const texto = String(valor || '');
    const bytes = new TextEncoder().encode(texto);
    if (bytes.length <= maxBytes) return texto;
    let fin = Math.max(0, maxBytes);
    while (fin > 0 && (bytes[fin] & 0xC0) === 0x80) fin--;
    return new TextDecoder().decode(bytes.subarray(0, fin)).trimEnd();
}

function tokensSistemaGroq(modo) {
    if (modo === MODO_GROQ.DECISION_BUSQUEDA || modo === MODO_GROQ.BUSQUEDA_FORZADA) return RESERVA.SISTEMA_BUSQUEDA_TOKENS;
    if (modo === MODO_GROQ.SINTESIS_BUSQUEDA) return RESERVA.SISTEMA_SINTESIS_BUSQUEDA_TOKENS;
    return RESERVA.SISTEMA_TOKENS;
}

function tokensEntradaGroq(mensajes) {
    return (mensajes || []).reduce((total, mensaje) => {
        let bytes = bytesTexto(mensaje && mensaje.content);
        if (mensaje && mensaje.tool_calls) bytes += bytesTexto(JSON.stringify(mensaje.tool_calls));
        if (mensaje && mensaje.tool_call_id) bytes += bytesTexto(mensaje.tool_call_id);
        if (mensaje && mensaje.name) bytes += bytesTexto(mensaje.name);
        return total + bytes;
    }, 0) * RESERVA.TOKENS_POR_BYTE_ENTRADA;
}

// Ejecuta UNA petición real a Groq con el mismo ciclo completo de reserva,
// rollback y conciliación. El orquestador semántico la invoca una vez para la
// decisión/respuesta normal y, solo si hubo herramienta, otra para la síntesis.
// Así cada petición del proveedor queda contabilizada en DO, D1 y bolsa.
async function ejecutarGroqContabilizado(env, db, usuario, { modelo, mensajes, maxTokens, modo, herramientas = [] }) {
    const uso = await db.obtenerUso(usuario.id);
    if (uso.tokens >= CREDITOS.INVITADO_POR_MES) throw E.cuotaAgotada();
    await db.obtenerCreditos();

    const doObj = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const snap = await (await doObj.fetch('https://internal/snapshot', { method: 'GET' })).json();
    const hoy = diaActual();
    const primerUsoCandidato = !usuario.primer_uso_dia || usuario.primer_uso_dia !== hoy;
    const cap = decidirModo({ primerUsoCandidato, compartidaUsada: snap.compartida_usada });
    if (cap.modo === CAPACIDAD.RESERVA_PROTEGIDA && !primerUsoCandidato) throw E.capacidadDiaria();

    const maxSalida = Math.min(
        Number(maxTokens) > 0 ? Number(maxTokens) : RESERVA.MAX_SALIDA_TOKENS,
        cap.max_tokens,
        RESERVA.MAX_SALIDA_TOKENS,
    );
    if (maxSalida <= 0) throw E.capacidadDiaria();

    const herramientasTokens = Array.isArray(herramientas) && herramientas.length
        ? bytesTexto(JSON.stringify(herramientas)) * RESERVA.TOKENS_POR_BYTE_ENTRADA
        : 0;
    const tokensReservados = tokensEntradaGroq(mensajes)
        + tokensSistemaGroq(modo)
        + herramientasTokens
        + maxSalida
        + RESERVA.MARGEN_TOKEN;
    if (tokensReservados > LIMITES_GROQ.tokens_por_minuto) {
        throw E.parametrosInvalidos('La petición excede el límite de tokens por minuto.');
    }

    const reservaResp = await doObj.fetch('https://internal/reservar', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: usuario.id, tokens: tokensReservados, solicitudes: 1, primerUso: primerUsoCandidato }),
    });
    const reserva = await reservaResp.json();
    if (!reserva.permitido) {
        // Causa concreta con código estable (nunca un 503 ambiguo para todas):
        // - 'minuto'               -> límite de tokens por minuto (TPM).
        // - 'dia'/'solicitudes'/'capacidad' -> capacidad diaria real o bolsa diaria.
        // Cualquier otro motivo (p. ej. 'sin-usuario' = bug interno) cae en 500
        // seguro 'interno' y no expone estadísticas de otros usuarios.
        if (reserva.motivo === 'minuto') throw E.limitePorMinuto();
        if (reserva.motivo === 'dia' || reserva.motivo === 'solicitudes' || reserva.motivo === 'capacidad') throw E.capacidadDiaria();
        throw new Error('reserva rechazada sin motivo reconocido');
    }

    const reservaUsuario = await db.reservarUso(usuario.id, tokensReservados);
    if (!reservaUsuario) {
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        throw E.cuotaAgotada();
    }
    const reservaBolsa = await db.reservarBolsa(tokensReservados);
    if (!reservaBolsa) {
        await db.reconciliarUso(usuario.id, tokensReservados);
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        throw E.bolsaAgotada();
    }

    let resultado;
    try {
        resultado = await llamarGroq(env, { modelo, mensajes, max_tokens: maxSalida, modo, herramientas });
    } catch (err) {
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        await db.reconciliarUso(usuario.id, tokensReservados);
        await db.reconciliarBolsa(tokensReservados);
        throw err;
    }

    const real = resultado.usage.tokens;
    await doObj.fetch('https://internal/reconciliar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId, real }) });
    if (real <= tokensReservados) {
        const liberar = tokensReservados - real;
        if (liberar > 0) {
            await db.reconciliarUso(usuario.id, liberar);
            await db.reconciliarBolsa(liberar);
        }
    } else {
        const extra = real - tokensReservados;
        await db.sumarUso(usuario.id, { tokens: extra, solicitudes: 0 });
        const bolsaOk = await db.consumirBolsa(extra);
        if (!bolsaOk) await db.agotarBolsa();
        registrarEvidencia('uso_groq_exceso', { extra, real, reservado: tokensReservados });
    }
    await db.marcarUsoHoy(usuario.id);
    usuario.primer_uso_dia = hoy;
    return resultado;
}

function normalizarSolicitudBusqueda(datos, permitirTipo = false) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
    const permitidas = new Set(['consulta', 'tema', 'recencia']);
    if (permitirTipo) permitidas.add('tipo');
    if (Object.keys(datos).some(clave => !permitidas.has(clave))) return null;
    if (permitirTipo && datos.tipo !== 'busqueda') return null;
    const consulta = typeof datos.consulta === 'string' ? datos.consulta.trim() : '';
    if (consulta.length < 2 || consulta.length > 300 || bytesTexto(consulta) > RESERVA.MAX_CONSULTA_BUSQUEDA_BYTES) return null;
    if (datos.tema !== undefined && !TEMAS_BUSQUEDA.has(datos.tema)) return null;
    if (datos.recencia !== undefined && !RECENCIAS_BUSQUEDA.has(datos.recencia)) return null;
    return {
        consulta,
        tema: TEMAS_BUSQUEDA.has(datos.tema) ? datos.tema : 'general',
        recencia: RECENCIAS_BUSQUEDA.has(datos.recencia) ? datos.recencia : null,
    };
}

async function ejecutarBusquedaConCuota(env, db, usuario, solicitud, paraSintesis = false) {
    const hoy = diaActual();
    const registro = await db.intentarRegistrarBusqueda(usuario.id, hoy);
    if (!registro.ok) {
        return { estado: 'limite_diario', respuesta: 'Has superado el límite de búsquedas web por hoy (20). Inténtalo mañana.' };
    }
    const busqueda = await consultarBusqueda(env, solicitud.consulta, {
        ...solicitud,
        detalle: paraSintesis ? 'sintesis' : 'compacto',
    });
    if (busqueda.error === 'sin_resultados') {
        return { estado: 'sin_resultados', respuesta: 'No encontré fuentes útiles para responder esa consulta con información actual.' };
    }
    if (busqueda.error === 'fallo_proveedor') {
        try { await db.liberarConsultaBusqueda(usuario.id, hoy); } catch { /* best effort */ }
        return { estado: 'fallo_proveedor', respuesta: 'No se pudo consultar la web ahora. Reintenta.' };
    }
    return { estado: 'ok', resultados: busqueda.resultados };
}

function normalizarTextoCorto(valor, max = 120) {
    const texto = typeof valor === 'string' ? valor.trim() : '';
    return texto.length >= 2 && texto.length <= max ? texto : '';
}

function normalizarContextoTemporal(valor) {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    const fecha = typeof valor.fecha === 'string' ? valor.fecha : '';
    const hora = typeof valor.hora === 'string' ? valor.hora : '';
    const zona = typeof valor.zona === 'string' ? valor.zona.trim() : '';
    const offset = typeof valor.offset === 'string' ? valor.offset : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)
        || !zona || zona.length > 64 || !/^UTC[+-]\d{2}:\d{2}$/.test(offset)) return null;
    const d = new Date(`${fecha}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) return null;
    return { fecha, hora, zona, offset };
}

function normalizarSolicitudClima(datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
    if (Object.keys(datos).some(clave => !['ubicacion', 'fecha'].includes(clave))) return null;
    const fecha = typeof datos.fecha === 'string' ? datos.fecha : '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(`${fecha}T00:00:00Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) return null;
    if (datos.ubicacion !== undefined && !normalizarTextoCorto(datos.ubicacion)) return null;
    return { fecha, ubicacion: normalizarTextoCorto(datos.ubicacion) };
}

function extraerLlamadaHerramienta(toolCalls) {
    if (!Array.isArray(toolCalls) || toolCalls.length !== 1) return null;
    const llamada = toolCalls[0];
    if (!llamada || llamada.type !== 'function' || !llamada.function) return null;
    let argumentos;
    try { argumentos = JSON.parse(llamada.function.arguments || '{}'); } catch { return null; }
    if (llamada.function.name === 'busqueda_web') {
        const solicitud = normalizarSolicitudBusqueda(argumentos);
        return solicitud ? { tipo: 'busqueda', solicitud } : null;
    }
    if (llamada.function.name === 'consultar_clima') {
        const solicitud = normalizarSolicitudClima(argumentos);
        return solicitud ? { tipo: 'clima', solicitud } : null;
    }
    return null;
}

async function ejecutarClimaConCuota(env, db, usuario, ubicacion, fecha, fechaLocal) {
    if (!ubicacion) {
        return { estado: 'falta_ubicacion', respuesta: '¿En qué ciudad y país quieres consultar el clima?' };
    }
    const objetivo = new Date(`${fecha}T00:00:00Z`);
    const base = new Date(`${fechaLocal}T00:00:00Z`);
    const dias = Math.round((objetivo.getTime() - base.getTime()) / 86400000);
    if (!Number.isFinite(dias) || dias < 0 || dias > 15) {
        return { estado: 'consulta_invalida', respuesta: 'Puedo consultar el pronóstico desde hoy hasta los próximos 15 días.' };
    }
    const hoy = diaActual();
    const registro = await db.intentarRegistrarClima(usuario.id, hoy);
    if (!registro.ok) {
        return { estado: 'limite_diario', respuesta: 'Has superado el límite de consultas de clima por hoy (20). Inténtalo mañana.' };
    }
    const clima = await consultarClima(env, ubicacion, { fecha, fechaLocal });
    if (clima.error === 'ciudad_no_encontrada') {
        return { estado: 'ciudad_no_encontrada', respuesta: 'No encontré la ciudad. Indica la ciudad y el país (por ejemplo, Santa Cruz de la Sierra, Bolivia).' };
    }
    if (clima.error === 'fecha_invalida') {
        try { await db.liberarConsultaClima(usuario.id, hoy); } catch { /* best effort */ }
        return { estado: 'consulta_invalida', respuesta: 'No pude interpretar la fecha solicitada. Indica el día de otra forma.' };
    }
    if (clima.error === 'fallo_proveedor') {
        try { await db.liberarConsultaClima(usuario.id, hoy); } catch { /* best effort */ }
        return { estado: 'fallo_proveedor', respuesta: 'No se pudo consultar el clima ahora. Reintenta.' };
    }
    return { estado: 'ok', respuesta: clima.texto };
}

function preguntaActualDesdeMensaje(mensaje) {
    const texto = String(mensaje || '');
    const marca = 'Pregunta del usuario:';
    const indice = texto.lastIndexOf(marca);
    const actual = indice >= 0 ? texto.slice(indice + marca.length).trim() : texto.trim();
    return recortarUtf8(actual, 1200);
}

function construirPromptSintesis(mensaje, solicitud, resultados) {
    const evidencia = resultados.slice(0, 3).map((r, indice) => ({
        id: indice + 1,
        titulo: r.titulo,
        contenido: r.contenido,
        fecha: r.fecha || '',
    }));
    return 'Redacta la respuesta final a partir de estos datos JSON. Entrega una respuesta completa, no un título ni un fragmento: abre con la conclusión y resume después solo los hechos útiles; cita afirmaciones como [1], [2] o [3]. No enumeres enlaces ni menciones que vas a responder; escribe al menos una oración terminada antes de finalizar. Descarta cualquier fuente que no sea relevante para el tema de la consulta original. Si la evidencia no basta o es contradictoria, dilo claramente sin inventar ni mezclar datos.\n' + JSON.stringify({
        pregunta: preguntaActualDesdeMensaje(mensaje),
        consulta_resuelta: solicitud.consulta,
        evidencia,
    });
}

// Una cabecera incompleta como "Noticias de" no es una respuesta útil, aunque
// el proveedor haya devuelto HTTP 200. La tratamos igual que un fallo blando de
// síntesis: no se muestran enlaces aislados y el usuario puede reintentar.
function sintesisUtil(texto, finishReason) {
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
    // Una respuesta bien terminada puede cerrar con una o varias referencias
    // ([1], [2]) después de la oración. Eso no la convierte en un fragmento.
    return finishReason !== 'length'
        && limpio.length >= 24
        && (/[.!?…](?:\s*\[\d+\]){0,3}$/.test(limpio)
            || /\[\d+\]$/.test(limpio));
}

async function handlerChat(env, request) {
    const { db, usuario } = await autenticarInvitado(env, request);

    // Límite del cuerpo HTTP con límite real de bytes (confía en Content-Length y,
    // si falta, lee el stream hasta un tope). Evita cuerpos abusivos antes de Groq.
    const body = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);

    // --- Ruta de clima (herramienta) ---
    // El Worker es el único intermediario: autentica al invitado, resuelve la
    // ciudad con Open-Meteo y consulta el forecast. NO llama a Groq ni consume
    // cuota/tokens de Groq; usa un contador diario propio (20/día UTC) aislado
    // de la cuota mensual, la bolsa global y el RateLimiterDO de Groq.
    const herramienta = body && typeof body.herramienta === 'object' && body.herramienta !== null ? body.herramienta : null;
    if (herramienta && herramienta.tipo !== 'clima' && herramienta.tipo !== 'busqueda') {
        throw E.parametrosInvalidos('Herramienta no soportada.');
    }
    if (herramienta && herramienta.tipo === 'clima') {
        const ubicacion = typeof body.herramienta.ubicacion === 'string' ? body.herramienta.ubicacion.trim() : '';
        if (!ubicacion || ubicacion.length < 2 || ubicacion.length > 120) {
            throw E.parametrosInvalidos('Indica una ciudad válida para consultar el clima.');
        }
        const temporal = normalizarContextoTemporal(body.contextoTemporal);
        const fechaLocal = temporal ? temporal.fecha : diaActual();
        const fecha = typeof herramienta.fecha === 'string' ? herramienta.fecha : fechaLocal;
        const resultado = await ejecutarClimaConCuota(env, db, usuario, ubicacion, fecha, fechaLocal);
        return json({ ok: true, respuesta: resultado.respuesta, climaEstado: resultado.estado, herramientasProtocolo: 1 });
    }

    // --- Ruta de búsqueda web (herramienta, Tavily SOLO desde el Worker) ---
    // La clave TAVILY_API_KEY vive como secreto del Worker; nunca se acepta ni se
    // expone la clave Tavily del usuario (API Personal conserva su flujo propio).
    // Contador diario propio en D1 (uso_busqueda_diario), atómico y aislado de
    // cuota mensual, bolsa global y RateLimiterDO. NO guarda ni loguea la
    // consulta, snippets ni resultados.
    if (herramienta && herramienta.tipo === 'busqueda') {
        const solicitud = normalizarSolicitudBusqueda(herramienta, true);
        if (!solicitud) {
            throw new ApiError('consulta-busqueda-invalida', 'Indica una búsqueda válida.', 400);
        }
        const busqueda = await ejecutarBusquedaConCuota(env, db, usuario, solicitud);
        if (busqueda.estado !== 'ok') {
            return json({ ok: true, respuesta: busqueda.respuesta, busquedaEstado: busqueda.estado });
        }
        // Compatibilidad con bundles anteriores: esta ruta directa conserva la
        // respuesta de resultados sin Groq. Los clientes nuevos usan la decisión
        // semántica del chat normal y reciben una síntesis.
        return json({ ok: true, busquedaEstado: 'ok', resultados: busqueda.resultados });
    }

    const modelo = String(body.modelo || '');
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
    const forzarBusqueda = body.forzarBusqueda === true;
    const permitirBusqueda = body.permitirBusqueda === true || forzarBusqueda;
    const permitirClima = body.permitirClima === true && !forzarBusqueda;
    const temporal = normalizarContextoTemporal(body.contextoTemporal);
    const ubicacionHabitual = normalizarTextoCorto(body.ubicacionHabitual);
    const ubicacionDispositivo = normalizarTextoCorto(body.ubicacionDispositivo);

    if (!modeloPermitido(modelo)) throw E.modeloNoPermitido();
    if (!mensaje || !mensaje.trim()) throw E.parametrosInvalidos('Falta el mensaje.');

    // Límite de entrada por BYTES UTF-8 (no por nº de caracteres ni estimación chars/4).
    const bytesEntrada = new TextEncoder().encode(mensaje).length;
    if (bytesEntrada > RESERVA.MAX_ENTRADA_BYTES) throw E.parametrosInvalidos('Mensaje demasiado largo.');

    const herramientas = crearHerramientasNoMi({ permitirBusqueda, permitirClima, forzarBusqueda });
    // Primera llamada: el modelo responde directamente o solicita una única
    // herramienta semántica. Las preferencias desactivadas usan chat sin tools.
    const primera = await ejecutarGroqContabilizado(env, db, usuario, {
        modelo,
        mensajes: [{ role: 'user', content: mensaje }],
        maxTokens: RESERVA.MAX_SALIDA_TOKENS,
        modo: forzarBusqueda
            ? MODO_GROQ.BUSQUEDA_FORZADA
            : (herramientas.length ? MODO_GROQ.DECISION_BUSQUEDA : MODO_GROQ.NORMAL),
        herramientas,
    });
    if (!herramientas.length || primera.toolCalls.length === 0) {
        if (!primera.texto.trim()) throw E.proveedorNoDisponible();
        return json({ ok: true, respuesta: primera.texto, busquedaProtocolo: 1, herramientasProtocolo: 1 });
    }

    // Solo se acepta exactamente una llamada a la función permitida. No se
    // ejecutan herramientas desconocidas, múltiples ni argumentos no válidos.
    const llamada = extraerLlamadaHerramienta(primera.toolCalls);
    if (!llamada
        || (llamada.tipo === 'clima' && !permitirClima)
        || (llamada.tipo === 'busqueda' && !permitirBusqueda)) {
        return json({
            ok: true,
            respuesta: 'No pude preparar la consulta externa de forma segura. Reformula la pregunta.',
            busquedaEstado: 'consulta_invalida',
            busquedaProtocolo: 1,
            herramientasProtocolo: 1,
        });
    }

    if (llamada.tipo === 'clima') {
        const ubicacion = llamada.solicitud.ubicacion || ubicacionHabitual || ubicacionDispositivo;
        const fechaLocal = temporal ? temporal.fecha : diaActual();
        const resultado = await ejecutarClimaConCuota(env, db, usuario, ubicacion, llamada.solicitud.fecha, fechaLocal);
        return json({
            ok: true,
            respuesta: resultado.respuesta,
            climaEstado: resultado.estado,
            busquedaProtocolo: 1,
            herramientasProtocolo: 1,
        });
    }

    const solicitud = llamada.solicitud;

    const busqueda = await ejecutarBusquedaConCuota(env, db, usuario, solicitud, true);
    if (busqueda.estado !== 'ok') {
        return json({ ok: true, respuesta: busqueda.respuesta, busquedaEstado: busqueda.estado, busquedaProtocolo: 1, herramientasProtocolo: 1 });
    }

    // Segunda y última llamada: sintetiza evidencia saneada. No se vuelven a
    // ofrecer tools, por lo que el ciclo tiene como máximo una búsqueda.
    let sintesis;
    try {
        sintesis = await ejecutarGroqContabilizado(env, db, usuario, {
            modelo,
            mensajes: [{ role: 'user', content: construirPromptSintesis(mensaje, solicitud, busqueda.resultados) }],
            // La instrucción pide ≤160 palabras. GPT-OSS puede consumir parte
            // del presupuesto razonando; 640 tokens con esfuerzo bajo dejan
            // margen para una respuesta terminada sin hacerla extensa.
            maxTokens: 640,
            modo: MODO_GROQ.SINTESIS_BUSQUEDA,
        });
    } catch (err) {
        // Tavily sí respondió: la consulta externa consume cupo igual que un
        // resultado vacío. No se revierte aquí, porque hacerlo permitiría repetir
        // Tavily sin límite cuando la segunda llamada Groq está sin capacidad.
        if (err instanceof ApiError && err.code === 'proveedor-no-disponible') {
            return json({
                ok: true,
                respuesta: 'Encontré fuentes, pero no pude preparar la respuesta. Reintenta.',
                busquedaEstado: 'fallo_sintesis',
                busquedaProtocolo: 1,
                herramientasProtocolo: 1,
            });
        }
        throw err;
    }
    if (!sintesisUtil(sintesis.texto, sintesis.finishReason)) {
        return json({
            ok: true,
            respuesta: 'Encontré fuentes, pero no pude preparar la respuesta. Reintenta.',
            busquedaEstado: 'fallo_sintesis',
            busquedaProtocolo: 1,
            herramientasProtocolo: 1,
        });
    }

    const fuentes = busqueda.resultados.map((resultado) => ({
        titulo: resultado.titulo,
        url: resultado.url,
        fecha: resultado.fecha || '',
    }));
    return json({ ok: true, respuesta: sintesis.texto, busquedaEstado: 'ok', busquedaProtocolo: 1, herramientasProtocolo: 1, fuentes });
}

// Evidencia técnica SIN contenido de usuario (no se guarda prompt/respuesta).
function registrarEvidencia(tipo, datos) {
    try {
        console.warn('[nomi-api][evidencia]', tipo, JSON.stringify({ ...datos, ts: Date.now() }));
    } catch { /* nunca debe romper el flujo */ }
}

// --- Admin (privado) ---
async function handlerAdminInvitacion(env, request) {
    autenticarAdmin(env, request);
    // Limita el cuerpo (incluso sin Content-Length) antes de procesar.
    const cuerpo = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);

    // Etiqueta opcional, limitada y validada (texto corto, sin secretos).
    let etiqueta = null;
    if (cuerpo && cuerpo.etiqueta !== undefined && cuerpo.etiqueta !== null) {
        if (typeof cuerpo.etiqueta !== 'string') throw E.parametrosInvalidos('La etiqueta debe ser texto.');
        const t = cuerpo.etiqueta.trim();
        if (t.length === 0) throw E.parametrosInvalidos('La etiqueta no puede estar vacía.');
        if (t.length > 64) throw E.parametrosInvalidos('La etiqueta es demasiado larga (máx. 64).');
        if (!/^[\p{L}\p{N} _\-]+$/u.test(t)) throw E.parametrosInvalidos('La etiqueta contiene caracteres no permitidos.');
        etiqueta = t;
    }

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo, id } = await db.crearInvitacion(etiqueta);
    return json({ ok: true, codigo, id }, 201);
}

// Listado administrativo: estado, id, fechas, etiqueta y usuario vinculado.
// NUNCA incluye códigos, hashes ni tokens.
async function handlerAdminListado(env, request) {
    autenticarAdmin(env, request);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const invitaciones = await db.listarInvitaciones();
    return json({ ok: true, invitaciones }, 200);
}

// Revocación administrativa por id (transaccional con D1). Revoca la invitación
// y, si estaba canjeada, también el usuario vinculado (su token deja de autenticar).
async function handlerAdminRevocar(env, request) {
    autenticarAdmin(env, request);
    const cuerpo = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const id = String(cuerpo.id || '').trim();
    if (!id) throw E.parametrosInvalidos('Falta el id de la invitación.');
    if (id.length > 64) throw E.parametrosInvalidos('El id de la invitación es demasiado largo.');

    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const resultado = await db.revocarInvitacion(id);
    if (!resultado.ok) {
        if (resultado.motivo === 'no_encontrada') throw E.noEncontrado();
        throw E.invitacionYaRevocada();
    }
    return json({ ok: true, usuarioRevocado: resultado.usuarioRevocado }, 200);
}

async function handlerAdminLiberar(env, request) {
    autenticarAdmin(env, request);
    const body = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const operacionId = String(body.operacionId || '').trim();
    const monto = Number(body.monto);
    if (!operacionId || !Number.isFinite(monto) || monto <= 0) {
        throw E.parametrosInvalidos('Faltan operacionId o monto.');
    }
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const resultado = await db.liberarReserva(operacionId, monto, String(body.anotacion || ''));
    const creditos = await db.obtenerCreditos();
    return json({ ok: true, repetida: resultado.repetida, bolsa: creditos.bolsa, reserva: creditos.reserva });
}

// --- Acceso propietario: recuperación PÚBLICA con la clave permanente ----
// Si aun no existe propietario activo, crea el ÚNICO usuario 'propietario'; si ya
// existe, rota su token (el anterior queda inválido). La clave NO se consume ni
// expira. NO acepta ni devuelve rol del cliente (el rol lo fija el servidor).
async function handlerRecuperarPropietario(env, request) {
    const body = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const clave = typeof body.clave === 'string' ? body.clave.trim() : '';
    // La clave generada mide ~52 chars (prefijo + 32 bytes b64url); aceptamos un
    // margen amplio, pero rechazamos textos que claramente no son una clave.
    if (!clave || clave.length < 24 || clave.length > 200) {
        throw E.clavePropietariaInvalida();
    }
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const resultado = await db.recuperarPropietario(clave);
    if (!resultado.ok) throw E.clavePropietariaInvalida();
    // El token opaco se devuelve; la clave nunca se expone aquí.
    return json({ ok: true, rol: 'propietario', token: resultado.token, rotado: resultado.rotado }, resultado.rotado ? 200 : 201);
}

// --- Acceso propietario (admin, protegido con ADMIN_SECRET) ---
// Crea o ROTA la clave de recuperación del propietario. La devuelve UNA única vez
// (solo su hash queda guardado). Nunca se lista en el bundle ni en el listado.
async function handlerAdminClavePropietaria(env, request) {
    autenticarAdmin(env, request);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { clave, id } = await db.crearClavePropietaria();
    return json({ ok: true, id, clave }, 201);
}

// Revoca la clave de recuperación activa Y el propietario activo (transaccional).
// El propietario deja de autenticar; los invitados no se ven afectados. Posterior
// a la revocación se podrá crear una nueva clave.
async function handlerAdminRevocarPropietario(env, request) {
    autenticarAdmin(env, request);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const resultado = await db.revocarAccesoPropietario();
    if (!resultado.claveRevocada && !resultado.propietarioRevocado) {
        throw E.clavePropietariaNoActiva();
    }
    return json({ ok: true, claveRevocada: resultado.claveRevocada, propietarioRevocado: resultado.propietarioRevocado }, 200);
}

// Listado admin del propietario: rol y estado, JAMÁS códigos, hashes ni tokens,
// ni tampoco la clave de recuperación (solo si hay una activa).
async function handlerAdminPropietario(env, request) {
    autenticarAdmin(env, request);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const propietario = await db.listarPropietario();
    const claveActiva = !!(await db.buscarClavePropietariaActiva());
    return json({
        ok: true,
        propietario: propietario ? { id: propietario.id, rol: 'propietario', estado: propietario.estado, creado_en: propietario.creado_en } : null,
        claveActiva,
    }, 200);
}

// --- Router principal ---
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        try {
            const url = new URL(request.url);
            const p = url.pathname;
            if (request.method === 'POST' && p === '/v1/activate') return await handlerActivacion(env, request);
            if (request.method === 'POST' && p === '/v1/recuperar-propietario') return await handlerRecuperarPropietario(env, request);
            if (request.method === 'GET' && p === '/v1/catalog') return handlerCatalogo(env, request);
            if (request.method === 'GET' && p === '/v1/usage') return await handlerUso(env, request);
            if (request.method === 'POST' && p === '/v1/chat') return await handlerChat(env, request);
            if (request.method === 'POST' && p === '/admin/invitacion') return await handlerAdminInvitacion(env, request);
            if (request.method === 'GET' && p === '/admin/invitaciones') return await handlerAdminListado(env, request);
            if (request.method === 'POST' && p === '/admin/revocar') return await handlerAdminRevocar(env, request);
            if (request.method === 'POST' && p === '/admin/liberar') return await handlerAdminLiberar(env, request);
            if (request.method === 'POST' && p === '/admin/propietario/clave') return await handlerAdminClavePropietaria(env, request);
            if (request.method === 'POST' && p === '/admin/propietario/revocar') return await handlerAdminRevocarPropietario(env, request);
            if (request.method === 'GET' && p === '/admin/propietario') return await handlerAdminPropietario(env, request);
            throw E.noEncontrado();
        } catch (err) {
            return errorHandler(err);
        }
    },
};
