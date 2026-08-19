// Durable Object de límites globales: tokens/día, tokens/minuto, solicitudes/día
// y capacidad diaria real de Groq (reserva protegida de primer uso + bolsa compartida).
//
// Persistido en el storage del DO (Cloudflare) -> no se confía en contadores locales.
// En tests se usa una instancia con storage en memoria (stub).
//
// El DO es la ÚNICA fuente de verdad concurrente para los contadores diarios:
//  - 20000 tokens de margen de seguridad: NUNCA asignables.
//  - 50000 tokens de reserva protegida de primer uso (hasta 5000 por invitado).
//  - 130000 tokens de bolsa compartida diaria.
//
// La reserva es identificable por `reservaId` (generado en el DO) y se reconcilia
// o revierte de forma segura: liberar/reconciliar por `reservaId` restaura la
// fuente correcta y, si era protegida, elimina la marca de primer uso del usuario
// para permitir reintento. No se usan banderas informativas sin efecto.

import { LIMITES_GROQ, CAPACIDAD_DIARIA } from './limites.js';
import { generarIdOpaque } from './crypto.js';

const SAP = CAPACIDAD_DIARIA;

// ID opaco de reserva generado con CSPRNG (getRandomValues) vía crypto.js,
// compatible con Cloudflare Workers y Node 18. Sin Math.random (no criptográfico).
function generarReservaId() {
    return generarIdOpaque();
}

export class RateLimiterDO {
    constructor(state, env) {
        this.state = state;   // { storage: { get, put, delete } } ; env no usado en Fase 1
        this._lock = null;    // serializa la sección crítica (el DO real ya es single-threaded)
    }

    // Mutex asíncrono: serializa reserva/liberación para que la concurrencia no
    // sobreescriva contadores. En un DO real las solicitudes al mismo DO se atienden
    // secuencialmente; el lock replica ese comportamiento en el stub de memoria.
    async _sync(fn) {
        let release;
        const previa = this._lock;
        this._lock = new Promise(resolve => { release = resolve; });
        if (previa) await previa;
        try {
            return await fn();
        } finally {
            release();
        }
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/snapshot') {
            const s = await this._snapshot();
            return Response.json(s);
        }

        // ---- Endpoints nuevos: capacidad diaria real ----
        if (url.pathname === '/reservar') {
            const body = await request.json().catch(() => ({}));
            const uso = await this._sync(() => this._reservar({
                usuarioId: body.usuarioId || null,
                tokens: Number(body.tokens) || 0,
                solicitudes: Number(body.solicitudes) || 0,
                primerUso: !!body.primerUso,
            }));
            return Response.json(uso);
        }

        if (url.pathname === '/liberar') {
            const body = await request.json().catch(() => ({}));
            const salida = await this._sync(() => this._liberar({ reservaId: body.reservaId }));
            return Response.json(salida);
        }

        if (url.pathname === '/reconciliar') {
            const body = await request.json().catch(() => ({}));
            const salida = await this._sync(() => this._reconciliar({ reservaId: body.reservaId, real: Number(body.real) || 0 }));
            return Response.json(salida);
        }

        // ---- Endpoints legacy (conservados para pruebas existentes) ----
        if (url.pathname === '/consume') {
            const body = await request.json().catch(() => ({}));
            const uso = await this._sync(() => this._consumirLegacy({
                tokens: body.tokens || 0,
                solicitudes: body.solicitudes || 0,
                prioridad: !!body.prioridad,
            }));
            return Response.json(uso);
        }

        if (url.pathname === '/release') {
            const body = await request.json().catch(() => ({}));
            const salida = await this._sync(() => this._liberarLegacy({ tokens: body.tokens || 0 }));
            return Response.json(salida);
        }

