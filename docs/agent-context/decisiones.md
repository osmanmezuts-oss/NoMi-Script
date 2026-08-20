# Decisiones vigentes y estables — NoMi-Script

Decisiones que no cambian sin autorización. Para contexto de fase, ver el
historial en `historial/`.

## Servidor (Worker Cloudflare, Fase 1)
- Worker Cloudflare desplegado en `workers.dev`; secretos configurados en el
  despliegue y endpoints protegidos por auth. El cliente nunca llama a Groq ni
  conoce sus claves.
- Persistencia en D1 con activación transaccional (`DB.batch`): alta de usuario
  + canje de invitación en una transacción atómica (all-or-nothing). D1 remota
  validó concurrencia 9+2→10 (exactamente 10); el rollback ante fallo de
  sentencia sigue cubierto por stub.
- Invitaciones: tope de 10 invitados; un código inválido no crea usuario ni
  consume cupo; la reserva diaria de capacidad se identifica por `reservaId`.

## Cliente (userscript)
- Endpoint del Worker FIJO en `workers.dev`; nunca se usa una URL de usuario.
- Solo se persisten URL pública + token opaco de instalación. NUNCA se leen ni
  guardan `GROQ_API_KEY`, `ADMIN_SECRET` ni `ACCESS_TOKEN_SECRET`.
- `401` del Worker → marca el token como inactivo/revocado (NO lo borra) y no hay
  fallback a OpenRouter desde el modo `nomi`. `cerrar acceso` borra solo el token
  local.
- Catálogo `/v1/catalog` es público; el chat `/v1/chat` usa Bearer.

## Distribución
- `NoMi Asistente V5.8.user.js` es un bundle generado; no se edita manualmente.
- Se genera con `python3 tools/build-userscript.py` desde `modules/` + `build/`
  en orden `build/modules-order.txt`; `VERSION_SCRIPT` define la `@version`.
- Sin `@require`; `@updateURL`/`@downloadURL` en `main`.

## Modos
- OpenRouter es el modo predeterminado e independiente; debe quedar intacto.
- NoMi es un modo explícito activado por el usuario.

## Roles de agentes
- Codex: auditor/analista/consultor; implementa solo con solicitud explícita.
- Kilo y Cline: implementadores; registran checkpoints breves en `AI_HANDOFF.md`.
