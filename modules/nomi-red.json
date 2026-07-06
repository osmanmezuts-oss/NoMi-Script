// ======== MÓDULO: Red y Servicios Externos ========
// NoMi Assistant – Funciones de peticiones HTTP, búsqueda web y llamadas a IA

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
                        reject(new Error(`Error ${resp.status}: ${resp.responseText}`));
                    }
                },
                onerror: (err) => {
                    fetch(url, opciones)
                        .then(async (r) => {
                            if (!r.ok) throw new Error(`Error ${r.status}: ${await r.text()}`);
                            return r.json();
                        })
                        .then(resolve)
                        .catch(reject);
                }
            });
        } else {
            fetch(url, opciones)
                .then(async (r) => {
                    if (!r.ok) throw new Error(`Error ${r.status}: ${await r.text()}`);
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
```

---
