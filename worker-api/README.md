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
  - `TAVILY_API_KEY` — **requerido solo para la herramienta de búsqueda web NoMi**
    (`herramienta.tipo = 'busqueda'`). Vive SOLO como secreto del Worker: nunca se
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
| POST | `/v1/chat` | Chat vía Groq (modelo allowlist) **o herramientas sin Groq**: `clima` (Open-Meteo) y `busqueda` (Tavily en el Worker) |
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

## Herramientas de `/v1/chat` (sin Groq)

Si el cuerpo incluye `herramienta`, la petición NO pasa por Groq y NO consume
cuota mensual, bolsa global ni el RateLimiterDO. Cada herramienta tiene un
contador diario propio en D1 (atómico por usuario+día UTC, tope 20) y una señal
explícita de resultado: el cliente NUNCA infiere el desenlace del texto humano.

### Clima — Open-Meteo (`herramienta.tipo = "clima"`)
- Cuerpo: `{ "tipo": "clima", "ubicacion": "<2–120 chars tras trim>" }`.
- Geocoding + forecast actual de Open-Meteo; respuesta breve en español.
- Estados (`climaEstado`): `ok` · `ciudad_no_encontrada` · `fallo_proveedor`.
- Un fallo del proveedor **revierte** el cupo diario; una ciudad no encontrada lo
  consume (la petición llegó al proveedor).

### Búsqueda web — Tavily SOLO en el Worker (`herramienta.tipo = "busqueda"`)
- Cuerpo: `{ "tipo": "busqueda", "consulta": "<2–300 chars, ≤600 bytes UTF-8>" }`;
  excede → 400 `consulta-busqueda-invalida`.
- Requiere el secreto `TAVILY_API_KEY` (nunca claves del usuario).
- Estados (`busquedaEstado`): `ok` (+ `resultados`: máx. 3 `{titulo, url,
  contenido}`, URLs solo http/https **sin query ni hash**) · `sin_resultados` ·
  `limite_diario` · `fallo_proveedor` (5xx/red/401/403/429/**timeout 10 s**).
- Un fallo del proveedor **revierte** el cupo diario; `sin_resultados` lo consume.

### Privacidad de las herramientas
- D1 guarda SOLO recuentos atómicos (`uso_clima_diario`, `uso_busqueda_diario`);
  nunca ubicaciones, consultas, snippets, resultados ni respuestas.
- No se loguean consultas ni resultados (`registrarEvidencia` no se invoca en estas rutas).
- Proveedores externos: Open-Meteo recibe la ubicación; Tavily recibe la consulta.
  Esto se comunica al usuario en la respuesta del cliente.

### Compatibilidad
- Cliente nuevo + Worker antiguo: el Worker rechaza herramientas desconocidas con
  400 `parametros-invalidos`; el cliente muestra “actualización del servidor” sin
  crash ni fallback a API Personal.

## Pasos manuales de Cloudflare (orden recomendado)

Desplegar en este orden: **migrar D1 → secretos → Worker → bundle**. El cliente
nuevo con un Worker viejo degrada con un mensaje claro (“actualización del
servidor”), pero las herramientas clima/búsqueda requieren este Worker.

1. Migrar D1 (idempotente; crea SOLO `uso_clima_diario` y `uso_busqueda_diario`,
   sin tocar tablas existentes):
   `npx wrangler d1 migrations apply nomi-api-db --remote`
   (las instalaciones nuevas pueden aplicar directamente `schema.sql`).
2. Crear/verificar secretos: `npx wrangler secret put GROQ_API_KEY` (idem para
   `ADMIN_SECRET`, `ACCESS_TOKEN_SECRET` y `TAVILY_API_KEY`). `TAVILY_API_KEY`
   solo se necesita para la búsqueda web NoMi.
3. Desplegar el Worker: `npx wrangler deploy` (desde `worker-api/`).
4. Solo después, distribuir el bundle generado (`NoMi Asistente V5.8.user.js`,
   versión 5.17), que ya incluye las herramientas y su detección.

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
