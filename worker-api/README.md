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
| POST | `/v1/chat` | Chat vía Groq (modelo allowlist) |
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
 `parametros-invalidos`, `admin-no-autorizado`, `no-encontrado`, `invitacion-ya-revocada`.

## Pasos manuales de Cloudflare (Fase 1)

1. Crear el Worker: `npx wrangler deploy` (desde `worker-api/`).
2. Crear D1: `npx wrangler d1 create nomi-api-db` y pegar el `database_id` en `wrangler.toml`.
3. Aplicar esquema: `npx wrangler d1 execute nomi-api-db --file=schema.sql`.
4. Crear secretos: `npx wrangler secret put GROQ_API_KEY` (idem para `ADMIN_SECRET` y `ACCESS_TOKEN_SECRET`).
5. El Durable Object se declara en `wrangler.toml` (`RATE_LIMITER`).

## Pruebas

```bash
node --test test/
```

No se requieren secretos ni llamadas reales a Groq (fetch se simula en las pruebas).

## Estados de capacidad

- `normal`: uso completo dentro de límites reales y bolsa global.
- `compartida`: prioridad al primer uso diario de un invitado.
- `limitada`: reduce `max_tokens` cuando la bolsa baja.
- `reserva-protegida`: no se toca la reserva del propietario salvo liberación explícita.
