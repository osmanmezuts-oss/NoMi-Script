-- ============================================================
-- nomi-api Worker · Fase 1 · Esquema D1
-- Guarda SOLO: usuarios, invitaciones (hash), cuota/uso y contadores.
-- NUNCA guarda prompts, respuestas, URLs, historial ni conversaciones.
-- ============================================================

CREATE TABLE IF NOT EXISTS invitaciones (
    id TEXT PRIMARY KEY,             -- id opaca (no determinística)
    codigo_hash TEXT NOT NULL UNIQUE,-- HMAC-SHA256(codigo, ACCESS_TOKEN_SECRET)
    estado TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | canjeada | revocada
    etiqueta TEXT,                   -- etiqueta opcional del administrador (sin secreto)
    creada_en INTEGER NOT NULL,      -- epoch ms
    canjeada_en INTEGER,
    revocada_en INTEGER              -- epoch ms de la revocación (historial)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,             -- id opaco de instalación
    token_hash TEXT NOT NULL UNIQUE, -- HMAC-SHA256(token, ACCESS_TOKEN_SECRET)
    rol TEXT NOT NULL DEFAULT 'invitado',  -- invitado | propietario
    estado TEXT NOT NULL DEFAULT 'activo', -- activo | suspendido | revocado
    creado_en INTEGER NOT NULL,
    invitacion_id TEXT UNIQUE REFERENCES invitaciones(id), -- vínculo 1:1 con la invitación (activación única)
    primer_uso_dia TEXT,             -- 'YYYY-MM-DD' del primer uso del día (para prioridad)
    ultima_renovacion TEXT           -- periodo mensual 'YYYY-MM' ya contabilizado
);
-- Nota de migración: worker-api no está desplegado aún, por lo que basta añadir la
-- columna `invitacion_id` a la definición (SQLite no permite ADD COLUMN con UNIQUE en
-- tablas ya creadas). El UNIQUE garantiza a nivel de esquema que una invitación solo
-- activa un usuario.

CREATE TABLE IF NOT EXISTS uso_mensual (
    usuario_id TEXT NOT NULL,
    periodo TEXT NOT NULL,           -- 'YYYY-MM'
    tokens INTEGER NOT NULL DEFAULT 0,
    solicitudes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, periodo)
);

CREATE TABLE IF NOT EXISTS creditos (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    bolsa_global INTEGER NOT NULL DEFAULT 4200000,  -- créditos liberados disponibles (10 invitados x 420000)
    reserva_propietario INTEGER NOT NULL DEFAULT 1800000,
    periodo TEXT                                    -- 'YYYY-MM' ya contabilizado (reset mensual, sin rollover)
);

CREATE TABLE IF NOT EXISTS liberaciones (
    operacion_id TEXT PRIMARY KEY,   -- idempotencia: evita doble gasto
    monto INTEGER NOT NULL,
    anotacion TEXT,
    realizada_en INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);

-- Contador diario de clima (Fase 2). Separado de la cuota mensual y de la bolsa
-- global de Groq. Máximo 20 consultas por usuario y día UTC. NO guarda la ciudad
-- ni la respuesta (solo el recuento atómico por usuario+día).
CREATE TABLE IF NOT EXISTS uso_clima_diario (
    usuario_id TEXT NOT NULL,
    dia TEXT NOT NULL,                 -- 'YYYY-MM-DD' (UTC)
    solicitudes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, dia)
);

-- Contador diario de búsqueda web NoMi (Tavily SOLO en el Worker). Separado del
-- clima y de la cuota mensual/bolsa global de Groq. Máximo 20 búsquedas por
-- usuario y día UTC. NO guarda la consulta ni resultados (solo el recuento
-- atómico por usuario+día).
CREATE TABLE IF NOT EXISTS uso_busqueda_diario (
    usuario_id TEXT NOT NULL,
    dia TEXT NOT NULL,                 -- 'YYYY-MM-DD' (UTC)
    solicitudes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, dia)
);

-- Claves permanentes de recuperación del propietario (Fase 3). Alta entropía,
-- generadas SOLO por endpoint admin. Se guarda únicamente el hash HMAC (pepper
-- ACCESS_TOKEN_SECRET, prefijo 'propietario:'); NUNCA texto plano. No expiran ni
-- se consumen; solo se invalidan por rotación/revocación admin explícita.
CREATE TABLE IF NOT EXISTS claves_propietario (
    id TEXT PRIMARY KEY,             -- id opaca (no determinística)
    clave_hash TEXT NOT NULL UNIQUE,-- HMAC-SHA256('propietario:' + clave, ACCESS_TOKEN_SECRET)
    estado TEXT NOT NULL DEFAULT 'activa',  -- activa | revocada
    creada_en INTEGER NOT NULL,      -- epoch ms
    revocada_en INTEGER              -- epoch ms de la revocación (historial)
);