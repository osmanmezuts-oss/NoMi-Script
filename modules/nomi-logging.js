// ======== MÓDULO: Logging y Diagnóstico ========
// NoMi Assistant – Funciones de registro y exportación de errores

function registrarError(tipo, mensaje, contexto) {
    try {
        const logs = getValor(STORAGE_ERROR_LOGS, []);
        const sistema = obtenerInfoSistema();
        const entrada = {
            timestamp: new Date().toISOString(),
            type: tipo,
            message: mensaje,
            context: contexto || 'Sin contexto adicional',
            version: VERSION_SCRIPT,
            url: window.location.href,
            sistema: sistema
        };
        logs.push(entrada);
        if (logs.length > 20) logs.shift();
        setValor(STORAGE_ERROR_LOGS, logs);
        enviarDiagnostico(entrada);
    } catch (e) {
        console.warn('No se pudo registrar el error:', e);
    }
}

function limpiarDatoParaDiagnostico(valor) {
    return String(valor || '')
        // Nunca se envían claves, tokens ni webhooks.
        .replace(/(?:sk-or-v1-|tvly-|gh[pousr]_|sk-)[A-Za-z0-9_-]+/g, '[clave oculta]')
        .replace(/https:\/\/[^\s]+/gi, (u) => {
            // Reducir URLs a dominio + ruta sencilla (sin query ni secreto).
            try {
                const p = new URL(u);
                p.search = ''; p.hash = ''; p.username = ''; p.password = '';
                return p.origin + p.pathname;
            } catch { return '[url]'; }
        })
        .replace(/([?&](?:key|token|secret|password|api_key|auth|sig)=)[^\s&]+/gi, '$1[oculto]')
        .slice(0, 500);
}

// Contexto técnico mínimo (dispositivo, red y batería) SOLO si está disponible.
// Nunca se envía ubicación exacta ni URL completa.
async function obtenerContextoTecnico() {
    const ctx = {};
    try {
        const s = obtenerInfoSistema();
        ctx.device = s.screenSize || '';
        ctx.platform = s.platform || '';
        ctx.mobile = !!s.isMobile;
    } catch (e) { /* ignora */ }
    try {
        // Red (Connection API): tipo de conexión estimado, sin datos de páginas.
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && conn.effectiveType) {
            ctx.red = conn.effectiveType + (typeof conn.saveData === 'boolean' && conn.saveData ? '/ahorro' : '');
        }
    } catch (e) { /* ignora */ }
    try {
        // Batería (Battery API) si existe.
        if (navigator.getBattery) {
            const b = await navigator.getBattery();
            if (b && typeof b.level === 'number') {
                ctx.bateria = Math.round((b.level || 0) * 100) + '%' + (b.charging ? ' (cargando)' : '');
            }
        }
    } catch (e) { /* ignora */ }
    return ctx;
}

// Envía el error a nomi-diagnostics (POST /v1/diagnostics) de forma no bloqueante.
async function enviarDiagnostico(error) {
    if (!NoMiState.diagnosticoActivo) return;
    // Asegura ID de instalación persistente (anónimo) y seguro.
    const instalacionId = obtenerInstalacionId();
    // Si no hay crypto disponible el ID es null: se omite el envío (no se usan IDs inseguros).
    if (!instalacionId) return;

    let tec = {};
    try { tec = await obtenerContextoTecnico(); } catch (e) { /* ignora */ }

    // Nunca se envía URL completa: sólo el dominio del sitio.
    let dominio = '';
    try { dominio = window.location.hostname; } catch (e) { /* ignora */ }

    try {
        await hacerPeticion(DIAGNOSTICS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: error.type || 'desconocido',
                message: limpiarDatoParaDiagnostico(error.message),
                context: limpiarDatoParaDiagnostico(error.context || ''),
                version: VERSION_SCRIPT,
                url: dominio,
                device: tec.device || '',
                platform: tec.platform || '',
                mobile: !!tec.mobile,
                red: tec.red || '',
                bateria: tec.bateria || '',
                instalacionId: instalacionId
            })
        });
    } catch (e) {
        console.warn('Diagnóstico no enviado:', e && e.message);
    }
}

function exportarLogs() {
    const logs = getValor(STORAGE_ERROR_LOGS, []);
    if (logs.length === 0) {
        mostrarNotificacionTemporal('No hay errores registrados.');
        return;
    }
    let texto = `=== LOGS DE NoMi ===\n`;
    texto += `Versión: ${VERSION_SCRIPT}\n`;
    texto += `Fecha de exportación: ${new Date().toISOString()}\n`;
    texto += `Total de errores: ${logs.length}\n\n`;
    logs.forEach((log, i) => {
        texto += `--- Error ${i+1} ---\n`;
        texto += `Timestamp: ${log.timestamp}\n`;
        texto += `Tipo: ${log.type}\n`;
        texto += `Mensaje: ${log.message}\n`;
        texto += `Contexto: ${log.context}\n`;
        texto += `URL: ${log.url || 'No disponible'}\n`;
        if (log.sistema) {
            texto += `Sistema: ${log.sistema.platform} | Móvil: ${log.sistema.isMobile} | Pantalla: ${log.sistema.screenSize}\n`;
        }
        if (log.stack) texto += `Stack: ${log.stack}\n`;
        texto += '\n';
    });
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomi_logs_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}
