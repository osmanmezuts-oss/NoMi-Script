// ======== MÓDULO: Persistencia y Almacenamiento ========
// NoMi Assistant – Funciones de almacenamiento, historial y getters/setters

function getValor(clave, defecto) {
    try {
        if (typeof GM_getValue !== 'undefined') {
            return GM_getValue(clave, defecto);
        }
        return localStorage.getItem(clave) !== null ? JSON.parse(localStorage.getItem(clave)) : defecto;
    } catch (e) { return defecto; }
}

function setValor(clave, valor) {
    try {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(clave, valor);
        } else {
            localStorage.setItem(clave, JSON.stringify(valor));
        }
    } catch (e) { /* ignore */ }
}

function eliminarValor(clave) {
    try {
        if (typeof GM_deleteValue !== 'undefined') {
            GM_deleteValue(clave);
        } else {
            localStorage.removeItem(clave);
        }
    } catch (e) { /* ignore */ }
}

function getPageKey() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (DOMINIOS_UNIFICADOS.some(d => host.includes(d))) return host;
    return host + path;
}

function getSessionKey() {
    const hoy = new Date().toISOString().slice(0, 10);
    return getPageKey() + '_' + hoy;
}

function getHistorial() {
    const key = 'nomi_historial_' + getSessionKey();
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function guardarHistorial(mensajes) {
    const key = 'nomi_historial_' + getSessionKey();
    localStorage.setItem(key, JSON.stringify(mensajes));
}

function getValidado() { return getValor(STORAGE_VALIDADO, false); }
function setValidado(v) { setValor(STORAGE_VALIDADO, v); }
function getModelo() { return getValor(STORAGE_MODELO, MODELO_POR_DEFECTO); }
function setModelo(m) { setValor(STORAGE_MODELO, m); NoMiState.modeloActual = m; }
function getUrlBase() { return getValor(STORAGE_URL, URL_BASE_POR_DEFECTO); }
function setUrlBase(u) { setValor(STORAGE_URL, u); NoMiState.urlBaseActual = u; }
function getPosicion() { return getValor(STORAGE_POSICION, { x: 20, y: 20 }); }
function setPosicion(p) { setValor(STORAGE_POSICION, p); }
function getPosicionVentana() { return getValor(STORAGE_POSICION_VENTANA, null); }
function setPosicionVentana(p) { setValor(STORAGE_POSICION_VENTANA, p); NoMiState.posicionOriginalVentana = p?.y || null; }
function getResumen() { return getValor(STORAGE_RESUMEN, ''); }
function setResumen(r) { setValor(STORAGE_RESUMEN, r); NoMiState.resumenPersistente = r; }
function getTokens() { return getValor(STORAGE_TOKENS, { total: 0, input: 0, output: 0 }); }
function setTokens(t) { setValor(STORAGE_TOKENS, t); NoMiState.tokens = t; }
function getContador() { return getValor(STORAGE_CONTADOR, 0); }
function setContador(c) { setValor(STORAGE_CONTADOR, c); NoMiState.contadorPreguntas = c; }
function getContexto() { return getValor(STORAGE_CONTEXTO, 10); }
function setContexto(c) { setValor(STORAGE_CONTEXTO, c); NoMiState.contextoSeleccionado = c; }
function getModoLigero() { return getValor(STORAGE_MODO_LIGERO, false); }
function setModoLigero(v) { setValor(STORAGE_MODO_LIGERO, v); NoMiState.modoLigeroActivo = v; }
function getModoResumen() { return getValor(STORAGE_MODO_RESUMEN, false); }
function setModoResumen(v) { setValor(STORAGE_MODO_RESUMEN, v); NoMiState.modoResumenActivo = v; }
function getBusquedaWeb() { return getValor(STORAGE_BUSQUEDA_WEB, false); }
function setBusquedaWeb(v) { setValor(STORAGE_BUSQUEDA_WEB, v); NoMiState.busquedaWebActiva = v; }
function getTamanoVentana() { return getValor(STORAGE_TAMANO_VENTANA, { w: ANCHO_POR_DEFECTO, h: ALTO_POR_DEFECTO }); }
function setTamanoVentana(t) { setValor(STORAGE_TAMANO_VENTANA, t); NoMiState.tamanoVentana = t; }
function getUbicacionActivada() { return getValor(STORAGE_UBICACION_ACTIVADA, false); }
function setUbicacionActivada(v) { setValor(STORAGE_UBICACION_ACTIVADA, v); NoMiState.ubicacionActivada = v; }
function getUbicacion() {
    const data = getValor(STORAGE_UBICACION, null);
    if (!data) return null;
    if (Date.now() - data.timestamp > UBICACION_EXPIRACION) {
        eliminarValor(STORAGE_UBICACION);
        return null;
    }
    return data;
}
function setUbicacion(ubicacion) {
    ubicacion.timestamp = Date.now();
    setValor(STORAGE_UBICACION, ubicacion);
    NoMiState.ubicacionActual = ubicacion;
}
function getCredencialesCargadas() { return getValor(STORAGE_CREDENCIALES_CARGADAS, false); }
function setCredencialesCargadas(v) { setValor(STORAGE_CREDENCIALES_CARGADAS, v); NoMiState.credencialesCargadas = v; }
function getApiKey() { return getValor(STORAGE_API_KEY, ''); }
function setApiKey(k) { setValor(STORAGE_API_KEY, k); NoMiState.apiKeyActual = k; }
function getTavilyKey() { return getValor(STORAGE_TAVILY_KEY, ''); }
function setTavilyKey(k) { setValor(STORAGE_TAVILY_KEY, k); NoMiState.tavilyKeyActual = k; }
function getConfigInicial() { return getValor(STORAGE_CONFIG_INICIAL, false); }
function setConfigInicial(v) { setValor(STORAGE_CONFIG_INICIAL, v); NoMiState.configuracionInicialCompletada = v; }
function getMotorBusqueda() { return getValor(STORAGE_MOTOR_BUSQUEDA, 'tavily'); }
function setMotorBusqueda(m) { setValor(STORAGE_MOTOR_BUSQUEDA, m); NoMiState.motorBusqueda = m; }
function getDiagnosticoActivo() { const v = getValor(STORAGE_DIAGNOSTICO_ACTIVO, null); return v === null ? true : !!v; }
function setDiagnosticoActivo(activo) { setValor(STORAGE_DIAGNOSTICO_ACTIVO, !!activo); NoMiState.diagnosticoActivo = !!activo; }
function getAvisoDiagnosticoVisto() { return getValor(STORAGE_DIAGNOSTICO_AVISO, false); }
function setAvisoDiagnosticoVisto(visto) { setValor(STORAGE_DIAGNOSTICO_AVISO, !!visto); NoMiState.avisoDiagnosticoVisto = !!visto; }

// ===== Acceso compartido NoMi (Worker) =====
// Se guarda únicamente la URL pública del Worker y el token opaco de instalación.
function getModoAcceso() { return getValor(STORAGE_MODO_ACCESO, MODO_ACCESO_POR_DEFECTO); }
function setModoAcceso(m) { setValor(STORAGE_MODO_ACCESO, m); NoMiState.modoAcceso = m; }
function getNomiWorkerUrl() { return getValor(STORAGE_NOMI_WORKER_URL, NOMI_WORKER_URL_POR_DEFECTO); }
function setNomiWorkerUrl(u) { setValor(STORAGE_NOMI_WORKER_URL, u); NoMiState.nomiWorkerUrl = u; }
function getNomiToken() { return getValor(STORAGE_NOMI_TOKEN, ''); }
function setNomiToken(t) { setValor(STORAGE_NOMI_TOKEN, t); NoMiState.nomiToken = t; }
function getNomiModelo() { return getValor(STORAGE_NOMI_MODELO, NOMI_MODELO_POR_DEFECTO); }
function setNomiModelo(m) { setValor(STORAGE_NOMI_MODELO, m); NoMiState.nomiModelo = m; }
function getNomiAccesoActivo() { return getValor(STORAGE_NOMI_ACCESO_ACTIVO, false); }
function setNomiAccesoActivo(v) { setValor(STORAGE_NOMI_ACCESO_ACTIVO, !!v); NoMiState.nomiAccesoActivo = !!v; }
// ID aleatorio persistente por instalación (se genera una sola vez y se guarda).
// Se usa criptografía segura (crypto.randomUUID / crypto.getRandomValues).
// Si no hay Web Crypto disponible, se retorna null para Omitir el diagnóstico;
// NUNCA se generan IDs con Math.random() (que no es criptográficamente seguro).
function generarIdCriptografico() {
    try {
        if (typeof crypto === 'undefined' || crypto === null) {
            return null; // sin Web Crypto no se genera un ID inseguro.
        }
        if (typeof crypto.randomUUID === 'function') {
            return 'nmi-' + crypto.randomUUID();
        }
        if (typeof crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
            return 'nmi-' + hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16);
        }
        // Web Crypto no disponible: se omite el diagnóstico (no se usa Math.random).
        return null;
    } catch {
        return null;
    }
}
function obtenerInstalacionId() {
    let id = getValor(STORAGE_INSTALACION_ID, '');
    if (!id) {
        id = generarIdCriptografico();
        if (id) { setValor(STORAGE_INSTALACION_ID, id); }
    }
    if (id) { NoMiState.instalacionId = id; }
    return id;
}
