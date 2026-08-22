-- ============================================================
-- Migración incremental e IDEMPOTENTE para bases D1 ya creadas con el
-- esquema de Fase 1: añade SOLO los contadores diarios de clima y búsqueda
-- web NoMi. No borra ni altera ninguna tabla/columna existente; segura de
-- reaplicar (CREATE TABLE IF NOT EXISTS).
-- Aplicar con:
--   npx wrangler d1 migrations apply nomi-api-db --remote
-- (las instalaciones nuevas pueden usar directamente schema.sql completo)
-- ============================================================

CREATE TABLE IF NOT EXISTS uso_clima_diario (
    usuario_id TEXT NOT NULL,
    dia TEXT NOT NULL,                 -- 'YYYY-MM-DD' (UTC)
    solicitudes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, dia)
);

CREATE TABLE IF NOT EXISTS uso_busqueda_diario (
    usuario_id TEXT NOT NULL,
    dia TEXT NOT NULL,                 -- 'YYYY-MM-DD' (UTC)
    solicitudes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, dia)
);
