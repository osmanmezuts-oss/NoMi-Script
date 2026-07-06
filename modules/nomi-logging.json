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
    } catch (e) {
        console.warn('No se pudo registrar el error:', e);
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
```

---