        return new Response('no-encontrado', { status: 404 });
    }

    // ---- Lectura/escritura del día con forma completa ----
    async _leerDia(hoy) {
        return await this.state.storage.get('dia:' + hoy)
            || { tokens: 0, solicitudes: 0, protectedUsed: 0, sharedUsed: 0, firstUse: {} };
    }
    async _escribirDia(hoy, d) { await this.state.storage.put('dia:' + hoy, d); }
    async _leerMin(min) { return await this.state.storage.get('min:' + min) || { tokens: 0 }; }
    async _escribirMin(min, m) { await this.state.storage.put('min:' + min, m); }

    _hoy() { return new Date().toISOString().slice(0, 10); }
    _min() { return Math.floor(Date.now() / 60000); }

    async _snapshot() {
        const hoy = this._hoy();
        const min = this._min();
        const dia = await this._leerDia(hoy);
        const minuto = await this._leerMin(min);
        return {
            tokens_dia: dia.tokens,
            solicitudes_dia: dia.solicitudes,
            tokens_minuto: minuto.tokens,
            protegida_usada: dia.protectedUsed,
            compartida_usada: dia.sharedUsed,
            margen_seguridad: SAP.MARGEN_SEGURIDAD,
            reserva_protegida_total: SAP.RESERVA_PROTEGIDA,
            bolsa_compartida_total: SAP.BOLSA_COMPARTIDA,
        };
    }

    // Capacidad diaria usable (sin el margen de seguridad, que nunca se asigna).
    _topeDiarioUsable() { return SAP.TOTAL_GROQ - SAP.MARGEN_SEGURIDAD; }

    // Reserva atómica de la capacidad diaria real.
    // Decide la fuente (protegida/compartida) dentro de la sección crítica:
    //  - primer uso candidato + sin marca hoy -> reserva protegida (<=5000/usuario, <=50000).
    //  - en otro caso -> bolsa compartida (<=130000).
    // Nadie usa el margen de seguridad (tope diario excluye esos 20000).
    async _reservar({ usuarioId, tokens, solicitudes, primerUso }) {
        if (!usuarioId) return { permitido: false, motivo: 'sin-usuario' };

        const hoy = this._hoy();
        const min = this._min();
        const d = await this._leerDia(hoy);
        const m = await this._leerMin(min);

        // Límites reales del proveedor (por minuto, diario sin margen de seguridad
        // y número de solicitudes por día).
        const minutosOk = m.tokens + tokens <= LIMITES_GROQ.tokens_por_minuto;
        const diarioOk = d.tokens + tokens <= this._topeDiarioUsable();
        const solicitudesOk = d.solicitudes + solicitudes <= LIMITES_GROQ.solicitudes_por_dia;

        let fuente = null;
        if (primerUso && !d.firstUse[usuarioId]) {
            // Reserva protegida de primer uso: tope por usuario y tope total.
            if (d.protectedUsed + tokens <= SAP.RESERVA_PROTEGIDA && tokens <= SAP.POR_USUARIO_PROTEGIDA) {
                fuente = 'protegida';
            }
        }
        if (!fuente) {
            // Bolsa compartida diaria para quien ya usó NoMi hoy.
            if (d.sharedUsed + tokens <= SAP.BOLSA_COMPARTIDA) fuente = 'compartida';
        }

        if (!fuente || !minutosOk || !diarioOk || !solicitudesOk) {
            // Nunca se superan los límites reales del proveedor, ni se toca el margen.
            const motivo = !fuente ? 'capacidad'
                : (!minutosOk ? 'minuto' : (!diarioOk ? 'dia' : 'solicitudes'));
            return { permitido: false, motivo };
        }

        const reservaId = generarReservaId();
        if (fuente === 'protegida') {
            d.protectedUsed += tokens;
            d.firstUse[usuarioId] = reservaId; // marca de primer uso (evita doble reserva)
        } else {
            d.sharedUsed += tokens;
        }
        d.tokens += tokens;
        d.solicitudes += solicitudes;
        m.tokens += tokens;

        await this._escribirDia(hoy, d);
        await this._escribirMin(min, m);
        await this.state.storage.put('res:' + reservaId, { usuarioId, tokens, fuente });
        return { permitido: true, fuente, reservaId };
    }

    // Revierte una reserva completa (por reservaId). Si era protegida, elimina la
    // marca de primer uso del usuario para que pueda reintentar como primer uso.
    async _liberar({ reservaId }) {
        if (!reservaId) return { liberado: 0 };
        const r = await this.state.storage.get('res:' + reservaId);
        if (!r) return { liberado: 0 };

        const hoy = this._hoy();
        const min = this._min();
        const d = await this._leerDia(hoy);
        const m = await this._leerMin(min);

        if (r.fuente === 'protegida') {
            d.protectedUsed = Math.max(0, d.protectedUsed - r.tokens);
            if (d.firstUse[r.usuarioId] === reservaId) delete d.firstUse[r.usuarioId];
        } else {
            d.sharedUsed = Math.max(0, d.sharedUsed - r.tokens);
        }
        d.tokens = Math.max(0, d.tokens - r.tokens);
        m.tokens = Math.max(0, m.tokens - r.tokens);

        await this._escribirDia(hoy, d);
        await this._escribirMin(min, m);
        await this.state.storage.delete('res:' + reservaId);
        return { liberado: r.tokens, fuente: r.fuente };
    }

    // Reconcilia una reserva con el uso REAL del proveedor (por reservaId).
    // Ajusta la fuente correcta y los límites reales sin exceder sus topes ni
    // bajar de 0 (comportamiento conservador: nunca se excede el límite real).
    async _reconciliar({ reservaId, real }) {
        if (!reservaId) return { ok: true };
        const r = await this.state.storage.get('res:' + reservaId);
        if (!r) return { ok: true };

        const hoy = this._hoy();
        const min = this._min();
        const d = await this._leerDia(hoy);
        const m = await this._leerMin(min);

        const ajuste = real - r.tokens;
        const clampBucket = (v, cap) => Math.min(cap, Math.max(0, v));
        if (r.fuente === 'protegida') {
            d.protectedUsed = clampBucket(d.protectedUsed + ajuste, SAP.RESERVA_PROTEGIDA);
        } else {
            d.sharedUsed = clampBucket(d.sharedUsed + ajuste, SAP.BOLSA_COMPARTIDA);
        }
        d.tokens = clampBucket(d.tokens + ajuste, this._topeDiarioUsable());
        m.tokens = clampBucket(m.tokens + ajuste, LIMITES_GROQ.tokens_por_minuto);

        await this._escribirDia(hoy, d);
        await this._escribirMin(min, m);
        await this.state.storage.delete('res:' + reservaId);
        return { ok: true, ajuste };
    }

    // ---- Legacy: consume (conservado para pruebas existentes) ----
    async _consumirLegacy({ tokens, solicitudes, prioridad }) {
        const hoy = this._hoy();
        const min = this._min();
        const d = await this._leerDia(hoy);
        const m = await this._leerMin(min);

        const excedeDia = d.tokens + tokens > LIMITES_GROQ.tokens_por_dia
            || d.solicitudes + solicitudes > LIMITES_GROQ.solicitudes_por_dia;
        const excedeMinuto = m.tokens + tokens > LIMITES_GROQ.tokens_por_minuto;

        if (excedeDia || excedeMinuto) {
            // Nunca se superan los límites reales del proveedor, incluso con prioridad.
            return { permitido: false, motivo: excedeDia ? 'dia' : 'minuto' };
        }

        d.tokens += tokens;
        d.solicitudes += solicitudes;
        m.tokens += tokens;
        await this._escribirDia(hoy, d);
        await this._escribirMin(min, m);
        return { permitido: true };
    }

    // ---- Legacy: release (conservado para pruebas existentes) ----
    async _liberarLegacy({ tokens }) {
        const hoy = this._hoy();
        const min = this._min();
        const d = await this._leerDia(hoy);
        const m = await this._leerMin(min);
        const clamp = n => Math.max(0, n - tokens);
        d.tokens = clamp(d.tokens);
        m.tokens = clamp(m.tokens);
        await this._escribirDia(hoy, d);
        await this._escribirMin(min, m);
        return { liberado: tokens };
    }
}
