// ======== MÓDULO: Núcleo Lógico (Orquestación) ========
// NoMi Assistant – Funciones principales de orquestación

async function procesarBusqueda(consulta) {
    if (NoMiState.motorBusqueda === 'ninguno') {
        agregarMensaje('bot', 'ℹ️ La búsqueda web está desactivada. Puedes activarla en el menú (⚙️) si has importado una clave de Tavily.');
        return;
    }
    if (!NoMiState.tavilyKeyActual) {
        const mensaje = `ℹ️ No hay clave de Tavily configurada. Para buscar en internet, necesitas una clave de Tavily.\n\nPuedes obtener una gratis en: https://tavily.com\n(Regístrate, copia tu API key y pégala en el menú ⚙️).`;
        agregarMensaje('bot', mensaje);
        return;
    }
    agregarMensaje('bot', `🔍 Realizando búsqueda: "${consulta}"...`);
    try {
        let ubicacionTexto = '';
        let ubicacionCoordenadas = '';
        if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
            ubicacionTexto = `${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}`;
            ubicacionCoordenadas = `${NoMiState.ubicacionActual.lat}, ${NoMiState.ubicacionActual.lon}`;
        }
        let consultaFinal = consulta;
        if (ubicacionCoordenadas && requiereUbicacion(consulta)) {
            consultaFinal = `${consulta} en ${ubicacionTexto} (coordenadas: ${ubicacionCoordenadas})`;
        }
        const resultados = await buscarWeb(consultaFinal);
        if (!resultados || !resultados.results || resultados.results.length === 0) {
            const msg = `❌ No se encontraron resultados para esa consulta.`;
            NoMiState.historial.push({role: 'assistant', content: msg});
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', msg);
            return;
        }
        const resultadosTexto = resultados.results.map((r, i) => `${i+1}. ${r.title || 'Sin título'}\n   ${r.content || 'Sin descripción'}`).join('\n\n');
        const prompt = `El usuario se encuentra en ${ubicacionTexto} (coordenadas GPS: ${ubicacionCoordenadas}). **DEBES usar ESTA ubicación para todas las consultas de clima y eventos locales.** Ignora cualquier otra ubicación que puedas inferir de la IP.\n\nInvestigué en la web sobre: "${consultaFinal}". Estos son los resultados obtenidos:\n\n${resultadosTexto}\n\nPor favor, ofrezca una respuesta clara, concisa y en un tono profesional pero cercano. Evite el uso excesivo de tablas o datos innecesarios. Resume la información más importante en 2-3 párrafos. Si hay datos numéricos (temperatura, precios, etc.), menciónelos de forma fluida dentro de la conversación. Mantenga un tono de colaboración entre iguales, sin tuteo excesivo.`;
        const respuestaIA = NoMiState.modoAcceso === MODO_ACCESO_NOMI
            ? await llamarIANoMi(prompt)
            : await llamarIA(prompt);
        const respuestaConIndicador = `🔍 ${respuestaIA}`;
        NoMiState.historial.push({role: 'assistant', content: respuestaConIndicador});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', respuestaConIndicador);
    } catch (error) {
        const msg = `❌ Error en la búsqueda: ${error.message}`;
        NoMiState.historial.push({role: 'assistant', content: msg});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', msg);
    }
}

// Decide si debe abrirse el asistente de configuración inicial.
// En modo NoMi con token activo NO se exige OpenRouter/Tavily ni se abre el asistente.
function debeMostrarConfiguracionInicial() {
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken && NoMiState.nomiAccesoActivo) {
        return false;
    }
    return !NoMiState.configuracionInicialCompletada || !NoMiState.credencialesCargadas;
}

