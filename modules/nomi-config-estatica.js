// ======== MÓDULO: Configuración Estática ========
// NoMi Assistant – Constantes de configuración y claves de almacenamiento

const NOMBRE_ASISTENTE = 'NoMi';
const DISEÑADOR = 'Gartos';
const MODELO_POR_DEFECTO = 'openai/gpt-oss-20b:free';
const URL_BASE_POR_DEFECTO = 'https://openrouter.ai/api/v1';
const DIAS_HISTORIAL = 7;
const LIMITE_TEXTO_NORMAL = 2000;
const LIMITE_TEXTO_LIGERO = 500;
const MENSAJES_VISIBLES = 50;
const CONTEXTOS_DISPONIBLES = [10, 20, 30];
const DOMINIOS_UNIFICADOS = ['youtube.com', 'reddit.com', 'wikipedia.org'];
const MIN_WIDTH = 280;
const MAX_WIDTH_PERCENT = 0.3;
const MIN_HEIGHT = 300;
const MAX_HEIGHT_PERCENT = 0.55;
const ANCHO_POR_DEFECTO = 320;
const ALTO_POR_DEFECTO = 400;
const UBICACION_EXPIRACION = 3 * 60 * 60 * 1000;
const CONTEXTO_RECIENTE = 10;
const DIAS_LIMITE_HISTORIAL = 7;
const VERSION_SCRIPT = '5.19';
const FECHA_LANZAMIENTO = '19/08/2026';

const STORAGE_VALIDADO = 'nomi_validado';
const STORAGE_API_KEY = 'nomi_api_key';
const STORAGE_TAVILY_KEY = 'nomi_tavily_key';
const STORAGE_MODELO = 'nomi_modelo';
const STORAGE_URL = 'nomi_url';
const STORAGE_POSICION = 'nomi_posicion';
const STORAGE_POSICION_VENTANA = 'nomi_posicion_ventana';
const STORAGE_RESUMEN = 'nomi_resumen';
const STORAGE_TOKENS = 'nomi_tokens';
const STORAGE_CONTADOR = 'nomi_contador';
const STORAGE_CONTEXTO = 'nomi_contexto';
const STORAGE_MODO_LIGERO = 'nomi_modo_ligero';
const STORAGE_MODO_RESUMEN = 'nomi_modo_resumen';
const STORAGE_BUSQUEDA_WEB = 'nomi_busqueda_web';
const STORAGE_TAMANO_VENTANA = 'nomi_tamano_ventana';
const STORAGE_UBICACION = 'nomi_ubicacion';
const STORAGE_UBICACION_ACTIVADA = 'nomi_ubicacion_activada';
const STORAGE_CLIMA_AUTOMATICO = 'nomi_clima_automatico';
const STORAGE_BUSQUEDA_WEB_NOMI = 'nomi_busqueda_web_nomi';
const STORAGE_ERROR_LOGS = 'nomi_error_logs';
const STORAGE_CREDENCIALES_CARGADAS = 'nomi_credenciales_cargadas';
const STORAGE_CONFIG_INICIAL = 'nomi_config_inicial';
const STORAGE_MOTOR_BUSQUEDA = 'nomi_motor_busqueda';
const STORAGE_DIAGNOSTICO_ACTIVO = 'nomi_diagnostico_activo';
const STORAGE_INSTALACION_ID = 'nomi_instalacion_id';
const STORAGE_DIAGNOSTICO_AVISO = 'nomi_diagnostico_aviso_visto';

// Endpoint del Worker de diagnóstico (envío de errores anónimo y mínimo).
const DIAGNOSTICS_URL = 'https://nomi-diagnostics.osmanmezuts.workers.dev/v1/diagnostics';

// ===== Acceso compartido NoMi (Worker de Cloudflare) =====
// Modo de acceso explícito que usa el Worker en lugar de OpenRouter/Tavily directo.
// SOLO se guardan la URL pública del Worker y el token opaco de instalación.
// NUNCA se incluyen ni leen GROQ_API_KEY, ADMIN_SECRET ni ACCESS_TOKEN_SECRET.
const MODO_ACCESO_OPENROUTER = 'openrouter';
const MODO_ACCESO_NOMI = 'nomi';
const MODO_ACCESO_POR_DEFECTO = MODO_ACCESO_OPENROUTER;
const NOMI_WORKER_URL_POR_DEFECTO = 'https://nomi-api-worker.osmanmezuts.workers.dev';
const NOMI_MODELO_POR_DEFECTO = 'openai/gpt-oss-20b';
// Etiquetas legibles del proveedor activo para el indicador superior.
const PROVEEDOR_NOMI_LABEL = 'NoMi Worker / Groq';
const PROVEEDOR_OPENROUTER_LABEL = 'OpenRouter';
// "API Personal" es la capa OpenAI-compatible que puede apuntar a OpenRouter
// u otro proveedor (DeepSeek, Groq, Mistral, Together, etc.). El catálogo de
// modelos gratuitos y los headers HTTP-Referer/X-Title solo aplican a OpenRouter.
// Detección segura por hostname real: solo openrouter.ai y sus subdominios
// (*.openrouter.ai). Dominios falsos (openrouter.ai.evil.com, evil.com/.../openrouter.ai)
// o URLs inválidas devuelven false (fallback seguro vía try/catch).
function esOpenRouter(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
        const host = new URL(url).hostname;
        return host === 'openrouter.ai' || host.endsWith('.openrouter.ai');
    } catch (e) {
        return false;
    }
}
// Construye los headers del Chat Personal (OpenAI-compatible). Los headers
// HTTP-Referer y X-Title se envían SOLO a OpenRouter; en otra URL no se envían.
function construirHeadersPersonal(apiKey, urlBase) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (apiKey || '')
    };
    if (esOpenRouter(urlBase)) {
        headers['HTTP-Referer'] = (typeof window !== 'undefined' && window.location && window.location.href) || '';
        headers['X-Title'] = 'NoMi Asistente';
    }
    return headers;
}
const NOMI_PERSONA_SISTEMA = 'Eres NoMi, una asistente virtual profesional, formal y cercana. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. Estás diseñada para ofrecer respuestas útiles, concisas y bien estructuradas. Refiérete a ti misma siempre en femenino (por ejemplo: "soy una asistente virtual", "estoy diseñada").';

const STORAGE_MODO_ACCESO = 'nomi_modo_acceso';
const STORAGE_NOMI_WORKER_URL = 'nomi_worker_url';
const STORAGE_NOMI_TOKEN = 'nomi_token';
const STORAGE_NOMI_MODELO = 'nomi_modelo_nomi';
const STORAGE_NOMI_ACCESO_ACTIVO = 'nomi_acceso_activo';
