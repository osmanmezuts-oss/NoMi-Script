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
        const sistema = `Eres NoMi, un asistente profesional y formal pero cercano. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. El usuario espera respuestas útiles, concisas y bien estructuradas.\n\n**Si el usuario pregunta sobre su ubicación (ej: "¿dónde estoy?", "¿en qué ciudad estoy?"), usa los datos de ubicación que tienes en el contexto.** No digas que no tienes acceso a la ubicación.`;
        NoMiState.historial.unshift({ role: 'system', content: sistema });
        guardarHistorial(NoMiState.historial);

        let bienvenida = `Hola, soy **${NOMBRE_ASISTENTE}**, su asistente de navegación.\nPara ver la lista de comandos disponibles, escriba \`!cmd\`.\n`;
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

async function preguntar(texto) {
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
    } else if (!NoMiState.credencialesCargadas || !NoMiState.apiKeyActual) {
        agregarMensaje('bot', '⚠️ **No hay credenciales configuradas.**\n\nPor favor, ve al menú (⚙️) y configura tus claves de API (OpenRouter y Tavily) o importa un archivo `.enc`.\n\nMientras tanto, puedes usar comandos básicos como `!cmd` para ver la lista de comandos disponibles.');
        return;
    }
    const input = document.getElementById('nomi-input');
    if (input) input.value = '';
    if (!texto.trim() || NoMiState.isWaiting) return;
    if (texto.trim() === '!cmd' || texto.trim() === '!comandos') { mostrarAyuda(); return; }

    NoMiState.isWaiting = true;
    document.getElementById('nomi-modelo-display').textContent = '⏳ pensando...';

    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
        if (Date.now() - NoMiState.ubicacionActual.timestamp > UBICACION_EXPIRACION) actualizarUbicacion(true);
    }

    const cmdBusqueda = texto.match(/^(investiga|busca|investigar|buscar)\s*[:|]?\s*(.+)/i);
    let esBusqueda = false, consulta = '';
    if (cmdBusqueda) {
        consulta = cmdBusqueda[2].trim();
        if (consulta) {
            esBusqueda = true;
            if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
        }
    }
    if (NoMiState.busquedaForzada) {
        esBusqueda = true; consulta = texto.trim(); NoMiState.busquedaForzada = false;
        if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
    }
    if (!esBusqueda && NoMiState.busquedaWebActiva && requiereBusqueda(texto)) {
        esBusqueda = true; consulta = texto.trim();
    }
    if (esBusqueda && consulta) {
        ocultarCargando();
        document.getElementById('nomi-modelo-display').textContent = NoMiState.modeloActual;
        await procesarBusqueda(consulta);
        if (NoMiState.busquedaWebTemporal) { NoMiState.busquedaWebTemporal = false; }
        NoMiState.isWaiting = false;
        return;
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

    NoMiState.historial.push({role: 'user', content: texto});
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);

    const enviar = document.getElementById('nomi-enviar');
    if (input) input.disabled = true;
    if (enviar) enviar.disabled = true;
    mostrarCargando();

    try {
        let respuestaTexto;
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            // Modo explícito "Acceso compartido NoMi": usa el Worker (Bearer token).
            // El mensaje conserva continuidad (persona + resumen + turnos recientes
            // + contexto completo: fecha, ubicación y contenido de página) y
            // respeta el límite de bytes del Worker.
            actualizarIndicadorProveedor();
            document.getElementById('nomi-modelo-display').textContent = NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO;
            respuestaTexto = await llamarIANoMi(construirMensajeWorkerNoMi(mensajeFinal));
        } else {
            const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + NoMiState.apiKeyActual,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'NoMi Asistente'
                },
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
                if (input) input.disabled = false;
                if (enviar) enviar.disabled = false;
                if (input) input.focus();
                NoMiState.isWaiting = false;
                return;
            } else {
                agregarMensaje('bot', '❌ Error inesperado');
                NoMiState.historial.pop();
                guardarHistorial(NoMiState.historial);
                document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
                registrarError('script', 'Respuesta inesperada de la API', 'Sin detalles');
                if (input) input.disabled = false;
                if (enviar) enviar.disabled = false;
                if (input) input.focus();
                NoMiState.isWaiting = false;
                return;
            }
        }
        // Ruta de éxito común a ambos modos.
        ocultarCargando();
        NoMiState.contadorPreguntas++;
        setContador(NoMiState.contadorPreguntas);
        NoMiState.historial.push({role: 'assistant', content: respuestaTexto});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', respuestaTexto);
        actualizarStats();
        if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) {
            setTimeout(() => generarResumen(NoMiState.historial), 100);
        }
    } catch (error) {
        ocultarCargando();
        agregarMensaje('bot', '❌ ' + error.message);
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
        registrarError('network', error.message, `Modo: ${NoMiState.modoAcceso}, URL: ${NoMiState.urlBaseActual}`);
    }
    if (input) input.disabled = false;
    if (enviar) enviar.disabled = false;
    if (input) input.focus();
    NoMiState.isWaiting = false;
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
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NoMiState.apiKeyActual },
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
