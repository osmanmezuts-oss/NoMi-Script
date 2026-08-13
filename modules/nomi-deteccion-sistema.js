// ======== MÓDULO: Detección de Sistema ========
// NoMi Assistant – Función para obtener información del sistema operativo y dispositivo

function obtenerInfoSistema() {
    const ua = navigator.userAgent;
    let platform = 'Desconocido';
    if (/windows/i.test(ua)) platform = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) platform = 'macOS';
    else if (/linux/i.test(ua)) platform = 'Linux';
    else if (/android/i.test(ua)) platform = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) platform = 'iOS';

    const isMobile = /mobile/i.test(ua) || window.innerWidth < 768;
    const screenSize = `${window.innerWidth}x${window.innerHeight}`;

    return { platform, isMobile, userAgent: ua, screenSize };
}
```

---
