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
    msg.innerHTML = `<b style="color:${color};">${nombre}:</b> ${texto}`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function cargarHistorial() {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    chatBody.innerHTML = '';
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
        msgDiv.innerHTML = `<b style="color:${color};">${nombre}:</b> ${msg.content}`;
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
    const modelDisplay = document.getElementById('nomi-modelo-display');
    if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
    actualizarContextoIndicador();
    actualizarBarraUbicacion();
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
```

---
