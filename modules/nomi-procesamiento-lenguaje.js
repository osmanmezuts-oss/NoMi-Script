// ======== MÓDULO: Procesamiento de Lenguaje y Detección ========
// NoMi Assistant – Funciones de detección de búsqueda y ubicación en texto

function requiereBusqueda(texto) {
    const palabrasClave = [
        'clima', 'pronóstico', 'tiempo', 'temperatura', 'lluvia', 'viento',
        'noticias', 'últimas noticias', 'eventos', 'actualidad',
        'precio', 'cotización', 'dólar', 'euro', 'bitcoin',
        'resultados', 'partido', 'fútbol', 'deporte',
        'evento', 'concierto', 'festival',
        'qué pasó', 'quién ganó',
        'fútbol', 'liga', 'campeonato', 'mundial', 'juega',
        'cuándo juega', 'selección', 'equipo', 'copa', 'torneo',
        'nations league', 'champions', 'europa', 'sudamericana',
        'libertadores', 'eliminatorias'
    ];
    const textoLower = texto.toLowerCase();
    return palabrasClave.some(palabra => textoLower.includes(palabra));
}

function requiereUbicacion(texto) {
    const palabrasClave = [
        'clima', 'pronóstico', 'tiempo', 'temperatura', 'lluvia', 'viento',
        'evento', 'concierto', 'festival', 'partido', 'fútbol',
        'dónde está', 'cómo llegar', 'dirección', 'transporte'
    ];
    const textoLower = texto.toLowerCase();
    return palabrasClave.some(palabra => textoLower.includes(palabra));
}

