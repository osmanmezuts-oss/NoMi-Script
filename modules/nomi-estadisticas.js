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
    div.appendChild(nomiCrearNodo('b', { css: 'font-size:14px;', texto: '📊 Estadísticas' }));
    const cuerpoStats = nomiCrearNodo('div', { css: 'margin-top:10px;line-height:1.8;' });
    const lineaStats = (txt) => { cuerpoStats.appendChild(document.createTextNode(txt)); cuerpoStats.appendChild(document.createElement('br')); };
    lineaStats(`Preguntas: ${NoMiState.contadorPreguntas}`);
    lineaStats(`Tokens totales: ${NoMiState.tokens.total}`);
    lineaStats(`Tokens entrada: ${NoMiState.tokens.input}`);
    lineaStats(`Tokens salida: ${NoMiState.tokens.output}`);
    lineaStats(`Mensajes guardados: ${NoMiState.historial.length}`);
    lineaStats(`Reinicio en: ${diasRestantes} días`);
    lineaStats(`💾 Espacio: ${espacioFormateado}`);
    if (logs.length > 0) cuerpoStats.appendChild(document.createTextNode(`📋 Errores registrados: ${logs.length}`));
    cuerpoStats.appendChild(document.createTextNode(NoMiState.credencialesCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'));
    div.appendChild(cuerpoStats);
    div.appendChild(nomiCrearNodo('div', { css: 'margin-top:8px;font-size:11px;color:#888;border-top:1px solid #333;padding-top:8px;max-height:80px;overflow-y:auto;', texto: `🧠 Resumen: ${resumenPreview}` }));
    div.appendChild(nomiCrearNodo('button', { id: 'nomi-stats-close', css: 'margin-top:10px;background:#333;border:none;padding:6px 12px;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Cerrar' }));
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
    div.appendChild(nomiCrearNodo('b', { css: 'font-size:14px;', texto: '📤 Exportar Chat' }));
    const listaExp = nomiCrearNodo('div', { css: 'margin-top:10px;' });
    if (fechas.length === 0) {
        listaExp.appendChild(nomiCrearNodo('div', { css: 'color:#555;', texto: 'No hay chats guardados.' }));
    } else {
        fechas.forEach(fecha => {
            const esHoy = fecha === new Date().toISOString().slice(0,10);
            const filaExp = nomiCrearNodo('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin:4px 0;' });
            filaExp.appendChild(nomiCrearNodo('span', { css: `color:${esHoy ? '#34a853' : '#ccc'};font-weight:${esHoy ? 'bold' : 'normal'};`, texto: esHoy ? `${fecha} ⭐ Hoy` : fecha }));
            const btnsExp = nomiCrearNodo('div');
            const btnTxt = nomiCrearNodo('button', { atributos: { 'data-fecha': fecha, 'data-formato': 'txt' }, css: 'background:#4a6cf7;border:none;padding:2px 8px;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;margin-right:4px;', texto: 'TXT' });
            btnTxt.onclick = () => exportarChat(fecha, 'txt');
            const btnJson = nomiCrearNodo('button', { atributos: { 'data-fecha': fecha, 'data-formato': 'json' }, css: 'background:#34a853;border:none;padding:2px 8px;border-radius:4px;color:#fff;cursor:pointer;font-size:10px;', texto: 'JSON' });
            btnJson.onclick = () => exportarChat(fecha, 'json');
            btnsExp.appendChild(btnTxt);
            btnsExp.appendChild(btnJson);
            filaExp.appendChild(btnsExp);
            listaExp.appendChild(filaExp);
        });
    }
    div.appendChild(listaExp);
    div.appendChild(nomiCrearNodo('button', { id: 'nomi-export-close', css: 'margin-top:10px;background:#333;border:none;padding:6px 12px;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Cerrar' }));
    document.body.appendChild(div);
    document.getElementById('nomi-export-close').onclick = () => div.remove();
}

function exportarChat(fecha, formato) {
    const key = 'nomi_historial_' + getPageKey() + '_' + fecha;
    const data = localStorage.getItem(key);
    if (!data) { alert('No hay historial para esa fecha.'); return; }
    const historialData = JSON.parse(data);
    // Privacidad: excluir mensajes de sistema (role: "system"), coordenadas GPS,
    // prompts internos, instrucciones técnicas y contexto de ubicación.
    // Solo exportar mensajes user/assistant y fuentes.
    const filtrado = historialData
        .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
        .map(m => ({
            role: m.role,
            content: m.content,
            // Fuentes solo si existen (formato compacto)
            fuentes: Array.isArray(m.fuentes) ? m.fuentes.map(f => ({
                titulo: f.titulo,
                url: f.url,
                fecha: f.fecha
            })) : undefined
        }));
    let contenido = '';
    if (formato === 'json') {
        contenido = JSON.stringify(filtrado, null, 2);
    } else {
        contenido = filtrado.map(m => {
            const rol = m.role === 'user' ? '👤 Tú' : `🤖 ${NOMBRE_ASISTENTE}`;
            let texto = `${rol}: ${m.content}`;
            if (m.fuentes && m.fuentes.length) {
                texto += '\n\nFuentes:\n' + m.fuentes.map((f, i) => `[${i+1}] ${f.titulo} — ${f.url}`).join('\n');
            }
            return texto;
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

