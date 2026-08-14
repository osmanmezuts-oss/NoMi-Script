// ======== MÓDULO: Menú de Configuración ========
// NoMi Assistant – Función de creación del menú de configuración (⚙️)

function mostrarMenu() {
    const existing = document.getElementById('nomi-menu');
    if (existing) { existing.style.display = existing.style.display === 'block' ? 'none' : 'block'; return; }
    const menu = document.createElement('div');
    menu.id = 'nomi-menu';
    menu.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border-radius:20px;padding:24px;z-index:9999999;color:#fff;border:1px solid #4a4a6a;box-shadow:0 8px 32px rgba(0,0,0,0.9);min-width:320px;max-width:90vw;max-height:80vh;overflow-y:auto;';
    const resumenDisabled = NoMiState.contextoSeleccionado !== 10;
    const { w, h } = NoMiState.tamanoVentana;
    const espacioOcupado = calcularEspacioOcupado();
    const espacioFormateado = espacioOcupado > 1024 ? `${Math.round(espacioOcupado/1024)} KB` : `${espacioOcupado} B`;
    const logs = getValor(STORAGE_ERROR_LOGS, []);
    const credCargadas = getCredencialesCargadas();
    const apiKeyActual = getApiKey();
    const tavilyKeyActual = getTavilyKey();
    const modeloActual = getModelo();
    const urlBaseActual = getUrlBase();
    const motor = getMotorBusqueda();
    const diagnosticoActivo = getDiagnosticoActivo();

    menu.innerHTML = `
        <h2 style="color:#FF6B6B;margin-top:0;">⚙️ Configuración</h2>
        <div style="margin:10px 0;">
            <div style="margin-bottom:8px;font-size:11px;color:#555;">💾 Espacio ocupado: <span style="color:#888;">${espacioFormateado}</span>${logs.length > 0 ? ` | 📋 Errores: <span style="color:#f55036;">${logs.length}</span>` : ''}${credCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'}</div>
            <div style="margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;">
                <h3 style="color:#4a6cf7;margin:0 0 8px 0;font-size:14px;">🔑 Credenciales</h3>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">OpenRouter API Key</label><input type="password" id="nomi-input-openrouter" value="${apiKeyActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></div>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Tavily API Key</label><input type="password" id="nomi-input-tavily" value="${tavilyKeyActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"><div style="font-size:9px;color:#555;margin-top:2px;">Si no tienes, obtén una gratis en tavily.com</div></div>
                                <div style="margin-bottom:8px;">
                    <label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Modelo gratuito</label>
                    <select id="nomi-input-modelo" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></select>
                    <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
                        <button id="nomi-actualizar-modelos" style="flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;">Actualizar</button>
                        <span id="nomi-estado-modelo" style="font-size:9px;color:#aaa;"></span>
                    </div>
                    <div style="font-size:9px;color:#888;margin-top:4px;">Lista ordenada por latencia estimada de OpenRouter.</div>
                </div>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">URL Base</label><input type="text" id="nomi-input-url" value="${urlBaseActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></div>
                <div style="display:flex;gap:8px;"><button id="nomi-guardar-creds" style="flex:1;padding:8px;background:#4a6cf7;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;">💾 Guardar</button><button id="nomi-importar-creds-menu" style="flex:1;padding:8px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;">📥 Importar .enc</button></div>
                <div style="font-size:10px;color:#555;margin-top:4px;">Las claves se guardan localmente en tu navegador.</div>
            </div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">🔍 Motor de búsqueda</label><select id="nomi-select-motor" style="width:100%;padding:8px;border-radius:8px;background:#0d0d1a;color:#fff;border:1px solid #555;"><option value="tavily" ${motor === 'tavily' ? 'selected' : ''}>Tavily (requiere clave)</option><option value="ninguno" ${motor === 'ninguno' ? 'selected' : ''}>Ninguno (sin búsqueda web)</option></select><div style="font-size:11px;color:#888;">Elige el motor de búsqueda para obtener información actualizada.</div></div>
            <div style="margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;">
                <h3 style="color:#36c5f0;margin:0 0 8px 0;font-size:14px;">🩺 Diagnóstico técnico</h3>
                <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;"><span>Enviar diagnóstico de errores</span><input type="checkbox" id="nomi-check-diagnostico" ${diagnosticoActivo ? 'checked' : ''}></label>
                <div style="font-size:10px;color:#888;margin-top:4px;">Solo errores y contexto técnico (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa.</div>
            </div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>📍 Ubicación</span><input type="checkbox" id="nomi-check-ubicacion" ${NoMiState.ubicacionActivada ? 'checked' : ''}></label><div style="font-size:11px;color:#888;">Permite a NoMi conocer su ubicación para respuestas más precisas (clima, eventos, etc.).</div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🌿 Modo Ligero</span><input type="checkbox" id="nomi-check-ligero" ${NoMiState.modoLigeroActivo ? 'checked' : ''}></label><div style="font-size:11px;color:#888;">Reduce el texto extraído de páginas a 500 caracteres.</div></div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">📌 Contexto</label><div style="display:flex;gap:8px;">${CONTEXTOS_DISPONIBLES.map(c => `<label style="font-size:13px;display:flex;align-items:center;gap:4px;"><input type="radio" name="contexto" value="${c}" ${NoMiState.contextoSeleccionado === c ? 'checked' : ''}>${c}</label>`).join('')}</div><div style="font-size:11px;color:#888;">Número de mensajes enviados al modelo (recomendado: 10).</div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🧠 Resumen persistente</span><input type="checkbox" id="nomi-check-resumen" ${NoMiState.modoResumenActivo ? 'checked' : ''} ${resumenDisabled ? 'disabled' : ''}></label><div style="font-size:11px;color:#888;">${resumenDisabled ? 'Solo disponible con 10 mensajes.' : 'Guarda un resumen de la conversación para contexto a largo plazo.'}</div></div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">📐 Tamaño de la ventana</label><div style="display:flex;gap:8px;margin-top:4px;"><label>Ancho (px): <input type="number" id="nomi-width-input" value="${w}" min="280" step="10" style="width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;"></label><label>Alto (px): <input type="number" id="nomi-height-input" value="${h}" min="300" step="10" style="width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;"></label></div><div style="display:flex;gap:6px;margin-top:6px;"><button id="nomi-size-apply" style="padding:4px 12px;background:#4a6cf7;border:none;border-radius:6px;color:#fff;cursor:pointer;">Aplicar</button><button id="nomi-size-default" style="padding:4px 12px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer;">Predeterminado</button></div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🔍 Búsqueda web</span><input type="checkbox" id="nomi-check-busqueda" ${NoMiState.busquedaWebActiva ? 'checked' : ''} ${credCargadas ? '' : 'disabled'}></label><div style="font-size:11px;color:#888;">${credCargadas ? 'Activa la búsqueda web automática (detección de palabras clave).' : 'Primero configura tus credenciales.'}</div></div>
            <button id="nomi-menu-restaurar" style="width:100%;padding:10px;background:#555;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🔄 Restaurar posición</button>
            <button id="nomi-menu-limpiar" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🗑️ Limpiar datos antiguos</button>
            <button id="nomi-menu-exportar-logs" style="width:100%;padding:10px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">📤 Exportar logs de error</button>
            <button id="nomi-menu-eliminar-global" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🗑️ Eliminar datos globales</button>
            <button id="nomi-menu-cerrar-sesion" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🚪 Cerrar sesión</button>
            <button id="nomi-menu-cerrar" style="width:100%;padding:10px;background:none;border:none;color:#888;font-size:14px;cursor:pointer;">Cerrar</button>
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #333;font-size:11px;color:#555;text-align:center;">ℹ️ <b>Acerca de NoMi</b><br>Asistente IA desarrollado por <b>${DISEÑADOR}</b><br>Powered by <b>OpenRouter</b> & <b>Tavily</b><br>Modelo: <b>${modeloActual}</b><br>Versión: <b>${VERSION_SCRIPT}</b> (${FECHA_LANZAMIENTO})<br><span style="color:#444;">ℹ️ En páginas de configuración de Google (accounts.google.com), la burbuja puede no aparecer. Vuelva a la página anterior o recargue.</span></div>
    `;
    document.body.appendChild(menu);

    document.getElementById('nomi-menu-cerrar').onclick = () => menu.remove();
    document.getElementById('nomi-guardar-creds').onclick = () => {
        const apiKey = document.getElementById('nomi-input-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-input-tavily').value.trim();
        const modelo = document.getElementById('nomi-input-modelo').value.trim() || MODELO_POR_DEFECTO;
        const urlBase = document.getElementById('nomi-input-url').value.trim() || URL_BASE_POR_DEFECTO;
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const modelDisplay = document.getElementById('nomi-modelo-display');
            if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
            actualizarStats();
            menu.remove();
            mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
        }
        };

    // ---- Selector guiado de modelo gratuito ----
    // Cambiar el modelo es siempre explícito del usuario: aquí sólo reacciona al <select>.
    document.getElementById('nomi-input-modelo').addEventListener('change', () => {
        const sel = document.getElementById('nomi-input-modelo');
        const elegido = (sel && sel.value) || '';
        if (!elegido) return;
        setModelo(elegido);              // persiste vía getModelo/setModelo.
        limpiarAvisoModelo();            // modelo válido → retira aviso de retirado/verificación.
        const display = document.getElementById('nomi-modelo-display');
        if (display) display.textContent = NoMiState.modeloActual;
    });
    document.getElementById('nomi-actualizar-modelos').onclick = () => cargarModelosAlMenu(true);
    // Puebla el selector al abrir el menú (el caché de sessionStorage evita consultas repetidas).
    cargarModelosAlMenu();

    document.getElementById('nomi-importar-creds-menu').onclick = () => { importarCredenciales(); menu.remove(); };
    document.getElementById('nomi-check-diagnostico').onchange = (e) => {
        NoMiState.diagnosticoActivo = e.target.checked;
        setDiagnosticoActivo(NoMiState.diagnosticoActivo);
        menu.remove();
        mostrarNotificacionTemporal(`🩺 Diagnóstico técnico ${NoMiState.diagnosticoActivo ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-select-motor').onchange = (e) => {
        NoMiState.motorBusqueda = e.target.value;
        setMotorBusqueda(NoMiState.motorBusqueda);
        mostrarNotificacionTemporal(`🔍 Motor de búsqueda: ${NoMiState.motorBusqueda === 'tavily' ? 'Tavily' : 'Desactivado'}`);
    };
    document.getElementById('nomi-check-ubicacion').onchange = (e) => {
        NoMiState.ubicacionActivada = e.target.checked;
        setUbicacionActivada(NoMiState.ubicacionActivada);
        if (NoMiState.ubicacionActivada) {
            if (!NoMiState.ubicacionActual) actualizarUbicacion(false);
            else mostrarNotificacionTemporal(`📍 Ubicación activada: ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}`);
        } else {
            if (NoMiState.ubicacionActual && confirm('¿Quieres eliminar la ubicación guardada?')) {
                eliminarValor(STORAGE_UBICACION);
                NoMiState.ubicacionActual = null;
                mostrarNotificacionTemporal('📍 Ubicación eliminada.');
            }
        }
        actualizarBarraUbicacion();
        menu.remove();
    };
    document.getElementById('nomi-menu-limpiar').onclick = () => {
        if (confirm('¿Eliminar todos los historiales de más de 7 días? Esta acción no se puede deshacer.')) {
            const resultado = limpiarHistorialesAntiguos();
            mostrarNotificacionTemporal(`🧹 ${resultado.eliminados} historiales eliminados. Espacio liberado: ~${Math.round(resultado.espacioLiberado/1024)} KB`);
            menu.remove();
        }
    };
    document.getElementById('nomi-menu-exportar-logs').onclick = () => { exportarLogs(); menu.remove(); };
    document.getElementById('nomi-menu-eliminar-global').onclick = () => {
        const dialog = document.createElement('div');
        dialog.id = 'nomi-dialog-global';
        dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border-radius:20px;padding:24px;z-index:99999999;color:#fff;border:1px solid #4a4a6a;box-shadow:0 8px 32px rgba(0,0,0,0.9);min-width:280px;max-width:90vw;max-height:80vh;overflow-y:auto;';
        dialog.innerHTML = `<h3 style="color:#FF6B6B;margin-top:0;">🗑️ Eliminar datos globales</h3><p style="font-size:13px;color:#888;">Seleccione qué datos desea eliminar:</p><div style="margin:12px 0;">${['📁 Historiales de chat (todos los dominios)','⚙️ Configuración (contexto, modos)','📍 Ubicación guardada','📋 Logs de errores','📐 Tamaño y posición de ventana','📊 Estadísticas de tokens'].map((t,i) => `<label style="display:block;margin:6px 0;font-size:13px;"><input type="checkbox" id="nomi-del-${i}" checked> ${t}</label>`).join('')}</div><div style="display:flex;gap:8px;margin-top:16px;"><button id="nomi-dialog-confirmar" style="flex:1;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;">Eliminar seleccionados</button><button id="nomi-dialog-cancelar" style="flex:1;padding:10px;background:#333;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;">Cancelar</button></div>`;
        document.body.appendChild(dialog);
        document.getElementById('nomi-dialog-cancelar').onclick = () => dialog.remove();
        document.getElementById('nomi-dialog-confirmar').onclick = () => {
            const checks = [document.getElementById('nomi-del-0').checked, document.getElementById('nomi-del-1').checked, document.getElementById('nomi-del-2').checked, document.getElementById('nomi-del-3').checked, document.getElementById('nomi-del-4').checked, document.getElementById('nomi-del-5').checked];
            const keysToRemove = [];
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('nomi_')) {
                    if (checks[0] && key.startsWith('nomi_historial_')) keysToRemove.push(key);
                    else if (checks[1] && [STORAGE_CONTEXTO, STORAGE_MODO_LIGERO, STORAGE_MODO_RESUMEN, STORAGE_BUSQUEDA_WEB, STORAGE_TAMANO_VENTANA, STORAGE_VALIDADO, STORAGE_API_KEY, STORAGE_MODELO, STORAGE_URL].includes(key)) keysToRemove.push(key);
                    else if (checks[2] && (key === STORAGE_UBICACION || key === STORAGE_UBICACION_ACTIVADA)) keysToRemove.push(key);
                    else if (checks[3] && key === STORAGE_ERROR_LOGS) keysToRemove.push(key);
                    else if (checks[4] && (key === STORAGE_POSICION || key === STORAGE_POSICION_VENTANA)) keysToRemove.push(key);
                    else if (checks[5] && [STORAGE_TOKENS, STORAGE_CONTADOR, STORAGE_RESUMEN].includes(key)) keysToRemove.push(key);
                    if (checks[0] && key.startsWith('nomi_chats_list_')) keysToRemove.push(key);
                }
            });
            if (keysToRemove.length === 0) { mostrarNotificacionTemporal('No hay datos seleccionados para eliminar.'); dialog.remove(); return; }
            if (confirm(`¿Eliminar ${keysToRemove.length} elemento(s)? Esta acción no se puede deshacer.`)) {
                keysToRemove.forEach(k => { localStorage.removeItem(k); eliminarValor(k); });
                mostrarNotificacionTemporal(`✅ ${keysToRemove.length} elemento(s) eliminado(s). La página se recargará.`);
                dialog.remove();
                setTimeout(() => location.reload(), 1500);
            }
        };
        menu.remove();
    };
    document.getElementById('nomi-menu-cerrar-sesion').onclick = () => {
        if (confirm('¿Cerrar sesión? Se borrarán los datos de validación y credenciales.')) {
            setValidado(false);
            ['STORAGE_API_KEY','STORAGE_TAVILY_KEY','STORAGE_MODELO','STORAGE_URL','STORAGE_POSICION','STORAGE_POSICION_VENTANA','STORAGE_RESUMEN','STORAGE_TOKENS','STORAGE_CONTADOR','STORAGE_CONTEXTO','STORAGE_MODO_LIGERO','STORAGE_MODO_RESUMEN','STORAGE_BUSQUEDA_WEB','STORAGE_TAMANO_VENTANA','STORAGE_UBICACION','STORAGE_UBICACION_ACTIVADA','STORAGE_ERROR_LOGS','STORAGE_CREDENCIALES_CARGADAS','STORAGE_CONFIG_INICIAL','STORAGE_MOTOR_BUSQUEDA'].forEach(k => eliminarValor(eval(k)));
            Object.keys(localStorage).filter(k => k.startsWith('nomi_historial_')).forEach(k => localStorage.removeItem(k));
            location.reload();
        }
    };
    document.getElementById('nomi-menu-restaurar').onclick = () => {
        const { w, h } = obtenerTamanoReal();
        const win = document.getElementById('nomi-chat');
        if (win) {
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = window.innerWidth - w - 20, top = window.innerHeight - h - 90;
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal('✅ Posición restaurada.');
    };
    document.getElementById('nomi-size-apply').onclick = () => {
        const w = parseInt(document.getElementById('nomi-width-input').value), h = parseInt(document.getElementById('nomi-height-input').value);
        if (w < MIN_WIDTH || h < MIN_HEIGHT) { mostrarNotificacionTemporal(`❌ El mínimo es ${MIN_WIDTH}x${MIN_HEIGHT}.`); return; }
        setTamanoVentana({ w, h });
        const win = document.getElementById('nomi-chat');
        if (win) {
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = Math.max(0, Math.min(window.innerWidth - w, win.offsetLeft)), top = Math.max(0, Math.min(window.innerHeight - h, win.offsetTop));
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal(`✅ Tamaño aplicado: ${w}x${h}`);
    };
    document.getElementById('nomi-size-default').onclick = () => {
        setTamanoVentana({ w: ANCHO_POR_DEFECTO, h: ALTO_POR_DEFECTO });
        const win = document.getElementById('nomi-chat');
        if (win) {
            const { w, h } = obtenerTamanoReal();
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = window.innerWidth - w - 20, top = window.innerHeight - h - 90;
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal('✅ Tamaño predeterminado restaurado.');
    };
    document.querySelectorAll('input[name="contexto"]').forEach(el => {
        el.onchange = () => {
            NoMiState.contextoSeleccionado = parseInt(el.value);
            setContexto(NoMiState.contextoSeleccionado);
            const resumenCheck = document.getElementById('nomi-check-resumen');
            if (NoMiState.contextoSeleccionado !== 10) { resumenCheck.disabled = true; resumenCheck.checked = false; setModoResumen(false); NoMiState.modoResumenActivo = false; }
            else resumenCheck.disabled = false;
            actualizarContextoIndicador();
            menu.remove();
            mostrarNotificacionTemporal(`✅ Contexto actualizado a ${NoMiState.contextoSeleccionado} mensajes.`);
        };
    });
    document.getElementById('nomi-check-ligero').onchange = (e) => { NoMiState.modoLigeroActivo = e.target.checked; setModoLigero(NoMiState.modoLigeroActivo); menu.remove(); mostrarNotificacionTemporal(`✅ Modo ligero ${NoMiState.modoLigeroActivo ? 'activado' : 'desactivado'}.`); };
    document.getElementById('nomi-check-resumen').onchange = (e) => {
        if (NoMiState.contextoSeleccionado !== 10) { e.target.checked = false; return; }
        NoMiState.modoResumenActivo = e.target.checked;
        setModoResumen(NoMiState.modoResumenActivo);
        if (NoMiState.modoResumenActivo && !NoMiState.resumenPersistente) generarResumen(NoMiState.historial);
        actualizarContextoIndicador();
        menu.remove();
        mostrarNotificacionTemporal(`🧠 Resumen persistente ${NoMiState.modoResumenActivo ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-check-busqueda').onchange = (e) => {
        if (!NoMiState.credencialesCargadas) { e.target.checked = false; mostrarNotificacionTemporal('Primero configura tus credenciales en la sección "Credenciales".'); return; }
        NoMiState.busquedaWebActiva = e.target.checked;
        setBusquedaWeb(NoMiState.busquedaWebActiva);
        menu.remove();
        mostrarNotificacionTemporal(`🔍 Búsqueda web ${NoMiState.busquedaWebActiva ? 'activada' : 'desactivada'}.`);
    };
}

