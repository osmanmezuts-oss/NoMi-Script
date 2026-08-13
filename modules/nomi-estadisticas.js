// ======== MÓDULO: Estadísticas y Exportación ========
// NoMi Assistant – Funciones de visualización de estadísticas y exportación de chats

function mostrarEstadisticas() {
    const existing = document.getElementById('nomi-stats-panel');
    if (existing) {
        existing.style.display = existing.style.display === 'block' ? 'none' : 'block';
        return;
    }
    const div = document.createElement('div');
    div.id = 'nomi-stats-panel';
    div.style.cssText = `
        position: fixed; top:20px; right:20px; background:#1a1a2e; color:#fff;
        padding:16px; border-radius:16px; font-family:monospace; font-size:13px;
        z-index:9999998; border:1px solid #4a4a6a; max-width:280px;
        box-shadow:0 8px 32px rgba(0,0,0,0.8);
    `;
    const timestamp = getValor('nomi_timestamp_' + getPageKey(), null);
    let diasRestantes = DIAS_HISTORIAL;
    if (timestamp) {
        const diasPasados = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);
        diasRestantes = Math.max(0, Math.round(DIAS_HISTORIAL - diasPasados));
    }
    const resumenPreview = NoMiState.resumenPersistente ? NoMiState.resumenPersistente.slice(0,150)+'...' : 'No hay resumen guardado.';
    const espacioOcupado = calcularEspacioOcupado();
    const espacioFormateado = espacioOcupado > 1024 ? `${Math.round(espacioOcupado/1024)} KB` : `${espacioOcupado} B`;
    const logs = getValor(STORAGE_ERROR_LOGS, []);
    div.innerHTML = `
        <b style="font-size:14px;">📊 Estadísticas</b>
        <div style="margin-top:10px; line-height:1.8;">
            Preguntas: ${NoMiState.contadorPreguntas}<br>
            Tokens totales: ${NoMiState.tokens.total}<br>
            Tokens entrada: ${NoMiState.tokens.input}<br>
            Tokens salida: ${NoMiState.tokens.output}<br>
            Mensajes guardados: ${NoMiState.historial.length}<br>
            Reinicio en: ${diasRestantes} días<br>
            💾 Espacio: ${espacioFormateado}<br>
            ${logs.length > 0 ? `📋 Errores registrados: ${logs.length}` : ''}
            ${NoMiState.credencialesCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'}
        </div>
        <div style="margin-top:8px; font-size:11px; color:#888; border-top:1px solid #333; padding-top:8px; max-height:80px; overflow-y:auto;">
            🧠 Resumen: ${resumenPreview}
        </div>
        <button id="nomi-stats-close" style="margin-top:10px; background:#333; border:none; padding:6px 12px; border-radius:6px; color:#fff; cursor:pointer;">Cerrar</button>
    `;
    document.body.appendChild(div);
    document.getElementById('nomi-stats-close').onclick = () => div.remove();
}

function mostrarExportacion() {
    const existing = document.getElementById('nomi-export-panel');
    if (existing) {
        existing.style.display = existing.style.display === 'block' ? 'none' : 'block';
        return;
    }
    const keys = Object.keys(localStorage).filter(k => k.startsWith('nomi_historial_'));
    const fechas = keys.map(k => k.replace('nomi_historial_', '').split('_')[1])
        .filter((v,i,a) => a.indexOf(v)===i).sort();
    const div = document.createElement('div');
    div.id = 'nomi-export-panel';
    div.style.cssText = `
        position: fixed; top:20px; right:20px; background:#1a1a2e; color:#fff;
        padding:16px; border-radius:16px; font-family:sans-serif; font-size:13px;
        z-index:9999998; border:1px solid #4a4a6a; max-width:280px; max-height:300px;
        overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.8);
    `;
    let html = `<b style="font-size:14px;">📤 Exportar Chat</b><div style="margin-top:10px;">`;
    if (fechas.length === 0) {
        html += '<div style="color:#555;">No hay chats guardados.</div>';
    } else {
        fechas.forEach(fecha => {
            const esHoy = fecha === new Date().toISOString().slice(0,10);
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin:4px 0;">
                    <span style="color:${esHoy ? '#34a853' : '#ccc'}; font-weight:${esHoy ? 'bold' : 'normal'};">${fecha} ${esHoy ? '⭐ Hoy' : ''}</span>
                    <div>
                        <button data-fecha="${fecha}" data-formato="txt" style="background:#4a6cf7; border:none; padding:2px 8px; border-radius:4px; color:#fff; cursor:pointer; font-size:10px; margin-right:4px;">TXT</button>
                        <button data-fecha="${fecha}" data-formato="json" style="background:#34a853; border:none; padding:2px 8px; border-radius:4px; color:#fff; cursor:pointer; font-size:10px;">JSON</button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div><button id="nomi-export-close" style="margin-top:10px; background:#333; border:none; padding:6px 12px; border-radius:6px; color:#fff; cursor:pointer;">Cerrar</button>`;
    div.innerHTML = html;
    document.body.appendChild(div);
    div.querySelectorAll('button[data-fecha]').forEach(btn => {
        btn.onclick = () => {
            const fecha = btn.dataset.fecha;
            const formato = btn.dataset.formato;
            exportarChat(fecha, formato);
        };
    });
    document.getElementById('nomi-export-close').onclick = () => div.remove();
}

function exportarChat(fecha, formato) {
    const key = 'nomi_historial_' + getPageKey() + '_' + fecha;
    const data = localStorage.getItem(key);
    if (!data) { alert('No hay historial para esa fecha.'); return; }
    const historialData = JSON.parse(data);
    let contenido = '';
    if (formato === 'json') {
        contenido = JSON.stringify(historialData, null, 2);
    } else {
        contenido = historialData.map(m => {
            const rol = m.role === 'user' ? '👤 Tú' : `🤖 ${NOMBRE_ASISTENTE}`;
            return `${rol}: ${m.content}`;
        }).join('\n\n');
    }
    const blob = new Blob([contenido], {type: formato === 'json' ? 'application/json' : 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${fecha}.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
}
```

---
