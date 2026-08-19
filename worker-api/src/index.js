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
import { llamarGroq } from './groq.js';
import { RateLimiterDO } from './rate-limiter-do.js';
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

async function handlerChat(env, request) {
    const { db, usuario } = await autenticarInvitado(env, request);

    // Límite del cuerpo HTTP con límite real de bytes (confía en Content-Length y,
    // si falta, lee el stream hasta un tope). Evita cuerpos abusivos antes de Groq.
    const body = await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const modelo = String(body.modelo || '');
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';

    if (!modeloPermitido(modelo)) throw E.modeloNoPermitido();
    if (!mensaje || !mensaje.trim()) throw E.parametrosInvalidos('Falta el mensaje.');

    // Límite de entrada por BYTES UTF-8 (no por nº de caracteres ni estimación chars/4).
    const bytesEntrada = new TextEncoder().encode(mensaje).length;
    if (bytesEntrada > RESERVA.MAX_ENTRADA_BYTES) throw E.parametrosInvalidos('Mensaje demasiado largo.');

    // Cuota mensual del invitado (ya contabilizada). La reserva atómica está más abajo.
    const uso = await db.obtenerUso(usuario.id);
    if (uso.tokens >= CREDITOS.INVITADO_POR_MES) throw E.cuotaAgotada();

    // Asegura el período mensual de la bolsa (reset sin rollover). El DO es quien
    // decide la fuente diaria; la bolsa mensual se mantiene como estaban.
    await db.obtenerCreditos();

    // Capacidad diaria real del proveedor (fuente de verdad: el DO).
    const id = env.RATE_LIMITER.idFromName('global');
    const doObj = env.RATE_LIMITER.get(id);
    const snap = await (await doObj.fetch('https://internal/snapshot', { method: 'GET' })).json();

    const hoy = diaActual();
    const primerUsoCandidato = !usuario.primer_uso_dia || usuario.primer_uso_dia !== hoy;
    const cap = decidirModo({ primerUsoCandidato, compartidaUsada: snap.compartida_usada });

    // Reserva protegida agotada y el usuario ya usó hoy: no queda capacidad para él.
    if (cap.modo === CAPACIDAD.RESERVA_PROTEGIDA && !primerUsoCandidato) throw E.capacidadTemporal();

    const maxSalida = Math.min(cap.max_tokens, RESERVA.MAX_SALIDA_TOKENS);

    // Límite conservador y verificable: peor caso 1 token por byte de entrada.
    // máximo posible = entrada (peor caso) + salida + margen. Si NO cabe bajo
    // tokens_por_minuto del proveedor, se rechaza ANTES de llamar a Groq (sin Math.min).
    const tokensEntrada = bytesEntrada * RESERVA.TOKENS_POR_BYTE_ENTRADA;
    const tokensNecesarios = tokensEntrada + maxSalida + RESERVA.MARGEN_TOKEN;
    if (tokensNecesarios > LIMITES_GROQ.tokens_por_minuto) {
        throw E.parametrosInvalidos('La petición excede el límite de tokens por minuto.');
    }
    const tokensReservados = tokensNecesarios;

    // 1) Reserva de capacidad diaria en el DO (única fuente de verdad concurrente).
    //    Decide atómicamente la fuente: reserva protegida de primer uso o bolsa compartida.
    //    El DO usa SOLO el id opaco del usuario para evitar doble prioridad.
    const r1 = await doObj.fetch('https://internal/reservar', {
        method: 'POST',
        body: JSON.stringify({ usuarioId: usuario.id, tokens: tokensReservados, solicitudes: 1, primerUso: primerUsoCandidato }),
    });
    const reserva = await r1.json();
    if (!reserva.permitido) throw E.capacidadTemporal();

    // 2) Reserva atómica de la cuota mensual del invitado (previene sobreconsumo por concurrencia).
    const reservaUsuario = await db.reservarUso(usuario.id, tokensReservados);
    if (!reservaUsuario) {
        // Rollback: liberar la reserva de capacidad ya tomada en el DO.
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        throw E.cuotaAgotada();
    }

    // 3) Reserva atómica de la bolsa global (descuento real por uso de cada chat).
    const reservaBolsa = await db.reservarBolsa(tokensReservados);
    if (!reservaBolsa) {
        // Rollback: liberar cuota individual y reserva de capacidad del DO.
        await db.reconciliarUso(usuario.id, tokensReservados);
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        throw E.capacidadTemporal();
    }

    // 4) Llamada a Groq (en tests se sustituye el fetch global).
    let res;
    try {
        res = await llamarGroq(env, { modelo, mensajes: [{ role: 'user', content: mensaje }], max_tokens: maxSalida });
    } catch (err) {
        // Revertir reservas si la llamada falla: liberar la capacidad (incluida la
        // marca de primer uso) y la bolsa/cuota, para no bloquear capacidad ni bolsa.
        await doObj.fetch('https://internal/liberar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId }) });
        await db.reconciliarUso(usuario.id, tokensReservados);
        await db.reconciliarBolsa(tokensReservados);
        throw err;
    }

    // 5) Reconciliación: el uso REAL del proveedor es la fuente de verdad.
    const real = res.usage.tokens;
    await doObj.fetch('https://internal/reconciliar', { method: 'POST', body: JSON.stringify({ reservaId: reserva.reservaId, real }) });

    // --- Cuota individual mensual: liberar lo sobreservado; si real excede, contabilizarlo. ---
    if (real <= tokensReservados) {
        const lib = tokensReservados - real;
        if (lib > 0) await db.reconciliarUso(usuario.id, lib);
    } else {
        const extra = real - tokensReservados;
        await db.sumarUso(usuario.id, { tokens: extra, solicitudes: 0 }); // cuenta el real, nunca se descarta
        registrarEvidencia('cuota_individual_exceso', { extra, real, reservado: tokensReservados });
    }

    // --- Bolsa global: devolver lo no usado; si real excede, descontar el exceso (sin doble gasto). ---
    if (real <= tokensReservados) {
        const lib = tokensReservados - real;
        if (lib > 0) await db.reconciliarBolsa(lib);
    } else {
        const extra = real - tokensReservados;
        const ok = await db.consumirBolsa(extra);
        if (!ok) await db.agotarBolsa(); // el uso real ocurrió; no se descarta, se deja evidencia
        registrarEvidencia('bolsa_exceso', { extra, real, reservado: tokensReservados });
    }

    // Marca el día del uso para la prioridad de primer uso diario (idempotente).
    await db.marcarUsoHoy(usuario.id);

    return json({ ok: true, respuesta: res.texto });
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
    await leerJsonLimitado(request, RESERVA.MAX_CUERPO_BYTES);
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    return json({ ok: true, codigo }, 201);
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

// --- Router principal ---
export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        try {
            const url = new URL(request.url);
            const p = url.pathname;
            if (request.method === 'POST' && p === '/v1/activate') return await handlerActivacion(env, request);
            if (request.method === 'GET' && p === '/v1/catalog') return handlerCatalogo(env, request);
            if (request.method === 'GET' && p === '/v1/usage') return await handlerUso(env, request);
            if (request.method === 'POST' && p === '/v1/chat') return await handlerChat(env, request);
            if (request.method === 'POST' && p === '/admin/invitacion') return await handlerAdminInvitacion(env, request);
            if (request.method === 'POST' && p === '/admin/liberar') return await handlerAdminLiberar(env, request);
            throw E.noEncontrado();
        } catch (err) {
            return errorHandler(err);
        }
    },
};
