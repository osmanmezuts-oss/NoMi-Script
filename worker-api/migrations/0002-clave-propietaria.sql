-- ============================================================
-- Migración incremental e IDEMPOTENTE: acceso propietario permanente.
-- Añade SOLO la tabla de claves de recuperación propietaria (guardando el hash
-- HMAC, nunca el valor). No borra ni altera tablas/columnas existentes; segura
-- de reaplicar (CREATE TABLE IF NOT EXISTS).
-- Aplicar con:
--   npx wrangler d1 migrations apply nomi-api-db --remote
-- (las instalaciones nuevas pueden usar directamente schema.sql completo)
-- ============================================================

-- Claves permanentes de recuperación del propietario. Alta entropía, generadas
-- SOLO por endpoint admin. Se guarda únicamente el hash HMAC (pepper
-- ACCESS_TOKEN_SECRET, prefijo 'propietario:'); NUNCA texto plano. No expiran ni
-- se consumen; solo se invalidan por rotación/revocación admin explícita.
CREATE TABLE IF NOT EXISTS claves_propietario (
    id TEXT PRIMARY KEY,             -- id opaca (no determinística)
    clave_hash TEXT NOT NULL UNIQUE,-- HMAC-SHA256('propietario:' + clave, ACCESS_TOKEN_SECRET)
    estado TEXT NOT NULL DEFAULT 'activa',  -- activa | revocada
    creada_en INTEGER NOT NULL,      -- epoch ms
    revocada_en INTEGER              -- epoch ms de la revocación (historial)
);