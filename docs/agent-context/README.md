# Protocolo de lectura para agentes (NoMi-Script)

Este directorio contiene el contexto estable para agentes. El estado operativo
vive en `AI_HANDOFF.md` (raíz); el detalle cerrado va en `historial/`.

## Reglas
1. Leer primero `AI_HANDOFF.md` (raíz). Es corto y siempre actual.
2. Leer solo el documento enlazado que aplique a la tarea (p. ej. `decisiones.md`
   para criterios estables, o `historial/` para trabajo ya cerrado).
3. No leer el historial por defecto. Solo cuando el handoff lo enlace o la tarea
   requiera contexto de una fase anterior.
4. No reconstruir contexto amplio ni leer todos los documentos de una vez.

## Al cerrar una fase
- Actualizar `AI_HANDOFF.md`: solo estado actual, arquitectura, restricciones,
  verificación, riesgo y próxima acción (máx. 35 líneas).
- Mover el detalle (logs, listas de archivos, resultados de pruebas) a
  `historial/YYYY-MM-DD-<tema>.md`, resumiendo y sin secretos ni identificadores
  sensibles.
- Reconciliar `Estado actual` y `Riesgos y próximo paso`: sustituir checkpoints
  superados, no dejar versiones antiguas como pendientes.

## Mapa
- `decisiones.md`: decisiones vigentes y estables.
- `historial/`: trabajo cerrado (Worker, D1, invitaciones, distribución).
