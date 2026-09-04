// ======== MÓDULO: Acceso compartido NoMi (Worker) ========
// NoMi Assistant – Integración con el Worker de Cloudflare (modo explícito).
//
// Seguridad:
//   - El endpoint del Worker es FIJO (NOMI_WORKER_URL_POR_DEFECTO). Nunca se
//     usa una URL controlada por el usuario para hacer peticiones.
//   - SOLO se guardan la URL pública por defecto y el token opaco de instalación.
//   - NUNCA se incluyen ni leen las claves secretas del Worker (API key de Groq,
//     secreto de administración ni secreto de firma de tokens).
//   - El token se envía como Bearer solo en POST /v1/chat. GET /v1/catalog es
//     público y NO lleva Authorization.
//   - Ante 401 se indica token inválido/revocado y NO se hace fallback a OpenRouter.
//
// Compatibilidad: reutiliza hacerPeticion (GM_xmlhttpRequest + fetch) para
// funcionar en Violentmonkey y Tampermonkey sin dependencias extra.

// Error específico de token inválido/revocado del Worker.
class NoMiTokenInvalidoError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NoMiTokenInvalidoError';
    }
}

// Devuelve SIEMPRE la URL fija del Worker. No se usa ninguna URL de usuario.
function nomiWorkerBase() {
    return NOMI_WORKER_URL_POR_DEFECTO;
}

// Resetea cualquier URL persistida distinta a la oficial (seguridad: evita
// que un valor antiguamente editable quede activo).
function resetearUrlWorkerNoMi() {
    if (getNomiWorkerUrl() !== NOMI_WORKER_URL_POR_DEFECTO) {
        setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO);
    }
}

// Indica si el modo NoMi puede usarse ahora (modo activo, token y acceso vigente).
function puedeUsarAccesoNoMi() {
    return NoMiState.modoAcceso === MODO_ACCESO_NOMI
        && !!NoMiState.nomiToken
        && NoMiState.nomiAccesoActivo === true;
}

// Estado legible del acceso compartido NoMi.
function estadoAccesoNoMi() {
    if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI) return 'desactivado';
    if (!NoMiState.nomiToken) return 'pendiente';
    return NoMiState.nomiAccesoActivo ? 'activo' : 'revocado';
}

// Longitud en bytes UTF-8 de una cadena.
function byteLengthUTF8(s) {
    return new TextEncoder().encode(s).length;
}

// Recorta una cadena para que ocupe como máximo maxBytes bytes UTF-8,
// sin cortar en medio de un carácter multibyte.
function recortarUTF8Seguro(s, maxBytes) {
    if (maxBytes <= 0) return '';
    const bytes = new TextEncoder().encode(s);
    if (bytes.length <= maxBytes) return s;
    let end = maxBytes;
    while (end > 0 && (bytes[end] & 0xC0) === 0x80) end--; // retrocede bytes de continuación
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, end));
}

