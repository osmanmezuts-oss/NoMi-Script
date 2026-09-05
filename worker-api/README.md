# nomi-api Worker (Fase 1)

Worker Cloudflare **nuevo e independiente** para el futuro acceso compartido a IA:
`NoMi → nomi-api Worker → Groq`.

No reemplaza ni modifica el Worker de diagnósticos (`worker/`). No contiene secretos
en el repositorio; solo referencia nombres de secretos/bindings.

## Seguridad

- Secretos esperados por nombre (NO incluidos en el repo):
  - `GROQ_API_KEY`
  - `ADMIN_SECRET`
  - `ACCESS_TOKEN_SECRET`
  - `TAVILY_API_KEY` — **requerido solo para la búsqueda web NoMi**.
    Vive SOLO como secreto del Worker: nunca se
    expone en respuestas, nunca se acepta del cliente y NO sustituye a la clave
    Tavily local opcional de API Personal. Sin él, la búsqueda responde
    `fallo_proveedor` (con rollback de cupo); chat y clima no lo usan.
- Variable opcional (no secreta): `TAVILY_TIMEOUT_MS` — timeout en ms de la llamada
  a Tavily en la búsqueda NoMi. Default **10000** (10 s); vencido se trata como
  `fallo_proveedor`.
- Invitaciones de un solo uso: se guarda **solo el hash** (HMAC-SHA256 con `ACCESS_TOKEN_SECRET`).
- Activación: el usuario canjea la invitación y recibe un token opaco de instalación;
  se guarda **solo el hash** del token.
- No hay registro público abierto.
- **No se guardan** prompts, respuestas, URLs de navegación, historial ni conversaciones.
- El Worker no acepta del cliente proveedor, URL, API key ni modelo arbitrario.

## Datos y cuotas

- D1 (`NOMI_DB`) para usuarios, invitaciones, estado, cuota mensual y contadores.
- Suposición inicial: 10 invitados, cada uno **420000 créditos NoMi/mes**.
- Propietario: reserva privada inicial de **1800000 créditos**.
- `POST /admin/liberar` mueve créditos de la reserva a la bolsa global (idempotente, sin doble gasto).
- Los créditos son límites máximos sujetos a la disponibilidad real de Groq (no una promesa de capacidad).
- La renovación mensual es **configuración explícita** (periodo `YYYY-MM` UTC); no se asume el reset de Groq.

## Groq

- Allowlist inicial:
  - `openai/gpt-oss-120b` (activo, recomendado)
  - `openai/gpt-oss-20b` (activo, alternativa rápida)