// ---- Poblado del selector de modelos gratuitos ----
// Reemplaza el texto del <select> por las opciones del catálogo filtrado (solo :free, precio 0).
// Mantiene el modelo actual seleccionado si sigue siendo gratuito; en caso de error
// conserva el modelo actual (nunca se cambia automáticamente).
async function cargarModelosAlMenu(force) {
    const select = document.getElementById('nomi-input-modelo');
    const estado = document.getElementById('nomi-estado-modelo');
    if (!select) return;
    estado.textContent = 'Cargando…';
    select.disabled = true;
    let lista = [];
    try {
        lista = await fetchFreeModelos(force);
    } catch (e) {
        estado.textContent = e instanceof OpenRouterRateLimitError
            ? 'Limitado (429). Conserva el modelo actual.'
            : 'No se pudo cargar. Conserva el modelo actual.';
        const actual = getModelo() || MODELO_POR_DEFECTO;
        select.innerHTML = `<option value="${actual}">${actual}</option>`;
        select.disabled = false;
        return;
    }
    const actual = getModelo() || MODELO_POR_DEFECTO;
    select.innerHTML = '';
    lista.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        let label = `${m.name} | ${m.id}`;
        if (m.context) label += ` | ctx ${m.context}`;
        if (m.id === MODELO_POR_DEFECTO) label += ' — Recomendado';
        if (m.id === actual) opt.selected = true;
        opt.textContent = label;
        select.appendChild(opt);
    });
    if (!lista.some(m => m.id === actual)) {
        const opt = document.createElement('option');
        opt.value = actual; opt.disabled = true; opt.selected = true;
        opt.textContent = `${actual} — (no disponible gratis en esta lista)`;
        select.appendChild(opt);
    }
    estado.textContent = `${lista.length} modelos gratuitos`;
    select.disabled = false;
}
