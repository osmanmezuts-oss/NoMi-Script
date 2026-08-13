// ======== MÓDULO: Asistente de Configuración Inicial ========
// NoMi Assistant – Función de creación del asistente de configuración inicial

function mostrarAsistenteConfiguracion() {
    const existing = document.getElementById('nomi-asistente-config');
    if (existing) existing.remove();

    const { w, h } = obtenerTamanoReal();
    const left = window.innerWidth / 2 - w / 2;
    const top = window.innerHeight / 2 - h / 2;

    const asistente = document.createElement('div');
    asistente.id = 'nomi-asistente-config';
    asistente.style.cssText = `
        position: fixed; left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px;
        max-width: 90vw; max-height: 90vh; background: #1a1a2e; border-radius: 20px;
        padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.9); z-index: 9999999;
        font-family: sans-serif; border: 2px solid #FF6B6B; display: flex;
        flex-direction: column; overflow-y: auto; color: #fff;
    `;
    asistente.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
            <h1 style="color: #FF6B6B; margin: 0; font-size: 24px;">🤖 ${NOMBRE_ASISTENTE}</h1>
            <p style="color: #888; font-size: 13px; margin: 4px 0;">Asistente IA para navegación</p>
            <p style="color: #555; font-size: 11px;">Versión ${VERSION_SCRIPT} | ${FECHA_LANZAMIENTO}</p>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 8px 0;">
            <div style="background: #0d0d1a; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="color: #4a6cf7; margin: 0 0 12px 0; font-size: 15px;">🔑 Configuración de credenciales</h3>
                <p style="color: #888; font-size: 12px; margin-bottom: 16px;">
                    Para usar ${NOMBRE_ASISTENTE}, necesitas configurar tus claves de API.
                    Puedes importarlas desde un archivo <b>.enc</b> (si tienes uno) o ingresarlas manualmente.
                </p>
                <button id="nomi-config-importar" style="width: 100%; padding: 12px; background: #4a6cf7; border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; margin-bottom: 12px;">📥 Importar desde archivo .enc</button>
                <div style="border-top: 1px solid #333; padding-top: 12px; margin-top: 8px;">
                    <p style="color: #888; font-size: 12px; margin-bottom: 8px;">✏️ O ingresa tus claves manualmente:</p>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">OpenRouter API Key *</label><input type="password" id="nomi-config-openrouter" placeholder="sk-or-v1-..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">Tavily API Key *</label><input type="password" id="nomi-config-tavily" placeholder="tvly-..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">Modelo (opcional)</label><input type="text" id="nomi-config-modelo" placeholder="${MODELO_POR_DEFECTO}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">URL Base (opcional)</label><input type="text" id="nomi-config-url" placeholder="${URL_BASE_POR_DEFECTO}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <button id="nomi-config-guardar" style="width: 100%; padding: 10px; background: #34a853; border: none; border-radius: 8px; color: #fff; font-size: 13px; cursor: pointer;">💾 Guardar credenciales</button>
                </div>
            </div>
            <div style="background: #0d0d1a; border-radius: 12px; padding: 12px; border: 1px solid #333;">
                <p style="color: #555; font-size: 10px; margin: 0; text-align: center;">ℹ️ Las claves se guardan localmente en tu navegador.<br>Puedes cambiarlas en cualquier momento desde el menú (⚙️).</p>
            </div>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px; flex-shrink: 0;">
            <button id="nomi-config-cerrar" style="flex: 1; padding: 8px; background: #333; border: none; border-radius: 8px; color: #888; font-size: 12px; cursor: pointer;">Cerrar (configurar más tarde)</button>
        </div>
    `;
    document.body.appendChild(asistente);

    document.getElementById('nomi-config-importar').onclick = () => importarCredenciales();
    document.getElementById('nomi-config-guardar').onclick = () => {
        const apiKey = document.getElementById('nomi-config-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-config-tavily').value.trim();
        const modelo = document.getElementById('nomi-config-modelo').value.trim() || MODELO_POR_DEFECTO;
        const urlBase = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.historial.length > 0) {
                const ultimoMensaje = NoMiState.historial[NoMiState.historial.length - 1];
                if (ultimoMensaje.role === 'assistant' && ultimoMensaje.content.includes('Aún no has importado')) {
                    NoMiState.historial.pop();
                    NoMiState.historial.push({role: 'assistant', content: '✅ Credenciales configuradas correctamente.\n\n¿En qué puedo ayudarle?'});
                    guardarHistorial(NoMiState.historial);
                    cargarHistorial();
                }
            }
            actualizarStats();
        }
    };
    document.getElementById('nomi-config-cerrar').onclick = () => {
        if (confirm('⚠️ Sin credenciales, NoMi no podrá responder preguntas ni buscar en la web.\n¿Estás seguro de que quieres continuar sin configurar?')) {
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.historial.length > 0) {
                const ultimoMensaje = NoMiState.historial[NoMiState.historial.length - 1];
                if (!(ultimoMensaje.role === 'assistant' && ultimoMensaje.content.includes('Aún no has importado'))) {
                    agregarMensaje('bot', '⚠️ **Aún no has configurado tus credenciales.**\n\nVe al menú (⚙️) y selecciona "Importar credenciales" o ingresa tus claves manualmente para activar la búsqueda web y el acceso a la IA.\n\nMientras tanto, puedo ayudarte con comandos básicos como `!cmd` para ver la lista de comandos.');
                }
            }
        }
    };
}