- OpenRouter aparece en el catálogo como **experimental / no incluido** (sin ejecutar llamadas).
- Integración con la API de chat completions de Groq; solo se contabiliza el **usage real** del proveedor.
- Límites globales iniciales Groq: 200000 tokens/día, 8000 tokens/minuto, 1000 solicitudes/día.
- Protección de concurrencia global mediante **Durable Object** (`RateLimiterDO`); no se confía en contadores locales.
- Prioridad razonable al primer uso diario de un invitado (nunca supera límites reales del proveedor).
- Modos de capacidad: normal, compartida, limitada, reserva protegida.

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/v1/activate` | Canjear invitación, devuelve token opaco |
| GET | `/v1/catalog` | Catálogo de modelos (sin credenciales) |
| GET | `/v1/usage` | Uso/cuota del invitado autenticado |
| POST | `/v1/chat` | Chat vía Groq (modelo allowlist) con decisión semántica opcional de búsqueda web y clima |
| POST | `/admin/invitacion` | Crear invitación (requiere `ADMIN_SECRET`); acepta `etiqueta` opcional |
| GET | `/admin/invitaciones` | Listar invitaciones (estado, id, fechas, etiqueta, usuario vinculado) |
| POST | `/admin/revocar` | Revocar invitación por `id` (transaccional) |
| POST | `/admin/liberar` | Liberar reserva → bolsa (idempotente) |

Respuestas `cache-control: no-store` y CORS mínimo (`GET, POST, OPTIONS`).

### Gestión administrativa de invitaciones

Los endpoints `/admin/*` requieren `ADMIN_SECRET` (Bearer). No devuelven nunca
códigos, hashes ni tokens de instalación.

- **Etiqueta opcional:** `POST /admin/invitacion` acepta `etiqueta` (texto, máx. 64
  caracteres, `/^[\p{L}\p{N} _\-]+$/u`). Es solo una nota del administrador, sin secreto.
- **Listado:** `GET /admin/invitaciones` devuelve estado, `id`, fechas de creación/canje/revocación,
  `etiqueta` y el usuario vinculado (si existe). Ordenado por creación descendente.
- **Revocación (`POST /admin/revocar`, cuerpo `{ "id": "<id>" }`):** revoca la invitación
  de forma **transaccional** (`DB.batch`):
  - Invitación **pendiente** → queda `revocada` (el código ya no activa).
  - Invitación **canjeada** → queda `revocada` **y** revoca el usuario vinculado
    (`estado='revocado'`), por lo que su token de instalación deja de autenticar.
  - **Liberación de cupo:** el tope de 10 invitados cuenta únicamente usuarios invitados
    con `estado='activo'`; al revocar un invitado canjeado su cupo queda libre.
  - Se conserva el historial: no se borran invitaciones, usuarios ni hashes.
  - Idempotente a efectos: revocar una ya revocada devuelve `409 invitacion-ya-revocada`;
    un `id` inexistente devuelve `404`.

### Errores
 `acceso-invalido`, `invitacion-invalida`, `cuota-mensual-agotada`,
 `capacidad-temporal-limitada`, `modelo-no-permitido`, `proveedor-no-disponible`,
 `parametros-invalidos`, `consulta-busqueda-invalida`, `admin-no-autorizado`,
 `no-encontrado`, `invitacion-ya-revocada`.

## Herramientas de `/v1/chat`

El cliente actual ofrece herramientas al modelo para que decida por intención y
contexto, sin comandos ni palabras obligatorias. Las rutas directas con
`herramienta` se conservan solo para bundles anteriores. Cada proveedor externo
tiene un contador diario propio en D1 (atómico por usuario+día UTC, tope 20).

### Clima semántico — Groq + Open-Meteo
- El cliente envía `permitirClima`, un anclaje local estructurado
  (`fecha`, `hora`, zona IANA y offset) y fallbacks opcionales de ubicación.
- Groq recibe `consultar_clima` y decide por significado/contexto. Devuelve la
  fecha exacta `YYYY-MM-DD` y solo la ubicación explícita del usuario.
- Prioridad del Worker: ubicación explícita → habitual configurable → dispositivo;
  si ninguna existe, pregunta una vez sin consumir cupo climático.
- Open-Meteo recibe la fecha exacta mediante `start_date/end_date`. La respuesta
  determinista contiene conclusión, mañana (06–11), tarde (12–17), noche
  (18–23) y una recomendación práctica; una fecha futura nunca mezcla “ahora”.
- Estados (`climaEstado`): `ok` · `falta_ubicacion` · `ciudad_no_encontrada` ·
  `limite_diario` · `fallo_proveedor` · `consulta_invalida`.
- Un fallo del proveedor **revierte** el cupo diario; una ciudad no encontrada lo
  consume (la petición llegó al proveedor).
- Compatibilidad: `{ "tipo": "clima", "ubicacion": "...", "fecha": "YYYY-MM-DD" }`
  continúa disponible para bundles anteriores.

### Búsqueda web semántica — Groq + Tavily SOLO en el Worker
- El cliente actual envía chat normal con `permitirBusqueda: true|false`; nunca
  decide por palabras clave ni envía una consulta Tavily construida localmente.
- La lupa puede enviar además `forzarBusqueda: true`: el Worker obliga una única
  llamada a `busqueda_web`, incluso si la preferencia automática estaba apagada.
- Con `true`, la primera llamada Groq recibe `busqueda_web` (y también
  `consultar_clima` si esa preferencia está activa) y decide
  por significado/contexto si necesita datos actuales o verificables. Un
  seguimiento debe convertir referencias como “esas noticias” en una consulta
  autosuficiente con tema, lugar y periodo.
- Si el modelo no pide la herramienta, su respuesta vuelve directamente: una
  llamada Groq, cero Tavily. Si la pide, se acepta exactamente una llamada válida,
  se consulta Tavily y una segunda llamada Groq sintetiza la evidencia. La segunda
  no recibe tools, por lo que no existe bucle de búsquedas.
- Cada llamada Groq se reserva y reconcilia por separado en DO, cuota D1 y bolsa.
  Tavily mantiene su contador independiente de 20 búsquedas/día UTC.
- Respuesta sintetizada: `busquedaEstado: "ok"`, `respuesta` y hasta 3 `fuentes`
  compactas `{titulo, url, fecha}`. Los snippets internos (≤300 caracteres) no se
  devuelven al navegador y también se acotan por bytes UTF-8 para respetar el
  presupuesto Groq. URLs solo http/https y sin query/hash. Toda respuesta
  del protocolo nuevo incluye `busquedaProtocolo: 1`.
- Estados sin síntesis: `sin_resultados`, `limite_diario`, `fallo_proveedor`,
  `fallo_sintesis` o `consulta_invalida`. Los dos fallos temporales permiten
  reintento; `fallo_proveedor` revierte el cupo porque Tavily no respondió. En
  `fallo_sintesis`, Tavily sí respondió y la búsqueda consume cupo para impedir
  consultas externas ilimitadas mediante reintentos.
- Tavily recibe `topic` (`general|news|finance`) y, si corresponde, `time_range`
  (`day|week|month|year`) elegidos por el modelo y validados por el Worker.
- Requiere el secreto `TAVILY_API_KEY` (nunca claves del usuario).
- Compatibilidad con bundles anteriores: `herramienta: {tipo:"busqueda",
  consulta}` sigue disponible y devuelve los resultados saneados sin síntesis,
  conservando títulos ≤70 y snippets ≤110 para no volver verboso el HUD antiguo.

### Privacidad de las herramientas
- D1 guarda SOLO recuentos atómicos (`uso_clima_diario`, `uso_busqueda_diario`);
  nunca ubicaciones, consultas, snippets, resultados ni respuestas.
- No se loguean consultas ni resultados (`registrarEvidencia` no se invoca en estas rutas).
- Proveedores externos: Open-Meteo recibe la ubicación; Groq recibe el contexto
  conversacional y la evidencia saneada; Tavily recibe la consulta resuelta.

### Compatibilidad
- Worker nuevo + bundle anterior: la ruta directa `herramienta.tipo="busqueda"`
  sigue funcionando.
- Bundle nuevo + Worker anterior: si se habilitó o forzó búsqueda, el cliente
  detecta que falta `herramientasProtocolo: 1` y muestra que el servidor debe
  actualizarse; no presenta una respuesta no verificada como información actual.
  Por eso el Worker debe desplegarse primero.

## Pasos manuales de Cloudflare (orden recomendado)

Desplegar en este orden: **migrar D1 → secretos → Worker → bundle**. El bundle
nuevo con un Worker viejo conserva el chat, pero aún no puede buscar de forma
semántica.

1. Migrar D1 (idempotente; crea SOLO `uso_clima_diario` y `uso_busqueda_diario`,
   sin tocar tablas existentes):
   `npx wrangler d1 migrations apply nomi-api-db --remote`
   (las instalaciones nuevas pueden aplicar directamente `schema.sql`).
2. Crear/verificar secretos: `npx wrangler secret put GROQ_API_KEY` (idem para
   `ADMIN_SECRET`, `ACCESS_TOKEN_SECRET` y `TAVILY_API_KEY`). `TAVILY_API_KEY`
   solo se necesita para la búsqueda web NoMi.
3. Desplegar el Worker: `npx wrangler deploy` (desde `worker-api/`).
4. Solo después, distribuir el bundle generado (`NoMi Asistente V5.8.user.js`,
   versión 5.20), que ya incluye búsqueda y clima semánticos.

El Durable Object ya está declarado en `wrangler.toml` (`RATE_LIMITER`).

## Pruebas

```bash
node --test test/
```

No se requieren secretos ni llamadas reales a Groq, Tavily ni Open-Meteo: el
fetch global se simula en las pruebas (`test/stubs.js` + stubs por suite).

## Estados de capacidad

- `normal`: uso completo dentro de límites reales y bolsa global.
- `compartida`: prioridad al primer uso diario de un invitado.
- `limitada`: reduce `max_tokens` cuando la bolsa baja.
- `reserva-protegida`: no se toca la reserva del propietario salvo liberación explícita.
