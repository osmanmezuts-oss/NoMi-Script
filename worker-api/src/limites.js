// Configuración de cuotas y límites (Fase 1). Todo explícito y configurable vía D1 `configuracion`.

// Reloj inyectable para pruebas deterministas (por defecto usa la hora real).
let _ahora = () => new Date();
export function setReloj(fn) {
    if (typeof fn !== 'function') throw new Error('setReloj requiere una función');
    _ahora = fn;
}
export function relojAhora() {
    return _ahora();
}

export const CREDITOS = {
    // 10 invitados x 420000 créditos/mes = 4.200.000 en la bolsa global inicial.
    INVITADO_POR_MES: 420000,
    INVITADOS_INICIALES: 10,
    BOLSA_INICIAL: 4200000,
    // Reserva privada inicial del propietario (por período). Se libera a la bolsa bajo demanda.
    RESERVA_PROPIETARIO_INICIAL: 1800000,
};

// Límites globales Groq (máximos reales del proveedor, nunca se superan).
export const LIMITES_GROQ = {
    tokens_por_dia: 200000,
    tokens_por_minuto: 8000,
    solicitudes_por_dia: 1000,
};

// Capacidad diaria real de Groq. El Durable Object es la única fuente de verdad
// concurrente para estos contadores diarios. Desglose de los 200000 tokens/día:
//  - 20000 de margen de seguridad: nunca asignables automáticamente.
//  - 50000 de reserva proteg. de primer uso diario (hasta 5000 por invitado).
//  - 130000 de bolsa compartida diaria (para quien ya usó NoMi hoy).
// Usable por día = RESERVA_PROTEGIDA + BOLSA_COMPARTIDA = 180000 (el margen queda libre).
export const CAPACIDAD_DIARIA = {
    TOTAL_GROQ: 200000,
    MARGEN_SEGURIDAD: 20000,         // nunca asignable automáticamente
    RESERVA_PROTEGIDA: 50000,        // reserva protegida de primer uso diario
    BOLSA_COMPARTIDA: 130000,        // bolsa compartida diaria
    POR_USUARIO_PROTEGIDA: 5000,     // reserva máxima por invitado (primer uso)
    MAX_INVITADOS: 10,
};

// Salida máxima por llamada y margen de seguridad (tokens de sistema, etc.).
const MAX_SALIDA_TOKENS = 1024;
const MARGEN_TOKEN = 256;
const TOKENS_POR_BYTE_ENTRADA = 1; // peor caso verificable: 1 token por byte de entrada

// Reserva de tokens antes de llamar a Groq. El cuerpo HTTP se limita antes de parsear
// y el mensaje se limita por BYTES UTF-8. La reserva usa un peor caso VERIFICABLE:
// 1 token por byte de entrada (un token ocupa al menos 1 byte), de modo que el
// "máximo posible" es comprobable y jamás se oculta un exceso con Math.min; si no
// cabe bajo tokens_por_minuto del proveedor, se rechaza ANTES de llamar a Groq.
export const RESERVA = {
    MAX_CUERPO_BYTES: 1 << 20,    // tope del cuerpo HTTP (1 MiB) antes de parsear
    // Tope de entrada en bytes UTF-8, DERIVADO para que (entrada + salida máxima +
    // margen) SIEMPRE quepa bajo tokens_por_minuto (8000). Verificación con valores
    // actuales: 6720*1 + 1024 + 256 = 8000 <= 8000. No es un valor a mano: si cambian
    // los límites de salida/margen o del proveedor, se recalcula solo y nunca permite
    // exceder tokens/minuto.
    MAX_ENTRADA_BYTES: Math.max(0, LIMITES_GROQ.tokens_por_minuto - MAX_SALIDA_TOKENS - MARGEN_TOKEN),
    TOKENS_POR_BYTE_ENTRADA,
    MARGEN_TOKEN,
    MAX_SALIDA_TOKENS,
};

// Renovación mensual: se define como configuración explícita (no se asume reset de Groq).
export const RENOVACION = {
    tipo: 'mensual',       // 'mensual' (extensible a 'manual' o 'personalizada')
    zona: 'UTC',
    // El periodo se deriva de la fecha actual; el reset del proveedor es independiente.
    // Semántica del período actual: la bolsa y la reserva del propietario se reinician
    // al inicio de cada período mensual (YYYY-MM) SIN rollover de créditos no usados.
};

export function periodoActual() {
    const iso = _ahora().toISOString(); // UTC
    return iso.slice(0, 7);              // 'YYYY-MM'
}

export function diaActual() {
    return _ahora().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