function iniciarAsistente() {
    NoMiState.historial = getHistorial();
    NoMiState.tokens = getTokens();
    NoMiState.contadorPreguntas = getContador();
    NoMiState.resumenPersistente = getResumen();
    NoMiState.contextoSeleccionado = getContexto();
    NoMiState.modoLigeroActivo = getModoLigero();
    NoMiState.modoResumenActivo = getModoResumen();
    NoMiState.busquedaWebActiva = getBusquedaWeb();
    NoMiState.tamanoVentana = getTamanoVentana();
    NoMiState.ubicacionActivada = getUbicacionActivada();
    NoMiState.climaAutomatico = getClimaAutomatico();
    NoMiState.busquedaWebNomi = getBusquedaWebNomi();
    NoMiState.ubicacionActual = getUbicacion();
    NoMiState.credencialesCargadas = getCredencialesCargadas();
    NoMiState.apiKeyActual = getApiKey();
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.configuracionInicialCompletada = getConfigInicial();
    NoMiState.motorBusqueda = getMotorBusqueda();
    NoMiState.modoAcceso = getModoAcceso();
    NoMiState.nomiWorkerUrl = getNomiWorkerUrl() || NOMI_WORKER_URL_POR_DEFECTO;
    NoMiState.nomiToken = getNomiToken();
    NoMiState.nomiModelo = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    NoMiState.nomiAccesoActivo = getNomiAccesoActivo();
    // El endpoint del Worker es fijo: cualquier URL persistida distinta se resetea.
    resetearUrlWorkerNoMi();

    crearBurbuja();
    crearVentanaChat();
    // Fija el indicador superior según el modo persistido (NoMi/OpenRouter).
    actualizarIndicador();
    actualizarHud();
    actualizarQuotaHud();
    configurarTeclado();

    // Aviso único al inicio sobre el diagnóstico técnico (no se repite).
    if (NoMiState.diagnosticoActivo && !NoMiState.avisoDiagnosticoVisto) {
        NoMiState.avisoDiagnosticoVisto = true;
        setAvisoDiagnosticoVisto(true);
        mostrarNotificacionTemporal('🩺 NoMi envía un diagnóstico técnico anónimo de errores (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa. Puedes desactivarlo en ⚙️ Configuración.');
    }

    if (NoMiState.ubicacionActivada && !NoMiState.ubicacionActual) {
        actualizarUbicacion(true);
    }

    const mostrarConfig = debeMostrarConfiguracionInicial();

    if (NoMiState.historial.length === 0) {
        const sistema = `Eres NoMi, una asistente virtual profesional, formal y cercana. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. Estás diseñada para ofrecer respuestas útiles, concisas y bien estructuradas. Refiérete a ti misma siempre en femenino (por ejemplo: "soy una asistente virtual", "estoy diseñada").\n\n**Si el usuario pregunta sobre su ubicación (ej: "¿dónde estoy?", "¿en qué ciudad estoy?"), usa los datos de ubicación que tienes en el contexto.** No digas que no tienes acceso a la ubicación.`;
        NoMiState.historial.unshift({ role: 'system', content: sistema });
        guardarHistorial(NoMiState.historial);

        let bienvenida = `Hola, soy **${NOMBRE_ASISTENTE}**, su asistente virtual. Estoy diseñada para acompañarle y responderle con claridad y respeto.\nPara ver la lista de comandos disponibles, escriba \`!cmd\`.\n`;
        if (mostrarConfig) bienvenida += `\n⚠️ **Es necesario configurar tus credenciales.**\nSe abrirá un asistente de configuración para que importes o ingreses tus claves de API.\n`;
        else if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken && NoMiState.nomiAccesoActivo) bienvenida += `\n🌐 Acceso compartido NoMi activo. Puedes chatear directamente.\n`;
        else if (!NoMiState.credencialesCargadas) bienvenida += `\n⚠️ **Aún no has configurado tus credenciales.** Ve al menú (⚙️) y selecciona "Importar credenciales" o ingresa tus claves manualmente para activar la búsqueda web y el acceso a la IA.\n`;
        else bienvenida += `\n✅ Credenciales cargadas correctamente.\n`;
        bienvenida += `\n¿En qué puedo ayudarle?`;
        NoMiState.historial.push({role: 'assistant', content: bienvenida});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', bienvenida);
    } else {
        cargarHistorial();
    }
    actualizarStats();
    if (!NoMiState.burbujaVisible) toggleBurbuja(true);

    if (mostrarConfig) {
        setTimeout(() => {
            if (NoMiState.ventanaAbierta) mostrarAsistenteConfiguracion();
            else {
                toggleVentana(true);
                setTimeout(() => mostrarAsistenteConfiguracion(), 300);
            }
        }, 800);
    }
        console.log(`✅ ${NOMBRE_ASISTENTE} V${VERSION_SCRIPT} activado!`);

    // Verificación de disponibilidad gratuita del modelo actual (segundo plano, no bloquea).
    // Se consulta una sola vez por pestaña/sesión (sessionStorage) en verificarModeloAlIniciar().
    void verificarModeloAlIniciar();
}

