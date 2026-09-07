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
// Compatibilidad: reutiliza hacerPeticion (GM.xmlHttpRequest/GM_xmlhttpRequest
// + fetch) para funcionar en Userscripts, Violentmonkey y Tampermonkey.

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
function construirMensajeWorkerNoMi(promptActual, maxBytesPermitidos) {
    const separador = '\n\n';
    const maxBytes = Number(maxBytesPermitidos) > 0 ? Number(maxBytesPermitidos) : 6000;
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

    // 3) Historial reciente: se priorizan los turnos más nuevos, pero se envían
    // en orden cronológico para que referencias como "esas noticias" conserven
    // correctamente su antecedente. La cabecera aparece una sola vez.
    if (headBudget > 0) {
        const limite = Math.min(NoMiState.contextoSeleccionado, CONTEXTO_RECIENTE);
        const recientes = NoMiState.historial
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .slice(-limite);
        const lineas = [];
        const cabecera = 'Historial reciente:\n';
        for (let i = recientes.length - 1; i >= 0; i--) {
            const rol = recientes[i].role === 'user' ? 'Usuario' : 'Asistente';
            const candidata = rol + ': ' + recientes[i].content;
            const candidatas = [candidata, ...lineas];
            const bloque = separador + cabecera + candidatas.join('\n');
            if (byteLengthUTF8(bloque) > headBudget) break;
            lineas.unshift(candidata);
        }
        if (lineas.length) {
            const bloque = separador + cabecera + lineas.join('\n');
            head += bloque;
            headBudget -= byteLengthUTF8(bloque);
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

// Aplica un catálogo recién obtenido tras activar o recuperar NoMi. Centralizarlo
// evita que el asistente inicial y el menú queden con avisos de otro modo/modelo.
function sincronizarCatalogoTrasAccesoNoMi(catalogo) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('nomi_modelo_verificado');
    if (typeof limpiarAvisoModelo === 'function') limpiarAvisoModelo();
    if (!catalogo) return false;

    const activo = (catalogo.modelos || []).find(x => x && x.proveedor === 'groq' && x.estado === 'activo');
    if (activo && activo.id) setNomiModelo(activo.id);
    const modelo = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    const disponible = typeof modeloActivoEnCatalogoNoMi === 'function'
        && modeloActivoEnCatalogoNoMi(modelo, catalogo);
    if (disponible) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('nomi_modelo_verificado', 'true');
        return true;
    }
    if (typeof mostrarAvisoModeloNoDisponibleNoMi === 'function') mostrarAvisoModeloNoDisponibleNoMi();
    return false;
}

// Activa el acceso: canjea el código de invitación y guarda el token opaco.
// Devuelve { token, catalogo } en éxito; lanza Error descriptivo en fallo (sin guardar token).
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
    await Promise.all([
        setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO),
        setNomiToken(datos.token),
        setNomiAccesoActivo(true),
    ]);
    // Sincroniza catálogo real del Worker ANTES de validar/mostrar el modelo.
    // Devuelve el catálogo (o null si falla temporalmente) para que el llamador
    // pueda mostrar "Verificando acceso..." y manejar el error de forma recuperable.
    let catalogo = null;
    try {
        catalogo = await obtenerCatalogoNoMi();
        sincronizarCatalogoTrasAccesoNoMi(catalogo);
    } catch (_) {
        // Catálogo opcional para la activación: conservamos token y acceso activo.
        // El llamador decidirá cómo mostrar el estado transitorio.
        catalogo = null;
    }
    // Aunque el catálogo falle, se elimina cualquier aviso heredado de Personal;
    // el acceso ya es válido y podrá reintentarse la comprobación después.
    if (!catalogo) sincronizarCatalogoTrasAccesoNoMi(null);
    // Espera también la selección de modelo que pudo producir la sincronización.
    await esperarPersistenciaGlobal();
    return { token: datos.token, catalogo };
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
    await Promise.all([
        setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO),
        setNomiToken(datos.token),
        setNomiAccesoActivo(true),
    ]);
    let catalogo = null;
    try {
        catalogo = await obtenerCatalogoNoMi();
        sincronizarCatalogoTrasAccesoNoMi(catalogo);
    } catch (_) {
        sincronizarCatalogoTrasAccesoNoMi(null);
    }
    await esperarPersistenciaGlobal();
    return { token: datos.token, catalogo };
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

