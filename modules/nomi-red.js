// ======== MÓDULO: Red y Servicios Externos ========
// NoMi Assistant – Funciones de peticiones HTTP, búsqueda web y llamadas a IA

// Extrae el código de error estable de un cuerpo JSON de respuesta
// ({ error: 'codigo' }). Devuelve '' si no hay JSON o no hay campo error.
function extraerCodigoError(texto) {
    if (typeof texto !== 'string' || !texto) return '';
    try {
        const obj = JSON.parse(texto);
        if (obj && typeof obj.error === 'string') return obj.error;
    } catch (e) { /* no es JSON: no hay código */ }
    return '';
}

function hacerPeticion(url, opciones) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: opciones.method || 'GET',
                url: url,
                headers: opciones.headers || {},
                data: opciones.body || null,
                onload: (resp) => {
                    if (resp.status >= 200 && resp.status < 300) {
                        try { resolve(JSON.parse(resp.responseText)); }
                        catch (e) { resolve(resp.responseText); }
                    } else {
                        const e = new Error(`Error ${resp.status}: ${resp.responseText}`);
                        e.status = resp.status;
                        const codigo = extraerCodigoError(resp.responseText);
                        if (codigo) e.codigo = codigo;
                        reject(e);
                    }
                },
                onerror: (err) => {
                    fetch(url, opciones)
                        .then(async (r) => {
                            if (!r.ok) {
                                const texto = await r.text();
                                const e = new Error(`Error ${r.status}: ${texto}`);
                                e.status = r.status;
                                const codigo = extraerCodigoError(texto);
                                if (codigo) e.codigo = codigo;
                                throw e;
                            }
                            return r.json();
                        })
                        .then(resolve)
                        .catch(reject);
                }
            });
        } else {
            fetch(url, opciones)
                .then(async (r) => {
                    if (!r.ok) {
                        const texto = await r.text();
                        const e = new Error(`Error ${r.status}: ${texto}`);
                        e.status = r.status;
                        const codigo = extraerCodigoError(texto);
                        if (codigo) e.codigo = codigo;
                        throw e;
                    }
                    return r.json();
                })
                .then(resolve)
                .catch(reject);
        }
    });
}

async function buscarWeb(consulta) {
    if (!NoMiState.tavilyKeyActual) throw new Error('No hay clave de Tavily.');
    try {
        const datos = await hacerPeticion('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: NoMiState.tavilyKeyActual,
                query: consulta,
                search_depth: 'basic',
                max_results: 5
            })
        });
        return datos;
    } catch (error) {
        registrarError('network', error.message, `Búsqueda: "${consulta}"`);
        throw error;
    }
}

async function llamarIA(mensaje) {
    if (!NoMiState.apiKeyActual) throw new Error('No hay clave de OpenRouter.');
    try {
        const datos = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.apiKeyActual
            },
            body: JSON.stringify({
                model: NoMiState.modeloActual,
                messages: [{role: 'user', content: mensaje}],
                stream: false,
                max_tokens: 1024
            })
        });
        if (datos.choices && datos.choices[0]) return datos.choices[0].message.content;
        else throw new Error(datos.error?.message || 'Error en la IA');
    } catch (error) {
        registrarError('api', error.message, `Modelo: ${NoMiState.modeloActual}, URL: ${NoMiState.urlBaseActual}`);
        throw error;
    }
}

