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
const VERSION_SCRIPT = '5.14';
const FECHA_LANZAMIENTO = '21/06/2026';

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
const STORAGE_ERROR_LOGS = 'nomi_error_logs';
const STORAGE_CREDENCIALES_CARGADAS = 'nomi_credenciales_cargadas';
const STORAGE_CONFIG_INICIAL = 'nomi_config_inicial';
const STORAGE_MOTOR_BUSQUEDA = 'nomi_motor_busqueda';
const STORAGE_DIAGNOSTICO_ACTIVO = 'nomi_diagnostico_activo';
const STORAGE_INSTALACION_ID = 'nomi_instalacion_id';
const STORAGE_DIAGNOSTICO_AVISO = 'nomi_diagnostico_aviso_visto';

// Endpoint del Worker de diagnóstico (envío de errores anónimo y mínimo).
const DIAGNOSTICS_URL = 'https://nomi-diagnostics.osmanmezuts.workers.dev/v1/diagnostics';
