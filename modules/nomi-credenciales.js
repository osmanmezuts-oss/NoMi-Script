// ======== MÓDULO: Credenciales ========
// NoMi Assistant – Funciones de importación y guardado de credenciales

function importarCredenciales() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const texto = await file.text();
            const arrayBuffer = await file.arrayBuffer();
            const bytesRaw = new Uint8Array(arrayBuffer);
            let credenciales = null;
            const erroresDetallados = [];

            try {
                const json = JSON.parse(texto);
                if (json.openrouter) {
                    credenciales = json;
                    mostrarNotificacionTemporal('📄 Archivo JSON plano importado.');
                }
            } catch (_) {}

            if (!credenciales && esHex(texto)) {
                try {
                    const bytes = hexToBytes(texto);
                    const metodosHex = [
                        { nombre: 'Hex-AES128-IV-fijo', fn: () => descifrarCBC(bytes, 16) },
                        { nombre: 'Hex-AES128-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 16);
                        }},
                        { nombre: 'Hex-AES256-IV-fijo', fn: () => descifrarCBC(bytes, 32) },
                        { nombre: 'Hex-AES256-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 32);
                        }}
                    ];
                    for (const metodo of metodosHex) {
                        try {
                            const resultado = await metodo.fn();
                            if (resultado && resultado.openrouter) {
                                credenciales = resultado;
                                mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                                break;
                            } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                        } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                    }
                } catch (err) { erroresDetallados.push('Hex: ' + err.message); }
            }

            if (!credenciales && esBase64(texto)) {
                try {
                    const bytes = base64ToBytes(texto);
                    const metodosBase64 = [
                        { nombre: 'Base64-AES128-IV-fijo', fn: () => descifrarCBC(bytes, 16) },
                        { nombre: 'Base64-AES128-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 16);
                        }},
                        { nombre: 'Base64-AES256-IV-fijo', fn: () => descifrarCBC(bytes, 32) },
                        { nombre: 'Base64-AES256-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 32);
                        }}
                    ];
                    for (const metodo of metodosBase64) {
                        try {
                            const resultado = await metodo.fn();
                            if (resultado && resultado.openrouter) {
                                credenciales = resultado;
                                mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                                break;
                            } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                        } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                    }
                } catch (err) { erroresDetallados.push('Base64: ' + err.message); }
            }

            if (!credenciales) {
                const metodosRaw = [
                    { nombre: 'Raw-AES128-IV-fijo', fn: () => descifrarCBC(bytesRaw, 16) },
                    { nombre: 'Raw-AES128-IV-incluido', fn: () => {
                        if (bytesRaw.length < 16) throw new Error('Datos demasiado cortos');
                        const iv = bytesRaw.slice(0, 16);
                        return descifrarCBCconIV(bytesRaw.slice(16), iv, 16);
                    }},
                    { nombre: 'Raw-AES256-IV-fijo', fn: () => descifrarCBC(bytesRaw, 32) },
                    { nombre: 'Raw-AES256-IV-incluido', fn: () => {
                        if (bytesRaw.length < 16) throw new Error('Datos demasiado cortos');
                        const iv = bytesRaw.slice(0, 16);
                        return descifrarCBCconIV(bytesRaw.slice(16), iv, 32);
                    }}
                ];
                for (const metodo of metodosRaw) {
                    try {
                        const resultado = await metodo.fn();
                if (resultado && resultado.openrouter) {
                            credenciales = resultado;
                            mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                            break;
                        } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                    } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                }
            }

            if (!credenciales) {
                try {
                    const password = prompt('🔐 Introduce la contraseña para descifrar (método GCM):');
                    if (password === null) return;
                    const resultado = await descifrarGCM(bytesRaw, password);
                    if (resultado && resultado.openrouter && resultado.tavily) {
                        credenciales = resultado;
                        mostrarNotificacionTemporal('🔐 Descifrado con GCM.');
                    } else throw new Error('No contiene las claves esperadas');
                } catch (errGCM) { erroresDetallados.push('GCM: ' + errGCM.message); }
            }

            if (!credenciales) {
                const resumen = erroresDetallados.length ? '\n\n📋 Intentos realizados:\n' + erroresDetallados.join('\n') : '';
                throw new Error('No se pudo descifrar el archivo con ningún método.' + resumen);
            }

            aplicarCredencialesImportadas(credenciales);

            mostrarNotificacionTemporal('✅ Credenciales importadas correctamente.');
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.ventanaAbierta) actualizarStats();
        } catch (err) {
            mostrarNotificacionTemporal('❌ ' + err.message);
            registrarError('credenciales', err.message, 'Importación de credenciales');
        }
    };
    input.click();
}

function guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase) {
    // La API key es obligatoria (cualquier proveedor OpenAI-compatible).
    // Tavily es OPCIONAL: la búsqueda web funciona solo si se proporciona;
    // el chat normal funciona sin ella. Retrocompatible con OpenRouter+Tavily.
    if (!apiKey) {
        mostrarNotificacionTemporal('❌ Debes ingresar al menos la API key de tu API Personal.');
        return false;
    }
    setApiKey(apiKey);
    // Tavily opcional: se guarda si se ingresó; si se deja vacío se ELIMINA
    // explícitamente la clave previa (no queda una cadena vacía suelta).
    if (tavilyKey) setTavilyKey(tavilyKey);
    else {
        setTavilyKey('');
        eliminarValor(STORAGE_TAVILY_KEY);
    }
    if (modelo) setModelo(modelo);
    if (urlBase) setUrlBase(urlBase);
    setCredencialesCargadas(true);
    setConfigInicial(true);
    NoMiState.apiKeyActual = apiKey;
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
    mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
    return true;
}

// Aplica un conjunto de credenciales importado (JSON/.enc). Tavily es opcional:
// si el archivo NO trae campo tavily, se ELIMINA la Tavily previa. Retrocompatible
// con configuraciones completas OpenRouter+Tavily (se conservan todas las claves).
function aplicarCredencialesImportadas(credenciales) {
    setApiKey(credenciales.openrouter);
    if (credenciales.tavily) setTavilyKey(credenciales.tavily);
    else {
        setTavilyKey('');
        eliminarValor(STORAGE_TAVILY_KEY);
    }
    if (credenciales.modelo) setModelo(credenciales.modelo);
    if (credenciales.url) setUrlBase(credenciales.url);
    setCredencialesCargadas(true);
    setConfigInicial(true);
    NoMiState.apiKeyActual = credenciales.openrouter;
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
}