// Construye el mensaje único para /v1/chat preservando continuidad y respetando
// siempre <=6000 bytes UTF-8 (contando persona, contexto, resumen, historial y
// TODOS los separadores, incluido el previo al historial).
//
// Estrategia de recorte (el bloque final "Pregunta del usuario" se preserva):
//   1) Se separa la pregunta final del contexto (fecha/ubicación/contenido de página).
//   2) Se RESERVA espacio para el bloque final de pregunta (con su separador).
//      Si la pregunta por sí sola supera el límite, se recorta UTF-8 de forma
//      segura e se indica claramente.
//   3) El contexto (fecha/ubicación/página) se recorta ANTES que la pregunta.
//   4) Resumen e historial solo se añaden si caben en el presupuesto restante.
// No altera el contrato del Worker.
function construirMensajeWorkerNoMi(promptActual) {
    const separador = '\n\n';
    const maxBytes = 6000;
    const persona = NOMI_PERSONA_SISTEMA;
    const indicadorRecorte = '[pregunta recortada por límite de tamaño]';

    // Separar la pregunta final del contexto (fecha/ubicación/contenido de página).
    let contexto = String(promptActual || '');
    let pregunta = contexto;
    const idx = contexto.lastIndexOf('Pregunta del usuario:');
    if (idx !== -1) {
        pregunta = contexto.slice(idx);
        contexto = contexto.slice(0, idx);
    }

    // Reservar el bloque final de pregunta; si solo él excede, recortarlo UTF-8
    // seguro e indicarlo claramente (el indicador también se reserva, sin separador extra).
    let cola = pregunta;
    if (byteLengthUTF8(persona + separador + cola) > maxBytes) {
        const disponible = maxBytes - byteLengthUTF8(persona + separador) - byteLengthUTF8(indicadorRecorte) - 1;
        cola = recortarUTF8Seguro(pregunta, disponible) + indicadorRecorte;
    }

    // Presupuesto para la cabecera (persona + contexto + resumen + historial),
    // reservando el separador y bloque final de pregunta.
    let headBudget = maxBytes - byteLengthUTF8(persona) - byteLengthUTF8(separador + cola);
    let head = persona;

    // 1) Contexto (fecha/ubicación/página) — se recorta ANTES que la pregunta.
    if (headBudget > 0 && contexto.trim().length > 0) {
        const bloque = separador + contexto.trim();
        if (byteLengthUTF8(bloque) <= headBudget) {
            head += bloque;
            headBudget -= byteLengthUTF8(bloque);
        } else if (headBudget > byteLengthUTF8(separador) + 1) {
            head += separador + recortarUTF8Seguro(contexto.trim(), headBudget - byteLengthUTF8(separador) - 1);
            headBudget = 0;
        }
    }

    // 2) Resumen (si cabe en el presupuesto restante).
    if (headBudget > 0 && NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10 && NoMiState.resumenPersistente) {
        const head2 = separador + 'Resumen de la conversación anterior:\n';
        const bloque = head2 + NoMiState.resumenPersistente;
        if (byteLengthUTF8(bloque) <= headBudget) {
            head += bloque;
            headBudget -= byteLengthUTF8(bloque);
        } else if (headBudget > byteLengthUTF8(head2) + 1) {
            head += head2 + recortarUTF8Seguro(NoMiState.resumenPersistente, headBudget - byteLengthUTF8(head2) - 1);
            headBudget = 0;
        }
    }

    // 3) Historial reciente (del más reciente al más antiguo) mientras quepa.
    if (headBudget > 0) {
        const limite = Math.min(NoMiState.contextoSeleccionado, CONTEXTO_RECIENTE);
        const recientes = NoMiState.historial
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .slice(-limite);
        const secciones = [];
        for (let i = recientes.length - 1; i >= 0; i--) {
            const rol = recientes[i].role === 'user' ? 'Usuario' : 'Asistente';
            const sec = (secciones.length === 0 ? 'Historial reciente (del más reciente al más antiguo):\n' : '') + rol + ': ' + recientes[i].content;
            // El separador inicial (\n\n) antes de "Historial reciente..." se descuenta
            // aquí para que el presupuesto coincida exactamente con lo concatenado.
            const bloque = (secciones.length ? '\n' : separador) + sec;
            if (byteLengthUTF8(bloque) > headBudget) break;
            secciones.push(sec);
            headBudget -= byteLengthUTF8(bloque);
        }
        if (secciones.length) {
            head += separador + secciones.slice().reverse().join('\n');
        }
    }

    return head + separador + cola;
}

