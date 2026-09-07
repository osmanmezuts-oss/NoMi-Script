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

    const lineaEspacio = nomiCrearNodo('div', { css: 'margin-bottom:8px;font-size:11px;color:#555;' });
    lineaEspacio.appendChild(document.createTextNode('💾 Espacio ocupado: '));
    lineaEspacio.appendChild(nomiCrearNodo('span', { css: 'color:#888;', texto: espacioFormateado }));
    if (logs.length > 0) {
        lineaEspacio.appendChild(document.createTextNode(' | 📋 Errores: '));
        lineaEspacio.appendChild(nomiCrearNodo('span', { css: 'color:#f55036;', texto: String(logs.length) }));
    }
    lineaEspacio.appendChild(document.createTextNode(credCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'));

    const secOpen = nomiCrearNodo('div', { id: 'nomi-seccion-openrouter', css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' + (NoMiState.modoAcceso === 'nomi' ? 'opacity:0.5;pointer-events:none;' : '') });
    secOpen.appendChild(nomiCrearNodo('h3', { css: 'color:#4a6cf7;margin:0 0 8px 0;font-size:14px;', texto: '🔑 API Personal' }));
    if (NoMiState.modoAcceso === 'nomi') {
        secOpen.appendChild(nomiCrearNodo('div', { clase: 'nomi-openrouter-aviso', css: 'font-size:10px;color:#f5a623;margin-bottom:6px;font-weight:bold;', texto: 'Solo disponible en modo API Personal. Cambia el modo de acceso para usarlas.' }));
    }
    const filaOR = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaOR.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'API Key (API Personal)' }));
    filaOR.appendChild(nomiCrearNodo('input', { id: 'nomi-input-openrouter', valor: apiKeyActual, atributos: { type: 'password' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secOpen.appendChild(filaOR);
    const filaTav = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaTav.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Tavily API Key (opcional)' }));
    filaTav.appendChild(nomiCrearNodo('input', { id: 'nomi-input-tavily', valor: tavilyKeyActual, atributos: { type: 'password' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    filaTav.appendChild(nomiCrearNodo('div', { css: 'font-size:9px;color:#555;margin-top:2px;', texto: 'Opcional: solo para búsqueda web. Si no tienes, obtén una gratis en tavily.com' }));
    secOpen.appendChild(filaTav);
    const filaModeloMenu = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaModeloMenu.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo' }));
    // OpenRouter: selector poblado por el catálogo. Otra API: campo manual.
    const selModeloMenu = nomiCrearNodo('select', { id: 'nomi-input-modelo', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' });
    const inputModeloManual = nomiCrearNodo('input', { id: 'nomi-input-modelo-manual', valor: modeloActual, atributos: { type: 'text', placeholder: 'p. ej. gpt-4o-mini' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;display:none;' });
    filaModeloMenu.appendChild(selModeloMenu);
    filaModeloMenu.appendChild(inputModeloManual);
    filaModeloMenu.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-actualizar-modelos', css: 'flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;', texto: 'Actualizar' }),
        nomiCrearNodo('span', { id: 'nomi-estado-modelo', css: 'font-size:9px;color:#aaa;' })
    ]}));
    filaModeloMenu.appendChild(nomiCrearNodo('div', { id: 'nomi-nota-modelo', css: 'font-size:9px;color:#888;margin-top:4px;', texto: 'En OpenRouter se lista por latencia estimada. En otra API compatible, escribe el modelo manualmente.' }));
    secOpen.appendChild(filaModeloMenu);
    const filaUrl = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaUrl.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'URL Base' }));
    filaUrl.appendChild(nomiCrearNodo('input', { id: 'nomi-input-url', valor: urlBaseActual, atributos: { type: 'text' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secOpen.appendChild(filaUrl);
    secOpen.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-guardar-creds', css: 'flex:1;padding:8px;background:#4a6cf7;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '💾 Guardar' }),
        nomiCrearNodo('button', { id: 'nomi-importar-creds-menu', css: 'flex:1;padding:8px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '📥 Importar .enc' })
    ]}));
    secOpen.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#555;margin-top:4px;', texto: 'Las claves se guardan localmente en tu navegador.' }));

    const secMotor = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secMotor.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '🔍 Motor de búsqueda' }));
    secMotor.appendChild(nomiCrearNodo('select', { id: 'nomi-select-motor', css: 'width:100%;padding:8px;border-radius:8px;background:#0d0d1a;color:#fff;border:1px solid #555;', hijos: [
        nomiCrearNodo('option', { valor: 'tavily', seleccionado: motor === 'tavily', texto: 'Tavily (requiere clave)' }),
        nomiCrearNodo('option', { valor: 'ninguno', seleccionado: motor === 'ninguno', texto: 'Ninguno (sin búsqueda web)' })
    ]}));
    secMotor.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Elige el motor de búsqueda para obtener información actualizada.' }));

    const secDiag = nomiCrearNodo('div', { css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' });
    secDiag.appendChild(nomiCrearNodo('h3', { css: 'color:#36c5f0;margin:0 0 8px 0;font-size:14px;', texto: '🩺 Diagnóstico técnico' }));
    secDiag.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;', hijos: [
        document.createTextNode('Enviar diagnóstico de errores'),
        nomiCrearNodo('input', { id: 'nomi-check-diagnostico', marcado: diagnosticoActivo, atributos: { type: 'checkbox' } })
    ]}));
    secDiag.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:4px;', texto: 'Solo errores y contexto técnico (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa.' }));

    const estadoAcc = estadoAccesoNoMi();
    const txtEstadoAcc = estadoAcc === 'activo' ? '✅ Activo' : estadoAcc === 'revocado' ? '⛔ Revocado/inválido' : estadoAcc === 'pendiente' ? '⏳ Pendiente de activación' : 'Desactivado';
    const sinAccesoNoMi = estadoAcc !== 'activo';
    const secNomi = nomiCrearNodo('div', { css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' });
    secNomi.appendChild(nomiCrearNodo('h3', { css: 'color:#b06bff;margin:0 0 8px 0;font-size:14px;', texto: '🌐 Acceso NoMi' }));
    secNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;margin-bottom:8px;', texto: 'Principal: usa NoMi con tu invitación, sin claves propias.' }));
    secNomi.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Modo de acceso' }));
    secNomi.appendChild(nomiCrearNodo('select', { id: 'nomi-select-modo', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;', hijos: [
        nomiCrearNodo('option', { valor: 'nomi', seleccionado: NoMiState.modoAcceso === 'nomi', texto: 'NoMi — acceso con invitación' }),
        nomiCrearNodo('option', { valor: 'openrouter', seleccionado: NoMiState.modoAcceso === 'openrouter', texto: 'API Personal — avanzada' })
    ]}));
    secNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#aaa;margin:8px 0 4px;', hijos: [
        document.createTextNode('Estado: '),
        nomiCrearNodo('span', { id: 'nomi-estado-acceso', texto: txtEstadoAcc })
    ]}));
    const ctaActivar = nomiCrearNodo('button', { id: 'nomi-cta-activar', css: 'width:100%;padding:8px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-bottom:8px;', texto: '🔑 Activar acceso NoMi' });
    if (!sinAccesoNoMi) ctaActivar.style.display = 'none';
    ctaActivar.onclick = () => {
        const sel = document.getElementById('nomi-select-modo');
        if (sel) sel.value = 'nomi';
        aplicarCambioModo('nomi');
        const codigo = document.getElementById('nomi-input-codigo');
        if (codigo) codigo.focus();
    };
    secNomi.appendChild(ctaActivar);
    const secWorker = nomiCrearNodo('div', { id: 'nomi-seccion-worker', css: `display:${NoMiState.modoAcceso === 'nomi' ? 'block' : 'none'};margin-top:8px;` });
    secWorker.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#666;margin-bottom:6px;', hijos: [
        document.createTextNode('Worker: '),
        nomiCrearNodo('span', { css: 'color:#888;', texto: NOMI_WORKER_URL_POR_DEFECTO }),
        document.createTextNode(' (fijo, no editable)')
    ]}));
    const filaCodigo = nomiCrearNodo('div', { css: 'margin-bottom:6px;' });
    filaCodigo.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Código de invitación' }));
    filaCodigo.appendChild(nomiCrearNodo('input', { id: 'nomi-input-codigo', atributos: { type: 'text', placeholder: 'XXXX-XXXX' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secWorker.appendChild(filaCodigo);
    secWorker.appendChild(nomiCrearNodo('button', { id: 'nomi-activar-acceso', css: 'width:100%;padding:8px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-bottom:6px;', texto: '🔑 Activar con código' }));
    const filaModeloNomi = nomiCrearNodo('div', { css: 'margin-bottom:6px;' });
    filaModeloNomi.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo NoMi' }));
    const nomiModeloActual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    filaModeloNomi.appendChild(nomiCrearNodo('select', { id: 'nomi-select-modelo-nomi', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;', hijos: [
        nomiCrearNodo('option', { valor: nomiModeloActual, texto: nomiModeloActual })
    ]}));
    filaModeloNomi.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-actualizar-modelos-nomi', css: 'flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;', texto: 'Cargar modelos' }),
        nomiCrearNodo('span', { id: 'nomi-estado-modelo-nomi', css: 'font-size:9px;color:#aaa;' })
    ]}));
    secWorker.appendChild(filaModeloNomi);
    secWorker.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#555;margin-top:2px;', texto: 'Solo se guardan la URL pública (fija) y el token opaco. Nunca se guardan claves del Worker.' }));
    secWorker.appendChild(nomiCrearNodo('button', { id: 'nomi-cerrar-acceso-nomi', css: 'width:100%;padding:6px;background:#f55036;border:none;border-radius:8px;color:#fff;font-size:11px;cursor:pointer;margin-top:6px;', texto: '🗑️ Cerrar acceso (borra el token de este navegador)' }));
    secNomi.appendChild(secWorker);

    // Preferencia independiente de clima NoMi: desactivable aunque no haya API
    // Personal/Tavily configurada. No afecta a Tavily de Personal.
    const filaClimaAuto = nomiCrearNodo('div', { css: 'margin-top:10px;padding-top:8px;border-top:1px solid #333;' });
    filaClimaAuto.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;', hijos: [
        document.createTextNode('🌦️ Clima automático NoMi'),
        nomiCrearNodo('input', { id: 'nomi-check-clima-nomi', marcado: getClimaAutomatico(), atributos: { type: 'checkbox' } })
    ]}));
    filaClimaAuto.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:2px;', texto: 'El modelo reconoce la intención meteorológica por significado y consulta Open-Meteo desde NoMi. No exige comandos ni palabras concretas.' }));
    secNomi.appendChild(filaClimaAuto);

    // Preferencia independiente "Búsqueda web NoMi": Tavily SOLO en el Worker,
    // sin clave del usuario ni API Personal. Visible siempre y activada por defecto.
    const filaBusqNomi = nomiCrearNodo('div', { css: 'margin-top:10px;' });
    filaBusqNomi.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;', hijos: [
        document.createTextNode('🔎 Búsqueda web NoMi'),
        nomiCrearNodo('input', { id: 'nomi-check-busqueda-nomi', marcado: getBusquedaWebNomi(), atributos: { type: 'checkbox' } })
    ]}));
    filaBusqNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:2px;', texto: 'Busca en internet vía Tavily desde el servidor NoMi (sin tu clave ni API Personal). Desactívalo para enviar esas consultas por el chat normal.' }));
    secNomi.appendChild(filaBusqNomi);

    const secUbi = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secUbi.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('📍 Ubicación'),
        nomiCrearNodo('input', { id: 'nomi-check-ubicacion', marcado: NoMiState.ubicacionActivada, atributos: { type: 'checkbox' } })
    ]}));
    secUbi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Permite a NoMi conocer su ubicación para respuestas más precisas (clima, eventos, etc.).' }));
    secUbi.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#aaa;display:block;margin-top:7px;', texto: 'Ciudad habitual (opcional)' }));
    secUbi.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:5px;margin-top:3px;', hijos: [
        nomiCrearNodo('input', { id: 'nomi-input-ubicacion-habitual', valor: getUbicacionHabitual(), atributos: { type: 'text', maxlength: '120', placeholder: 'Santa Cruz de la Sierra, Bolivia' }, css: 'flex:1;min-width:0;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:11px;' }),
        nomiCrearNodo('button', { id: 'nomi-guardar-ubicacion-habitual', css: 'padding:6px 8px;background:#4a6cf7;border:none;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;', texto: 'Guardar' })
    ]}));
    secUbi.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#777;margin-top:3px;', texto: 'Se usa solo cuando la consulta no menciona otro lugar. Déjalo vacío para usar la ubicación del dispositivo o preguntar.' }));

    const secLig = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secLig.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🌿 Modo Ligero'),
        nomiCrearNodo('input', { id: 'nomi-check-ligero', marcado: NoMiState.modoLigeroActivo, atributos: { type: 'checkbox' } })
    ]}));
    secLig.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Reduce el texto extraído de páginas a 500 caracteres.' }));

    const secCtx = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secCtx.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '📌 Contexto' }));
    const radiosCtx = nomiCrearNodo('div', { css: 'display:flex;gap:8px;' });
    CONTEXTOS_DISPONIBLES.forEach(c => {
        radiosCtx.appendChild(nomiCrearNodo('label', { css: 'font-size:13px;display:flex;align-items:center;gap:4px;', hijos: [
            nomiCrearNodo('input', { atributos: { type: 'radio', name: 'contexto', value: String(c) }, marcado: NoMiState.contextoSeleccionado === c }),
            document.createTextNode(String(c))
        ]}));
    });
    secCtx.appendChild(radiosCtx);
    secCtx.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Número de mensajes enviados al modelo (recomendado: 10).' }));

    const secRes = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secRes.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🧠 Resumen persistente'),
        nomiCrearNodo('input', { id: 'nomi-check-resumen', marcado: NoMiState.modoResumenActivo, deshabilitado: resumenDisabled, atributos: { type: 'checkbox' } })
    ]}));
    secRes.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: resumenDisabled ? 'Solo disponible con 10 mensajes.' : 'Guarda un resumen de la conversación para contexto a largo plazo.' }));

    const secTam = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secTam.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '📐 Tamaño de la ventana' }));
    secTam.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;margin-top:4px;', hijos: [
        nomiCrearNodo('label', { hijos: [
            document.createTextNode('Ancho (px): '),
            nomiCrearNodo('input', { id: 'nomi-width-input', valor: String(w), atributos: { type: 'number', min: '280', step: '10' }, css: 'width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;' })
        ]}),
        nomiCrearNodo('label', { hijos: [
            document.createTextNode('Alto (px): '),
            nomiCrearNodo('input', { id: 'nomi-height-input', valor: String(h), atributos: { type: 'number', min: '300', step: '10' }, css: 'width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;' })
        ]})
    ]}));
    secTam.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:6px;margin-top:6px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-size-apply', css: 'padding:4px 12px;background:#4a6cf7;border:none;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Aplicar' }),
        nomiCrearNodo('button', { id: 'nomi-size-default', css: 'padding:4px 12px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Predeterminado' })
    ]}));

    const secBusq = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secBusq.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🔍 Búsqueda web'),
        nomiCrearNodo('input', { id: 'nomi-check-busqueda', marcado: NoMiState.busquedaWebActiva, deshabilitado: !credCargadas, atributos: { type: 'checkbox' } })
    ]}));
    secBusq.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: credCargadas ? 'Activa la búsqueda web automática (detección de palabras clave).' : 'Primero configura tus credenciales.' }));

    // ---- API Personal (avanzado): agrupa OpenRouter/Tavily ----
    // Cerrada por defecto solo si NO hay credenciales Y el modo activo no es
    // Personal (openrouter). Se abre sola si ya está configurada o activa.
    const personalCerrado = !(credCargadas || NoMiState.modoAcceso === MODO_ACCESO_OPENROUTER);
    const secPersonal = nomiCrearNodo('div', { css: 'margin-bottom:16px;' });
    const personalHeader = nomiCrearNodo('button', { id: 'nomi-personal-toggle', css: 'width:100%;padding:10px;background:#0d0d1a;border:1px solid #333;border-radius:12px;color:#fff;font-size:14px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;', hijos: [
        nomiCrearNodo('span', { texto: '🔧 API Personal (avanzado)' }),
        nomiCrearNodo('span', { id: 'nomi-personal-indicador', css: 'font-size:12px;color:#888;', texto: personalCerrado ? '▸' : '▾' })
    ]});
    const personalContent = nomiCrearNodo('div', { id: 'nomi-personal-content', css: 'margin-top:8px;' });
    personalContent.style.display = personalCerrado ? 'none' : 'block';
    personalContent.appendChild(secOpen);
    secPersonal.appendChild(personalHeader);
    secPersonal.appendChild(personalContent);
    personalHeader.onclick = () => {
        const c = document.getElementById('nomi-personal-content');
        const ind = document.getElementById('nomi-personal-indicador');
        if (!c) return;
        const oculto = c.style.display === 'none';
        c.style.display = oculto ? 'block' : 'none';
        if (ind) ind.textContent = oculto ? '▾' : '▸';
    };

    const contenedor = nomiCrearNodo('div', { css: 'margin:10px 0;' });
    contenedor.appendChild(lineaEspacio);
    contenedor.appendChild(secNomi);
    contenedor.appendChild(secPersonal);
    contenedor.appendChild(secMotor);
    contenedor.appendChild(secDiag);
    contenedor.appendChild(secUbi);
    contenedor.appendChild(secLig);
    contenedor.appendChild(secCtx);
    contenedor.appendChild(secRes);
    contenedor.appendChild(secTam);
    contenedor.appendChild(secBusq);
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-restaurar', css: 'width:100%;padding:10px;background:#555;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🔄 Restaurar posición' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-limpiar', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🗑️ Limpiar datos antiguos' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-exportar-logs', css: 'width:100%;padding:10px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '📤 Exportar logs de error' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-eliminar-global', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🗑️ Eliminar datos globales' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-cerrar-sesion', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🚪 Cerrar sesión' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-cerrar', css: 'width:100%;padding:10px;background:none;border:none;color:#888;font-size:14px;cursor:pointer;', texto: 'Cerrar' }));

    const pieAcerca = nomiCrearNodo('div', { css: 'margin-top:16px;padding-top:12px;border-top:1px solid #333;font-size:11px;color:#555;text-align:center;' });
    pieAcerca.appendChild(document.createTextNode('ℹ️ Acerca de NoMi'));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Asistente IA desarrollado por ${DISEÑADOR}`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode('Powered by API Personal (OpenAI-compatible)'));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Modelo: ${modeloActual}`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Versión: ${VERSION_SCRIPT} (${FECHA_LANZAMIENTO})`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(nomiCrearNodo('span', { css: 'color:#444;', texto: 'ℹ️ En páginas de configuración de Google (accounts.google.com), la burbuja puede no aparecer. Vuelva a la página anterior o recargue.' }));

    menu.appendChild(nomiCrearNodo('h2', { css: 'color:#FF6B6B;margin-top:0;', texto: '⚙️ Configuración' }));
    menu.appendChild(contenedor);
    menu.appendChild(pieAcerca);
    document.body.appendChild(menu);

    document.getElementById('nomi-menu-cerrar').onclick = () => menu.remove();
    document.getElementById('nomi-guardar-creds').onclick = () => {
        const apiKey = document.getElementById('nomi-input-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-input-tavily').value.trim();
        const urlBase = document.getElementById('nomi-input-url').value.trim() || URL_BASE_POR_DEFECTO;
        // El modelo se toma del selector (OpenRouter) o del campo manual (otra API).
        const esOR = esOpenRouter(urlBase);
        const modelo = esOR
            ? (document.getElementById('nomi-input-modelo').value.trim() || MODELO_POR_DEFECTO)
            : (document.getElementById('nomi-input-modelo-manual').value.trim() || MODELO_POR_DEFECTO);
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const modelDisplay = document.getElementById('nomi-modelo-display');
            if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
            actualizarStats();
            menu.remove();
            mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
        }
        };

    // ---- Visibilidad del campo Modelo según la URL ----
    // OpenRouter: selector poblado por el catálogo. Otra API compatible: campo manual.
    const actualizarVisibilidadModelo = () => {
        const url = (document.getElementById('nomi-input-url') && document.getElementById('nomi-input-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(url);
        const sel = document.getElementById('nomi-input-modelo');
        const inp = document.getElementById('nomi-input-modelo-manual');
        const btn = document.getElementById('nomi-actualizar-modelos');
        if (!sel || !inp) return;
        sel.style.display = esOR ? 'block' : 'none';
        inp.style.display = esOR ? 'none' : 'block';
        if (btn) btn.style.display = esOR ? 'flex' : 'none';
        if (!esOR && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
    };

    // ---- Selector guiado de modelo (OpenRouter) ----
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
    // Campo manual (otra API): persiste el modelo escrito sin consultar catálogo.
    const inpManual = document.getElementById('nomi-input-modelo-manual');
    if (inpManual) inpManual.addEventListener('input', () => {
        const v = inpManual.value.trim();
        if (v) setModelo(v);
    });
    // Al cambiar la URL base, se reevalúa si es OpenRouter y se muestra el control adecuado.
    const urlInput = document.getElementById('nomi-input-url');
    if (urlInput) urlInput.addEventListener('change', () => { actualizarVisibilidadModelo(); cargarModelosAlMenu(); });
    document.getElementById('nomi-actualizar-modelos').onclick = () => cargarModelosAlMenu(true);
    // Puebla el selector al abrir el menú (el caché de sessionStorage evita consultas repetidas).
    actualizarVisibilidadModelo();
    cargarModelosAlMenu();

    document.getElementById('nomi-importar-creds-menu').onclick = () => { importarCredenciales(); menu.remove(); };
    document.getElementById('nomi-check-diagnostico').onchange = (e) => {
        NoMiState.diagnosticoActivo = e.target.checked;
        setDiagnosticoActivo(NoMiState.diagnosticoActivo);
        menu.remove();
        mostrarNotificacionTemporal(`🩺 Diagnóstico técnico ${NoMiState.diagnosticoActivo ? 'activado' : 'desactivado'}.`);
    };

    // ---- Acceso compartido NoMi (Worker) ----
    // Alterna la sección OpenRouter (credenciales/modelo/URL) según el modo:
    // en modo NoMi se deshabilita visual y funcionalmente con el texto indicado.
    const alternarSeccionOpenRouter = () => {
        const sec = document.getElementById('nomi-seccion-openrouter');
        if (!sec) return;
        const esNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
        sec.style.opacity = esNoMi ? '0.5' : '1';
        sec.style.pointerEvents = esNoMi ? 'none' : 'auto';
        // Añade/quita el aviso "Solo disponible en modo API Personal".
        let aviso = sec.querySelector('.nomi-openrouter-aviso');
        const texto = 'Solo disponible en modo API Personal. Cambia el modo de acceso para usarlas.';
        if (esNoMi) {
            if (!aviso) {
                aviso = document.createElement('div');
                aviso.className = 'nomi-openrouter-aviso';
                aviso.style.cssText = 'font-size:10px;color:#f5a623;margin-bottom:6px;font-weight:bold;';
                sec.insertBefore(aviso, sec.firstChild.nextSibling);
            }
            aviso.textContent = texto;
        } else if (aviso) {
            aviso.remove();
        }
    };
    const aplicarCambioModo = (m) => {
        setModoAcceso(m);
        const sec = document.getElementById('nomi-seccion-worker');
        if (sec) sec.style.display = m === 'nomi' ? 'block' : 'none';
        alternarSeccionOpenRouter();
        actualizarIndicador();
        // Al cambiar de modo se limpia el estado HUD transitorio y la cuota
        // obsoleta (nunca se hereda límite/acceso inválido/capacidad de NoMi a Personal).
        NoMiState.usoNoMi = null;
        NoMiState.reintentarPregunta = '';
        NoMiState.reintentarBusquedaForzada = false;
        establecerEstadoHud(null);
        actualizarQuotaHud();
        mostrarNotificacionTemporal(`🌐 Modo de acceso: ${m === 'nomi' ? 'Acceso NoMi' : 'API Personal'}`);
    };
    const selModoNoMi = document.getElementById('nomi-select-modo');
    if (selModoNoMi) selModoNoMi.onchange = (e) => aplicarCambioModo(e.target.value);
    const activarNoMiBtn = document.getElementById('nomi-activar-acceso');
    if (activarNoMiBtn) activarNoMiBtn.onclick = async () => {
        const codigo = document.getElementById('nomi-input-codigo').value.trim();
        if (!codigo) { mostrarNotificacionTemporal('❌ Introduce el código de invitación.'); return; }
        activarNoMiBtn.disabled = true;
        activarNoMiBtn.textContent = '⏳ Activando…';
        try {
            // activarAccesoNoMi ahora devuelve { token, catalogo } y sincroniza el catálogo
            // antes de validar/mostrar el modelo. Durante la sincronización mostramos
            // "Verificando acceso..." y NO mostramos falso modelo no disponible/retirado.
            const resultado = await activarAccesoNoMi(codigo);
            setModoAcceso(MODO_ACCESO_NOMI);
            const sel = document.getElementById('nomi-select-modo');
            if (sel) sel.value = 'nomi';
            const sec = document.getElementById('nomi-seccion-worker');
            if (sec) sec.style.display = 'block';
            alternarSeccionOpenRouter();
            actualizarIndicador();
            const est = document.getElementById('nomi-estado-acceso');
            if (est) est.textContent = '✅ Activo';
            // Si el catálogo falló temporalmente, mostramos estado recuperable, no error de modelo.
            if (resultado.catalogo) {
                mostrarNotificacionTemporal('✅ Acceso NoMi activado. Catálogo sincronizado.');
            } else {
                mostrarNotificacionTemporal('✅ Acceso NoMi activado. Verificando catálogo…');
            }
            cargarModelosNoMiAlMenu();
            establecerEstadoHud(null);
            consultarUsoNoMi();
            const ctaAct = document.getElementById('nomi-cta-activar');
            if (ctaAct) ctaAct.style.display = 'none';
        } catch (err) {
            mostrarNotificacionTemporal('❌ ' + err.message);
        } finally {
            activarNoMiBtn.disabled = false;
            activarNoMiBtn.textContent = '🔑 Activar con código';
        }
    };
    const cerrarNoMiBtn = document.getElementById('nomi-cerrar-acceso-nomi');
    if (cerrarNoMiBtn) cerrarNoMiBtn.onclick = () => {
        cerrarAccesoNoMi();
        const est = document.getElementById('nomi-estado-acceso');
        if (est) est.textContent = '⏳ Pendiente de activación';
        const ctaAct = document.getElementById('nomi-cta-activar');
        if (ctaAct) ctaAct.style.display = 'block';
    };
    const actualizarNoMiModelos = document.getElementById('nomi-actualizar-modelos-nomi');
    if (actualizarNoMiModelos) actualizarNoMiModelos.onclick = () => cargarModelosNoMiAlMenu();
    if (getNomiToken()) cargarModelosNoMiAlMenu();
    document.getElementById('nomi-check-clima-nomi').onchange = (e) => {
        NoMiState.climaAutomatico = e.target.checked;
        setClimaAutomatico(NoMiState.climaAutomatico);
        menu.remove();
        mostrarNotificacionTemporal(`🌦️ Clima automático NoMi ${NoMiState.climaAutomatico ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-check-busqueda-nomi').onchange = (e) => {
        NoMiState.busquedaWebNomi = e.target.checked;
        setBusquedaWebNomi(NoMiState.busquedaWebNomi);
        menu.remove();
        mostrarNotificacionTemporal(`🔎 Búsqueda web NoMi ${NoMiState.busquedaWebNomi ? 'activada' : 'desactivada'}.`);
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
    document.getElementById('nomi-guardar-ubicacion-habitual').onclick = () => {
        const inputHabitual = document.getElementById('nomi-input-ubicacion-habitual');
        setUbicacionHabitual(inputHabitual ? inputHabitual.value : '');
        mostrarNotificacionTemporal(NoMiState.ubicacionHabitual
            ? `📍 Ubicación habitual guardada: ${NoMiState.ubicacionHabitual}`
            : '📍 Ubicación habitual eliminada.');
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
        const opcionesGlobal = ['📁 Historiales de chat (todos los dominios)','⚙️ Configuración (contexto, modos)','📍 Ubicación guardada','📋 Logs de errores','📐 Tamaño y posición de ventana','📊 Estadísticas de tokens'];
        dialog.appendChild(nomiCrearNodo('h3', { css: 'color:#FF6B6B;margin-top:0;', texto: '🗑️ Eliminar datos globales' }));
        dialog.appendChild(nomiCrearNodo('p', { css: 'font-size:13px;color:#888;', texto: 'Seleccione qué datos desea eliminar:' }));
        const cajaChecks = nomiCrearNodo('div', { css: 'margin:12px 0;' });
        opcionesGlobal.forEach((t, i) => {
            cajaChecks.appendChild(nomiCrearNodo('label', { css: 'display:block;margin:6px 0;font-size:13px;', hijos: [
                nomiCrearNodo('input', { id: `nomi-del-${i}`, marcado: true, atributos: { type: 'checkbox' } }),
                document.createTextNode(' ' + t)
            ]}));
        });
        dialog.appendChild(cajaChecks);
        dialog.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;margin-top:16px;', hijos: [
            nomiCrearNodo('button', { id: 'nomi-dialog-confirmar', css: 'flex:1;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;', texto: 'Eliminar seleccionados' }),
            nomiCrearNodo('button', { id: 'nomi-dialog-cancelar', css: 'flex:1;padding:10px;background:#333;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;', texto: 'Cancelar' })
        ]}));
        document.body.appendChild(dialog);
        document.getElementById('nomi-dialog-cancelar').onclick = () => dialog.remove();
        document.getElementById('nomi-dialog-confirmar').onclick = () => {
            const checks = [document.getElementById('nomi-del-0').checked, document.getElementById('nomi-del-1').checked, document.getElementById('nomi-del-2').checked, document.getElementById('nomi-del-3').checked, document.getElementById('nomi-del-4').checked, document.getElementById('nomi-del-5').checked];
            const keysToRemove = [];
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('nomi_')) {
                    if (checks[0] && key.startsWith('nomi_historial_')) keysToRemove.push(key);
                    else if (checks[1] && [STORAGE_CONTEXTO, STORAGE_MODO_LIGERO, STORAGE_MODO_RESUMEN, STORAGE_BUSQUEDA_WEB, STORAGE_TAMANO_VENTANA, STORAGE_VALIDADO, STORAGE_API_KEY, STORAGE_MODELO, STORAGE_URL].includes(key)) keysToRemove.push(key);
                    else if (checks[2] && (key === STORAGE_UBICACION || key === STORAGE_UBICACION_ACTIVADA || key === STORAGE_UBICACION_HABITUAL)) keysToRemove.push(key);
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
            ['STORAGE_API_KEY','STORAGE_TAVILY_KEY','STORAGE_MODELO','STORAGE_URL','STORAGE_POSICION','STORAGE_POSICION_VENTANA','STORAGE_RESUMEN','STORAGE_TOKENS','STORAGE_CONTADOR','STORAGE_CONTEXTO','STORAGE_MODO_LIGERO','STORAGE_MODO_RESUMEN','STORAGE_BUSQUEDA_WEB','STORAGE_TAMANO_VENTANA','STORAGE_UBICACION','STORAGE_UBICACION_ACTIVADA','STORAGE_UBICACION_HABITUAL','STORAGE_ERROR_LOGS','STORAGE_CREDENCIALES_CARGADAS','STORAGE_CONFIG_INICIAL','STORAGE_MOTOR_BUSQUEDA'].forEach(k => eliminarValor(eval(k)));
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
    // El catálogo de modelos gratuitos SOLO se consulta si la URL es OpenRouter.
    // En otra API compatible se conserva el modelo manual sin intentar catálogo.
    const url = (document.getElementById('nomi-input-url') && document.getElementById('nomi-input-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
    if (!esOpenRouter(url)) {
        if (estado) estado.textContent = 'API propia: usa el modelo manual.';
        const inp = document.getElementById('nomi-input-modelo-manual');
        if (inp && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
        return;
    }
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
        nomiVaciarNodo(select);
        const optActual = document.createElement('option');
        optActual.value = actual;
        optActual.textContent = actual;
        select.appendChild(optActual);
        select.disabled = false;
        return;
    }
    const actual = getModelo() || MODELO_POR_DEFECTO;
    nomiVaciarNodo(select);
    lista.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        let label = `${m.name} | ${m.id}`;
        if (m.context) label += ` | ctx ${m.context}`;
        if (m.posicion) label += ` | Latencia #${m.posicion}`;
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

// ---- Selector de modelos del catálogo NoMi (Worker) ----
// Puebla el <select id="nomi-select-modelo-nomi"> con los modelos groq activos
// del catálogo público. Conserva el modelo actual si no aparece.
async function cargarModelosNoMiAlMenu() {
    const select = document.getElementById('nomi-select-modelo-nomi');
    const estado = document.getElementById('nomi-estado-modelo-nomi');
    if (!select) return;
    if (estado) estado.textContent = 'Cargando…';
    try {
        const cat = await obtenerCatalogoNoMi();
        const lista = (cat && cat.modelos || []).filter(m => m && m.proveedor === 'groq' && m.estado === 'activo');
        const actual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
        nomiVaciarNodo(select);
        lista.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.nombre || m.id} | ${m.id}`;
            if (m.id === actual) opt.selected = true;
            select.appendChild(opt);
        });
        select.onchange = () => { setNomiModelo(select.value); actualizarIndicador(); };
        if (estado) estado.textContent = `${lista.length} modelos`;
    } catch (e) {
        if (estado) estado.textContent = 'No se pudo cargar el catálogo.';
        const actual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
        nomiVaciarNodo(select);
        const optActual = document.createElement('option');
        optActual.value = actual;
        optActual.textContent = actual;
        select.appendChild(optActual);
    }
}
