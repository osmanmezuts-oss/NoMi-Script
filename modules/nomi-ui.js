// ======== MÓDULO: UI – Burbuja y Ventana ========
// NoMi Assistant – Funciones de creación de la burbuja flotante y la ventana de chat

// Constructor seguro de nodos DOM (sin sinks HTML ejecutables). Reutilizable por
// todos los módulos del bundle porque las declaraciones de función se elevan al
// ámbito global del userscript concatenado.
function nomiCrearNodo(tag, props) {
    const el = document.createElement(tag);
    if (!props) return el;
    if (props.id) el.id = props.id;
    if (props.clase) el.className = props.clase;
    if (props.css) el.style.cssText = props.css;
    if (props.titulo) el.title = props.titulo;
    if (props.valor != null) el.value = props.valor;
    if (props.marcado) el.checked = true;
    if (props.seleccionado) el.selected = true;
    if (props.deshabilitado) el.disabled = true;
    if (props.atributos) {
        for (const k in props.atributos) el.setAttribute(k, props.atributos[k]);
    }
    if (props.texto != null) el.textContent = props.texto;
    if (props.hijos) {
        for (const child of props.hijos) {
            if (child == null) continue;
            el.appendChild(child);
        }
    }
    return el;
}

// Vacía un nodo sin asignar HTML ni usar el método de vaciado moderno
// (incompatible con WebViews/Android antiguos). Usa firstChild/removeChild,
// soportado en todos los navegadores. Seguro frente a CSP/Trusted Types.
function nomiVaciarNodo(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

function crearBurbuja() {
    const existing = document.getElementById('nomi-bubble');
    if (existing) existing.remove();
    const bubble = document.createElement('div');
    bubble.id = 'nomi-bubble';
    bubble.textContent = '💬';
    bubble.style.cssText = 'position:fixed;left:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#1a1a2e;border:2px solid #FF6B6B;color:white;font-size:28px;cursor:pointer;z-index:999998;box-shadow:0 4px 16px rgba(255,107,107,0.5);display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;transition:transform 0.2s;';
    if (NoMiState.posicionBurbuja.x || NoMiState.posicionBurbuja.y) {
        bubble.style.left = NoMiState.posicionBurbuja.x + 'px';
        bubble.style.top = NoMiState.posicionBurbuja.y + 'px';
        bubble.style.right = 'auto';
        bubble.style.bottom = 'auto';
    }
    document.body.appendChild(bubble);
    NoMiState.burbujaVisible = true;

    let startX, startY, origX, origY, isDragging = false, isTouching = false;
    bubble.addEventListener('touchstart', (e) => {
        if (NoMiState.ventanaAbierta) return;
        const touch = e.touches[0];
        startX = touch.clientX; startY = touch.clientY;
        origX = bubble.offsetLeft || 0; origY = bubble.offsetTop || 0;
        isDragging = false; isTouching = true;
    }, { passive: true });
    bubble.addEventListener('touchmove', (e) => {
        if (!isTouching || NoMiState.ventanaAbierta) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX, dy = touch.clientY - startY;
        if (Math.sqrt(dx*dx + dy*dy) > 10) {
            isDragging = true;
            let newX = Math.max(0, Math.min(window.innerWidth - 56, origX + dx));
            let newY = Math.max(0, Math.min(window.innerHeight - 56, origY + dy));
            bubble.style.left = newX + 'px'; bubble.style.top = newY + 'px';
            bubble.style.right = 'auto'; bubble.style.bottom = 'auto';
            NoMiState.posicionBurbuja = { x: newX, y: newY };
            setPosicion(NoMiState.posicionBurbuja);
        }
    }, { passive: true });
    bubble.addEventListener('touchend', () => {
        isTouching = false;
        if (!isDragging) toggleVentana();
        isDragging = false;
    });

    let mouseDown = false, mouseStartX, mouseStartY, mouseOrigX, mouseOrigY, mouseDragging = false;
    bubble.addEventListener('mousedown', (e) => {
        if (NoMiState.ventanaAbierta) return;
        mouseDown = true;
        mouseStartX = e.clientX; mouseStartY = e.clientY;
        mouseOrigX = bubble.offsetLeft || 0; mouseOrigY = bubble.offsetTop || 0;
        mouseDragging = false;
    });
    document.addEventListener('mousemove', (e) => {
        if (!mouseDown || NoMiState.ventanaAbierta) return;
        const dx = e.clientX - mouseStartX, dy = e.clientY - mouseStartY;
        if (Math.sqrt(dx*dx + dy*dy) > 5) {
            mouseDragging = true;
            let newX = Math.max(0, Math.min(window.innerWidth - 56, mouseOrigX + dx));
            let newY = Math.max(0, Math.min(window.innerHeight - 56, mouseOrigY + dy));
            bubble.style.left = newX + 'px'; bubble.style.top = newY + 'px';
            bubble.style.right = 'auto'; bubble.style.bottom = 'auto';
            NoMiState.posicionBurbuja = { x: newX, y: newY };
            setPosicion(NoMiState.posicionBurbuja);
        }
    });
    document.addEventListener('mouseup', () => {
        if (mouseDown) {
            mouseDown = false;
            if (!mouseDragging) toggleVentana();
            mouseDragging = false;
        }
    });
}

function crearVentanaChat() {
    const existing = document.getElementById('nomi-chat');
    if (existing) existing.remove();
    const win = document.createElement('div');
    win.id = 'nomi-chat';
    const { w, h } = obtenerTamanoReal();
    let left = window.innerWidth - w - 20;
    let top = window.innerHeight - h - 90;
    if (NoMiState.posicionVentana.x && NoMiState.posicionVentana.y) {
        left = NoMiState.posicionVentana.x;
        top = NoMiState.posicionVentana.y;
    }
    left = Math.max(0, Math.min(window.innerWidth - w, left));
    top = Math.max(0, Math.min(window.innerHeight - h, top));

    win.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${w}px;height:${h}px;max-width:90vw;max-height:90vh;background:#1a1a2e;border-radius:20px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.9);z-index:999997;font-family:sans-serif;border:1px solid #4a4a6a;display:none;flex-direction:column;overflow:hidden;transition:none;`;
    NoMiState.posicionVentana = { x: left, y: top };
    setPosicionVentana(NoMiState.posicionVentana);

    const header = nomiCrearNodo('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#fff;flex-shrink:0;', hijos: [
        nomiCrearNodo('div', { css: 'display:flex;align-items:center;gap:8px;', hijos: [
            nomiCrearNodo('b', { css: 'font-size:13px;color:#FF6B6B;', texto: NOMBRE_ASISTENTE }),
            nomiCrearNodo('span', { id: 'nomi-proveedor-display', css: 'font-size:9px;color:#36c5f0;font-weight:bold;' }),
            nomiCrearNodo('span', { id: 'nomi-modelo-display', css: 'font-size:9px;color:#888;', texto: NoMiState.modeloActual })
        ]}),
        nomiCrearNodo('div', { hijos: [
            nomiCrearNodo('button', { id: 'nomi-web-btn', css: 'background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;', texto: '🌐' }),
            nomiCrearNodo('button', { id: 'nomi-stats-btn', titulo: 'Estadísticas', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;', texto: '📊' }),
            nomiCrearNodo('button', { id: 'nomi-export-btn', titulo: 'Exportar historial', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;', texto: '📤' }),
            nomiCrearNodo('button', { id: 'nomi-menu-btn', css: 'background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;', texto: '⚙️' })
        ]})
    ]});
    win.appendChild(header);

    const filaCtx = nomiCrearNodo('div', { css: 'display:flex;justify-content:space-between;font-size:9px;color:#555;flex-shrink:0;margin-bottom:4px;', hijos: [
        nomiCrearNodo('span', { id: 'nomi-contexto-indicador', texto: `📚 Contexto: ${NoMiState.contextoSeleccionado} mensajes` }),
        nomiCrearNodo('span', { id: 'nomi-web-status', css: 'display:none;color:#34a853;', texto: '🌐 Web activo' })
    ]});
    win.appendChild(filaCtx);

    const chatBody = nomiCrearNodo('div', { id: 'nomi-chat-body', css: 'flex:1;background:#0d0d1a;border-radius:12px;padding:8px;overflow-y:auto;margin-bottom:8px;font-size:12px;color:#ccc;min-height:100px;' });
    chatBody.appendChild(nomiCrearNodo('div', { css: 'color:#666;text-align:center;', texto: 'Cargando conversación...' }));
    win.appendChild(chatBody);

    const loading = nomiCrearNodo('div', { id: 'nomi-loading', css: 'display:none;color:#888;font-size:11px;font-style:italic;margin-bottom:4px;flex-shrink:0;', texto: '✍️ Escribiendo' });
    loading.appendChild(nomiCrearNodo('span', { id: 'nomi-dots', texto: '.' }));
    win.appendChild(loading);

    const input = nomiCrearNodo('input', { id: 'nomi-input', atributos: { type: 'text', placeholder: 'Pregunta...', autocomplete: 'off' } });
    input.style.cssText = 'flex:1;padding:8px;border-radius:10px;border:none;background:#0d0d1a;color:#fff;font-size:13px;';
    const filaInput = nomiCrearNodo('div', { css: 'display:flex;gap:6px;flex-shrink:0;', hijos: [
        input,
        nomiCrearNodo('button', { id: 'nomi-search-btn', titulo: 'Forzar búsqueda web de esta pregunta', css: 'background:#4a6cf7;border:none;border-radius:10px;padding:8px 12px;color:#fff;font-size:14px;cursor:pointer;margin-right:4px;', texto: '🔍' }),
        nomiCrearNodo('button', { id: 'nomi-enviar', css: 'background:#FF6B6B;border:none;border-radius:10px;padding:8px 14px;color:#fff;font-weight:bold;cursor:pointer;', texto: '➤' })
    ]});
    win.appendChild(filaInput);

    const ubicDisplay = nomiCrearNodo('span', { id: 'nomi-ubicacion-display', css: 'color:#888;font-size:10px;' });
    ubicDisplay.textContent = NoMiState.ubicacionActual ? `📍 ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}` : 'Ubicación desactivada';
    const tokLabel = nomiCrearNodo('span');
    tokLabel.appendChild(document.createTextNode('📊 Tokens: '));
    tokLabel.appendChild(nomiCrearNodo('span', { id: 'nomi-token-counter', texto: '0' }));
    const filaAbajo = nomiCrearNodo('div', { css: 'margin-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#555;flex-shrink:0;', hijos: [
        nomiCrearNodo('div', { hijos: [
            nomiCrearNodo('button', { id: 'nomi-lock-toggle', titulo: 'Bloquear/Desbloquear movimiento de la ventana', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0;z-index:999999;', texto: '🔓' })
        ]}),
        nomiCrearNodo('div', { css: 'display:flex;align-items:center;gap:6px;', hijos: [
            ubicDisplay,
            nomiCrearNodo('button', { id: 'nomi-ubicacion-update', titulo: 'Actualizar ubicación', css: 'background:none;border:none;color:#4a6cf7;font-size:12px;cursor:pointer;padding:0 4px;', texto: '⟳' }),
            tokLabel,
            nomiCrearNodo('button', { id: 'nomi-cerrar-chat', titulo: 'Cerrar chat', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0 6px;margin-left:4px;', texto: '✕' })
        ]})
    ]});
    win.appendChild(filaAbajo);
    document.body.appendChild(win);

    document.getElementById('nomi-ubicacion-update').onclick = () => {
        if (NoMiState.ubicacionActivada) actualizarUbicacion(false);
        else mostrarNotificacionTemporal('📍 La ubicación está desactivada. Actívala en el menú (⚙️).');
    };
    document.getElementById('nomi-search-btn').onclick = () => {
        const input = document.getElementById('nomi-input');
        const texto = input.value.trim();
        if (texto) { NoMiState.busquedaForzada = true; preguntar(texto); }
        else mostrarNotificacionTemporal('Escribe una pregunta antes de usar la lupa.');
    };
    document.getElementById('nomi-lock-toggle').onclick = function(e) {
        e.stopPropagation();
        NoMiState.ventanaBloqueada = !NoMiState.ventanaBloqueada;
        this.textContent = NoMiState.ventanaBloqueada ? '🔒' : '🔓';
    };
    document.getElementById('nomi-cerrar-chat').onclick = () => toggleVentana(false);

    let dragStartX, dragStartY, dragOrigLeft, dragOrigTop, isDraggingWin = false;
    win.addEventListener('mousedown', (e) => {
        if (NoMiState.ventanaBloqueada) return;
        if (e.target.closest('button') || e.target.closest('input')) return;
        if (e.clientY - win.getBoundingClientRect().top > 30) return;
        e.preventDefault();
        dragStartX = e.clientX; dragStartY = e.clientY;
        dragOrigLeft = win.offsetLeft; dragOrigTop = win.offsetTop;
        isDraggingWin = true;
        const onMove = (ev) => {
            if (!isDraggingWin) return;
            const dx = ev.clientX - dragStartX, dy = ev.clientY - dragStartY;
            let nl = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, dragOrigLeft + dx));
            let nt = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, dragOrigTop + dy));
            win.style.left = nl + 'px'; win.style.top = nt + 'px';
            NoMiState.posicionVentana = { x: nl, y: nt };
            setPosicionVentana(NoMiState.posicionVentana);
        };
        const onUp = () => { isDraggingWin = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    win.addEventListener('touchstart', (e) => {
        if (NoMiState.ventanaBloqueada) return;
        if (e.target.closest('button') || e.target.closest('input')) return;
        const touch = e.touches[0];
        if (touch.clientY - win.getBoundingClientRect().top > 30) return;
        e.preventDefault();
        dragStartX = touch.clientX; dragStartY = touch.clientY;
        dragOrigLeft = win.offsetLeft; dragOrigTop = win.offsetTop;
        isDraggingWin = true;
    }, {passive:false});
    win.addEventListener('touchmove', (e) => {
        if (NoMiState.ventanaBloqueada || !isDraggingWin) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX, dy = touch.clientY - dragStartY;
        let nl = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, dragOrigLeft + dx));
        let nt = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, dragOrigTop + dy));
        win.style.left = nl + 'px'; win.style.top = nt + 'px';
        NoMiState.posicionVentana = { x: nl, y: nt };
        setPosicionVentana(NoMiState.posicionVentana);
    }, {passive:false});
    win.addEventListener('touchend', () => { isDraggingWin = false; });

    document.getElementById('nomi-enviar').onclick = () => { const input = document.getElementById('nomi-input'); preguntar(input.value); };
    document.getElementById('nomi-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(document.getElementById('nomi-input').value); } });
    document.getElementById('nomi-web-btn').onclick = () => {
        NoMiState.modoWebActivo = !NoMiState.modoWebActivo;
        const status = document.getElementById('nomi-web-status');
        if (NoMiState.modoWebActivo) {
            status.style.display = 'inline';
            document.getElementById('nomi-web-btn').style.borderColor = '#34a853';
            document.getElementById('nomi-web-btn').style.color = '#34a853';
            agregarMensaje('bot', '🌐 Modo Web activado. La siguiente pregunta incluirá análisis de página.');
        } else {
            status.style.display = 'none';
            document.getElementById('nomi-web-btn').style.borderColor = '#555';
            document.getElementById('nomi-web-btn').style.color = '#888';
            agregarMensaje('bot', '🌐 Modo web desactivado.');
        }
    };
    document.getElementById('nomi-stats-btn').onclick = () => mostrarEstadisticas();
    document.getElementById('nomi-export-btn').onclick = () => mostrarExportacion();
    document.getElementById('nomi-menu-btn').onclick = () => mostrarMenu();

    document.getElementById('nomi-stats-btn').onclick = () => mostrarEstadisticas();
    document.getElementById('nomi-export-btn').onclick = () => mostrarExportacion();
    document.getElementById('nomi-menu-btn').onclick = () => mostrarMenu();

    actualizarContextoIndicador();
    actualizarStats();
    actualizarBarraUbicacion();
}

// ======== Indicador superior de proveedor y modelo ========
// Actualiza un solo dato del DOM a la vez. Devuelve el elemento o null (los
// stubs de los tests devuelven null para getElementById).
function actualizarIndicadorProveedor() {
    const el = document.getElementById('nomi-proveedor-display');
    if (!el) return;
    const esNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
    el.textContent = esNoMi ? PROVEEDOR_NOMI_LABEL : PROVEEDOR_OPENROUTER_LABEL;
    el.style.color = esNoMi ? '#36c5f0' : '#f5a623';
}

// Actualiza el texto del modelo mostrado según el proveedor activo.
function actualizarIndicadorModelo() {
    const el = document.getElementById('nomi-modelo-display');
    if (!el) return;
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
        el.textContent = (NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO);
    } else {
        el.textContent = NoMiState.modeloActual || MODELO_POR_DEFECTO;
    }
}

// Actualiza proveedor + modelo en una sola llamada.
function actualizarIndicador() {
    actualizarIndicadorProveedor();
    actualizarIndicadorModelo();
}