// Construye el prompt de resumen para /v1/chat: instrucción compacta + historial
// recortado para respetar <=6000 bytes UTF-8. Conserva la instrucción.
function construirMensajeResumenNoMi(historialCompleto) {
    const separador = '\n\n';
    const maxBytes = 6000;
    const instruccion = 'Eres un asistente que resume conversaciones. Genera un resumen COMPACTO (máximo 300 palabras) de toda la conversación. Incluye temas principales y decisiones. Responde SOLO con el resumen.';
    const texto = (historialCompleto || [])
        .map(m => (m.role === 'user' ? 'Usuario' : 'Asistente') + ': ' + (m.content || ''))
        .join('\n');
    const head = instruccion + separador + 'Resume esta conversación:\n';
    let prompt = head + texto;
    if (byteLengthUTF8(prompt) > maxBytes) {
        prompt = head + recortarUTF8Seguro(texto, maxBytes - byteLengthUTF8(head) - 1);
    }
    return prompt;
}

// Activa el acceso: canjea el código de invitación y guarda el token opaco.
// Devuelve el token en éxito; lanza Error descriptivo en fallo (sin guardar token).
async function activarAccesoNoMi(codigo) {
    resetearUrlWorkerNoMi();
    const base = nomiWorkerBase();
    const cuerpo = JSON.stringify({ codigo: String(codigo || '').trim().toUpperCase() });
    let datos;
    try {
        datos = await hacerPeticion(base + '/v1/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: cuerpo
        });
    } catch (err) {
        throw new Error(mapearErrorActivacion(err));
    }
    if (!datos || !datos.token) {
        throw new Error('El servidor NoMi no devolvió un token de instalación.');
    }
    setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO);
    setNomiToken(datos.token);
    setNomiAccesoActivo(true);
    // Intenta obtener el catálogo para fijar un modelo groq activo por defecto.
    try {
        const cat = await obtenerCatalogoNoMi();
        const m = (cat && cat.modelos || []).find(x => x && x.proveedor === 'groq' && x.estado === 'activo');
        if (m && m.id) setNomiModelo(m.id);
    } catch (_) { /* el catálogo es opcional para la activación */ }
    return datos.token;
}

// Convierte errores HTTP de activación en mensajes claros para el usuario.
function mapearErrorActivacion(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 400) return 'Código de invitación inválido o ya usado.';
    if (status === 503) return 'Capacidad de NoMi temporalmente llena. Intenta de nuevo más tarde.';
    if (status === 401) return 'No autorizado por el servidor NoMi.';
    return (err && err.message) ? err.message : 'No se pudo activar el acceso NoMi.';
}

// Recupera el acceso PROPIETARIO permanente con su clave de recuperación.
// Llamada a /v1/recuperar-propietario. Si no existe propietario, lo crea; si ya
// existe, rota su token (el anterior queda inválido). La clave NO se consume ni
// se persiste en el navegador: SOLO se guarda el token opaco devuelto.
async function recuperarAccesoPropietario(clave) {
    resetearUrlWorkerNoMi();
    const base = nomiWorkerBase();
    let datos;
    try {
        datos = await hacerPeticion(base + '/v1/recuperar-propietario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clave: String(clave || '').trim() })
        });
    } catch (err) {
        throw new Error(mapearErrorRecuperacionPropietario(err));
    }
    if (!datos || !datos.token) {
        throw new Error('El servidor NoMi no devolvió un token de instalación.');
    }
    // NUNCA se persiste la clave; solo el token opaco de instalación.
    setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO);
    setNomiToken(datos.token);
    setNomiAccesoActivo(true);
    try {
        const cat = await obtenerCatalogoNoMi();
        const m = (cat && cat.modelos || []).find(x => x && x.proveedor === 'groq' && x.estado === 'activo');
        if (m && m.id) setNomiModelo(m.id);
    } catch (_) { /* el catálogo es opcional para la recuperación */ }
    return datos.token;
}

// Convierte errores HTTP de recuperación propietaria en mensajes claros.
function mapearErrorRecuperacionPropietario(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 400) return 'La clave propietaria es inválida o ya no está activa.';
    if (status === 401) return 'No autorizado por el servidor NoMi.';
    return (err && err.message) ? err.message : 'No se pudo recuperar el acceso propietario NoMi.';
}

