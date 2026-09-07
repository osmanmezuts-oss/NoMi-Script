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
    const cabecera = nomiCrearNodo('div', { css: 'text-align:center;margin-bottom:16px;', hijos: [
        nomiCrearNodo('h1', { css: 'color:#FF6B6B;margin:0;font-size:24px;', texto: `🤖 ${NOMBRE_ASISTENTE}` }),
        nomiCrearNodo('p', { css: 'color:#888;font-size:13px;margin:4px 0;', texto: 'Asistente IA para navegación' }),
        nomiCrearNodo('p', { css: 'color:#555;font-size:11px;', texto: `Versión ${VERSION_SCRIPT} | ${FECHA_LANZAMIENTO}` })
    ]});
    asistente.appendChild(cabecera);

    const scroll = nomiCrearNodo('div', { css: 'flex:1;overflow-y:auto;padding:8px 0;' });

    // ---- Acceso NoMi (principal en instalación limpia) ----
    // Primera sección visible: activar con código de invitación normal o recuperar
    // el acceso propietario permanente con su clave. NO exige credenciales de API
    // Personal/.enc ni cerrar el asistente para activar NoMi. La clave propietaria
    // se envía una vez al Worker y NUNCA se persiste en el navegador (solo el token).
    const secNoMi = nomiCrearNodo('div', { id: 'nomi-config-seccion-nomi', css: 'background:#0d0d1a;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #b06bff;' });
    secNoMi.appendChild(nomiCrearNodo('h3', { css: 'color:#b06bff;margin:0 0 12px 0;font-size:15px;', texto: '🔑 Acceso NoMi' }));
    const estadoNoMi = nomiCrearNodo('span', { id: 'nomi-config-estado-nomi', css: 'font-size:11px;color:#888;' });
    secNoMi.appendChild(estadoNoMi);

    const filaCodigoConf = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaCodigoConf.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Código de invitación' }));
    filaCodigoConf.appendChild(nomiCrearNodo('input', { id: 'nomi-config-codigo', atributos: { type: 'text', placeholder: 'Código de invitación' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    filaCodigoConf.appendChild(nomiCrearNodo('button', { id: 'nomi-config-activar', css: 'width:100%;padding:10px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-top:6px;', texto: '🔑 Activar con código de invitación' }));
    secNoMi.appendChild(filaCodigoConf);

    const filaClave = nomiCrearNodo('div', { css: 'border-top:1px solid #333;padding-top:10px;margin-top:10px;' });
    filaClave.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Clave propietaria (recuperar acceso permanente)' }));
    filaClave.appendChild(nomiCrearNodo('input', { id: 'nomi-config-clave-propietario', atributos: { type: 'password', placeholder: 'nomi-pro-…' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    filaClave.appendChild(nomiCrearNodo('button', { id: 'nomi-config-recuperar-propietario', css: 'width:100%;padding:10px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-top:6px;', texto: '🔑 Recuperar acceso propietario' }));
    filaClave.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:6px;', texto: 'La clave no se guarda en este navegador: solo se guarda el token opaco que devuelve el servidor.' }));
    secNoMi.appendChild(filaClave);
    scroll.appendChild(secNoMi);

        // Caja de credenciales (API Personal / .enc): COLAPSADA por defecto en instalación
    // limpia, con toggle explícito. Se conserva el contenido completo; solo se oculta
    // visualmente hasta que el usuario la abra.
    const cajaCredsWrapper = nomiCrearNodo('div', { css: 'background:#0d0d1a;border-radius:12px;margin-bottom:16px;' });
    const cajaCreds = nomiCrearNodo('div', { css: 'padding:0 16px;' });
    const cajaCredsContenido = nomiCrearNodo('div', { id: 'nomi-config-credenciales-contenido', css: 'display:none;' });
    const filaEncabezadoCreds = nomiCrearNodo('div', { css: 'display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 12px;border-bottom:1px solid #333;' });
    filaEncabezadoCreds.appendChild(nomiCrearNodo('h3', { css: 'color:#4a6cf7;margin:0;font-size:15px;', texto: '🔑 Configuración de credenciales' }));
    filaEncabezadoCreds.appendChild(nomiCrearNodo('button', { id: 'nomi-config-toggle-credenciales', atributos: { title: 'Mostrar/ocultar credenciales' }, css: 'background:#333;border:none;border-radius:6px;color:#fff;font-size:12px;padding:4px 10px;cursor:pointer;', texto: '▸' }));
    cajaCreds.appendChild(filaEncabezadoCreds);
    cajaCredsContenido.appendChild(nomiCrearNodo('p', { css: 'color:#888;font-size:12px;margin-bottom:16px;', texto: `Para usar ${NOMBRE_ASISTENTE}, necesitas configurar tus claves de API. Puedes importarlas desde un archivo .enc (si tienes uno) o ingresarlas manualmente.` }));
    cajaCredsContenido.appendChild(nomiCrearNodo('button', { id: 'nomi-config-importar', css: 'width:100%;padding:12px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:12px;', texto: '📥 Importar desde archivo .enc' }));
    const subCaja = nomiCrearNodo('div', { css: 'border-top:1px solid #333;padding-top:12px;margin-top:8px;' });
    subCaja.appendChild(nomiCrearNodo('p', { css: 'color:#888;font-size:12px;margin-bottom:8px;', texto: '✏️ O ingresa tus claves manualmente:' }));

    const filaOpenrouter = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaOpenrouter.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'API Key (API Personal) *' }));
    filaOpenrouter.appendChild(nomiCrearNodo('input', { id: 'nomi-config-openrouter', atributos: { type: 'password', placeholder: 'sk-or-v1-...' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaOpenrouter);

    const filaTavily = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaTavily.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Tavily API Key (opcional)' }));
    filaTavily.appendChild(nomiCrearNodo('input', { id: 'nomi-config-tavily', atributos: { type: 'password', placeholder: 'tvly-...' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaTavily);

    const filaModelo = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaModelo.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo (opcional)' }));
    const selModelo = nomiCrearNodo('select', { id: 'select', css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' });
    selModelo.id = 'nomi-config-modelo';
    selModelo.appendChild(nomiCrearNodo('option', { valor: MODELO_POR_DEFECTO, texto: `${MODELO_POR_DEFECTO} — Recomendado` }));
    filaModelo.appendChild(selModelo);
    const inputModeloManualA = nomiCrearNodo('input', { id: 'nomi-config-modelo-manual', valor: getModelo(), atributos: { type: 'text', placeholder: 'p. ej. gpt-4o-mini' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;margin-top:4px;display:none;' });
    filaModelo.appendChild(inputModeloManualA);
    filaModelo.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-config-refrescar-modelos', css: 'flex:1;padding:6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;', texto: 'Actualizar modelos' }),
        nomiCrearNodo('span', { id: 'nomi-config-estado-modelo', css: 'font-size:10px;color:#aaa;' })
    ]}));
    filaModelo.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:4px;', texto: 'En OpenRouter se lista por latencia estimada. En otra API compatible, escribe el modelo manualmente.' }));
    subCaja.appendChild(filaModelo);

    const filaUrl = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaUrl.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'URL Base (opcional)' }));
    filaUrl.appendChild(nomiCrearNodo('input', { id: 'nomi-config-url', atributos: { type: 'text', placeholder: URL_BASE_POR_DEFECTO }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaUrl);
        subCaja.appendChild(nomiCrearNodo('button', { id: 'nomi-config-guardar', css: 'width:100%;padding:10px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '💾 Guardar credenciales' }));
    cajaCredsContenido.appendChild(subCaja);
    cajaCreds.appendChild(cajaCredsContenido);
    cajaCredsWrapper.appendChild(cajaCreds);
    scroll.appendChild(cajaCredsWrapper);

    const cajaInfo = nomiCrearNodo('div', { css: 'background:#0d0d1a;border-radius:12px;padding:12px;border:1px solid #333;' });
    const pInfo = nomiCrearNodo('p', { css: 'color:#555;font-size:10px;margin:0;text-align:center;' });
    pInfo.appendChild(document.createTextNode('ℹ️ Las claves se guardan localmente en tu navegador.'));
    pInfo.appendChild(document.createElement('br'));
    pInfo.appendChild(document.createTextNode('Puedes cambiarlas en cualquier momento desde el menú (⚙️).'));
    cajaInfo.appendChild(pInfo);
    scroll.appendChild(cajaInfo);
    asistente.appendChild(scroll);

    const pie = nomiCrearNodo('div', { css: 'margin-top:12px;display:flex;gap:8px;flex-shrink:0;' });
    pie.appendChild(nomiCrearNodo('button', { id: 'nomi-config-cerrar', css: 'flex:1;padding:8px;background:#333;border:none;border-radius:8px;color:#888;font-size:12px;cursor:pointer;', texto: 'Cerrar (configurar más tarde)' }));
    asistente.appendChild(pie);
    document.body.appendChild(asistente);

    void cargarModelosAsistente(false);

    document.getElementById('nomi-config-importar').onclick = () => importarCredenciales();
    // ---- Acceso NoMi: activar con código de invitación o recuperar propietario ----
    // La sección "Acceso NoMi" (nomi-config-seccion-nomi) es la primera vista en
    // instalación limpia: activa con un código de invitación o recupera el acceso
    // propietario permanente con su clave, SIN necesidad de .enc ni ir a ⚙️.
    // En ambos casos: establece el modo NoMi, actualiza estado/HUD, cierra el
    // asistente, limpia los inputs (incluida la clave) y nunca persiste la clave.
    const finalizarOnboardingNoMi = () => {
        // Estado NoMi activo y HUD sincronizado.
        setModoAcceso(MODO_ACCESO_NOMI);
        NoMiState.modoAcceso = MODO_ACCESO_NOMI;
        if (typeof actualizarHud === 'function') actualizarHud();
        if (typeof actualizarIndicador === 'function') actualizarIndicador();
        // Cierra el asistente de configuración y abre la ventana de chat.
        const asistente = document.getElementById('nomi-asistente-config');
        if (asistente) asistente.remove();
        if (!NoMiState.ventanaAbierta) toggleVentana(true);
        // Limpieza de inputs (la clave nunca se persiste).
        const claveInput = document.getElementById('nomi-config-clave-propietario');
        if (claveInput) claveInput.value = '';
        const codigoInput = document.getElementById('nomi-config-codigo');
        if (codigoInput) codigoInput.value = '';
    };
    const btnActivar = document.getElementById('nomi-config-activar');
    if (btnActivar) btnActivar.onclick = async () => {
        const inputCodigo = document.getElementById('nomi-config-codigo');
        const codigo = (inputCodigo ? inputCodigo.value.trim() : '');
        if (!codigo) {
            mostrarNotificacionTemporal('Introduce un código de invitación.');
            return;
        }
        btnActivar.disabled = true;
        const estadoNoMi = document.getElementById('nomi-config-estado-nomi');
        if (estadoNoMi) estadoNoMi.textContent = 'Activando…';
        try {
            const resultado = await activarAccesoNoMi(codigo);
            finalizarOnboardingNoMi();
            mostrarNotificacionTemporal(resultado.catalogo
                ? '✅ Acceso compartido NoMi activado. Catálogo sincronizado.'
                : '✅ Acceso compartido NoMi activado. Verificando catálogo…');
        } catch (err) {
            mostrarNotificacionTemporal(err && err.message ? err.message : 'Error al activar el acceso NoMi.');
        } finally {
            btnActivar.disabled = false;
            if (estadoNoMi) estadoNoMi.textContent = '';
            // Limpieza final de inputs (incluida la clave, que nunca se persiste).
            if (inputCodigo) inputCodigo.value = '';
        }
    };
    const btnRecuperar = document.getElementById('nomi-config-recuperar-propietario');
    if (btnRecuperar) btnRecuperar.onclick = async () => {
        const inputClave = document.getElementById('nomi-config-clave-propietario');
        const clave = (inputClave ? inputClave.value.trim() : '');
        if (!clave) {
            mostrarNotificacionTemporal('Introduce la clave propietaria.');
            return;
        }
        btnRecuperar.disabled = true;
        const estadoNoMi = document.getElementById('nomi-config-estado-nomi');
        if (estadoNoMi) estadoNoMi.textContent = 'Recuperando…';
        try {
            const resultado = await recuperarAccesoPropietario(clave);
            finalizarOnboardingNoMi();
            mostrarNotificacionTemporal(resultado.catalogo
                ? '✅ Acceso propietario recuperado. Catálogo sincronizado.'
                : '✅ Acceso propietario recuperado. Verificando catálogo…');
        } catch (err) {
            mostrarNotificacionTemporal(err && err.message ? err.message : 'Error al recuperar el acceso propietario.');
        } finally {
            btnRecuperar.disabled = false;
            if (estadoNoMi) estadoNoMi.textContent = '';
            // La clave nunca se persiste: siempre se limpia al terminar.
            if (inputClave) inputClave.value = '';
        }
    };
    // Toggle explícito: API Personal/.enc colapsado por defecto, como sección avanzada.
    const toggleCreds = document.getElementById('nomi-config-toggle-credenciales');
    if (toggleCreds) {
        const icono = toggleCreds;
        toggleCreds.onclick = () => {
            const cont = document.getElementById('nomi-config-credenciales-contenido');
            if (!cont) return;
            const abierto = cont.style.display !== 'none';
            cont.style.display = abierto ? 'none' : 'block';
            icono.textContent = abierto ? '▸' : '▾';
        };
    }
    // "Actualizar modelos": si la URL es OpenRouter, consulta el catálogo; si no,
    // muestra el campo manual. Se reevalúa al cambiar la URL base.
    const evaluarUrlAsistente = () => {
        const url = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(url);
        const sel = document.getElementById('nomi-config-modelo');
        const inp = document.getElementById('nomi-config-modelo-manual');
        if (sel) sel.style.display = esOR ? 'block' : 'none';
        if (inp) inp.style.display = esOR ? 'none' : 'block';
    };
    const urlAsistente = document.getElementById('nomi-config-url');
    if (urlAsistente) urlAsistente.addEventListener('change', () => { evaluarUrlAsistente(); cargarModelosAsistente(false); });
    evaluarUrlAsistente();
    document.getElementById('nomi-config-refrescar-modelos').onclick = () => cargarModelosAsistente(true);
    document.getElementById('nomi-config-guardar').onclick = () => {
        const apiKey = document.getElementById('nomi-config-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-config-tavily').value.trim();
        const urlBase = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(urlBase);
        const modelo = esOR
            ? (document.getElementById('nomi-config-modelo').value.trim() || MODELO_POR_DEFECTO)
            : (document.getElementById('nomi-config-modelo-manual').value.trim() || MODELO_POR_DEFECTO);
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

// ---- Poblado del selector de modelos gratuitos en el asistente inicial ----
// La opción por defecto (MODELO_POR_DEFECTO) ya está presente al crear el <select>; al
// refrescar se repuebla con el catálogo filtrado (solo :free, precio 0).
async function cargarModelosAsistente(force) {
    const select = document.getElementById('nomi-config-modelo');
    const estado = document.getElementById('nomi-config-estado-modelo');
    if (!select) return;
    // El catálogo SOLO se consulta si la URL es OpenRouter; en otra API se
    // conserva el modelo manual sin intentar catálogo.
    const url = (document.getElementById('nomi-config-url') && document.getElementById('nomi-config-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
    if (!esOpenRouter(url)) {
        if (estado) estado.textContent = 'API propia: usa el modelo manual.';
        const inp = document.getElementById('nomi-config-modelo-manual');
        if (inp && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
        return;
    }
    if (!force && select.options.length > 1) return; // ya poblado previamente.
    estado.textContent = 'Cargando…';
    try {
        const lista = await fetchFreeModelos(force);
        const actual = select.value || MODELO_POR_DEFECTO;
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
    } catch (e) {
        estado.textContent = e instanceof OpenRouterRateLimitError ? 'Limitado (429)' : 'No se pudo cargar';
    }
}
