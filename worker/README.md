# nomi-diagnostics (Cloudflare Worker)

Worker de telemetría de errores **anónima y mínima** para NoMi. Reemplaza el
"Hello World" del Worker `nomi-diagnostics`.

## Endpoint
- `POST https://nomi-diagnostics.osmanmezuts.workers.dev/v1/diagnostics`

## Requisitos de despliegue
1. Crear el KV namespace y poner su `id` en `wrangler.toml`.
2. Crear el secreto del webhook de Slack:
   ```bash
   wrangler secret put SLACK_WEBHOOK_URL
   ```
3. Desplegar:
   ```bash
   wrangler deploy
   ```

## Comportamiento
- **Envío inmediato a Slack** del reporte saneado.
- **Límite**: 10 reportes por instalación cada 10 minutos (KV con TTL 600 s, clave `rl:*`).
- **Deduplicación**: 5 minutos (KV con TTL 300 s, clave `dd:*`, huella SHA-256).
- **No almacena** reportes ni contenido: en KV sólo hay contadores y huellas con expiración.
- **Filtrado fuerte** (ver `src/sanitize.js`): redacta claves, tokens, cookies,
  webhooks, JWT y URLs con parámetros; las URLs se reducen a `origin + pathname`.

## Privacidad
- El cliente de NoMi nunca envía: claves API, archivos `.enc`, contenido del chat,
  ubicación exacta ni la URL completa. (El Worker aplica una segunda capa de
  saneado "defense in depth").
- Repuestas con `cache-control: no-store`.

## Pruebas
```bash
node --test test/
```