// Obtiene el catálogo PÚBLICO de modelos del Worker (sin Authorization).
async function obtenerCatalogoNoMi() {
    const base = nomiWorkerBase();
    return await hacerPeticion(base + '/v1/catalog', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
}

// Detecta de forma robusta un 401 del Worker (status, mensaje o error tipado).
function esError401NoMi(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    return status === 401
        || (err instanceof NoMiTokenInvalidoError)
        || !!(err && err.message && /401/.test(err.message));
}

// Llama al chat del Worker. Devuelve el texto de la respuesta.
// `herramienta` (opcional) permite rutas especiales del Worker (p. ej. clima) sin
// pasar por Groq. Ante 401 marca el acceso como revocado y lanza
// NoMiTokenInvalidoError (sin fallback).
async function llamarIANoMi(mensaje, maxTokens, herramienta) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(mensaje || '')
    };
    if (herramienta && typeof herramienta === 'object') cuerpo.herramienta = herramienta;
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken
            },
            body: JSON.stringify(cuerpo)
        });
        if (datos && typeof datos.respuesta === 'string') return datos.respuesta;
        throw new Error((datos && datos.error && datos.error.message) || 'Respuesta inesperada del Worker NoMi.');
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        throw err;
    }
}

// Estados explícitos que la ruta de clima del Worker reporta en `climaEstado`.
const ESTADOS_CLIMA_NO_MI = ['ok', 'ciudad_no_encontrada', 'limite_diario', 'fallo_proveedor'];

// Llama a la ruta de clima del Worker y devuelve { texto, estado } con estado
// ∈ ok | ciudad_no_encontrada | limite_diario | fallo_proveedor. La señal es
// explícita: el cliente NUNCA infiere el resultado del texto humano. Con un
// Worker anterior sin `climaEstado` se asume 'ok' (compatibilidad hacia atrás).
// Errores HTTP/red idénticos a llamarIANoMi (401 → NoMiTokenInvalidoError, sin
// fallback); NO altera llamarIANoMi ni el chat normal.
async function llamarClimaNoMi(texto, ubicacion) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(texto || ''),
        herramienta: { tipo: 'clima', ubicacion: String(ubicacion || '') },
    };
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken,
            },
            body: JSON.stringify(cuerpo),
        });
        if (datos && typeof datos.respuesta === 'string') {
            const estado = ESTADOS_CLIMA_NO_MI.indexOf(datos.climaEstado) >= 0 ? datos.climaEstado : 'ok';
            return { texto: datos.respuesta, estado };
        }
        throw new Error((datos && datos.error && datos.error.message) || 'Respuesta inesperada del Worker NoMi.');
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        throw err;
    }
}

// Estados explícitos que la ruta de búsqueda del Worker reporta en `busquedaEstado`.
const ESTADOS_BUSQUEDA_NO_MI = ['ok', 'sin_resultados', 'limite_diario', 'fallo_proveedor'];

// Mensaje claro cuando el Worker desplegado aún no conoce la herramienta
// 'busqueda' (rechazo 400 parametros-invalidos) o responde sin la señal esperada.
// SIN fallback a API Personal y SIN usar claves locales; solo informa.
function respuestaActualizacionRequerida() {
    return {
        estado: 'actualizacion_requerida',
        texto: 'Tu acceso NoMi necesita una actualización del servidor para usar la búsqueda web. Avisa al administrador para actualizar el Worker.',
    };
}

// Validación local de la consulta, IDÉNTICA a la del Worker: si falla aquí,
// ni siquiera se llama al Worker (y un 400 remoto jamás será por esto).
function consultaBusquedaValidaLocal(consulta) {
    const c = String(consulta || '').trim();
    if (c.length < 2 || c.length > 300) return false;
    return new TextEncoder().encode(c).length <= 600;
}

