// Stubs para pruebas: D1 en memoria y storage para el Durable Object.
// Sin llamadas reales, sin secretos. Emula el subconjunto de SQL usado por src/db.js.

import { RateLimiterDO } from '../src/rate-limiter-do.js';

export function crearD1Stub() {
    const tablas = {
        invitaciones: [],
        usuarios: [],
        uso_mensual: [],
        creditos: [{ id: 1, bolsa_global: 0, reserva_propietario: 1800000, periodo: '' }],
        liberaciones: [],
    };

    function runSql(sql, p) {
        let i = 0;
        const val = () => p[i++];
        if (sql.includes('FORCE_FAIL')) throw new Error('fallo simulado de sentencia (stub)');
        if (/^INSERT INTO invitaciones/.test(sql)) {
            const id = val(); const codigo_hash = val(); const estado = val();
            // El código nuevo inserta (id, codigo_hash, estado, etiqueta, creada_en);
            // el SQL crudo de pruebas inserta (id, codigo_hash, estado, creada_en).
            let etiqueta = null; let creada_en;
            const resto = p.length - i;
            if (resto >= 2) { etiqueta = val(); creada_en = val(); }
            else { creada_en = val(); }
            tablas.invitaciones.push({ id, codigo_hash, estado, etiqueta: etiqueta ?? null, creada_en, revocada_en: null });
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE invitaciones SET estado\s*=\s*'revocada'/.test(sql)) {
            const revocadaEn = val(); const id = val();
            const fila = tablas.invitaciones.find(r => r.id === id && (r.estado === 'pendiente' || r.estado === 'canjeada'));
            if (!fila) return { meta: { changes: 0 } };
            fila.estado = 'revocada'; fila.revocada_en = revocadaEn;
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE invitaciones SET estado='canjeada'/.test(sql)) {
            const canjeadaEn = val();
            const codigoHash = val();
            const fila = tablas.invitaciones.find(r => r.codigo_hash === codigoHash && r.estado === 'pendiente');
            if (!fila) return { meta: { changes: 0 } };
            // En la transacción de activación, el canje exige que YA exista un usuario
            // vinculado a esta invitación (ES DECIR, el alta de la misma transacción
            // tuvo éxito). Emula `AND EXISTS (SELECT 1 FROM usuarios WHERE invitacion_id = ...)`.
            if (sql.includes('EXISTS (SELECT 1 FROM usuarios')) {
                const hayUsuario = tablas.usuarios.some(u => u.invitacion_id === fila.id);
                if (!hayUsuario) return { meta: { changes: 0 } };
            }
            fila.estado = 'canjeada'; fila.canjeada_en = canjeadaEn;
            return { meta: { changes: 1 } };
        }
        if (/^INSERT INTO usuarios/.test(sql)) {
            if (sql.includes('FROM invitaciones')) {
                // Alta transaccional (activación): SOLO si la invitación existe y está
                // 'pendiente' Y hay cupo. binds: id, token_hash, creado_en, codigo_hash, limite.
                const id = val(); const tokenHash = val(); const creadoEn = val(); const codigoHash = val(); const limite = val();
                const invitacion = tablas.invitaciones.find(r => r.codigo_hash === codigoHash && r.estado === 'pendiente');
                if (!invitacion) return { meta: { changes: 0 } };
                const n = tablas.usuarios.filter(r => r.rol === 'invitado' && r.estado === 'activo').length;
                if (n >= limite) return { meta: { changes: 0 } };
                tablas.usuarios.push({ id, token_hash: tokenHash, rol: 'invitado', estado: 'activo', creado_en: creadoEn, invitacion_id: invitacion.id });
                return { meta: { changes: 1 } };
            }
            tablas.usuarios.push({ id: val(), token_hash: val(), rol: val(), estado: val(), creado_en: val() });
            return { meta: { changes: 1 } };
        }
        if (/^DELETE FROM usuarios/.test(sql)) {
            const id = val();
            const i = tablas.usuarios.findIndex(r => r.id === id);
            if (i >= 0) { tablas.usuarios.splice(i, 1); return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
        }
                if (sql.includes('WHERE tokens + excluded.tokens <= ?')) {
            // Reserva con guarda de cuota (reservarUso): binds uid, periodo, tokens, solicitudes, quota
            const usuarioId = val(); const periodo = val(); const tokens = val(); const solicitudes = val(); const quota = val();
            const fila = tablas.uso_mensual.find(r => r.usuario_id === usuarioId && r.periodo === periodo);
            if (fila) {
                if (fila.tokens + tokens > quota) return { meta: { changes: 0 } };
                fila.tokens += tokens; fila.solicitudes += solicitudes;
                return { meta: { changes: 1 } };
            }
            tablas.uso_mensual.push({ usuario_id: usuarioId, periodo, tokens, solicitudes });
            return { meta: { changes: 1 } };
        }
        if (/^INSERT INTO uso_mensual/.test(sql)) {
            const usuarioId = val(); const periodo = val(); const tokens = val(); const solicitudes = val();
            const fila = tablas.uso_mensual.find(r => r.usuario_id === usuarioId && r.periodo === periodo);
            if (fila) { fila.tokens += tokens; fila.solicitudes += solicitudes; }
            else tablas.uso_mensual.push({ usuario_id: usuarioId, periodo, tokens, solicitudes });
            return { meta: { changes: 1 } };
        }
        if (sql.includes('SET tokens = MAX(0, tokens - ?)')) {
            // reconciliarUso: libera tokens sobreservados (clamp 0). binds: liberar, uid, periodo
            const aLiberar = val(); const uid = val(); const periodo = val();
            const fila = tablas.uso_mensual.find(r => r.usuario_id === uid && r.periodo === periodo);
            if (fila) { fila.tokens = Math.max(0, fila.tokens - aLiberar); return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
        }
        if (/^UPDATE usuarios SET estado\s*=\s*'revocado'/.test(sql)) {
            const invId = val();
            const fila = tablas.usuarios.find(r => r.invitacion_id === invId && r.estado === 'activo');
            if (!fila) return { meta: { changes: 0 } };
            fila.estado = 'revocado';
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE usuarios SET primer_uso_dia/.test(sql)) {
            const dia = val(); const id = val();
            const fila = tablas.usuarios.find(r => r.id === id);
            if (fila) { fila.primer_uso_dia = dia; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
        }
        if (/^INSERT INTO creditos/.test(sql)) {
            // El SQL real usa id literal `1`: VALUES (1, ?, ?, ?) -> binds: bolsa, reserva, periodo.
            const bolsa = val(); const reserva = val(); const periodo = val();
            tablas.creditos = [{ id: 1, bolsa_global: bolsa, reserva_propietario: reserva, periodo }];
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE creditos SET bolsa_global = \?, reserva_propietario = \?, periodo = \?/.test(sql)) {
            const bolsa = val(); const reserva = val(); const periodo = val(); const actual = val();
            const c = tablas.creditos[0];
            if (c && c.periodo !== actual) {
                c.bolsa_global = bolsa; c.reserva_propietario = reserva; c.periodo = periodo;
                return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
        }
        if (/^UPDATE creditos SET bolsa_global = bolsa_global - \?/.test(sql)) {
            const cantidad = val();
            const c = tablas.creditos[0];
            if (c.bolsa_global >= cantidad) { c.bolsa_global -= cantidad; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
        }
        if (/^UPDATE creditos SET bolsa_global = bolsa_global \+ \?/.test(sql)) {
            const cantidad = val();
            const c = tablas.creditos[0];
            c.bolsa_global += cantidad;
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE creditos SET bolsa_global = 0/.test(sql)) {
            const c = tablas.creditos[0];
            c.bolsa_global = 0;
            return { meta: { changes: 1 } };
        }
        if (/^UPDATE creditos SET reserva_propietario = reserva_propietario - \?/.test(sql)) {
            const monto = val();
            const c = tablas.creditos[0];
            if (c.reserva_propietario >= monto) {
                c.reserva_propietario -= monto; c.bolsa_global += monto;
                return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
        }
        if (/^INSERT INTO liberaciones/.test(sql)) {
            tablas.liberaciones.push({ operacion_id: val(), monto: val(), anotacion: val(), realizada_en: val() });
            return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
    }

    function firstSql(sql, p) {
        let i = 0;
        const val = () => p[i++];
        if (/^SELECT estado FROM invitaciones WHERE id/.test(sql)) {
            const idv = val();
            const fila = tablas.invitaciones.find(r => r.id === idv);
            return fila ? { estado: fila.estado } : null;
        }
        if (/^SELECT id, estado, codigo_hash FROM invitaciones/.test(sql)) {
            const idv = val();
            const fila = tablas.invitaciones.find(r => r.id === idv);
            return fila ? { id: fila.id, estado: fila.estado, codigo_hash: fila.codigo_hash } : null;
        }
        if (/^SELECT id FROM invitaciones/.test(sql)) {
            const codigoHash = val();
            const fila = tablas.invitaciones.find(r => r.codigo_hash === codigoHash);
            return fila ? { id: fila.id } : null;
        }
        if (/^SELECT estado FROM invitaciones/.test(sql)) {
            const codigoHash = val();
            const fila = tablas.invitaciones.find(r => r.codigo_hash === codigoHash);
            return fila ? { estado: fila.estado } : null;
        }
        if (/^SELECT id FROM creditos/.test(sql)) {
            const c = tablas.creditos[0];
            return c ? { id: c.id } : null;
        }
        if (/^SELECT id, rol, estado, primer_uso_dia, ultima_renovacion FROM usuarios/.test(sql)) {
            const tokenHash = val();
            const fila = tablas.usuarios.find(r => r.token_hash === tokenHash);
            if (!fila) return null;
            return { id: fila.id, rol: fila.rol, estado: fila.estado, primer_uso_dia: fila.primer_uso_dia || null, ultima_renovacion: fila.ultima_renovacion || null };
        }
        if (/^SELECT tokens, solicitudes FROM uso_mensual/.test(sql)) {
            const usuarioId = val(); const periodo = val();
            const fila = tablas.uso_mensual.find(r => r.usuario_id === usuarioId && r.periodo === periodo);
            return fila ? { tokens: fila.tokens, solicitudes: fila.solicitudes } : null;
        }
        if (/^SELECT bolsa_global, reserva_propietario FROM creditos/.test(sql)) {
            const c = tablas.creditos[0];
            return c ? { bolsa_global: c.bolsa_global, reserva_propietario: c.reserva_propietario } : null;
        }
        if (/^SELECT operacion_id FROM liberaciones/.test(sql)) {
            const operacionId = val();
            const fila = tablas.liberaciones.find(r => r.operacion_id === operacionId);
            return fila ? { operacion_id: fila.operacion_id } : null;
        }
        return null;
    }

    function allSql(sql, p) {
        if (/LEFT JOIN usuarios u/.test(sql)) {
            const filas = tablas.invitaciones.map(i => {
                const u = tablas.usuarios.find(x => x.invitacion_id === i.id) || null;
                return {
                    id: i.id,
                    estado: i.estado,
                    creada_en: i.creada_en ?? null,
                    canjeada_en: i.canjeada_en ?? null,
                    revocada_en: i.revocada_en ?? null,
                    etiqueta: i.etiqueta ?? null,
                    usuario_id: u ? u.id : null,
                    usuario_rol: u ? u.rol : null,
                    usuario_estado: u ? u.estado : null,
                    usuario_creado_en: u ? u.creado_en : null,
                };
            });
            filas.sort((a, b) => (b.creada_en || 0) - (a.creada_en || 0));
            return { results: filas };
        }
        return { results: [] };
    }

    const api = {
        prepare(sql) {
            let bound = [];
            const bind = (...params) => { bound = params; return stmt; };
            const stmt = {
                bind,
                run: () => runSql(sql, bound),
                first: () => firstSql(sql, bound),
                all: () => allSql(sql, bound),
            };
            return stmt;
        },
        batch(statements) {
            // Emula la transacción D1 atómica (DB.batch): aplica TODAS las sentencias
            // o NINGUNA. Si una sentencia falla, restaura el estado previo.
            const snapshot = structuredClone(tablas);
            const resultados = [];
            try {
                for (const st of statements) {
                    resultados.push(st.run ? st.run() : st.first());
                }
            } catch (err) {
                for (const clave of Object.keys(tablas)) tablas[clave] = snapshot[clave];
                throw err;
            }
            return resultados;
        },
        _tablas: tablas,
    };
    return api;
}

// Storage en memoria para el Durable Object.
export function crearStorageMemoria() {
    const mapa = new Map();
    return {
        get: async (k) => mapa.get(k),
        put: async (k, v) => { mapa.set(k, v); },
        delete: async (k) => { mapa.delete(k); },
    };
}

// Crea un stub del Durable Object (clase real con storage en memoria).
export function crearDoStub() {
    const obj = new RateLimiterDO({ storage: crearStorageMemoria() }, {});
    return { idFromName: () => 'global', get: () => ({ fetch: (url, init) => obj.fetch(new Request(url, init)) }) };
}

// Env simulado (secretos falsos SOLO para pruebas; nunca reales).
export function crearEnv({ db, doBinding, admin = 'admin-test', groq = 'groq-test' } = {}) {
    return {
        NOMI_DB: db || crearD1Stub(),
        ACCESS_TOKEN_SECRET: 'secret-test',
        ADMIN_SECRET: admin,
        GROQ_API_KEY: groq,
        RATE_LIMITER: doBinding || crearDoStub(),
    };
}
