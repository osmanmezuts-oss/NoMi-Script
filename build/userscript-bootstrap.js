// ======== BOOTSTRAP DEL USERSCRIPT (no editar manualmente; se incluye en el bundle) ========
(function() {
    'use strict';

    // ======== CARGA INICIAL DESDE PERSISTENCIA ========
    NoMiState.historial = getHistorial();
    NoMiState.tokens = getTokens();
    NoMiState.contadorPreguntas = getContador();
    NoMiState.resumenPersistente = getResumen();
    NoMiState.validado = getValidado();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
    NoMiState.posicionBurbuja = getPosicion();
    const posV = getPosicionVentana();
    if (posV) NoMiState.posicionVentana = posV;
    NoMiState.posicionOriginalVentana = posV ? posV.y : null;
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
    NoMiState.diagnosticoActivo = getDiagnosticoActivo();
    NoMiState.avisoDiagnosticoVisto = getAvisoDiagnosticoVisto();
    obtenerInstalacionId(); // genera/recupera el ID persistente anónimo de instalación

    limpiarHistorialesAntiguos();

    // ======== INICIO ========
    setTimeout(() => {
        setValor(STORAGE_VALIDADO, true);
        NoMiState.validado = true;
        iniciarAsistente();
    }, 500);
})();
