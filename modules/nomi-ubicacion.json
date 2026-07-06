// ======== MÓDULO: Ubicación Geográfica ========
// NoMi Assistant – Funciones de geolocalización y gestión de ubicación

function obtenerUbicacionPorGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalización no soportada por este navegador.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                NoMiState.fuenteUbicacion = 'gps';
                fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`)
                    .then(res => res.json())
                    .then(data => {
                        const ciudad = data.city || data.locality || data.principalSubdivision || 'Ubicación desconocida';
                        const pais = data.countryName || '';
                        resolve({
                            lat, lon, ciudad, pais,
                            timestamp: Date.now(),
                            fuente: 'gps'
                        });
                    })
                    .catch(() => resolve({
                        lat, lon,
                        ciudad: 'Ubicación desconocida',
                        pais: '',
                        timestamp: Date.now(),
                        fuente: 'gps'
                    }));
            },
            (error) => {
                if (error.code === 1) reject(new Error('Permiso denegado. Activa la ubicación en los ajustes del navegador.'));
                else if (error.code === 3) reject(new Error('Timeout. Reintentando...'));
                else reject(new Error('Error al obtener ubicación: ' + error.message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    });
}

async function actualizarUbicacion(silencioso = false, intento = 1) {
    if (!NoMiState.ubicacionActivada) {
        if (!silencioso) mostrarNotificacionTemporal('📍 La ubicación está desactivada. Actívala en el menú (⚙️).');
        return null;
    }
    try {
        const ubicacion = await obtenerUbicacionPorGPS();
        NoMiState.fuenteUbicacion = ubicacion.fuente || 'gps';
        setUbicacion(ubicacion);
        if (!silencioso) {
            mostrarNotificacionTemporal(`📍 Ubicación actualizada: ${ubicacion.ciudad}, ${ubicacion.pais} (${NoMiState.fuenteUbicacion === 'gps' ? 'GPS' : 'IP'})`);
            agregarMensaje('bot', `📍 Ubicación establecida: **${ubicacion.ciudad}, ${ubicacion.pais}** (${NoMiState.fuenteUbicacion === 'gps' ? 'GPS' : 'IP'}).`);
        }
        actualizarBarraUbicacion();
        inyectarContextoUbicacion(ubicacion);
        return ubicacion;
    } catch (error) {
        if (intento <= 3 && error.message.includes('Timeout')) {
            if (!silencioso) mostrarNotificacionTemporal(`🔄 Reintentando GPS... (intento ${intento}/3)`);
            await new Promise(r => setTimeout(r, 2000));
            return actualizarUbicacion(silencioso, intento + 1);
        }
        const mensajeError = error.message.includes('Permiso denegado') ? '📍 Permiso denegado. Actívalo en ajustes.' : `📍 Error: ${error.message}`;
        actualizarBarraUbicacionConError(mensajeError);
        if (!silencioso) mostrarNotificacionTemporal(`❌ ${error.message}`);
        registrarError('gps', error.message, 'Ubicación');
        return null;
    }
}

function actualizarBarraUbicacionConError(mensaje) {
    const el = document.getElementById('nomi-ubicacion-display');
    if (el) { el.textContent = mensaje; el.style.color = '#f55036'; }
}

function inyectarContextoUbicacion(ubicacion) {
    if (!ubicacion) return;
    const fuente = ubicacion.fuente === 'gps' ? 'GPS' : 'IP aproximada';
    const mensajeContexto = `📍 Ubicación del usuario: ${ubicacion.ciudad}, ${ubicacion.pais} (${fuente}). Coordenadas GPS: ${ubicacion.lat}, ${ubicacion.lon}. **DEBES usar ESTA ubicación para todas las consultas de clima y eventos locales.** Ignora cualquier otra ubicación que puedas inferir de la IP.\n\n**Si el usuario pregunta "¿dónde estoy?" o sobre su ubicación, responde usando los datos de ubicación que tienes en este contexto.** No digas que no tienes acceso a la ubicación.`;
    const existe = NoMiState.historial.some(msg => msg.role === 'system' && msg.content.includes('Ubicación del usuario'));
    if (existe) {
        const index = NoMiState.historial.findIndex(msg => msg.role === 'system' && msg.content.includes('Ubicación del usuario'));
        if (index !== -1) {
            NoMiState.historial[index].content = mensajeContexto;
            guardarHistorial(NoMiState.historial);
        }
    } else {
        NoMiState.historial.unshift({ role: 'system', content: mensajeContexto });
        guardarHistorial(NoMiState.historial);
    }
}

function actualizarBarraUbicacion() {
    const el = document.getElementById('nomi-ubicacion-display');
    if (!el) return;
    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
        const fuente = NoMiState.ubicacionActual.fuente === 'gps' ? 'GPS' : 'IP';
        el.textContent = `📍 ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais} (${fuente})`;
        el.style.color = fuente === 'GPS' ? '#34a853' : '#f5a623';
        el.style.display = 'inline';
        document.getElementById('nomi-ubicacion-update').style.display = 'inline';
    } else if (NoMiState.ubicacionActivada && !NoMiState.ubicacionActual) {
        el.textContent = '📍 Obteniendo ubicación...';
        el.style.color = '#888';
        el.style.display = 'inline';
        document.getElementById('nomi-ubicacion-update').style.display = 'inline';
    } else {
        el.textContent = '📍 Ubicación desactivada';
        el.style.color = '#888';
        el.style.display = 'inline';
        document.getElementById('nomi-ubicacion-update').style.display = 'none';
    }
}
```

---
