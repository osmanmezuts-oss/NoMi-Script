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
    capacidadTemporal: () => new ApiError('capacidad-temporal-limitada', 'Capacidad temporalmente limitada. Inténtalo más tarde.', 503),
    modeloNoPermitido: () => new ApiError('modelo-no-permitido', 'Modelo no permitido.', 403),
    proveedorNoDisponible: () => new ApiError('proveedor-no-disponible', 'El proveedor no está disponible ahora.', 502),
    noEncontrado: () => new ApiError('no-encontrado', 'Recurso no encontrado.', 404),
    metodoInvalido: () => new ApiError('metodo-invalido', 'Método no permitido.', 405),
    adminNoAutorizado: () => new ApiError('admin-no-autorizado', 'Administración no autorizada.', 401),
    invitacionYaRevocada: () => new ApiError('invitacion-ya-revocada', 'La invitación ya está revocada.', 409),
    parametrosInvalidos: (detalle) => new ApiError('parametros-invalidos', detalle || 'Parámetros inválidos.', 400),
    noCacheError: () => new ApiError('sin-cache', 'Operación sin caché requerida.', 400),
};