// Petición común al chat del Worker. Las preferencias solo habilitan que Groq
// decida semánticamente si necesita una herramienta del servidor; no envían
// claves ni activan ningún flujo de API Personal.
async function solicitarChatNoMi(mensaje, opciones) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    const opts = opciones && typeof opciones === 'object' ? opciones : {};
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(mensaje || '')
    };
    if (opts.herramienta && typeof opts.herramienta === 'object') cuerpo.herramienta = opts.herramienta;
    if (typeof opts.permitirBusqueda === 'boolean') cuerpo.permitirBusqueda = opts.permitirBusqueda;
    if (typeof opts.permitirClima === 'boolean') cuerpo.permitirClima = opts.permitirClima;
    if (opts.forzarBusqueda === true) cuerpo.forzarBusqueda = true;
    if (opts.contextoTemporal && typeof opts.contextoTemporal === 'object') cuerpo.contextoTemporal = opts.contextoTemporal;
    if (typeof opts.ubicacionHabitual === 'string' && opts.ubicacionHabitual) cuerpo.ubicacionHabitual = opts.ubicacionHabitual;
    if (typeof opts.ubicacionDispositivo === 'string' && opts.ubicacionDispositivo) cuerpo.ubicacionDispositivo = opts.ubicacionDispositivo;
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken
            },
            body: JSON.stringify(cuerpo)
        });
        if (datos && typeof datos.respuesta === 'string') return datos;
        throw new Error((datos && datos.error && datos.error.message) || 'Respuesta inesperada del Worker NoMi.');
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        throw err;
    }
}

// Contrato histórico: devuelve únicamente texto para resumen y otras llamadas.
async function llamarIANoMi(mensaje, maxTokens, herramienta) {
    const datos = await solicitarChatNoMi(mensaje, { herramienta });
    return datos.respuesta;
}

// Chat NoMi nuevo: devuelve la respuesta junto con la señal estable de búsqueda
// y fuentes compactas. Si se pidió navegación y falta la señal del protocolo,
// no se muestra como actual una respuesta de un Worker antiguo.
async function llamarIANoMiSemantico(mensaje, permitirBusqueda, forzarBusqueda, permitirClima, contexto) {
    const busquedaPermitida = permitirBusqueda === true || forzarBusqueda === true;
    const climaPermitido = permitirClima === true && forzarBusqueda !== true;
    const ctx = contexto && typeof contexto === 'object' ? contexto : {};
    const datos = await solicitarChatNoMi(mensaje, {
        permitirBusqueda: busquedaPermitida,
        permitirClima: climaPermitido,
        forzarBusqueda: forzarBusqueda === true,
        contextoTemporal: ctx.temporal,
        ubicacionHabitual: ctx.ubicacionHabitual,
        ubicacionDispositivo: ctx.ubicacionDispositivo,
    });
    if ((busquedaPermitida || climaPermitido) && datos.herramientasProtocolo !== 1) {
        return {
            texto: 'Las herramientas de NoMi necesitan actualizar el servidor antes de responder con información actual.',
            estadoBusqueda: 'actualizacion_requerida',
            estadoClima: 'actualizacion_requerida',
            fuentes: [],
        };
    }
    const estados = ['ok', 'sin_resultados', 'limite_diario', 'fallo_proveedor', 'fallo_sintesis', 'consulta_invalida', 'actualizacion_requerida'];
    const estadoBusqueda = estados.indexOf(datos.busquedaEstado) >= 0 ? datos.busquedaEstado : null;
    const fuentes = Array.isArray(datos.fuentes)
        ? datos.fuentes.slice(0, 3).map(f => ({
            titulo: typeof f.titulo === 'string' ? f.titulo : '',
            url: typeof f.url === 'string' ? f.url : '',
            fecha: typeof f.fecha === 'string' ? f.fecha : '',
        }))
        : [];
    const estadosClima = ['ok', 'falta_ubicacion', 'ciudad_no_encontrada', 'limite_diario', 'fallo_proveedor', 'consulta_invalida'];
    const estadoClima = estadosClima.indexOf(datos.climaEstado) >= 0 ? datos.climaEstado : null;
    return { texto: datos.respuesta, estadoBusqueda, estadoClima, fuentes };
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

// Cierra el acceso compartido NoMi en ESTE NAVEGADOR: borra el token local.
// NO revoca el token en el servidor (eso lo hace el administrador).
function cerrarAccesoNoMi() {
    setNomiToken('');
    setNomiAccesoActivo(false);
    mostrarNotificacionTemporal('🔌 Acceso compartido NoMi cerrado en este navegador (el token sigue activo en el servidor hasta que un administrador lo revoque).');
}
