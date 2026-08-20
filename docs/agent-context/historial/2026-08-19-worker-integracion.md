# Historial cerrado — 2026-08-19 — Worker, D1, invitaciones y distribución

Resumen de fases cerradas. Sin logs, secretos ni identificadores sensibles.
Estado operativo actual en `AI_HANDOFF.md` (raíz).

## 1) Distribución 5.15 (userscript bundle) — CERRADA/PUBLICADA
- Migración a bundle único generado (sin `@require`). `VERSION_SCRIPT` define la
  versión del userscript.
- Generador `tools/build-userscript.py` (Python 3, sin dependencias): obtiene
  versión desde config y concatena módulos en orden `build/modules-order.txt`.
- Endurecimiento: rechaza `@require` en cabecera/salida, exige un marcador
  `__NOMI_VERSION__`, rechaza bootstrap vacío y escribe el bundle de forma
  atómica (archivo temporal + `os.replace`).
- Validado: generación, `--check`, `git diff --check`, pruebas negativas.

## 2) worker-api Fase 1 — Worker Cloudflare / D1 / invitaciones — CERRADA (Worker desplegado, endpoints auth, auditoría superada)
Implementado, validado por pruebas (56/56, stub) y desplegado: secretos
configurados en el despliegue y endpoints protegidos por auth. Detalle:
- **Cuotas/límites:** límite conservador verificable en sustitución de `bytes/3`
  (peor caso 1 token por byte; se rechaza toda petición que no quepa bajo
  `tokens_por_minuto` antes de llamar a Groq). Lector streaming con límite real
  de bytes (1 MiB) vía Content-Length; ya no se usa `request.json()` directo.
- **Capacidad diaria Groq:** Durable Object `RateLimiterDO` como única fuente
  atómica de contadores diarios (200000 tokens/día: margen 20000, reserva
  protegida de primer uso 50000, bolsa compartida 130000; máx. 10 invitados,
  5000/usuario). `decidirModo` deriva el modo del uso real de la bolsa compartida.
- **Activación transaccional D1 (`DB.batch`):** alta de usuario + canje de
  invitación en una transacción; `usuarios.invitacion_id UNIQUE` (vínculo 1:1).
  Sin cupo → invitación queda pendiente y reutilizable; código inválido → no
  crea usuario ni consume cupo. `handlerActivacion` mapea capacidad→503 / inválida→400.
- **CSPRNG:** `generarReservaId` usa `crypto.getRandomValues` (sin `Math.random`)
  y aplica límite `solicitudes_por_dia = 1000` en `/reservar`.
- **Rollbacks:** `handlerChat` libera reserva del DO y reconcilia cuota/bolsa en
  fallo de Groq; ambos casos probados.
- **Validación remota (D1 de prueba):** 12 invitaciones creadas; activación
  secuencial 10×201 + 11.ª/12.ª→503; concurrencia 9+2→exactamente 10
  (1 éxito + 1 rechazo, invitación sin cupo pendiente); negativas 400
  (inválido/canjeado) y 503 (cupo lleno); 0 usuarios huérfanos, 0 duplicados
  de `invitacion_id`.
- **Riesgos:** el rollback de `DB.batch` ante fallo de sentencia no es
  ejercitable vía HTTP y sigue cubierto solo por stub.

## 3) Cliente "Acceso compartido NoMi" (v5.16) — implementado y APROBADO en auditoría Codex (pendiente prueba manual real)
- Modo `nomi` explícito conmutado en `preguntar`/`procesarBusqueda`/`generarResumen`;
  OpenRouter intacto. UI de activación por código en ⚙️ Configuración.
- Módulos: `nomi-config-estatica.js` (constantes/modo/URL/token), `nomi-state.js`,
  `nomi-persistencia.js`, `nomi-acceso-nomi.js` (activar/obtenerCatalogo/llamarIA/
  cerrar/estado + `NoMiTokenInvalidoError`), `nomi-red.js` (adjunta `err.status`),
  `nomi-core.js` (ramas de modo), `nomi-menu-config.js` (sección de activación).
- `build/`: `@connect` al endpoint fijo, inserción de `nomi-acceso-nomi.js` en el
  orden, bootstrap carga estado de acceso.
- Validado: `node modules/test/run-nomi-acceso.cjs` (20/20), build + `--check`,
  `git diff --check`, `node --check`.
- Riesgos: pendiente únicamente la prueba manual real contra el Worker desplegado
  (activación con código válido y una consulta) y la validación de UI en VM/TM.
