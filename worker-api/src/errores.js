// Errores tipados del API. Cada uno lleva un código estable y un HTTP status.
// Los mensajes NO exponen detalles internos ni secretos.

export class ApiError extends Error {
    constructor(code, message, status) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
    }
}

export const E = {
    accesoInvalido: () => new ApiError('acceso-invalido', 'Acceso inválido. Revisa tu token de instalación.', 401),
    invitacionInvalida: () => new ApiError('invitacion-invalida', 'Invitación inválida o ya utilizada.', 400),
    cuotaAgotada: () => new ApiError('cuota-mensual-agotada', 'Tu cuota mensual está agotada.', 429),
    // Causas de capacidad diferenciadas con código estable (nunca un 503 ambiguo):
    // - limite-por-minuto: límite de tokens por minuto (TPM) del proveedor.
    // - capacidad-diaria:  capacidad diaria real (tokens/solicitudes por día o bolsa diaria).
    // - bolsa-agotada:     bolsa compartida mensual global sin créditos.
    //   capacidadTemporal() se conserva solo para la activación (tope de invitados).
    limitePorMinuto: () => new ApiError('limite-por-minuto', 'Espera un minuto y reintenta.', 503),
    // Límite REAL devuelto por el proveedor (HTTP 429 de Groq: puede ser TPM,
    // RPM, TPD o RPD). NO es un proveedor no disponible (502), ni un límite
    // preventivo del DO (limite-por-minuto), que se aplica ANTES de llamar a Groq).
    limiteProveedor: () => new ApiError('limite-proveedor', 'NoMi alcanzó temporalmente un límite del proveedor. Espera y reintenta.', 429),
    capacidadDiaria: () => new ApiError('capacidad-diaria', 'La capacidad diaria de NoMi está agotada. Reintenta mañana.', 503),
    bolsaAgotada: () => new ApiError('bolsa-agotada', 'La bolsa compartida de NoMi está agotada por ahora. Reintenta más tarde.', 503),
    capacidadTemporal: () => new ApiError('capacidad-temporal-limitada', 'Capacidad temporalmente limitada. Inténtalo más tarde.', 503),
    modeloNoPermitido: () => new ApiError('modelo-no-permitido', 'Modelo no permitido.', 403),
    proveedorNoDisponible: () => new ApiError('proveedor-no-disponible', 'El proveedor no está disponible ahora.', 502),
    noEncontrado: () => new ApiError('no-encontrado', 'Recurso no encontrado.', 404),
    metodoInvalido: () => new ApiError('metodo-invalido', 'Método no permitido.', 405),
    adminNoAutorizado: () => new ApiError('admin-no-autorizado', 'Administración no autorizada.', 401),
    invitacionYaRevocada: () => new ApiError('invitacion-ya-revocada', 'La invitación ya está revocada.', 409),
    clavePropietariaInvalida: () => new ApiError('clave-propietaria-invalida', 'Clave de recuperación propietaria inválida o inactiva.', 400),
    clavePropietariaNoActiva: () => new ApiError('clave-propietaria-no-activa', 'No hay ninguna clave propietaria activa.', 400),
    parametrosInvalidos: (detalle) => new ApiError('parametros-invalidos', detalle || 'Parámetros inválidos.', 400),
    noCacheError: () => new ApiError('sin-cache', 'Operación sin caché requerida.', 400),
};
