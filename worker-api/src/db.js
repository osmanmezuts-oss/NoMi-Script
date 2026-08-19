// Capa de acceso a D1. Usa una interfaz mínima {prepare} para poder simularla en tests.
// NO guarda prompts, respuestas, URLs, historial ni conversaciones.

import { E } from './errores.js';
import { CREDITOS, CAPACIDAD_DIARIA, periodoActual, diaActual } from './limites.js';
import { hashCodigo, hashToken, generarIdOpaque, generarCodigoInvitacion, generarTokenInstalacion } from './crypto.js';

export class BaseDatos {
    constructor(db, secret) {
        this.db = db;          // binding D1 (o stub en tests)
        this.secret = secret;  // ACCESS_TOKEN_SECRET (pepper)
    }

    async run(sql, ...params) {
        const stmt = this.db.prepare(sql);
        const bound = params.length ? stmt.bind(...params) : stmt;
        return bound.run();
    }

    async first(sql, ...params) {
        const stmt = this.db.prepare(sql);
        const bound = params.length ? stmt.bind(...params) : stmt;
        return bound.first();
    }

    // ---- Invitaciones (solo hash) ----
    async crearInvitacion() {
        const codigo = this.generarCodigo();
        const id = generarIdOpaque();
        const codigoHash = await hashCodigo(this.secret, codigo);
        await this.run(
            'INSERT INTO invitaciones (id, codigo_hash, estado, creada_en) VALUES (?, ?, ?, ?)',
            id, codigoHash, 'pendiente', Date.now()
        );
        return { codigo, id };
    }

    // ---- Activación (transacción D1 real y atómica) ----
    // Crea el usuario Y canjea la invitación en UNA transacción `DB.batch()`
    // (all-or-nothing): o se aplican ambas sentencias o ninguna. Con esto se
    // elimina por construcción el usuario huérfano por fallo parcial y el consumo
    // temporal de cupos por códigos inválidos.
    //   alta:    solo si la invitación existe Y está 'pendiente' Y hay cupo
    //            (guarda atómica `COUNT<MAX` en la propia sentencia);
    //   canje:   solo si existe un usuario vinculado a esa invitación (ES DECIR,
    //            el alta tuvo éxito en la misma transacción). No vuelve a mirar
    //            el cupo porque dentro de la transacción el conteo ya incluye al
    //            usuario recién creado.
    // Resultado:
    //   { ok:true, token, id }          -> invitado creado y activado;
    //   { ok:false, motivo:'capacidad'} -> sin cupo (invitación queda pendiente/reutilizable);
    //   { ok:false, motivo:'invalida'}  -> código no válido o invitación ya usada.
    async activarInvitacion(codigo) {
        const token = this.generarToken();
        const tokenHash = await hashToken(this.secret, token);
        const id = generarIdOpaque();
        const codigoHash = await hashCodigo(this.secret, codigo);
        const creadoEn = Date.now();
        const limite = CAPACIDAD_DIARIA.MAX_INVITADOS;

        const insertar = this.db.prepare(
            `INSERT INTO usuarios (id, token_hash, rol, estado, creado_en, invitacion_id)
             SELECT ?, ?, 'invitado', 'activo', ?, id
             FROM invitaciones
             WHERE codigo_hash = ? AND estado = 'pendiente'
               AND (SELECT COUNT(*) FROM usuarios WHERE rol = 'invitado') < ?`
        ).bind(id, tokenHash, creadoEn, codigoHash, limite);

        const canjear = this.db.prepare(
            `UPDATE invitaciones SET estado='canjeada', canjeada_en=?
             WHERE codigo_hash = ? AND estado = 'pendiente'
               AND EXISTS (SELECT 1 FROM usuarios WHERE invitacion_id = invitaciones.id)`
        ).bind(creadoEn, codigoHash);

        const resultados = await this.db.batch([insertar, canjear]);
        const usuarioCreado = !!(resultados && resultados[0] && resultados[0].meta && resultados[0].meta.changes === 1);

        if (!usuarioCreado) {
            // Sin cupo (la invitación sigue pendiente y reutilizable) vs invitación
            // inválida o ya usada (nada que tocar).
            const inv = await this.first('SELECT estado FROM invitaciones WHERE codigo_hash = ?', codigoHash);
            if (inv && inv.estado === 'pendiente') return { ok: false, motivo: 'capacidad' };
            return { ok: false, motivo: 'invalida' };
        }
        return { ok: true, token, id };
    }