// ---- Clima vía Worker NoMi (sin Tavily, sin Groq) ----
// Sufijos temporales que pueden seguir a la ciudad ("en La Paz mañana") y que NO
// deben enviarse a Open-Meteo como parte de la ubicación (auditoría hallazgo 1).
const SUFIJOS_TEMPORALES_CLIMA = [
    'hoy', 'mañana', 'manana', 'madrugada', 'ayer', 'pasado', 'ahora', 'luego', 'después', 'despues',
    'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
    'próxima', 'proxima', 'próximo', 'proximo', 'semana', 'mismo', 'durante', 'noche', 'tarde',
    'mediodía', 'mediodia',
];
const CONJUNTO_SUFIJOS = new Set(SUFIJOS_TEMPORALES_CLIMA);

function limpiarSufijosTemporalesCiudad(ciudad) {
    const partes = String(ciudad || '').trim().split(/\s+/);
    while (partes.length > 1 && CONJUNTO_SUFIJOS.has(partes[partes.length - 1].toLowerCase())) {
        partes.pop();
    }
    return partes.join(' ').trim();
}

// Normaliza la ubicación detectada eliminando SOLO comillas, apóstrofes o
// puntuación EXTERNOS (inicio/final). Conserva apóstrofes internos legítimos
// (p. ej. "Sant'Agata") y no toca el interior de la cadena: evita que una comilla
// o apóstrofo de cierre pegado por el usuario (p. ej. "Santa Cruz de la Sierra'")
// llegue a Open-Meteo y rompa la resolución del geocoding.
function normalizarUbicacionClima(ubicacion) {
    let s = String(ubicacion || '').trim();
    s = s.replace(/^[\s"'“”‘’]+/, '').replace(/[\s"'“”‘’]+$/, '');
    s = s.replace(/^[¿¡…]+/, '');
    s = s.replace(/[?!.,;:…]+$/, '');
    return s.trim();
}

// Detección conservadora de consultas meteorológicas en modo NoMi. Devuelve la
// ubicación a consultar o null (entonces el chat sigue normal).
// - Palabras fuertes: clima, pronóstico/pronostico, temperatura, lluvia, viento.
// - "tiempo" SOLO en expresiones meteorológicas claras ("qué tiempo hace/hará",
//   "tiempo hoy/mañana"); nunca como palabra aislada ("¿cuánto tiempo tardas?",
//   "tiempo de ejecución") para evitar falsos positivos.
// - Se activa solo con ciudad tras "en …" (recortando sufijos temporales) O
//   ubicación local previamente habilitada.
function detectarClimaNoMi(texto) {
    if (typeof texto !== 'string' || !texto.trim()) return null;
    const t = texto.trim();
        const climaFuerte = /\b(clima|pronóstico|pronostico|temperatura|lluvia|viento)\b/i.test(t);
    // Límite compatible con tildes: `\b` en JS no contempla á/é/ó/ñ como `\w`, por
    // lo que `hará\b`/`está\b`/`será\b` fallan cuando van seguidos de espacio o
    // puntuación (p. ej. "qué tiempo hará mañana"). Tras hace/hará/hara/está/
    // esta/este/será/sera usamos el look-ahead positivo `(?=$|[\s?.,!¿¡])`,
    // compatible con espacio, puntuación o fin de texto sin romper acentos. Los
    // falsos positivos ("cuánto tiempo tardas…", "tiempo de ejecución…") se
    // siguen bloqueando por la estructura de la frase, no por el límite.
    const climaPorTiempo = /\btiempo\b/i.test(t) && (
        /\b(qué|que|cómo|como)\s+tiempo\s+(hace|hará|hara|está|esta|este|será|sera)(?=$|[\s?.,!¿¡])/i.test(t) ||
        /\btiempo\s+(hoy|mañana|manana|ahora)\b/i.test(t)
    );
    if (!climaFuerte && !climaPorTiempo) return null;
    // a) Ciudad identificable tras "en …" (normalizando extremos y eliminando
    // sufijos temporales).
    const m = t.match(/\ben\s+([^?.,!¿¡]+)/i);
    if (m && m[1].trim().length >= 3) {
        const ciudad = limpiarSufijosTemporalesCiudad(normalizarUbicacionClima(m[1]));
        if (ciudad.length >= 3) return ciudad;
    }
    // b) Ubicación local explícitamente habilitada.
    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual && NoMiState.ubicacionActual.ciudad) {
        const u = NoMiState.ubicacionActual;
        return (normalizarUbicacionClima(u.ciudad) + (u.pais ? ', ' + u.pais : '')).trim();
    }
    return null;
}

// Maneja una consulta de clima en modo NoMi: llama al Worker con `herramienta`
// y pinta la respuesta breve. El Worker nunca pasa por Groq ni usa Tavily.
async function manejarClimaNoMi(texto, ubicacion) {
    NoMiState.isWaiting = true;
    deshabilitarControlesEnvio();
    actualizarHud();
    NoMiState.historial.push({ role: 'user', content: texto });
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);
    mostrarCargando();
    try {
        // Señal explícita del Worker (`climaEstado`, vía llamarClimaNoMi):
        // distingue éxito real de ciudad inexistente, límite diario y fallo
        // temporal del proveedor SIN inspeccionar el texto humano.
        const resultado = await llamarClimaNoMi(texto, ubicacion);
        const respuestaTexto = resultado.texto;
        ocultarCargando();
        if (resultado.estado === 'fallo_proveedor') {
            // Fallo temporal de Open-Meteo (el Worker ya revirtió la cuota):
            // mismo tratamiento blando y reintentable que una caída de red,
            // conservando el mensaje humano recibido.
            NoMiState.historial.pop();
            guardarHistorial(NoMiState.historial);
            const dispFallo = document.getElementById('nomi-modelo-display');
            if (dispFallo) dispFallo.textContent = '⚠️ error';
            agregarMensaje('bot', respuestaTexto);
            NoMiState.reintentarPregunta = texto;
            mapearErrorHudNoMi({}); // estado HUD 'sin_conexion' -> botón "Reintentar"
            registrarError('network', 'Clima: fallo temporal del proveedor (Open-Meteo).', `Modo: NoMi (clima), URL: ${NoMiState.nomiWorkerUrl}`);
        } else {
            // ok / ciudad_no_encontrada / limite_diario: consulta atendida y no
            // reintentable tal cual; el mensaje humano ya explica cada caso.
            NoMiState.contadorPreguntas++;
            setContador(NoMiState.contadorPreguntas);
            NoMiState.historial.push({ role: 'assistant', content: respuestaTexto });
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', respuestaTexto);
            NoMiState.reintentarPregunta = '';
            actualizarStats();
        }
    } catch (error) {
        ocultarCargando();
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        const disp = document.getElementById('nomi-modelo-display');
        if (disp) disp.textContent = '⚠️ error';
        // Igual que el chat NoMi normal: la pregunta queda guardada para el
        // reintento explícito del HUD ("Reintentar"). mapearErrorHudNoMi la
        // limpia en 401 (acceso inválido no es reintentable).
        NoMiState.reintentarPregunta = texto;
        // Error humano breve sin fuga técnica.
        agregarMensaje('bot', mensajeHumanoErrorNoMi(error));
        mapearErrorHudNoMi(error);
        registrarError('network', error.message, `Modo: NoMi (clima), URL: ${NoMiState.nomiWorkerUrl}`);
    }
    restaurarControlesEnvio();
    NoMiState.isWaiting = false;
    actualizarHud();
}

