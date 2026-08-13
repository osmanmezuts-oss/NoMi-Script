// ======== MÓDULO: Limpieza y Mantenimiento ========
// NoMi Assistant – Funciones de limpieza de historiales y cálculo de espacio

function limpiarHistorialesAntiguos() {
    const keys = Object.keys(localStorage);
    const hoy = new Date();
    let eliminados = 0;
    let espacioLiberado = 0;
    keys.forEach(key => {
        if (key.startsWith('nomi_historial_')) {
            const partes = key.split('_');
            if (partes.length >= 4) {
                const fechaStr = partes.slice(3).join('_');
                try {
                    const fecha = new Date(fechaStr);
                    const diffDias = Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
                    if (diffDias > DIAS_LIMITE_HISTORIAL) {
                        const data = localStorage.getItem(key);
                        if (data) espacioLiberado += data.length;
                        localStorage.removeItem(key);
                        eliminados++;
                        const chatsKey = 'nomi_chats_list_' + partes.slice(1, 3).join('_');
                        const chats = JSON.parse(localStorage.getItem(chatsKey) || '[]');
                        const nuevaLista = chats.filter(f => f !== fechaStr);
                        if (nuevaLista.length !== chats.length) {
                            localStorage.setItem(chatsKey, JSON.stringify(nuevaLista));
                        }
                    }
                } catch (e) {}
            }
        }
    });
    if (eliminados > 0) {
        console.log(`🧹 Limpieza automática: ${eliminados} historiales eliminados. Espacio liberado: ~${Math.round(espacioLiberado/1024)} KB`);
    }
    return { eliminados, espacioLiberado };
}

function calcularEspacioOcupado() {
    let total = 0;
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('nomi_')) {
            total += localStorage.getItem(key).length;
        }
    });
    return total;
}