    async buscarPorToken(token) {
        const tokenHash = await hashToken(this.secret, token);
        return this.first(
            'SELECT id, rol, estado, primer_uso_dia, ultima_renovacion FROM usuarios WHERE token_hash = ?',
            tokenHash
        );
    }

    // ---- Uso mensual / cuota ----
    async obtenerUso(usuarioId, periodo = periodoActual()) {
        const fila = await this.first(
            'SELECT tokens, solicitudes FROM uso_mensual WHERE usuario_id = ? AND periodo = ?',
            usuarioId, periodo
        );
        return fila || { tokens: 0, solicitudes: 0 };
    }

    async sumarUso(usuarioId, { tokens, solicitudes }, periodo = periodoActual()) {
        await this.run(
            `INSERT INTO uso_mensual (usuario_id, periodo, tokens, solicitudes)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(usuario_id, periodo) DO UPDATE SET
               tokens = tokens + excluded.tokens,
               solicitudes = solicitudes + excluded.solicitudes`,
            usuarioId, periodo, tokens, solicitudes
        );
        // Marca el día del uso (primera petición de cada día recibe prioridad).
        // Se fija de forma idempotente al día actual: así al día siguiente vuelve a
        // marcarse como primer uso sin depender de COALESCE (que no actualizaba la fecha).
        await this.run(
            'UPDATE usuarios SET primer_uso_dia = ? WHERE id = ?',
            diaActual(), usuarioId
        );
    }

        // Marca el día actual como día de uso del invitado (idempotente). Usado para
    // priorizar el primer uso diario; se fija al día actual sin depender de COALESCE.
    async marcarUsoHoy(usuarioId) {
        await this.run(
            'UPDATE usuarios SET primer_uso_dia = ? WHERE id = ?',
            diaActual(), usuarioId
        );
    }

    // ---- Reserva/reconciliación de la cuota mensual del invitado ----
    // Reserva atómicamente tokens del límite mensual (guarda: tokens + reserva <= INVITADO_POR_MES).
    // Devuelve true si la reserva cabe; false si la cuota se agotaría, evitando sobreconsumo
    // por concurrencia (la guarda se evalúa dentro de la propia sentencia SQL).
    async reservarUso(usuarioId, tokens, solicitudes = 1, periodo = periodoActual()) {
        const res = await this.run(
            `INSERT INTO uso_mensual (usuario_id, periodo, tokens, solicitudes)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(usuario_id, periodo) DO UPDATE SET
               tokens = tokens + excluded.tokens,
               solicitudes = solicitudes + excluded.solicitudes
             WHERE tokens + excluded.tokens <= ?`,
            usuarioId, periodo, tokens, solicitudes, CREDITOS.INVITADO_POR_MES
        );
        return res && res.meta && res.meta.changes === 1;
    }

    // Libera los tokens sobreservados tras conocer el uso real del proveedor.
    // tokens = MAX(0, tokens - ?): nunca negativo. Las solicitudes no se devuelven
    // (una solicitud cuenta aunque haya consumido menos tokens). Neto: reserva - lib = real.
    async reconciliarUso(usuarioId, tokensALiberar, periodo = periodoActual()) {
                await this.run(
            'UPDATE uso_mensual SET tokens = MAX(0, tokens - ?) WHERE usuario_id = ? AND periodo = ?',
            tokensALiberar, usuarioId, periodo
        );
    }

    // ---- Créditos (bolsa global / reserva propietario) ----
    // La bolsa y la reserva se reinician al inicio de cada período mensual (YYYY-MM)
    // SIN rollover de créditos no usados. El reset es atómico y concurrente-seguro.
    async obtenerCreditos() {
        await this.asegurarPeriodoCreditos();
        const fila = await this.first('SELECT bolsa_global, reserva_propietario FROM creditos WHERE id = 1');
        if (!fila) return { bolsa: CREDITOS.BOLSA_INICIAL, reserva: CREDITOS.RESERVA_PROPIETARIO_INICIAL };
        return { bolsa: Number(fila.bolsa_global), reserva: Number(fila.reserva_propietario) };
    }

