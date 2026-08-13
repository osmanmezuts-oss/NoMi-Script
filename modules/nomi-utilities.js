// ======== MÓDULO: NoMiUtilities ========
// NoMi Assistant – Funciones auxiliares de utilidad general

function mostrarAyuda() {
    const ayuda = `
**📋 Comandos disponibles para NoMi**

| Comando | Descripción |
|---------|-------------|
| \`!cmd\` o \`!comandos\` | Muestra esta lista de ayuda. |
| \`investiga: [pregunta]\` o \`busca: [pregunta]\` | Realiza una búsqueda en la web (requiere credenciales). |
| \`analiza\`, \`examina\` o \`escanea\` | Analiza el contenido de la página actual. |
| \`presentate\` | Muestra nuevamente el mensaje de bienvenida. |
| \`actualizar ubicación\` | Fuerza la actualización de la ubicación (si está activada). |

**Botones disponibles:**
- 🌐 Activa/desactiva el análisis automático de la página.
- 🔍 Forza una búsqueda web para la pregunta actual.
- 📊 Muestra estadísticas de uso.
- 📤 Exporta el historial a TXT o JSON.
- ⚙️ Abre el menú de configuración.

> **Nota:** En páginas de configuración de Google (accounts.google.com), la burbuja puede no aparecer. Vuelva a la página anterior o recargue manualmente.
`;
    agregarMensaje('bot', ayuda);
}

function obtenerTamanoReal() {
    let w = NoMiState.tamanoVentana.w;
    let h = NoMiState.tamanoVentana.h;
    const maxW = Math.min(window.innerWidth * MAX_WIDTH_PERCENT, window.innerWidth - 20);
    const maxH = Math.min(window.innerHeight * MAX_HEIGHT_PERCENT, window.innerHeight - 20);
    w = Math.max(MIN_WIDTH, Math.min(maxW, w));
    h = Math.max(MIN_HEIGHT, Math.min(maxH, h));
    return { w, h };
}

function obtenerContextoTiempo() {
    const ahora = new Date();
    const fecha = ahora.toISOString().slice(0, 10);
    const hora = ahora.toTimeString().slice(0, 5);
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const utcOffset = -ahora.getTimezoneOffset() / 60;
    const offsetStr = utcOffset >= 0 ? `+${utcOffset}` : `${utcOffset}`;
    return `📅 ${fecha} ${hora} (UTC${offsetStr})`;
}

function extraerInformacionPagina(limite) {
    const titulo = document.title || 'Sin título';
    const url = window.location.href;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || 'Sin descripción';
    const main = document.querySelector('main') || document.querySelector('article');
    const cuerpo = (main?.innerText || document.body.innerText || document.body.textContent || '')
        .replace(/\s+/g, ' ').replace(/\n/g, ' ').trim().slice(0, limite);
    const encabezados = [];
    document.querySelectorAll('h1, h2, h3').forEach(h => encabezados.push(h.textContent.trim()));
    return { titulo, url, metaDesc, texto: cuerpo, encabezados: encabezados.slice(0,10) };
}

function configurarTeclado() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', () => {
        const win = document.getElementById('nomi-chat');
        if (!win || win.style.display !== 'flex') return;
        const viewportHeight = window.visualViewport.height;
        const keyboardHeight = window.innerHeight - viewportHeight;
        if (keyboardHeight > 100) {
            const nuevoTop = Math.max(10, window.innerHeight - keyboardHeight - win.offsetHeight - 20);
            win.style.top = nuevoTop + 'px';
        } else {
            if (NoMiState.posicionOriginalVentana !== null) {
                const maxTop = window.innerHeight - win.offsetHeight - 20;
                const topRestaurado = Math.min(NoMiState.posicionOriginalVentana, maxTop);
                win.style.top = Math.max(10, topRestaurado) + 'px';
            }
        }
    });
}