// Texto persistente de una respuesta web sintetizada. Conserva los enlaces para
// los seguimientos, pero no guarda ni muestra el volcado de snippets de Tavily.
function construirRespuestaConFuentesPlano(texto, fuentes) {
    const lineas = [String(texto || '')];
    const lista = Array.isArray(fuentes) ? fuentes.slice(0, 3) : [];
    if (lista.length) lineas.push('', 'Fuentes:');
    lista.forEach((fuente, indice) => {
        const url = nomiUrlFuenteSegura(fuente && fuente.url);
        const titulo = fuente && fuente.titulo ? String(fuente.titulo) : 'Fuente web';
        lineas.push('[' + (indice + 1) + '] ' + titulo + (url ? ' — ' + url : ''));
    });
    return lineas.join('\n');
}

// Defensa en profundidad (respaldo, no el mecanismo principal): si un modelo
// normal responde con una línea aislada `!search`, NO se muestra como respuesta
// útil ni se ejecuta. Se registra diagnóstico SIN contenido y se muestra un error
// humano breve.
function esRespuestaComandoInseguro(texto) {
    return typeof texto === 'string' && /^\s*!search(\s|$)/i.test(texto);
}

async function preguntar(texto, opciones = {}) {
    // La lupa aplica solo a este envío. Se consume incluso si clima gana o el
    // acceso falla, para que no se filtre accidentalmente a la pregunta siguiente.
    const forzarBusquedaSolicitada = NoMiState.busquedaForzada === true;
    const esReintento = opciones.reintento === true;
    NoMiState.busquedaForzada = false;
    NoMiState.reintentarBusquedaForzada = false;
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
        // Modo explícito NoMi: exige token Y acceso activo. Sin eso, informa y
        // NO se hace ninguna petición HTTP (tampoco fallback a OpenRouter).
        if (!NoMiState.nomiToken) {
            agregarMensaje('bot', '🔑 **No tienes un token de acceso NoMi.**\n\nActívalo con un código de invitación en ⚙️ Configuración > Acceso compartido NoMi.\nNo se usa OpenRouter en este modo.');
            return;
        }
        if (!NoMiState.nomiAccesoActivo) {
            agregarMensaje('bot', '⛔ **Tu acceso NoMi no está activo o fue revocado.**\n\nVuelve a activar un código de invitación en ⚙️ Configuración > Acceso compartido NoMi.\nNo se usa OpenRouter en este modo.');
            return;
        }
        // Clima vía Worker (solo NoMi): detección conservadora, sin Tavily ni Groq.
        // Si el usuario desactivó "clima automático NoMi", la consulta sigue el chat
        // normal sin herramienta (sin pasar por Open-Meteo).
        const ubicacionClima = NoMiState.climaAutomatico ? detectarClimaNoMi(texto) : null;
        if (ubicacionClima) {
            // Igual que el chat normal: el texto enviado sale del input (el mensaje
            // ya queda pintado en el chat e historial por manejarClimaNoMi).
            const inputClima = document.getElementById('nomi-input');
            if (inputClima) inputClima.value = '';
            await manejarClimaNoMi(texto, ubicacionClima);
            return;
        }
    } else if (!NoMiState.credencialesCargadas || !NoMiState.apiKeyActual) {
        agregarMensaje('bot', '⚠️ **No hay credenciales configuradas.**\n\nPor favor, ve al menú (⚙️) y configura tu API Personal (URL base + API key) o importa un archivo `.enc`.\n\nMientras tanto, puedes usar comandos básicos como `!cmd` para ver la lista de comandos disponibles.');
        return;
    }
    const input = document.getElementById('nomi-input');
    if (input) input.value = '';
    if (!texto.trim() || NoMiState.isWaiting) return;
    if (texto.trim() === '!cmd' || texto.trim() === '!comandos') { mostrarAyuda(); return; }

    NoMiState.isWaiting = true;
    deshabilitarControlesEnvio();
    actualizarHud();

    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
        if (Date.now() - NoMiState.ubicacionActual.timestamp > UBICACION_EXPIRACION) actualizarUbicacion(true);
    }

    // En modo NoMi la búsqueda web legada (procesarBusqueda/buscarWeb con clave
    // Tavily local o API Personal) NUNCA aplica. La preferencia habilita la
    // decisión semántica del modelo y la lupa fuerza una única búsqueda vía Worker.
    const modoNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
    const forzarBusquedaNoMi = modoNoMi && forzarBusquedaSolicitada;
    const cmdBusqueda = !modoNoMi ? texto.match(/^(investiga|busca|investigar|buscar)\s*[:|]?\s*(.+)/i) : null;
    let esBusqueda = false, consulta = '';
    if (cmdBusqueda) {
        consulta = cmdBusqueda[2].trim();
        if (consulta) {
            esBusqueda = true;
            if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
        }
    }
    if (forzarBusquedaSolicitada && !modoNoMi) {
        esBusqueda = true; consulta = texto.trim();
        if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
    }
    if (!esBusqueda && !modoNoMi && NoMiState.busquedaWebActiva && requiereBusqueda(texto)) {
        esBusqueda = true; consulta = texto.trim();
    }
    if (esBusqueda && consulta) {
        ocultarCargando();
        actualizarIndicadorModelo();
        await procesarBusqueda(consulta);
        if (NoMiState.busquedaWebTemporal) { NoMiState.busquedaWebTemporal = false; }
        restaurarControlesEnvio();
        NoMiState.isWaiting = false;
        actualizarHud();
        return;
    }

    // Un reintento del HUD sustituye el turno temporal fallido, no lo duplica.
    // En cambio, si la persona hace otra pregunta (por ejemplo, “¿por qué?”),
    // el turno fallido se conserva en historial para que NoMi tenga contexto.
    if (esReintento) {
        const ultimo = NoMiState.historial[NoMiState.historial.length - 1];
        const anterior = NoMiState.historial[NoMiState.historial.length - 2];
        if (ultimo && anterior
            && ultimo.role === 'assistant'
            && anterior.role === 'user'
            && anterior.content === texto) {
            NoMiState.historial.splice(-2, 2);
            guardarHistorial(NoMiState.historial);
        }
    }

    const palabrasClave = ['analiza', 'examina', 'escanea', 'resume esta página'];
    const esAnalisis = palabrasClave.some(p => texto.toLowerCase().includes(p));
    const usarWeb = NoMiState.modoWebActivo || esAnalisis;
    let infoPagina = '';
    if (usarWeb) {
        const limite = NoMiState.modoLigeroActivo ? LIMITE_TEXTO_LIGERO : LIMITE_TEXTO_NORMAL;
        const info = extraerInformacionPagina(limite);
        infoPagina = `INFORMACIÓN DE LA PÁGINA ACTUAL:\nTítulo: ${info.titulo}\nURL: ${info.url}\nDescripción: ${info.metaDesc}\nEncabezados: ${info.encabezados.join(', ')}\nContenido principal (primeros ${limite} caracteres):\n${info.texto}\n---\n`;
        if (NoMiState.modoWebActivo) {
            NoMiState.modoWebActivo = false;
            document.getElementById('nomi-web-status').style.display = 'none';
            document.getElementById('nomi-web-btn').style.borderColor = '#555';
            document.getElementById('nomi-web-btn').style.color = '#888';
        }
    }

    const contextoFechaHora = obtenerContextoTiempo();
    let contextoUbicacion = '';
    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual && requiereUbicacion(texto)) {
        const fuente = NoMiState.ubicacionActual.fuente === 'gps' ? 'GPS' : 'IP aproximada';
        contextoUbicacion = `📍 Ubicación del usuario: ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais} (${fuente}). Coordenadas GPS: ${NoMiState.ubicacionActual.lat}, ${NoMiState.ubicacionActual.lon}. **DEBES usar ESTA ubicación.**`;
    } else if (NoMiState.ubicacionActivada && !NoMiState.ubicacionActual && requiereUbicacion(texto)) {
        contextoUbicacion = '📍 Ubicación: no disponible (solicitando...)';
    }
    const contextoCompleto = contextoUbicacion ? `${contextoFechaHora}\n${contextoUbicacion}` : contextoFechaHora;

    let mensajesParaEnviar = [];
    if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10 && NoMiState.resumenPersistente) {
        mensajesParaEnviar.push({ role: 'system', content: `Resumen de la conversación anterior:\n${NoMiState.resumenPersistente}` });
    }
    const limiteMensajes = Math.min(NoMiState.contextoSeleccionado, CONTEXTO_RECIENTE);
    const mensajesRecientes = NoMiState.historial.filter(m => m.role === 'user' || m.role === 'assistant').slice(-limiteMensajes);
    mensajesParaEnviar.push(...mensajesRecientes);
    let mensajeCompleto = texto;
    if (infoPagina) mensajeCompleto = infoPagina + '\nPregunta del usuario: ' + texto;
    const mensajeFinal = `${contextoCompleto}\n\nPregunta del usuario: ${mensajeCompleto}`;
    // Debe construirse ANTES de añadir la pregunta al historial: así el turno
    // actual aparece una sola vez y los seguimientos conservan solo antecedentes.
    // Con búsqueda habilitada se reservan además el sistema semántico y el
    // schema de la herramienta bajo el límite Groq de 8000 TPM. 5000 bytes deja
    // margen para ambos sin reducir la salida máxima ni provocar un 400 tardío.
    const habilitarBusquedaNoMi = NoMiState.busquedaWebNomi === true || forzarBusquedaNoMi;
    const maxBytesWorkerNoMi = habilitarBusquedaNoMi ? 5000 : 6000;
    const mensajeWorkerNoMi = modoNoMi ? construirMensajeWorkerNoMi(mensajeFinal, maxBytesWorkerNoMi) : '';

    NoMiState.historial.push({role: 'user', content: texto});
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);

    mostrarCargando();

    try {
        let respuestaTexto;
        let resultadoNoMi = null;
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            // Modo explícito "Acceso compartido NoMi": usa el Worker (Bearer token).
            // El mensaje conserva continuidad (persona + resumen + turnos recientes
            // + contexto completo: fecha, ubicación y contenido de página) y
            // respeta el límite de bytes del Worker.
            actualizarIndicadorProveedor();
            document.getElementById('nomi-modelo-display').textContent = NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO;
            resultadoNoMi = await llamarIANoMiSemantico(
                mensajeWorkerNoMi,
                habilitarBusquedaNoMi,
                forzarBusquedaNoMi,
            );
            respuestaTexto = resultadoNoMi.texto;

            if (resultadoNoMi.estadoBusqueda === 'fallo_proveedor'
                || resultadoNoMi.estadoBusqueda === 'fallo_sintesis') {
                // Fallo temporal de Tavily (con rollback) o de la síntesis Groq
                // posterior (Tavily sí consumió cupo). En ambos casos se conserva
                // la pregunta para un reintento explícito y forzado.
                ocultarCargando();
                // El error visible también forma parte de la conversación. Si
                // se pregunta “¿por qué?”, debe poder referirse a este turno.
                NoMiState.historial.push({ role: 'assistant', content: respuestaTexto });
                guardarHistorial(NoMiState.historial);
                const dispFallo = document.getElementById('nomi-modelo-display');
                if (dispFallo) dispFallo.textContent = '⚠️ error';
                agregarMensaje('bot', respuestaTexto);
                NoMiState.reintentarPregunta = texto;
                // El modelo ya decidió que necesitaba la web: el botón debe
                // reintentar la herramienta, no volver a dejarlo a criterio.
                NoMiState.reintentarBusquedaForzada = true;
                mapearErrorHudNoMi({});
                const etapaFallo = resultadoNoMi.estadoBusqueda === 'fallo_sintesis' ? 'síntesis Groq' : 'Tavily';
                registrarError('network', `Búsqueda NoMi: fallo temporal de ${etapaFallo}.`, `Modo: NoMi, URL: ${NoMiState.nomiWorkerUrl}`);
                restaurarControlesEnvio();
                NoMiState.isWaiting = false;
                actualizarHud();
                return;
            }
        } else {
            // Chat Personal (OpenAI-compatible): /chat/completions con la URL
            // base configurada. Los headers HTTP-Referer/X-Title solo se envían
            // si la URL es OpenRouter (construirHeadersPersonal lo gestiona).
            const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
                method: 'POST',
                headers: construirHeadersPersonal(NoMiState.apiKeyActual, NoMiState.urlBaseActual),
                body: JSON.stringify({
                    model: NoMiState.modeloActual,
                    messages: [...mensajesParaEnviar, {role: 'user', content: mensajeFinal}],
                    stream: false
                })
            });
            if (respuesta.choices && respuesta.choices[0]) {
                respuestaTexto = respuesta.choices[0].message.content;
                document.getElementById('nomi-modelo-display').textContent = NoMiState.modeloActual;
                if (respuesta.usage) {
                    NoMiState.tokens.total += respuesta.usage.total_tokens || 0;
                    NoMiState.tokens.input += respuesta.usage.prompt_tokens || 0;
                    NoMiState.tokens.output += respuesta.usage.completion_tokens || 0;
                    setTokens(NoMiState.tokens);
                }
            } else if (respuesta.error) {
                agregarMensaje('bot', '❌ Error: ' + (respuesta.error.message || JSON.stringify(respuesta.error)));
                NoMiState.historial.pop();
                guardarHistorial(NoMiState.historial);
                document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
                registrarError('api', respuesta.error.message || 'Error desconocido en API', `Modelo: ${NoMiState.modeloActual}`);
                restaurarControlesEnvio();
                NoMiState.isWaiting = false;
                actualizarHud();
                return;
            } else {
                agregarMensaje('bot', '❌ Error inesperado');
                NoMiState.historial.pop();
                guardarHistorial(NoMiState.historial);
                document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
                registrarError('script', 'Respuesta inesperada de la API', 'Sin detalles');
                restaurarControlesEnvio();
                NoMiState.isWaiting = false;
                actualizarHud();
                return;
            }
        }
        // Defensa en profundidad SOLO en modo NoMi: una respuesta que empieza por una
        // línea aislada `!search` NO se muestra como resultado útil ni se ejecuta
        // (respaldo; el mecanismo principal es el Worker). Se registra diagnóstico
        // SIN contenido. En API Personal no se aplica (auditoría hallazgo 4).
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && esRespuestaComandoInseguro(respuestaTexto)) {
            ocultarCargando();
                        const disp = document.getElementById('nomi-modelo-display');
            // La defensa conserva el modelo de NoMi (no el de Personal/OpenRouter):
            // en modo NoMi el indicador de modelo debe seguir mostrando nomiModelo.
            if (disp) disp.textContent = NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO;
            registrarError('script', 'Respuesta del modelo con comando interno !search no ejecutada (sin contenido de usuario).', 'Seguridad');
            agregarMensaje('bot', '❌ No pude completar esa respuesta de forma segura. Reformula tu pregunta.');
            restaurarControlesEnvio();
            NoMiState.isWaiting = false;
            actualizarHud();
            return;
        }
        // Ruta de éxito común a ambos modos.
        ocultarCargando();
        const estadoNoAtendido = resultadoNoMi
            && (resultadoNoMi.estadoBusqueda === 'consulta_invalida'
                || resultadoNoMi.estadoBusqueda === 'actualizacion_requerida');
        if (!estadoNoAtendido) {
            NoMiState.contadorPreguntas++;
            setContador(NoMiState.contadorPreguntas);
        }
        const fuentesNoMi = resultadoNoMi && resultadoNoMi.estadoBusqueda === 'ok'
            ? resultadoNoMi.fuentes
            : [];
        const respuestaHistorial = fuentesNoMi.length
            ? construirRespuestaConFuentesPlano(respuestaTexto, fuentesNoMi)
            : respuestaTexto;
        NoMiState.historial.push({role: 'assistant', content: respuestaHistorial});
        guardarHistorial(NoMiState.historial);
        if (fuentesNoMi.length) agregarMensajeConFuentes(respuestaTexto, fuentesNoMi);
        else agregarMensaje('bot', respuestaTexto);
        NoMiState.reintentarPregunta = '';
        NoMiState.reintentarBusquedaForzada = false;
        actualizarStats();
        // NoMi: tras respuesta exitosa, refresca cuota y limpia estado de error.
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) await consultarUsoNoMi();
        if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) {
            setTimeout(() => generarResumen(NoMiState.historial), 100);
        }
    } catch (error) {
        ocultarCargando();
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            // Error NoMi: un único mensaje humano; el detalle técnico queda solo
            // en registrarError(). La pregunta se guarda para reintento explícito.
            NoMiState.reintentarPregunta = texto;
            NoMiState.reintentarBusquedaForzada = forzarBusquedaNoMi;
            agregarMensaje('bot', mensajeHumanoErrorNoMi(error));
            mapearErrorHudNoMi(error);
            registrarError('network', error.message, `Modo: NoMi, URL: ${NoMiState.nomiWorkerUrl}`);
        } else {
            agregarMensaje('bot', '❌ ' + error.message);
            registrarError('network', error.message, `Modo: ${NoMiState.modoAcceso}, URL: ${NoMiState.urlBaseActual}`);
        }
    }
    restaurarControlesEnvio();
    NoMiState.isWaiting = false;
    actualizarHud();
}

async function generarResumen(historialCompleto) {
    if (!NoMiState.modoResumenActivo || NoMiState.contextoSeleccionado !== 10 || historialCompleto.length < 4) return;
    try {
        let textoResumen = null;
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            textoResumen = await llamarIANoMi(construirMensajeResumenNoMi(historialCompleto));
        } else {
            const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
                method: 'POST',
                headers: construirHeadersPersonal(NoMiState.apiKeyActual, NoMiState.urlBaseActual),
                body: JSON.stringify({
                    model: NoMiState.modeloActual,
                    messages: [
                        { role: 'system', content: 'Eres un asistente que resume conversaciones. Genera un resumen COMPACTO (máximo 300 palabras) de toda la conversación. Incluye temas principales y decisiones. Responde SOLO con el resumen.' },
                        { role: 'user', content: `Resume esta conversación:\n\n${historialCompleto.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n')}` }
                    ],
                    stream: false, max_tokens: 500
                })
            });
            if (respuesta.choices && respuesta.choices[0]) {
                textoResumen = respuesta.choices[0].message.content;
            }
        }
        if (textoResumen) setResumen(textoResumen);
    } catch (error) {
        registrarError('api', error.message, 'Generación de resumen');
    }
}