// Extrae `error` del cuerpo JSON que hacerPeticion adjunta en err.message
// ("Error <status>: <cuerpo JSON>"). Parsing ESTRUCTURADO defensivo: si no hay
// JSON válido devuelve null (el caller aplica su caso genérico). Nunca se
// interpreta texto humano libre para decidir estados.
function extraerCodigoErrorCuerpo(err) {
    try {
        const m = err && typeof err.message === 'string' ? err.message.match(/^\s*Error\s+\d+:\s*([\s\S]+)$/) : null;
        if (!m) return null;
        const datos = JSON.parse(m[1]);
        return datos && typeof datos.error === 'string' ? datos.error : null;
    } catch {
        return null;
    }
}

// Llama a la ruta de búsqueda del Worker y devuelve:
//   { estado: 'ok', resultados: [{ titulo, url, contenido }] }  (máx. 3)
//   { estado, texto } con estado ∈ sin_resultados | limite_diario |
//                         fallo_proveedor | consulta_invalida |
//                         actualizacion_requerida.
// La señal es explícita (`busquedaEstado`): NUNCA se infiere del texto humano.
// Un HTTP 400 se distingue por CÓDIGO estable del cuerpo JSON:
//   - 'consulta-busqueda-invalida' -> Worker ACTUAL rechazando la consulta
//     (defensa; la validación local ya debería evitarlo) -> mensaje humano de
//     validación, sin reintento ni falso aviso de actualización.
//   - cualquier otro / sin JSON    -> Worker ANTIGUO que no conoce la
//     herramienta -> actualización requerida.
// Errores HTTP/red idénticos a llamarIANoMi (401 → NoMiTokenInvalidoError, sin
// fallback). NO altera llamarIANoMi ni el chat normal ni API Personal.
async function llamarBusquedaNoMi(consulta) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    // P1-2: validación local antes de red. Con la consulta ya validada, un 400
    // remoto SOLO puede venir de un Worker que no conoce la herramienta.
    if (!consultaBusquedaValidaLocal(consulta)) {
        return { estado: 'consulta_invalida', texto: 'Esa búsqueda no es válida. Indica qué buscar entre 2 y 300 caracteres.' };
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(consulta),
        herramienta: { tipo: 'busqueda', consulta: String(consulta) },
    };
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken,
            },
            body: JSON.stringify(cuerpo),
        });
        const estadoBruto = datos ? datos.busquedaEstado : undefined;
        if (ESTADOS_BUSQUEDA_NO_MI.indexOf(estadoBruto) >= 0) {
            if (estadoBruto === 'ok' && Array.isArray(datos.resultados)) {
                return { estado: 'ok', resultados: datos.resultados };
            }
            if (estadoBruto !== 'ok' && typeof datos.respuesta === 'string') {
                return { estado: estadoBruto, texto: datos.respuesta };
            }
        }
        // 200 sin señal conocida: Worker antiguo/inesperado -> actualización requerida.
        return respuestaActualizacionRequerida();
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        // P1-2: distinguir 400 por código estable del cuerpo JSON.
        const status = err && typeof err.status === 'number' ? err.status : null;
        if (status === 400) {
            if (extraerCodigoErrorCuerpo(err) === 'consulta-busqueda-invalida') {
                return { estado: 'consulta_invalida', texto: 'Esa búsqueda no es válida. Indica qué buscar entre 2 y 300 caracteres.' };
            }
            return respuestaActualizacionRequerida();
        }
        throw err;
    }
}

// Cierra el acceso compartido NoMi en ESTE NAVEGADOR: borra el token local.
// NO revoca el token en el servidor (eso lo hace el administrador).
function cerrarAccesoNoMi() {
    setNomiToken('');
    setNomiAccesoActivo(false);
    mostrarNotificacionTemporal('🔌 Acceso compartido NoMi cerrado en este navegador (el token sigue activo en el servidor hasta que un administrador lo revoque).');
}