    async asegurarPeriodoCreditos() {
        const periodo = periodoActual();
        // Reset solo si el periodo cambió. WHERE periodo <> ? evita doble reset y es
        // idempotente bajo concurrencia (una sola fila con id=1).
        const res = await this.run(
            'UPDATE creditos SET bolsa_global = ?, reserva_propietario = ?, periodo = ? WHERE id = 1 AND periodo <> ?',
            CREDITOS.BOLSA_INICIAL, CREDITOS.RESERVA_PROPIETARIO_INICIAL, periodo, periodo
        );
        if (res && res.meta && res.meta.changes === 1) return;
        // Si la fila aún no existe (primera ejecución), créala con el periodo actual.
        const existe = await this.first('SELECT id FROM creditos WHERE id = 1');
        if (!existe) {
            await this.run(
                'INSERT INTO creditos (id, bolsa_global, reserva_propietario, periodo) VALUES (1, ?, ?, ?)',
                CREDITOS.BOLSA_INICIAL, CREDITOS.RESERVA_PROPIETARIO_INICIAL, periodo
            );
        }
    }

    // Reserva atómicamente `cantidad` de la bolsa global (guarda: bolsa >= cantidad).
    // Previene doble gasto/sobreconsumo por concurrencia. Devuelve true si cupo.
    async reservarBolsa(cantidad) {
        const res = await this.run(
            'UPDATE creditos SET bolsa_global = bolsa_global - ? WHERE id = 1 AND bolsa_global >= ?',
            cantidad, cantidad
        );
        return res && res.meta && res.meta.changes === 1;
    }

    // Devuelve a la bolsa los tokens no usados (reconciliación tras conocer el uso real).
    async reconciliarBolsa(cantidad) {
        await this.run(
            'UPDATE creditos SET bolsa_global = bolsa_global + ? WHERE id = 1',
            cantidad
        );
    }

    // Consume `cantidad` de la bolsa con guarda (usado cuando el uso real supera la reserva).
    // Devuelve true si pudo descontarlo; false si la bolsa no alcanza.
    async consumirBolsa(cantidad) {
        const res = await this.run(
            'UPDATE creditos SET bolsa_global = bolsa_global - ? WHERE id = 1 AND bolsa_global >= ?',
            cantidad, cantidad
        );
        return res && res.meta && res.meta.changes === 1;
    }

    // Pone la bolsa a 0 (último recurso si el uso real excede la capacidad disponible).
    async agotarBolsa() {
        await this.run('UPDATE creditos SET bolsa_global = 0 WHERE id = 1');
    }

    async liberarReserva(operacionId, monto, anotacion = '') {
        // Idempotente: si la operación ya se ejecutó, no se vuelve a gastar.
        const existente = await this.first('SELECT operacion_id FROM liberaciones WHERE operacion_id = ?', operacionId);
        if (existente) return { repetida: true };
        // Mueve monto de reserva -> bolsa (guarda: reserva >= monto).
        const res = await this.run(
            'UPDATE creditos SET reserva_propietario = reserva_propietario - ?, bolsa_global = bolsa_global + ? WHERE id = 1 AND reserva_propietario >= ?',
            monto, monto, monto
        );
        if (!res || !res.meta || res.meta.changes !== 1) {
            throw E.parametrosInvalidos('La reserva no dispone de esa cantidad.');
        }
        await this.run(
            'INSERT INTO liberaciones (operacion_id, monto, anotacion, realizada_en) VALUES (?, ?, ?, ?)',
            operacionId, monto, anotacion, Date.now()
        );
        return { repetida: false };
    }

                // Hooks para tests (inyección de generación sin dependencias reales).
    generarCodigo() { return generarCodigoInvitacion(); }
    generarToken() { return generarTokenInstalacion(); }

}