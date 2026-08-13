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
        enviarErrorASlack(entrada);
    } catch (e) {
        console.warn('No se pudo registrar el error:', e);
    }
}

function limpiarDatoParaSlack(valor) {
    return String(valor || '')
        .replace(/https:\/\/hooks\.slack\.com\/services\/[^\s]+/gi, '[webhook oculto]')
        .replace(/(?:sk-or-v1-|tvly-)[A-Za-z0-9_-]+/g, '[clave oculta]')
        .slice(0, 1000);
}

async function enviarErrorASlack(error) {
    if (!NoMiState.slackErroresActivo || !NoMiState.slackWebhookUrl) return;

    try {
        const pagina = window.location.origin + window.location.pathname;
        const respuesta = await hacerPeticion(NoMiState.slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: `:warning: *Error de NoMi*\n*Tipo:* ${limpiarDatoParaSlack(error.type)}\n*Mensaje:* ${limpiarDatoParaSlack(error.message)}\n*Contexto:* ${limpiarDatoParaSlack(error.context)}\n*Versión:* ${VERSION_SCRIPT}\n*Página:* ${pagina}\n*Fecha:* ${error.timestamp}`
            })
        });
        if (respuesta !== 'ok') throw new Error('Slack no confirmó el envío.');
    } catch (e) {
        console.warn('No se pudo enviar el error a Slack:', e.message);
    }
}

async function probarConexionSlack() {
    if (!NoMiState.slackWebhookUrl) throw new Error('Primero pega la URL del webhook de Slack.');
    const respuesta = await hacerPeticion(NoMiState.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ':white_check_mark: *NoMi conectado correctamente a Slack.* Los próximos errores se enviarán a este canal.' })
    });
    if (respuesta !== 'ok') throw new Error('Slack no confirmó la conexión.');
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
