// ======== MÓDULO: Chat y Mensajería ========
// NoMi Assistant – Funciones de renderizado y gestión del chat

function agregarMensaje(quien, texto) {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    const color = quien === 'yo' ? '#FF6B6B' : '#34a853';
    const nombre = quien === 'yo' ? 'Tú' : NOMBRE_ASISTENTE;
    const msg = document.createElement('div');
    msg.style.cssText = `
        margin:4px 0; padding:6px 10px; border-radius:10px;
        background:${color}33; border-left:3px solid ${color};
        font-size:12px; word-wrap:break-word;
    `;
    const nombreMsg = document.createElement('b');
    nombreMsg.style.color = color;
    nombreMsg.textContent = `${nombre}:`;
    msg.appendChild(nombreMsg);
    msg.appendChild(document.createTextNode(' ' + texto));
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Valida y normaliza una URL de fuente con el API URL (no solo regex): exige
// protocolo http/https absoluto y elimina query/hash (defensa en profundidad
// sobre la saneación del Worker). Devuelve null si no es segura.
function nomiUrlFuenteSegura(u) {
    if (typeof u !== 'string' || !u.trim()) return null;
    try {
        const parsed = new URL(u.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return null;
    }
}

// Respuesta sintetizada con fuentes web compactas. Renderizado 100% seguro
// (CSP/Trusted Types): solo nodos DOM y textContent, nunca HTML crudo. Los
// snippets usados por el modelo no se muestran al usuario como un volcado.
function agregarMensajeConFuentes(texto, resultados) {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return null;
    const color = '#34a853';
    const msg = document.createElement('div');
    msg.style.cssText = 'margin:4px 0; padding:6px 10px; border-radius:10px; background:#34a85333; border-left:3px solid #34a853; font-size:12px; word-wrap:break-word;';
    const nombreMsg = document.createElement('b');
    nombreMsg.style.color = color;
    nombreMsg.textContent = NOMBRE_ASISTENTE + ':';
    msg.appendChild(nombreMsg);
    msg.appendChild(document.createTextNode(' ' + String(texto || '')));
    const lista = (Array.isArray(resultados) ? resultados : []).slice(0, 3);
    if (lista.length > 0) {
        const etiqueta = document.createElement('div');
        etiqueta.style.cssText = 'color:#aaa;margin-top:7px;font-size:11px;';
        etiqueta.textContent = 'Fuentes:';
        msg.appendChild(etiqueta);
    }
    lista.forEach((r, indice) => {
        const item = document.createElement('div');
        item.style.cssText = 'margin-top:3px;font-size:11px;';
        const lineaTitulo = document.createElement('div');
        const vineta = document.createElement('b');
        vineta.textContent = '[' + (indice + 1) + '] ';
        lineaTitulo.appendChild(vineta);
        const urlSegura = nomiUrlFuenteSegura(r && r.url);
        if (urlSegura && r.titulo) {
            const a = document.createElement('a');
            a.href = urlSegura;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.color = '#8ab4ff';
            a.textContent = String(r.titulo);
            lineaTitulo.appendChild(a);
        } else if (urlSegura) {
            const a = document.createElement('a');
            a.href = urlSegura;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.color = '#8ab4ff';
            a.style.wordBreak = 'break-all';
            a.textContent = urlSegura;
            lineaTitulo.appendChild(a);
        } else if (r && r.titulo) {
            const spanTitulo = document.createElement('span');
            spanTitulo.textContent = String(r.titulo);
            lineaTitulo.appendChild(spanTitulo);
        }
        if (r && r.fecha) {
            const fecha = document.createElement('span');
            fecha.style.color = '#888';
            fecha.textContent = ' · ' + String(r.fecha);
            lineaTitulo.appendChild(fecha);
        }
        item.appendChild(lineaTitulo);
        msg.appendChild(item);
    });
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msg;
}

function cargarHistorial() {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    nomiVaciarNodo(chatBody);
    const mensajesMostrar = NoMiState.historial
        .filter(msg => msg.role !== 'system')
        .slice(-MENSAJES_VISIBLES);
    if (mensajesMostrar.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#666; text-align:center; padding:20px 0;';
        empty.textContent = '💬 Sin mensajes aún. ¡Pregunta algo!';
        chatBody.appendChild(empty);
        return;
    }
    mensajesMostrar.forEach(msg => {
        const esUsuario = msg.role === 'user';
        const color = esUsuario ? '#FF6B6B' : '#34a853';
        const nombre = esUsuario ? 'Tú' : NOMBRE_ASISTENTE;
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            margin:4px 0; padding:6px 10px; border-radius:10px;
            background:${color}33; border-left:3px solid ${color};
            font-size:12px; word-wrap:break-word;
        `;
        const nombreMsg = document.createElement('b');
        nombreMsg.style.color = color;
        nombreMsg.textContent = `${nombre}:`;
        msgDiv.appendChild(nombreMsg);
        msgDiv.appendChild(document.createTextNode(' ' + msg.content));
        chatBody.appendChild(msgDiv);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
}

function actualizarContextoIndicador() {
    const el = document.getElementById('nomi-contexto-indicador');
    if (el) {
        let texto = `📚 Contexto: ${NoMiState.contextoSeleccionado} mensajes`;
        if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) texto += ' + resumen';
        el.textContent = texto;
    }
}

function actualizarStats() {
    const counter = document.getElementById('nomi-token-counter');
    if (counter) counter.textContent = NoMiState.tokens.total;
    // El modelo mostrado respeta el proveedor activo: NoMi NO debe ser
    // sobrescrito por el modelo Personal (OpenRouter).
    actualizarIndicadorModelo();
    actualizarContextoIndicador();
    actualizarBarraUbicacion();
}

// Deshabilita los controles de envío (input, enviar y búsqueda) durante un
// envío. Se restauran SIEMPRE con restaurarControlesEnvio().
function deshabilitarControlesEnvio() {
    const input = document.getElementById('nomi-input');
    const enviar = document.getElementById('nomi-enviar');
    const buscar = document.getElementById('nomi-search-btn');
    if (input) input.disabled = true;
    if (enviar) enviar.disabled = true;
    if (buscar) buscar.disabled = true;
}

// Restaura los controles de envío (input, enviar y búsqueda) y devuelve el
// foco al input. Se llama en todas las salidas de preguntar().
function restaurarControlesEnvio() {
    const input = document.getElementById('nomi-input');
    const enviar = document.getElementById('nomi-enviar');
    const buscar = document.getElementById('nomi-search-btn');
    if (input) { input.disabled = false; input.focus(); }
    if (enviar) enviar.disabled = false;
    if (buscar) buscar.disabled = false;
}

function mostrarCargando() {
    const loading = document.getElementById('nomi-loading');
    if (loading) {
        loading.style.display = 'block';
        let count = 0;
        const dots = document.getElementById('nomi-dots');
        if (dots) {
            const interval = setInterval(() => {
                count = (count % 3) + 1;
                dots.textContent = '.'.repeat(count);
            }, 400);
            loading.dataset.interval = interval;
        }
    }
}

function ocultarCargando() {
    const loading = document.getElementById('nomi-loading');
    if (loading) {
        loading.style.display = 'none';
        if (loading.dataset.interval) {
            clearInterval(parseInt(loading.dataset.interval));
            delete loading.dataset.interval;
        }
    }
}

function toggleBurbuja(mostrar) {
    const bubble = document.getElementById('nomi-bubble');
    if (!bubble) return;
    if (mostrar === undefined) NoMiState.burbujaVisible = !NoMiState.burbujaVisible;
    else NoMiState.burbujaVisible = mostrar;
    bubble.style.display = NoMiState.burbujaVisible ? 'flex' : 'none';
}

function toggleVentana(mostrar) {
    const win = document.getElementById('nomi-chat');
    if (!win) return;
    if (mostrar === undefined) NoMiState.ventanaAbierta = !NoMiState.ventanaAbierta;
    else NoMiState.ventanaAbierta = mostrar;
    win.style.display = NoMiState.ventanaAbierta ? 'flex' : 'none';
    if (NoMiState.ventanaAbierta) {
        document.getElementById('nomi-input').focus();
        cargarHistorial();
        // Al abrir el chat, NoMi consulta el uso una vez (sin polling).
        actualizarHud();
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken) consultarUsoNoMi();
    }
}

function mostrarNotificacionTemporal(msg) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; bottom:100px; left:50%; transform:translateX(-50%);
        background:#1a1a2e; color:#fff; padding:12px 20px; border-radius:12px;
        font-size:14px; z-index:9999999; border:1px solid #4a4a6a;
        box-shadow:0 4px 16px rgba(0,0,0,0.5); text-align:center; max-width:80%;
    `;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}
