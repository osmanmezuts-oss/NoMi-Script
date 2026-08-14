/*
 * NoMi Asistente - Tampermonkey Script
 * 
 * Copyright 2026 Gartos
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ARCHIVO GENERADO AUTOMATICAMENTE POR tools/build-userscript.py — NO EDITAR MANUALMENTE.
// Para cambiar el contenido, edita modules/ o build/ y regenera con el script.

// ==UserScript==
// @name         NoMi Asistente V5.8
// @namespace    http://tampermonkey.net/
// @version      5.15
// @description  Asistente IA con importación de credenciales, actualización automática y mejoras multiplataforma
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      nomi-diagnostics.osmanmezuts.workers.dev
// @connect      openrouter.ai
// @updateURL    https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/NoMi%20Asistente%20V5.8.user.js
// @downloadURL  https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/NoMi%20Asistente%20V5.8.user.js
// ==/UserScript==

// ======== MODULO: nomi-config-estatica.js (bundle) ========
// ======== MÓDULO: Configuración Estática ========
// NoMi Assistant – Constantes de configuración y claves de almacenamiento

const NOMBRE_ASISTENTE = 'NoMi';
const DISEÑADOR = 'Gartos';
const MODELO_POR_DEFECTO = 'openai/gpt-oss-20b:free';
const URL_BASE_POR_DEFECTO = 'https://openrouter.ai/api/v1';
const DIAS_HISTORIAL = 7;
const LIMITE_TEXTO_NORMAL = 2000;
const LIMITE_TEXTO_LIGERO = 500;
const MENSAJES_VISIBLES = 50;
const CONTEXTOS_DISPONIBLES = [10, 20, 30];
const DOMINIOS_UNIFICADOS = ['youtube.com', 'reddit.com', 'wikipedia.org'];
const MIN_WIDTH = 280;
const MAX_WIDTH_PERCENT = 0.3;
const MIN_HEIGHT = 300;
const MAX_HEIGHT_PERCENT = 0.55;
const ANCHO_POR_DEFECTO = 320;
const ALTO_POR_DEFECTO = 400;
const UBICACION_EXPIRACION = 3 * 60 * 60 * 1000;
const CONTEXTO_RECIENTE = 10;
const DIAS_LIMITE_HISTORIAL = 7;
const VERSION_SCRIPT = '5.15';
const FECHA_LANZAMIENTO = '21/06/2026';

const STORAGE_VALIDADO = 'nomi_validado';
const STORAGE_API_KEY = 'nomi_api_key';
const STORAGE_TAVILY_KEY = 'nomi_tavily_key';
const STORAGE_MODELO = 'nomi_modelo';
const STORAGE_URL = 'nomi_url';
const STORAGE_POSICION = 'nomi_posicion';
const STORAGE_POSICION_VENTANA = 'nomi_posicion_ventana';
const STORAGE_RESUMEN = 'nomi_resumen';
const STORAGE_TOKENS = 'nomi_tokens';
const STORAGE_CONTADOR = 'nomi_contador';
const STORAGE_CONTEXTO = 'nomi_contexto';
const STORAGE_MODO_LIGERO = 'nomi_modo_ligero';
const STORAGE_MODO_RESUMEN = 'nomi_modo_resumen';
const STORAGE_BUSQUEDA_WEB = 'nomi_busqueda_web';
const STORAGE_TAMANO_VENTANA = 'nomi_tamano_ventana';
const STORAGE_UBICACION = 'nomi_ubicacion';
const STORAGE_UBICACION_ACTIVADA = 'nomi_ubicacion_activada';
const STORAGE_ERROR_LOGS = 'nomi_error_logs';
const STORAGE_CREDENCIALES_CARGADAS = 'nomi_credenciales_cargadas';
const STORAGE_CONFIG_INICIAL = 'nomi_config_inicial';
const STORAGE_MOTOR_BUSQUEDA = 'nomi_motor_busqueda';
const STORAGE_DIAGNOSTICO_ACTIVO = 'nomi_diagnostico_activo';
const STORAGE_INSTALACION_ID = 'nomi_instalacion_id';
const STORAGE_DIAGNOSTICO_AVISO = 'nomi_diagnostico_aviso_visto';

// Endpoint del Worker de diagnóstico (envío de errores anónimo y mínimo).
const DIAGNOSTICS_URL = 'https://nomi-diagnostics.osmanmezuts.workers.dev/v1/diagnostics';

// ======== MODULO: nomi-deteccion-sistema.js (bundle) ========
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

// ======== MODULO: nomi-criptografia.js (bundle) ========
// ======== MÓDULO: Criptografía y Descifrado ========
// NoMi Assistant – Funciones auxiliares de detección de formato y descifrado

function esHex(texto) {
    const limpio = texto.replace(/[\s\r\n\-]/g, '');
    if (limpio.length === 0) return false;
    return /^[0-9a-fA-F]+$/.test(limpio) && limpio.length % 2 === 0;
}

function hexToBytes(hex) {
    const limpio = hex.replace(/[\s\r\n\-]/g, '');
    const bytes = new Uint8Array(limpio.length / 2);
    for (let i = 0; i < limpio.length; i += 2) {
        bytes[i/2] = parseInt(limpio.substr(i, 2), 16);
    }
    return bytes;
}

function esBase64(texto) {
    const limpio = texto.replace(/[\s\r\n]/g, '');
    if (limpio.length === 0) return false;
    return /^[A-Za-z0-9+/]*={0,2}$/.test(limpio);
}

function base64ToBytes(base64) {
    const limpio = base64.replace(/[\s\r\n]/g, '');
    const binaryString = atob(limpio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function descifrarGCM(datos, password) {
    try {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: enc.encode('nomi_salt'), iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        const iv = datos.slice(0, 12);
        const data = datos.slice(12);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        return JSON.parse(dec.decode(decrypted));
    } catch (e) {
        throw new Error('Error en descifrado GCM: ' + e.message);
    }
}

async function descifrarCBC(datos, keySize = 16) {
    const keyStr = '2009201710042023';
    const ivStr = '1004202320092017';
    try {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        let keyBytes;
        if (keySize === 32) {
            const padded = keyStr.padEnd(32, ' ');
            keyBytes = enc.encode(padded.slice(0, 32));
        } else {
            keyBytes = enc.encode(keyStr.slice(0, 16));
        }
        const ivBytes = enc.encode(ivStr.slice(0, 16));

        const key = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-CBC' },
            false,
            ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: ivBytes },
            key,
            datos
        );
        return JSON.parse(dec.decode(decrypted));
    } catch (e) {
        throw new Error('Error en descifrado CBC (keySize=' + keySize + '): ' + e.message);
    }
}

async function descifrarCBCconIV(datos, ivBytes, keySize = 16) {
    const keyStr = '2009201710042023';
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    let keyBytes;
    if (keySize === 32) {
        const padded = keyStr.padEnd(32, ' ');
        keyBytes = enc.encode(padded.slice(0, 32));
    } else {
        keyBytes = enc.encode(keyStr.slice(0, 16));
    }

    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: ivBytes },
        key,
        datos
    );

    return JSON.parse(dec.decode(decrypted));
}

// ======== MODULO: nomi-procesamiento-lenguaje.js (bundle) ========
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

// ======== MODULO: nomi-state.js (bundle) ========
// ======== MÓDULO: NoMiState ========
// NoMi Assistant – Estado centralizado (única fuente de verdad)

window.NoMiState = {
    modoWebActivo: false,
    modoResumenActivo: false,
    modoLigeroActivo: false,
    busquedaWebActiva: false,
    busquedaWebTemporal: false,
    ubicacionActivada: false,
    contextoSeleccionado: 10,
    resumenPersistente: '',
    modeloActual: MODELO_POR_DEFECTO,
    urlBaseActual: URL_BASE_POR_DEFECTO,
    burbujaVisible: false,
    ventanaAbierta: false,
    validado: false,
    isWaiting: false,
    contadorPreguntas: 0,
    historial: [],
    tokens: { total: 0, input: 0, output: 0 },
    posicionBurbuja: { x: 20, y: 20 },
    posicionVentana: { x: 0, y: 0 },
    posicionOriginalVentana: null,
    ventanaBloqueada: false,
    tamanoVentana: { w: ANCHO_POR_DEFECTO, h: ALTO_POR_DEFECTO },
    busquedaForzada: false,
    ubicacionActual: null,
    fuenteUbicacion: 'desconocida',
    credencialesCargadas: false,
    apiKeyActual: '',
    tavilyKeyActual: '',
    configuracionInicialCompletada: false,
    motorBusqueda: 'tavily',
    diagnosticoActivo: true,
    instalacionId: '',
    avisoDiagnosticoVisto: false
};

// ======== MODULO: nomi-utilities.js (bundle) ========
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

// ======== MODULO: nomi-limpieza.js (bundle) ========
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

// ======== MODULO: nomi-persistencia.js (bundle) ========
// ======== MÓDULO: Persistencia y Almacenamiento ========
// NoMi Assistant – Funciones de almacenamiento, historial y getters/setters

function getValor(clave, defecto) {
    try {
        if (typeof GM_getValue !== 'undefined') {
            return GM_getValue(clave, defecto);
        }
        return localStorage.getItem(clave) !== null ? JSON.parse(localStorage.getItem(clave)) : defecto;
    } catch (e) { return defecto; }
}

function setValor(clave, valor) {
    try {
        if (typeof GM_setValue !== 'undefined') {
            GM_setValue(clave, valor);
        } else {
            localStorage.setItem(clave, JSON.stringify(valor));
        }
    } catch (e) { /* ignore */ }
}

function eliminarValor(clave) {
    try {
        if (typeof GM_deleteValue !== 'undefined') {
            GM_deleteValue(clave);
        } else {
            localStorage.removeItem(clave);
        }
    } catch (e) { /* ignore */ }
}

function getPageKey() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (DOMINIOS_UNIFICADOS.some(d => host.includes(d))) return host;
    return host + path;
}

function getSessionKey() {
    const hoy = new Date().toISOString().slice(0, 10);
    return getPageKey() + '_' + hoy;
}

function getHistorial() {
    const key = 'nomi_historial_' + getSessionKey();
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function guardarHistorial(mensajes) {
    const key = 'nomi_historial_' + getSessionKey();
    localStorage.setItem(key, JSON.stringify(mensajes));
}

function getValidado() { return getValor(STORAGE_VALIDADO, false); }
function setValidado(v) { setValor(STORAGE_VALIDADO, v); }
function getModelo() { return getValor(STORAGE_MODELO, MODELO_POR_DEFECTO); }
function setModelo(m) { setValor(STORAGE_MODELO, m); NoMiState.modeloActual = m; }
function getUrlBase() { return getValor(STORAGE_URL, URL_BASE_POR_DEFECTO); }
function setUrlBase(u) { setValor(STORAGE_URL, u); NoMiState.urlBaseActual = u; }
function getPosicion() { return getValor(STORAGE_POSICION, { x: 20, y: 20 }); }
function setPosicion(p) { setValor(STORAGE_POSICION, p); }
function getPosicionVentana() { return getValor(STORAGE_POSICION_VENTANA, null); }
function setPosicionVentana(p) { setValor(STORAGE_POSICION_VENTANA, p); NoMiState.posicionOriginalVentana = p?.y || null; }
function getResumen() { return getValor(STORAGE_RESUMEN, ''); }
function setResumen(r) { setValor(STORAGE_RESUMEN, r); NoMiState.resumenPersistente = r; }
function getTokens() { return getValor(STORAGE_TOKENS, { total: 0, input: 0, output: 0 }); }
function setTokens(t) { setValor(STORAGE_TOKENS, t); NoMiState.tokens = t; }
function getContador() { return getValor(STORAGE_CONTADOR, 0); }
function setContador(c) { setValor(STORAGE_CONTADOR, c); NoMiState.contadorPreguntas = c; }
function getContexto() { return getValor(STORAGE_CONTEXTO, 10); }
function setContexto(c) { setValor(STORAGE_CONTEXTO, c); NoMiState.contextoSeleccionado = c; }
function getModoLigero() { return getValor(STORAGE_MODO_LIGERO, false); }
function setModoLigero(v) { setValor(STORAGE_MODO_LIGERO, v); NoMiState.modoLigeroActivo = v; }
function getModoResumen() { return getValor(STORAGE_MODO_RESUMEN, false); }
function setModoResumen(v) { setValor(STORAGE_MODO_RESUMEN, v); NoMiState.modoResumenActivo = v; }
function getBusquedaWeb() { return getValor(STORAGE_BUSQUEDA_WEB, false); }
function setBusquedaWeb(v) { setValor(STORAGE_BUSQUEDA_WEB, v); NoMiState.busquedaWebActiva = v; }
function getTamanoVentana() { return getValor(STORAGE_TAMANO_VENTANA, { w: ANCHO_POR_DEFECTO, h: ALTO_POR_DEFECTO }); }
function setTamanoVentana(t) { setValor(STORAGE_TAMANO_VENTANA, t); NoMiState.tamanoVentana = t; }
function getUbicacionActivada() { return getValor(STORAGE_UBICACION_ACTIVADA, false); }
function setUbicacionActivada(v) { setValor(STORAGE_UBICACION_ACTIVADA, v); NoMiState.ubicacionActivada = v; }
function getUbicacion() {
    const data = getValor(STORAGE_UBICACION, null);
    if (!data) return null;
    if (Date.now() - data.timestamp > UBICACION_EXPIRACION) {
        eliminarValor(STORAGE_UBICACION);
        return null;
    }
    return data;
}
function setUbicacion(ubicacion) {
    ubicacion.timestamp = Date.now();
    setValor(STORAGE_UBICACION, ubicacion);
    NoMiState.ubicacionActual = ubicacion;
}
function getCredencialesCargadas() { return getValor(STORAGE_CREDENCIALES_CARGADAS, false); }
function setCredencialesCargadas(v) { setValor(STORAGE_CREDENCIALES_CARGADAS, v); NoMiState.credencialesCargadas = v; }
function getApiKey() { return getValor(STORAGE_API_KEY, ''); }
function setApiKey(k) { setValor(STORAGE_API_KEY, k); NoMiState.apiKeyActual = k; }
function getTavilyKey() { return getValor(STORAGE_TAVILY_KEY, ''); }
function setTavilyKey(k) { setValor(STORAGE_TAVILY_KEY, k); NoMiState.tavilyKeyActual = k; }
function getConfigInicial() { return getValor(STORAGE_CONFIG_INICIAL, false); }
function setConfigInicial(v) { setValor(STORAGE_CONFIG_INICIAL, v); NoMiState.configuracionInicialCompletada = v; }
function getMotorBusqueda() { return getValor(STORAGE_MOTOR_BUSQUEDA, 'tavily'); }
function setMotorBusqueda(m) { setValor(STORAGE_MOTOR_BUSQUEDA, m); NoMiState.motorBusqueda = m; }
function getDiagnosticoActivo() { const v = getValor(STORAGE_DIAGNOSTICO_ACTIVO, null); return v === null ? true : !!v; }
function setDiagnosticoActivo(activo) { setValor(STORAGE_DIAGNOSTICO_ACTIVO, !!activo); NoMiState.diagnosticoActivo = !!activo; }
function getAvisoDiagnosticoVisto() { return getValor(STORAGE_DIAGNOSTICO_AVISO, false); }
function setAvisoDiagnosticoVisto(visto) { setValor(STORAGE_DIAGNOSTICO_AVISO, !!visto); NoMiState.avisoDiagnosticoVisto = !!visto; }
// ID aleatorio persistente por instalación (se genera una sola vez y se guarda).
// Se usa criptografía segura (crypto.randomUUID / crypto.getRandomValues).
// Si no hay Web Crypto disponible, se retorna null para Omitir el diagnóstico;
// NUNCA se generan IDs con Math.random() (que no es criptográficamente seguro).
function generarIdCriptografico() {
    try {
        if (typeof crypto === 'undefined' || crypto === null) {
            return null; // sin Web Crypto no se genera un ID inseguro.
        }
        if (typeof crypto.randomUUID === 'function') {
            return 'nmi-' + crypto.randomUUID();
        }
        if (typeof crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
            return 'nmi-' + hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16);
        }
        // Web Crypto no disponible: se omite el diagnóstico (no se usa Math.random).
        return null;
    } catch {
        return null;
    }
}
function obtenerInstalacionId() {
    let id = getValor(STORAGE_INSTALACION_ID, '');
    if (!id) {
        id = generarIdCriptografico();
        if (id) { setValor(STORAGE_INSTALACION_ID, id); }
    }
    if (id) { NoMiState.instalacionId = id; }
    return id;
}

// ======== MODULO: nomi-logging.js (bundle) ========
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

// ======== MODULO: nomi-estadisticas.js (bundle) ========
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

// ======== MODULO: nomi-chat.js (bundle) ========
// ======== MÓDULO: Chat y Mensajería ========
// NoMi Assistant – Funciones de renderizado y gestión del chat

function agregarMensaje(quien, texto) {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    const color = quien === 'yo' ? '#FF6B6B' : '#34a853';
    const nombre = quien === 'yo' ? 'Tú' : NOMBRE_ASISTENTE;
    const msg = document.createElement('div');
    msg.style.cssText = `
        margin:4px 0; padding:6px 10px; border-radius:10px;
        background:${color}33; border-left:3px solid ${color};
        font-size:12px; word-wrap:break-word;
    `;
    msg.innerHTML = `<b style="color:${color};">${nombre}:</b> ${texto}`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function cargarHistorial() {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    chatBody.innerHTML = '';
    const mensajesMostrar = NoMiState.historial
        .filter(msg => msg.role !== 'system')
        .slice(-MENSAJES_VISIBLES);
    if (mensajesMostrar.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#666; text-align:center; padding:20px 0;';
        empty.textContent = '💬 Sin mensajes aún. ¡Pregunta algo!';
        chatBody.appendChild(empty);
        return;
    }
    mensajesMostrar.forEach(msg => {
        const esUsuario = msg.role === 'user';
        const color = esUsuario ? '#FF6B6B' : '#34a853';
        const nombre = esUsuario ? 'Tú' : NOMBRE_ASISTENTE;
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
            margin:4px 0; padding:6px 10px; border-radius:10px;
            background:${color}33; border-left:3px solid ${color};
            font-size:12px; word-wrap:break-word;
        `;
        msgDiv.innerHTML = `<b style="color:${color};">${nombre}:</b> ${msg.content}`;
        chatBody.appendChild(msgDiv);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
}

function actualizarContextoIndicador() {
    const el = document.getElementById('nomi-contexto-indicador');
    if (el) {
        let texto = `📚 Contexto: ${NoMiState.contextoSeleccionado} mensajes`;
        if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) texto += ' + resumen';
        el.textContent = texto;
    }
}

function actualizarStats() {
    const counter = document.getElementById('nomi-token-counter');
    if (counter) counter.textContent = NoMiState.tokens.total;
    const modelDisplay = document.getElementById('nomi-modelo-display');
    if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
    actualizarContextoIndicador();
    actualizarBarraUbicacion();
}

function mostrarCargando() {
    const loading = document.getElementById('nomi-loading');
    if (loading) {
        loading.style.display = 'block';
        let count = 0;
        const dots = document.getElementById('nomi-dots');
        if (dots) {
            const interval = setInterval(() => {
                count = (count % 3) + 1;
                dots.textContent = '.'.repeat(count);
            }, 400);
            loading.dataset.interval = interval;
        }
    }
}

function ocultarCargando() {
    const loading = document.getElementById('nomi-loading');
    if (loading) {
        loading.style.display = 'none';
        if (loading.dataset.interval) {
            clearInterval(parseInt(loading.dataset.interval));
            delete loading.dataset.interval;
        }
    }
}

function toggleBurbuja(mostrar) {
    const bubble = document.getElementById('nomi-bubble');
    if (!bubble) return;
    if (mostrar === undefined) NoMiState.burbujaVisible = !NoMiState.burbujaVisible;
    else NoMiState.burbujaVisible = mostrar;
    bubble.style.display = NoMiState.burbujaVisible ? 'flex' : 'none';
}

function toggleVentana(mostrar) {
    const win = document.getElementById('nomi-chat');
    if (!win) return;
    if (mostrar === undefined) NoMiState.ventanaAbierta = !NoMiState.ventanaAbierta;
    else NoMiState.ventanaAbierta = mostrar;
    win.style.display = NoMiState.ventanaAbierta ? 'flex' : 'none';
    if (NoMiState.ventanaAbierta) {
        document.getElementById('nomi-input').focus();
        cargarHistorial();
    }
}

function mostrarNotificacionTemporal(msg) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; bottom:100px; left:50%; transform:translateX(-50%);
        background:#1a1a2e; color:#fff; padding:12px 20px; border-radius:12px;
        font-size:14px; z-index:9999999; border:1px solid #4a4a6a;
        box-shadow:0 4px 16px rgba(0,0,0,0.5); text-align:center; max-width:80%;
    `;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ======== MODULO: nomi-red.js (bundle) ========
// ======== MÓDULO: Red y Servicios Externos ========
// NoMi Assistant – Funciones de peticiones HTTP, búsqueda web y llamadas a IA

function hacerPeticion(url, opciones) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: opciones.method || 'GET',
                url: url,
                headers: opciones.headers || {},
                data: opciones.body || null,
                onload: (resp) => {
                    if (resp.status >= 200 && resp.status < 300) {
                        try { resolve(JSON.parse(resp.responseText)); }
                        catch (e) { resolve(resp.responseText); }
                    } else {
                        reject(new Error(`Error ${resp.status}: ${resp.responseText}`));
                    }
                },
                onerror: (err) => {
                    fetch(url, opciones)
                        .then(async (r) => {
                            if (!r.ok) throw new Error(`Error ${r.status}: ${await r.text()}`);
                            return r.json();
                        })
                        .then(resolve)
                        .catch(reject);
                }
            });
        } else {
            fetch(url, opciones)
                .then(async (r) => {
                    if (!r.ok) throw new Error(`Error ${r.status}: ${await r.text()}`);
                    return r.json();
                })
                .then(resolve)
                .catch(reject);
        }
    });
}

async function buscarWeb(consulta) {
    if (!NoMiState.tavilyKeyActual) throw new Error('No hay clave de Tavily.');
    try {
        const datos = await hacerPeticion('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: NoMiState.tavilyKeyActual,
                query: consulta,
                search_depth: 'basic',
                max_results: 5
            })
        });
        return datos;
    } catch (error) {
        registrarError('network', error.message, `Búsqueda: "${consulta}"`);
        throw error;
    }
}

async function llamarIA(mensaje) {
    if (!NoMiState.apiKeyActual) throw new Error('No hay clave de OpenRouter.');
    try {
        const datos = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.apiKeyActual
            },
            body: JSON.stringify({
                model: NoMiState.modeloActual,
                messages: [{role: 'user', content: mensaje}],
                stream: false,
                max_tokens: 1024
            })
        });
        if (datos.choices && datos.choices[0]) return datos.choices[0].message.content;
        else throw new Error(datos.error?.message || 'Error en la IA');
    } catch (error) {
        registrarError('api', error.message, `Modelo: ${NoMiState.modeloActual}, URL: ${NoMiState.urlBaseActual}`);
        throw error;
    }
}

// ======== MODULO: nomi-modelos-free.js (bundle) ========
// ======== MÓDULO: Catálogo de Modelos Gratuitos (OpenRouter) ========
// NoMi Assistant – Listado de modelos gratuitos (:free, precio 0) para selección guiada.
//
// NO envía ni registra datos sensibles, chats, claves ni historial.
// NO llama a la telemetría/IA ni a Slack.
// Cachea en sessionStorage (una sola consulta por pestaña).
// Nunca usa Math.random ni Date.now() como generador de identificadores: es solo catálogo.

const MODELO_FREE_CACHE = 'nomi_modelos_free_cache';
const MODELO_FREE_TTL = 5 * 60 * 1000; // 5 minutos de validez en sessionStorage.
const MODELO_FREE_URL = 'https://openrouter.ai/api/v1/models?sort=latency-low-to-high';

// OpenRouter responde 429 cuando se supera la cuota. No confundimos 429 con baja de modelo.
class OpenRouterRateLimitError extends Error {
    constructor(message, retryAfter) {
        super(message);
        this.name = 'OpenRouterRateLimitError';
        this.retryAfter = retryAfter;
    }
}
class OpenRouterHttpError extends Error {
    constructor(status) {
        super('Error ' + status);
        this.name = 'OpenRouterHttpError';
        this.status = status;
    }
}
class OpenRouterNetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OpenRouterNetworkError';
    }
}

// Filtra: chat/texto, id :free y precio 0. No inventa cifras de latencia numérica.
function parsearModelosFree(datos) {
    const arr = Array.isArray(datos) ? datos : (datos && Array.isArray(datos.data) ? datos.data : []);
    return arr
        .filter(m => {
            if (!m || typeof m.id !== 'string') return false;
            if (!m.id.endsWith(':free')) return false;
            const precio = m.pricing || {};
            const request = precio.request;
            if (precio.prompt === undefined || precio.prompt === null || Number(precio.prompt) !== 0) return false;
            if (precio.completion === undefined || precio.completion === null || Number(precio.completion) !== 0) return false;
            if (request !== undefined && request !== null && Number(request) !== 0) return false;
            return true;
        })
        .map((m, i) => ({
            id: m.id,
            name: m.name || m.id,
            context: m.context_length ? Number(m.context_length) : null,
            // Posición relativa según el orden devuelto por OpenRouter (sort=latency-low-to-high).
            // No es una medición en milisegundos: solo indica orden relativo de latencia estimada.
            posicion: i + 1,
            peralmb: null
        }));
}

// Consulta compatible con userscripts: GM_xmlhttpRequest evita depender de CORS.
function solicitarCatalogoOpenRouter() {
    return new Promise((resolve, reject) => {
        const procesarRespuesta = (status, texto, retryAfter) => {
            if (status === 429) return reject(new OpenRouterRateLimitError('429 (rate limit)', retryAfter));
            if (status < 200 || status >= 300) return reject(new OpenRouterHttpError(status));
            try { resolve(JSON.parse(texto)); }
            catch { reject(new OpenRouterNetworkError('Respuesta inválida de OpenRouter')); }
        };
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: MODELO_FREE_URL,
                headers: { Accept: 'application/json' },
                onload: (resp) => procesarRespuesta(resp.status, resp.responseText, resp.responseHeaders?.match(/retry-after:\s*([^\r\n]+)/i)?.[1]),
                onerror: () => reject(new OpenRouterNetworkError('Sin conexión a OpenRouter')),
                ontimeout: () => reject(new OpenRouterNetworkError('Tiempo de espera agotado'))
            });
            return;
        }
        fetch(MODELO_FREE_URL, { method: 'GET', headers: { Accept: 'application/json' } })
            .then(async (resp) => procesarRespuesta(resp.status, await resp.text(), resp.headers.get('retry-after')))
            .catch((e) => reject(e instanceof OpenRouterHttpError || e instanceof OpenRouterRateLimitError || e instanceof OpenRouterNetworkError ? e : new OpenRouterNetworkError((e && e.message) || 'Sin conexión a OpenRouter')));
    });
}

// Consulta el catálogo de modelos gratuitos. Resuelve con [{id,name,context,...}].
// Lanza OpenRouterRateLimitError (429) / OpenRouterHttpError / OpenRouterNetworkError.
async function fetchFreeModelos(force) {
    const ahora = Date.now();
    if (!force) {
        const cached = sessionStorage.getItem(MODELO_FREE_CACHE);
        if (cached) {
            try {
                const obj = JSON.parse(cached);
                if (obj && obj.expira > ahora && Array.isArray(obj.data)) return obj.data;
            } catch { /* cache corrupto: se descarta */ }
        }
    }
    try {
        const datos = await solicitarCatalogoOpenRouter();
        const modelos = parsearModelosFree(datos);
        sessionStorage.setItem(MODELO_FREE_CACHE, JSON.stringify({ data: modelos, expira: ahora + MODELO_FREE_TTL }));
        return modelos;
    } catch (e) {
        sessionStorage.removeItem(MODELO_FREE_CACHE);
        throw e instanceof OpenRouterHttpError || e instanceof OpenRouterRateLimitError || e instanceof OpenRouterNetworkError
            ? e
            : new OpenRouterNetworkError((e && e.message) || 'Sin conexión a OpenRouter');
    }
}

// Indica si un id está presente como gratuito en la lista.
function modeloDisponible(modelo, lista) {
    return Array.isArray(lista) && lista.some(m => m.id === modelo);
}

// ---- Avisos en la cabecera (debajo del nombre técnico del modelo) ----
// No altera estructura existente: crea un <span id="nomi-modelo-aviso"> hermano al display.
function _crearAvisoModelo() {
    let aviso = document.getElementById('nomi-modelo-aviso');
    if (!aviso) {
        aviso = document.createElement('span');
        aviso.id = 'nomi-modelo-aviso';
        aviso.style.cssText = 'display:block;font-size:9px;margin-top:2px;';
        const display = document.getElementById('nomi-modelo-display');
        if (display && display.parentNode) display.parentNode.insertBefore(aviso, display.nextSibling);
    }
    return aviso;
}
function limpiarAvisoModelo() {
    const aviso = document.getElementById('nomi-modelo-aviso');
    if (aviso) aviso.remove();
}
function mostrarAvisoModeloRetirado() {
    const aviso = _crearAvisoModelo();
    aviso.style.color = '#f55036';
    aviso.textContent = '⚠️ Este modelo ya no está disponible gratis. Elige otro en Configuración.';
}
function mostrarAvisoVerificacion(tipo) {
    const aviso = _crearAvisoModelo();
    aviso.style.color = '#aaa';
    aviso.textContent = tipo === 'limit'
        ? 'No se pudo verificar disponibilidad (limitado). Inténtalo más tarde.'
        : 'No se pudo verificar disponibilidad del modelo.';
}

// Verificación de disponibilidad al abrir NoMi. Se ejecuta en segundo plano (no bloquea)
// y se consulta una sola vez por pestaña/sesión (sessionStorage).
async function verificarModeloAlIniciar() {
    if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('nomi_modelo_verificado') === 'true') return;
    const modelo = (typeof getModelo === 'function' ? getModelo() : '') || (NoMiState && NoMiState.modeloActual);
    if (!modelo) return;
    // Marcamos la sesión como verificada ANTES: no se reintenta en la misma pestaña aunque falle.
    sessionStorage.setItem('nomi_modelo_verificado', 'true');
    try {
        const lista = await fetchFreeModelos();
        if (!modeloDisponible(modelo, lista)) {
            mostrarAvisoModeloRetirado();
            return;
        }
        // Disponible → sin aviso; se retira cualquier aviso previo de la sesión.
        limpiarAvisoModelo();
    } catch (e) {
        if (e instanceof OpenRouterRateLimitError) mostrarAvisoVerificacion('limit');
        else mostrarAvisoVerificacion('fail');
        // No marcamos el modelo como retirado ante 429 ni error de red.
    }
    // No se envía diagnóstico ni se registra error por retirada normal de un modelo.
}

// ======== MODULO: nomi-credenciales.js (bundle) ========
// ======== MÓDULO: Credenciales ========
// NoMi Assistant – Funciones de importación y guardado de credenciales

function importarCredenciales() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const texto = await file.text();
            const arrayBuffer = await file.arrayBuffer();
            const bytesRaw = new Uint8Array(arrayBuffer);
            let credenciales = null;
            const erroresDetallados = [];

            try {
                const json = JSON.parse(texto);
                if (json.openrouter && json.tavily) {
                    credenciales = json;
                    mostrarNotificacionTemporal('📄 Archivo JSON plano importado.');
                }
            } catch (_) {}

            if (!credenciales && esHex(texto)) {
                try {
                    const bytes = hexToBytes(texto);
                    const metodosHex = [
                        { nombre: 'Hex-AES128-IV-fijo', fn: () => descifrarCBC(bytes, 16) },
                        { nombre: 'Hex-AES128-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 16);
                        }},
                        { nombre: 'Hex-AES256-IV-fijo', fn: () => descifrarCBC(bytes, 32) },
                        { nombre: 'Hex-AES256-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 32);
                        }}
                    ];
                    for (const metodo of metodosHex) {
                        try {
                            const resultado = await metodo.fn();
                            if (resultado && resultado.openrouter && resultado.tavily) {
                                credenciales = resultado;
                                mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                                break;
                            } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                        } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                    }
                } catch (err) { erroresDetallados.push('Hex: ' + err.message); }
            }

            if (!credenciales && esBase64(texto)) {
                try {
                    const bytes = base64ToBytes(texto);
                    const metodosBase64 = [
                        { nombre: 'Base64-AES128-IV-fijo', fn: () => descifrarCBC(bytes, 16) },
                        { nombre: 'Base64-AES128-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 16);
                        }},
                        { nombre: 'Base64-AES256-IV-fijo', fn: () => descifrarCBC(bytes, 32) },
                        { nombre: 'Base64-AES256-IV-incluido', fn: () => {
                            if (bytes.length < 16) throw new Error('Datos demasiado cortos');
                            const iv = bytes.slice(0, 16);
                            return descifrarCBCconIV(bytes.slice(16), iv, 32);
                        }}
                    ];
                    for (const metodo of metodosBase64) {
                        try {
                            const resultado = await metodo.fn();
                            if (resultado && resultado.openrouter && resultado.tavily) {
                                credenciales = resultado;
                                mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                                break;
                            } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                        } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                    }
                } catch (err) { erroresDetallados.push('Base64: ' + err.message); }
            }

            if (!credenciales) {
                const metodosRaw = [
                    { nombre: 'Raw-AES128-IV-fijo', fn: () => descifrarCBC(bytesRaw, 16) },
                    { nombre: 'Raw-AES128-IV-incluido', fn: () => {
                        if (bytesRaw.length < 16) throw new Error('Datos demasiado cortos');
                        const iv = bytesRaw.slice(0, 16);
                        return descifrarCBCconIV(bytesRaw.slice(16), iv, 16);
                    }},
                    { nombre: 'Raw-AES256-IV-fijo', fn: () => descifrarCBC(bytesRaw, 32) },
                    { nombre: 'Raw-AES256-IV-incluido', fn: () => {
                        if (bytesRaw.length < 16) throw new Error('Datos demasiado cortos');
                        const iv = bytesRaw.slice(0, 16);
                        return descifrarCBCconIV(bytesRaw.slice(16), iv, 32);
                    }}
                ];
                for (const metodo of metodosRaw) {
                    try {
                        const resultado = await metodo.fn();
                        if (resultado && resultado.openrouter && resultado.tavily) {
                            credenciales = resultado;
                            mostrarNotificacionTemporal(`🔐 Descifrado con ${metodo.nombre}`);
                            break;
                        } else erroresDetallados.push(`${metodo.nombre}: descifró pero no contiene openrouter/tavily`);
                    } catch (err) { erroresDetallados.push(`${metodo.nombre}: ${err.message}`); }
                }
            }

            if (!credenciales) {
                try {
                    const password = prompt('🔐 Introduce la contraseña para descifrar (método GCM):');
                    if (password === null) return;
                    const resultado = await descifrarGCM(bytesRaw, password);
                    if (resultado && resultado.openrouter && resultado.tavily) {
                        credenciales = resultado;
                        mostrarNotificacionTemporal('🔐 Descifrado con GCM.');
                    } else throw new Error('No contiene las claves esperadas');
                } catch (errGCM) { erroresDetallados.push('GCM: ' + errGCM.message); }
            }

            if (!credenciales) {
                const resumen = erroresDetallados.length ? '\n\n📋 Intentos realizados:\n' + erroresDetallados.join('\n') : '';
                throw new Error('No se pudo descifrar el archivo con ningún método.' + resumen);
            }

            setApiKey(credenciales.openrouter);
            setTavilyKey(credenciales.tavily);
            if (credenciales.modelo) setModelo(credenciales.modelo);
            if (credenciales.url) setUrlBase(credenciales.url);
            setCredencialesCargadas(true);
            setConfigInicial(true);
            NoMiState.apiKeyActual = credenciales.openrouter;
            NoMiState.tavilyKeyActual = credenciales.tavily;
            NoMiState.modeloActual = getModelo();
            NoMiState.urlBaseActual = getUrlBase();

            mostrarNotificacionTemporal('✅ Credenciales importadas correctamente.');
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.ventanaAbierta) actualizarStats();
        } catch (err) {
            mostrarNotificacionTemporal('❌ ' + err.message);
            registrarError('credenciales', err.message, 'Importación de credenciales');
        }
    };
    input.click();
}

function guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase) {
    if (!apiKey || !tavilyKey) {
        mostrarNotificacionTemporal('❌ Debes ingresar ambas claves (OpenRouter y Tavily).');
        return false;
    }
    setApiKey(apiKey);
    setTavilyKey(tavilyKey);
    if (modelo) setModelo(modelo);
    if (urlBase) setUrlBase(urlBase);
    setCredencialesCargadas(true);
    setConfigInicial(true);
    NoMiState.apiKeyActual = apiKey;
    NoMiState.tavilyKeyActual = tavilyKey;
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
    mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
    return true;
}

// ======== MODULO: nomi-ubicacion.js (bundle) ========
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

// ======== MODULO: nomi-ui.js (bundle) ========
// ======== MÓDULO: UI – Burbuja y Ventana ========
// NoMi Assistant – Funciones de creación de la burbuja flotante y la ventana de chat

function crearBurbuja() {
    const existing = document.getElementById('nomi-bubble');
    if (existing) existing.remove();
    const bubble = document.createElement('div');
    bubble.id = 'nomi-bubble';
    bubble.textContent = '💬';
    bubble.style.cssText = 'position:fixed;left:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:#1a1a2e;border:2px solid #FF6B6B;color:white;font-size:28px;cursor:pointer;z-index:999998;box-shadow:0 4px 16px rgba(255,107,107,0.5);display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;transition:transform 0.2s;';
    if (NoMiState.posicionBurbuja.x || NoMiState.posicionBurbuja.y) {
        bubble.style.left = NoMiState.posicionBurbuja.x + 'px';
        bubble.style.top = NoMiState.posicionBurbuja.y + 'px';
        bubble.style.right = 'auto';
        bubble.style.bottom = 'auto';
    }
    document.body.appendChild(bubble);
    NoMiState.burbujaVisible = true;

    let startX, startY, origX, origY, isDragging = false, isTouching = false;
    bubble.addEventListener('touchstart', (e) => {
        if (NoMiState.ventanaAbierta) return;
        const touch = e.touches[0];
        startX = touch.clientX; startY = touch.clientY;
        origX = bubble.offsetLeft || 0; origY = bubble.offsetTop || 0;
        isDragging = false; isTouching = true;
    }, { passive: true });
    bubble.addEventListener('touchmove', (e) => {
        if (!isTouching || NoMiState.ventanaAbierta) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX, dy = touch.clientY - startY;
        if (Math.sqrt(dx*dx + dy*dy) > 10) {
            isDragging = true;
            let newX = Math.max(0, Math.min(window.innerWidth - 56, origX + dx));
            let newY = Math.max(0, Math.min(window.innerHeight - 56, origY + dy));
            bubble.style.left = newX + 'px'; bubble.style.top = newY + 'px';
            bubble.style.right = 'auto'; bubble.style.bottom = 'auto';
            NoMiState.posicionBurbuja = { x: newX, y: newY };
            setPosicion(NoMiState.posicionBurbuja);
        }
    }, { passive: true });
    bubble.addEventListener('touchend', () => {
        isTouching = false;
        if (!isDragging) toggleVentana();
        isDragging = false;
    });

    let mouseDown = false, mouseStartX, mouseStartY, mouseOrigX, mouseOrigY, mouseDragging = false;
    bubble.addEventListener('mousedown', (e) => {
        if (NoMiState.ventanaAbierta) return;
        mouseDown = true;
        mouseStartX = e.clientX; mouseStartY = e.clientY;
        mouseOrigX = bubble.offsetLeft || 0; mouseOrigY = bubble.offsetTop || 0;
        mouseDragging = false;
    });
    document.addEventListener('mousemove', (e) => {
        if (!mouseDown || NoMiState.ventanaAbierta) return;
        const dx = e.clientX - mouseStartX, dy = e.clientY - mouseStartY;
        if (Math.sqrt(dx*dx + dy*dy) > 5) {
            mouseDragging = true;
            let newX = Math.max(0, Math.min(window.innerWidth - 56, mouseOrigX + dx));
            let newY = Math.max(0, Math.min(window.innerHeight - 56, mouseOrigY + dy));
            bubble.style.left = newX + 'px'; bubble.style.top = newY + 'px';
            bubble.style.right = 'auto'; bubble.style.bottom = 'auto';
            NoMiState.posicionBurbuja = { x: newX, y: newY };
            setPosicion(NoMiState.posicionBurbuja);
        }
    });
    document.addEventListener('mouseup', () => {
        if (mouseDown) {
            mouseDown = false;
            if (!mouseDragging) toggleVentana();
            mouseDragging = false;
        }
    });
}

function crearVentanaChat() {
    const existing = document.getElementById('nomi-chat');
    if (existing) existing.remove();
    const win = document.createElement('div');
    win.id = 'nomi-chat';
    const { w, h } = obtenerTamanoReal();
    let left = window.innerWidth - w - 20;
    let top = window.innerHeight - h - 90;
    if (NoMiState.posicionVentana.x && NoMiState.posicionVentana.y) {
        left = NoMiState.posicionVentana.x;
        top = NoMiState.posicionVentana.y;
    }
    left = Math.max(0, Math.min(window.innerWidth - w, left));
    top = Math.max(0, Math.min(window.innerHeight - h, top));

    win.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${w}px;height:${h}px;max-width:90vw;max-height:90vh;background:#1a1a2e;border-radius:20px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.9);z-index:999997;font-family:sans-serif;border:1px solid #4a4a6a;display:none;flex-direction:column;overflow:hidden;transition:none;`;
    NoMiState.posicionVentana = { x: left, y: top };
    setPosicionVentana(NoMiState.posicionVentana);

    win.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#fff;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:8px;"><b style="font-size:13px;color:#FF6B6B;">${NOMBRE_ASISTENTE}</b><span id="nomi-modelo-display" style="font-size:9px;color:#888;">${NoMiState.modeloActual}</span></div>
            <div><button id="nomi-web-btn" style="background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;">🌐</button><button id="nomi-stats-btn" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;" title="Estadísticas">📊</button><button id="nomi-export-btn" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;" title="Exportar historial">📤</button><button id="nomi-menu-btn" style="background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;">⚙️</button></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#555;flex-shrink:0;margin-bottom:4px;"><span id="nomi-contexto-indicador">📚 Contexto: ${NoMiState.contextoSeleccionado} mensajes</span><span id="nomi-web-status" style="display:none;color:#34a853;">🌐 Web activo</span></div>
        <div id="nomi-chat-body" style="flex:1;background:#0d0d1a;border-radius:12px;padding:8px;overflow-y:auto;margin-bottom:8px;font-size:12px;color:#ccc;min-height:100px;"><div style="color:#666;text-align:center;">Cargando conversación...</div></div>
        <div id="nomi-loading" style="display:none;color:#888;font-size:11px;font-style:italic;margin-bottom:4px;flex-shrink:0;">✍️ Escribiendo<span id="nomi-dots">.</span></div>
        <div style="display:flex;gap:6px;flex-shrink:0;"><input id="nomi-input" type="text" placeholder="Pregunta..." style="flex:1;padding:8px;border-radius:10px;border:none;background:#0d0d1a;color:#fff;font-size:13px;" autocomplete="off"><button id="nomi-search-btn" style="background:#4a6cf7;border:none;border-radius:10px;padding:8px 12px;color:#fff;font-size:14px;cursor:pointer;margin-right:4px;" title="Forzar búsqueda web de esta pregunta">🔍</button><button id="nomi-enviar" style="background:#FF6B6B;border:none;border-radius:10px;padding:8px 14px;color:#fff;font-weight:bold;cursor:pointer;">➤</button></div>
        <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#555;flex-shrink:0;"><div><button id="nomi-lock-toggle" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0;z-index:999999;" title="Bloquear/Desbloquear movimiento de la ventana">🔓</button></div><div style="display:flex;align-items:center;gap:6px;"><span id="nomi-ubicacion-display" style="color:#888;font-size:10px;">📍 ${NoMiState.ubicacionActual ? `${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}` : 'Ubicación desactivada'}</span><button id="nomi-ubicacion-update" style="background:none;border:none;color:#4a6cf7;font-size:12px;cursor:pointer;padding:0 4px;" title="Actualizar ubicación">⟳</button><span>📊 Tokens: <span id="nomi-token-counter">0</span></span><button id="nomi-cerrar-chat" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0 6px;margin-left:4px;" title="Cerrar chat">✕</button></div></div>
    `;
    document.body.appendChild(win);

    document.getElementById('nomi-ubicacion-update').onclick = () => {
        if (NoMiState.ubicacionActivada) actualizarUbicacion(false);
        else mostrarNotificacionTemporal('📍 La ubicación está desactivada. Actívala en el menú (⚙️).');
    };
    document.getElementById('nomi-search-btn').onclick = () => {
        const input = document.getElementById('nomi-input');
        const texto = input.value.trim();
        if (texto) { NoMiState.busquedaForzada = true; preguntar(texto); }
        else mostrarNotificacionTemporal('Escribe una pregunta antes de usar la lupa.');
    };
    document.getElementById('nomi-lock-toggle').onclick = function(e) {
        e.stopPropagation();
        NoMiState.ventanaBloqueada = !NoMiState.ventanaBloqueada;
        this.textContent = NoMiState.ventanaBloqueada ? '🔒' : '🔓';
    };
    document.getElementById('nomi-cerrar-chat').onclick = () => toggleVentana(false);

    let dragStartX, dragStartY, dragOrigLeft, dragOrigTop, isDraggingWin = false;
    win.addEventListener('mousedown', (e) => {
        if (NoMiState.ventanaBloqueada) return;
        if (e.target.closest('button') || e.target.closest('input')) return;
        if (e.clientY - win.getBoundingClientRect().top > 30) return;
        e.preventDefault();
        dragStartX = e.clientX; dragStartY = e.clientY;
        dragOrigLeft = win.offsetLeft; dragOrigTop = win.offsetTop;
        isDraggingWin = true;
        const onMove = (ev) => {
            if (!isDraggingWin) return;
            const dx = ev.clientX - dragStartX, dy = ev.clientY - dragStartY;
            let nl = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, dragOrigLeft + dx));
            let nt = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, dragOrigTop + dy));
            win.style.left = nl + 'px'; win.style.top = nt + 'px';
            NoMiState.posicionVentana = { x: nl, y: nt };
            setPosicionVentana(NoMiState.posicionVentana);
        };
        const onUp = () => { isDraggingWin = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    win.addEventListener('touchstart', (e) => {
        if (NoMiState.ventanaBloqueada) return;
        if (e.target.closest('button') || e.target.closest('input')) return;
        const touch = e.touches[0];
        if (touch.clientY - win.getBoundingClientRect().top > 30) return;
        e.preventDefault();
        dragStartX = touch.clientX; dragStartY = touch.clientY;
        dragOrigLeft = win.offsetLeft; dragOrigTop = win.offsetTop;
        isDraggingWin = true;
    }, {passive:false});
    win.addEventListener('touchmove', (e) => {
        if (NoMiState.ventanaBloqueada || !isDraggingWin) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX, dy = touch.clientY - dragStartY;
        let nl = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, dragOrigLeft + dx));
        let nt = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, dragOrigTop + dy));
        win.style.left = nl + 'px'; win.style.top = nt + 'px';
        NoMiState.posicionVentana = { x: nl, y: nt };
        setPosicionVentana(NoMiState.posicionVentana);
    }, {passive:false});
    win.addEventListener('touchend', () => { isDraggingWin = false; });

    document.getElementById('nomi-enviar').onclick = () => { const input = document.getElementById('nomi-input'); preguntar(input.value); };
    document.getElementById('nomi-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(document.getElementById('nomi-input').value); } });
    document.getElementById('nomi-web-btn').onclick = () => {
        NoMiState.modoWebActivo = !NoMiState.modoWebActivo;
        const status = document.getElementById('nomi-web-status');
        if (NoMiState.modoWebActivo) {
            status.style.display = 'inline';
            document.getElementById('nomi-web-btn').style.borderColor = '#34a853';
            document.getElementById('nomi-web-btn').style.color = '#34a853';
            agregarMensaje('bot', '🌐 Modo Web activado. La siguiente pregunta incluirá análisis de página.');
        } else {
            status.style.display = 'none';
            document.getElementById('nomi-web-btn').style.borderColor = '#555';
            document.getElementById('nomi-web-btn').style.color = '#888';
            agregarMensaje('bot', '🌐 Modo web desactivado.');
        }
    };
    document.getElementById('nomi-stats-btn').onclick = () => mostrarEstadisticas();
    document.getElementById('nomi-export-btn').onclick = () => mostrarExportacion();
    document.getElementById('nomi-menu-btn').onclick = () => mostrarMenu();

    actualizarContextoIndicador();
    actualizarStats();
    actualizarBarraUbicacion();
}

// ======== MODULO: nomi-asistente-config.js (bundle) ========
// ======== MÓDULO: Asistente de Configuración Inicial ========
// NoMi Assistant – Función de creación del asistente de configuración inicial

function mostrarAsistenteConfiguracion() {
    const existing = document.getElementById('nomi-asistente-config');
    if (existing) existing.remove();

    const { w, h } = obtenerTamanoReal();
    const left = window.innerWidth / 2 - w / 2;
    const top = window.innerHeight / 2 - h / 2;

    const asistente = document.createElement('div');
    asistente.id = 'nomi-asistente-config';
    asistente.style.cssText = `
        position: fixed; left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px;
        max-width: 90vw; max-height: 90vh; background: #1a1a2e; border-radius: 20px;
        padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.9); z-index: 9999999;
        font-family: sans-serif; border: 2px solid #FF6B6B; display: flex;
        flex-direction: column; overflow-y: auto; color: #fff;
    `;
    asistente.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
            <h1 style="color: #FF6B6B; margin: 0; font-size: 24px;">🤖 ${NOMBRE_ASISTENTE}</h1>
            <p style="color: #888; font-size: 13px; margin: 4px 0;">Asistente IA para navegación</p>
            <p style="color: #555; font-size: 11px;">Versión ${VERSION_SCRIPT} | ${FECHA_LANZAMIENTO}</p>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 8px 0;">
            <div style="background: #0d0d1a; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="color: #4a6cf7; margin: 0 0 12px 0; font-size: 15px;">🔑 Configuración de credenciales</h3>
                <p style="color: #888; font-size: 12px; margin-bottom: 16px;">
                    Para usar ${NOMBRE_ASISTENTE}, necesitas configurar tus claves de API.
                    Puedes importarlas desde un archivo <b>.enc</b> (si tienes uno) o ingresarlas manualmente.
                </p>
                <button id="nomi-config-importar" style="width: 100%; padding: 12px; background: #4a6cf7; border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; margin-bottom: 12px;">📥 Importar desde archivo .enc</button>
                <div style="border-top: 1px solid #333; padding-top: 12px; margin-top: 8px;">
                    <p style="color: #888; font-size: 12px; margin-bottom: 8px;">✏️ O ingresa tus claves manualmente:</p>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">OpenRouter API Key *</label><input type="password" id="nomi-config-openrouter" placeholder="sk-or-v1-..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">Tavily API Key *</label><input type="password" id="nomi-config-tavily" placeholder="tvly-..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                                        <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">Modelo gratuito (opcional)</label>
                        <select id="nomi-config-modelo" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;">
                            <option value="${MODELO_POR_DEFECTO}">${MODELO_POR_DEFECTO} — Recomendado</option>
                        </select>
                        <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
                            <button id="nomi-config-refrescar-modelos" style="flex:1;padding:6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;">Actualizar modelos gratis</button>
                            <span id="nomi-config-estado-modelo" style="font-size:10px;color:#aaa;"></span>
                        </div>
                        <div style="font-size:10px;color:#888;margin-top:4px;">Lista ordenada por latencia estimada de OpenRouter. Menor número = menor latencia estimada según OpenRouter.</div>
                    </div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">URL Base (opcional)</label><input type="text" id="nomi-config-url" placeholder="${URL_BASE_POR_DEFECTO}" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #555; background: #0d0d1a; color: #fff; font-size: 12px;"></div>
                    <button id="nomi-config-guardar" style="width: 100%; padding: 10px; background: #34a853; border: none; border-radius: 8px; color: #fff; font-size: 13px; cursor: pointer;">💾 Guardar credenciales</button>
                </div>
            </div>
            <div style="background: #0d0d1a; border-radius: 12px; padding: 12px; border: 1px solid #333;">
                <p style="color: #555; font-size: 10px; margin: 0; text-align: center;">ℹ️ Las claves se guardan localmente en tu navegador.<br>Puedes cambiarlas en cualquier momento desde el menú (⚙️).</p>
            </div>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px; flex-shrink: 0;">
            <button id="nomi-config-cerrar" style="flex: 1; padding: 8px; background: #333; border: none; border-radius: 8px; color: #888; font-size: 12px; cursor: pointer;">Cerrar (configurar más tarde)</button>
        </div>
    `;
    document.body.appendChild(asistente);

    void cargarModelosAsistente(false);

    document.getElementById('nomi-config-importar').onclick = () => importarCredenciales();
    // "Actualizar modelos gratis": consulta OpenRouter (fuerza) y repuebla el <select>.
    document.getElementById('nomi-config-refrescar-modelos').onclick = () => cargarModelosAsistente(true);
    document.getElementById('nomi-config-guardar').onclick = () => {
        const apiKey = document.getElementById('nomi-config-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-config-tavily').value.trim();
        const modelo = document.getElementById('nomi-config-modelo').value.trim() || MODELO_POR_DEFECTO;
        const urlBase = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.historial.length > 0) {
                const ultimoMensaje = NoMiState.historial[NoMiState.historial.length - 1];
                if (ultimoMensaje.role === 'assistant' && ultimoMensaje.content.includes('Aún no has importado')) {
                    NoMiState.historial.pop();
                    NoMiState.historial.push({role: 'assistant', content: '✅ Credenciales configuradas correctamente.\n\n¿En qué puedo ayudarle?'});
                    guardarHistorial(NoMiState.historial);
                    cargarHistorial();
                }
            }
            actualizarStats();
        }
    };
    document.getElementById('nomi-config-cerrar').onclick = () => {
        if (confirm('⚠️ Sin credenciales, NoMi no podrá responder preguntas ni buscar en la web.\n¿Estás seguro de que quieres continuar sin configurar?')) {
            const asistente = document.getElementById('nomi-asistente-config');
            if (asistente) asistente.remove();
            if (!NoMiState.ventanaAbierta) toggleVentana(true);
            if (NoMiState.historial.length > 0) {
                const ultimoMensaje = NoMiState.historial[NoMiState.historial.length - 1];
                if (!(ultimoMensaje.role === 'assistant' && ultimoMensaje.content.includes('Aún no has importado'))) {
                    agregarMensaje('bot', '⚠️ **Aún no has configurado tus credenciales.**\n\nVe al menú (⚙️) y selecciona "Importar credenciales" o ingresa tus claves manualmente para activar la búsqueda web y el acceso a la IA.\n\nMientras tanto, puedo ayudarte con comandos básicos como `!cmd` para ver la lista de comandos.');
                }
                        }
        }
    };
}

// ---- Poblado del selector de modelos gratuitos en el asistente inicial ----
// La opción por defecto (MODELO_POR_DEFECTO) ya está presente al crear el <select>; al
// refrescar se repuebla con el catálogo filtrado (solo :free, precio 0).
async function cargarModelosAsistente(force) {
    const select = document.getElementById('nomi-config-modelo');
    const estado = document.getElementById('nomi-config-estado-modelo');
    if (!select) return;
    if (!force && select.options.length > 1) return; // ya poblado previamente.
    estado.textContent = 'Cargando…';
    try {
        const lista = await fetchFreeModelos(force);
        const actual = select.value || MODELO_POR_DEFECTO;
        select.innerHTML = '';
        lista.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            let label = `${m.name} | ${m.id}`;
            if (m.context) label += ` | ctx ${m.context}`;
            if (m.posicion) label += ` | Latencia #${m.posicion}`;
            if (m.id === MODELO_POR_DEFECTO) label += ' — Recomendado';
            if (m.id === actual) opt.selected = true;
            opt.textContent = label;
            select.appendChild(opt);
        });
    } catch (e) {
        estado.textContent = e instanceof OpenRouterRateLimitError ? 'Limitado (429)' : 'No se pudo cargar';
    }
}

// ======== MODULO: nomi-menu-config.js (bundle) ========
// ======== MÓDULO: Menú de Configuración ========
// NoMi Assistant – Función de creación del menú de configuración (⚙️)

function mostrarMenu() {
    const existing = document.getElementById('nomi-menu');
    if (existing) { existing.style.display = existing.style.display === 'block' ? 'none' : 'block'; return; }
    const menu = document.createElement('div');
    menu.id = 'nomi-menu';
    menu.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border-radius:20px;padding:24px;z-index:9999999;color:#fff;border:1px solid #4a4a6a;box-shadow:0 8px 32px rgba(0,0,0,0.9);min-width:320px;max-width:90vw;max-height:80vh;overflow-y:auto;';
    const resumenDisabled = NoMiState.contextoSeleccionado !== 10;
    const { w, h } = NoMiState.tamanoVentana;
    const espacioOcupado = calcularEspacioOcupado();
    const espacioFormateado = espacioOcupado > 1024 ? `${Math.round(espacioOcupado/1024)} KB` : `${espacioOcupado} B`;
    const logs = getValor(STORAGE_ERROR_LOGS, []);
    const credCargadas = getCredencialesCargadas();
    const apiKeyActual = getApiKey();
    const tavilyKeyActual = getTavilyKey();
    const modeloActual = getModelo();
    const urlBaseActual = getUrlBase();
    const motor = getMotorBusqueda();
    const diagnosticoActivo = getDiagnosticoActivo();

    menu.innerHTML = `
        <h2 style="color:#FF6B6B;margin-top:0;">⚙️ Configuración</h2>
        <div style="margin:10px 0;">
            <div style="margin-bottom:8px;font-size:11px;color:#555;">💾 Espacio ocupado: <span style="color:#888;">${espacioFormateado}</span>${logs.length > 0 ? ` | 📋 Errores: <span style="color:#f55036;">${logs.length}</span>` : ''}${credCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'}</div>
            <div style="margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;">
                <h3 style="color:#4a6cf7;margin:0 0 8px 0;font-size:14px;">🔑 Credenciales</h3>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">OpenRouter API Key</label><input type="password" id="nomi-input-openrouter" value="${apiKeyActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></div>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Tavily API Key</label><input type="password" id="nomi-input-tavily" value="${tavilyKeyActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"><div style="font-size:9px;color:#555;margin-top:2px;">Si no tienes, obtén una gratis en tavily.com</div></div>
                                <div style="margin-bottom:8px;">
                    <label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Modelo gratuito</label>
                    <select id="nomi-input-modelo" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></select>
                    <div style="display:flex;gap:4px;align-items:center;margin-top:4px;">
                        <button id="nomi-actualizar-modelos" style="flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;">Actualizar</button>
                        <span id="nomi-estado-modelo" style="font-size:9px;color:#aaa;"></span>
                    </div>
                    <div style="font-size:9px;color:#888;margin-top:4px;">Lista ordenada por latencia estimada de OpenRouter. Menor número = menor latencia estimada según OpenRouter.</div>
                </div>
                <div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:2px;">URL Base</label><input type="text" id="nomi-input-url" value="${urlBaseActual}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;"></div>
                <div style="display:flex;gap:8px;"><button id="nomi-guardar-creds" style="flex:1;padding:8px;background:#4a6cf7;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;">💾 Guardar</button><button id="nomi-importar-creds-menu" style="flex:1;padding:8px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;">📥 Importar .enc</button></div>
                <div style="font-size:10px;color:#555;margin-top:4px;">Las claves se guardan localmente en tu navegador.</div>
            </div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">🔍 Motor de búsqueda</label><select id="nomi-select-motor" style="width:100%;padding:8px;border-radius:8px;background:#0d0d1a;color:#fff;border:1px solid #555;"><option value="tavily" ${motor === 'tavily' ? 'selected' : ''}>Tavily (requiere clave)</option><option value="ninguno" ${motor === 'ninguno' ? 'selected' : ''}>Ninguno (sin búsqueda web)</option></select><div style="font-size:11px;color:#888;">Elige el motor de búsqueda para obtener información actualizada.</div></div>
            <div style="margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;">
                <h3 style="color:#36c5f0;margin:0 0 8px 0;font-size:14px;">🩺 Diagnóstico técnico</h3>
                <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;"><span>Enviar diagnóstico de errores</span><input type="checkbox" id="nomi-check-diagnostico" ${diagnosticoActivo ? 'checked' : ''}></label>
                <div style="font-size:10px;color:#888;margin-top:4px;">Solo errores y contexto técnico (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa.</div>
            </div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>📍 Ubicación</span><input type="checkbox" id="nomi-check-ubicacion" ${NoMiState.ubicacionActivada ? 'checked' : ''}></label><div style="font-size:11px;color:#888;">Permite a NoMi conocer su ubicación para respuestas más precisas (clima, eventos, etc.).</div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🌿 Modo Ligero</span><input type="checkbox" id="nomi-check-ligero" ${NoMiState.modoLigeroActivo ? 'checked' : ''}></label><div style="font-size:11px;color:#888;">Reduce el texto extraído de páginas a 500 caracteres.</div></div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">📌 Contexto</label><div style="display:flex;gap:8px;">${CONTEXTOS_DISPONIBLES.map(c => `<label style="font-size:13px;display:flex;align-items:center;gap:4px;"><input type="radio" name="contexto" value="${c}" ${NoMiState.contextoSeleccionado === c ? 'checked' : ''}>${c}</label>`).join('')}</div><div style="font-size:11px;color:#888;">Número de mensajes enviados al modelo (recomendado: 10).</div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🧠 Resumen persistente</span><input type="checkbox" id="nomi-check-resumen" ${NoMiState.modoResumenActivo ? 'checked' : ''} ${resumenDisabled ? 'disabled' : ''}></label><div style="font-size:11px;color:#888;">${resumenDisabled ? 'Solo disponible con 10 mensajes.' : 'Guarda un resumen de la conversación para contexto a largo plazo.'}</div></div>
            <div style="margin-bottom:12px;"><label style="font-size:14px;display:block;margin-bottom:4px;">📐 Tamaño de la ventana</label><div style="display:flex;gap:8px;margin-top:4px;"><label>Ancho (px): <input type="number" id="nomi-width-input" value="${w}" min="280" step="10" style="width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;"></label><label>Alto (px): <input type="number" id="nomi-height-input" value="${h}" min="300" step="10" style="width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;"></label></div><div style="display:flex;gap:6px;margin-top:6px;"><button id="nomi-size-apply" style="padding:4px 12px;background:#4a6cf7;border:none;border-radius:6px;color:#fff;cursor:pointer;">Aplicar</button><button id="nomi-size-default" style="padding:4px 12px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer;">Predeterminado</button></div></div>
            <div style="margin-bottom:12px;"><label style="display:flex;justify-content:space-between;align-items:center;font-size:14px;"><span>🔍 Búsqueda web</span><input type="checkbox" id="nomi-check-busqueda" ${NoMiState.busquedaWebActiva ? 'checked' : ''} ${credCargadas ? '' : 'disabled'}></label><div style="font-size:11px;color:#888;">${credCargadas ? 'Activa la búsqueda web automática (detección de palabras clave).' : 'Primero configura tus credenciales.'}</div></div>
            <button id="nomi-menu-restaurar" style="width:100%;padding:10px;background:#555;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🔄 Restaurar posición</button>
            <button id="nomi-menu-limpiar" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🗑️ Limpiar datos antiguos</button>
            <button id="nomi-menu-exportar-logs" style="width:100%;padding:10px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">📤 Exportar logs de error</button>
            <button id="nomi-menu-eliminar-global" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🗑️ Eliminar datos globales</button>
            <button id="nomi-menu-cerrar-sesion" style="width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;">🚪 Cerrar sesión</button>
            <button id="nomi-menu-cerrar" style="width:100%;padding:10px;background:none;border:none;color:#888;font-size:14px;cursor:pointer;">Cerrar</button>
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #333;font-size:11px;color:#555;text-align:center;">ℹ️ <b>Acerca de NoMi</b><br>Asistente IA desarrollado por <b>${DISEÑADOR}</b><br>Powered by <b>OpenRouter</b> & <b>Tavily</b><br>Modelo: <b>${modeloActual}</b><br>Versión: <b>${VERSION_SCRIPT}</b> (${FECHA_LANZAMIENTO})<br><span style="color:#444;">ℹ️ En páginas de configuración de Google (accounts.google.com), la burbuja puede no aparecer. Vuelva a la página anterior o recargue.</span></div>
    `;
    document.body.appendChild(menu);

    document.getElementById('nomi-menu-cerrar').onclick = () => menu.remove();
    document.getElementById('nomi-guardar-creds').onclick = () => {
        const apiKey = document.getElementById('nomi-input-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-input-tavily').value.trim();
        const modelo = document.getElementById('nomi-input-modelo').value.trim() || MODELO_POR_DEFECTO;
        const urlBase = document.getElementById('nomi-input-url').value.trim() || URL_BASE_POR_DEFECTO;
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const modelDisplay = document.getElementById('nomi-modelo-display');
            if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
            actualizarStats();
            menu.remove();
            mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
        }
        };

    // ---- Selector guiado de modelo gratuito ----
    // Cambiar el modelo es siempre explícito del usuario: aquí sólo reacciona al <select>.
    document.getElementById('nomi-input-modelo').addEventListener('change', () => {
        const sel = document.getElementById('nomi-input-modelo');
        const elegido = (sel && sel.value) || '';
        if (!elegido) return;
        setModelo(elegido);              // persiste vía getModelo/setModelo.
        limpiarAvisoModelo();            // modelo válido → retira aviso de retirado/verificación.
        const display = document.getElementById('nomi-modelo-display');
        if (display) display.textContent = NoMiState.modeloActual;
    });
    document.getElementById('nomi-actualizar-modelos').onclick = () => cargarModelosAlMenu(true);
    // Puebla el selector al abrir el menú (el caché de sessionStorage evita consultas repetidas).
    cargarModelosAlMenu();

    document.getElementById('nomi-importar-creds-menu').onclick = () => { importarCredenciales(); menu.remove(); };
    document.getElementById('nomi-check-diagnostico').onchange = (e) => {
        NoMiState.diagnosticoActivo = e.target.checked;
        setDiagnosticoActivo(NoMiState.diagnosticoActivo);
        menu.remove();
        mostrarNotificacionTemporal(`🩺 Diagnóstico técnico ${NoMiState.diagnosticoActivo ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-select-motor').onchange = (e) => {
        NoMiState.motorBusqueda = e.target.value;
        setMotorBusqueda(NoMiState.motorBusqueda);
        mostrarNotificacionTemporal(`🔍 Motor de búsqueda: ${NoMiState.motorBusqueda === 'tavily' ? 'Tavily' : 'Desactivado'}`);
    };
    document.getElementById('nomi-check-ubicacion').onchange = (e) => {
        NoMiState.ubicacionActivada = e.target.checked;
        setUbicacionActivada(NoMiState.ubicacionActivada);
        if (NoMiState.ubicacionActivada) {
            if (!NoMiState.ubicacionActual) actualizarUbicacion(false);
            else mostrarNotificacionTemporal(`📍 Ubicación activada: ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}`);
        } else {
            if (NoMiState.ubicacionActual && confirm('¿Quieres eliminar la ubicación guardada?')) {
                eliminarValor(STORAGE_UBICACION);
                NoMiState.ubicacionActual = null;
                mostrarNotificacionTemporal('📍 Ubicación eliminada.');
            }
        }
        actualizarBarraUbicacion();
        menu.remove();
    };
    document.getElementById('nomi-menu-limpiar').onclick = () => {
        if (confirm('¿Eliminar todos los historiales de más de 7 días? Esta acción no se puede deshacer.')) {
            const resultado = limpiarHistorialesAntiguos();
            mostrarNotificacionTemporal(`🧹 ${resultado.eliminados} historiales eliminados. Espacio liberado: ~${Math.round(resultado.espacioLiberado/1024)} KB`);
            menu.remove();
        }
    };
    document.getElementById('nomi-menu-exportar-logs').onclick = () => { exportarLogs(); menu.remove(); };
    document.getElementById('nomi-menu-eliminar-global').onclick = () => {
        const dialog = document.createElement('div');
        dialog.id = 'nomi-dialog-global';
        dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border-radius:20px;padding:24px;z-index:99999999;color:#fff;border:1px solid #4a4a6a;box-shadow:0 8px 32px rgba(0,0,0,0.9);min-width:280px;max-width:90vw;max-height:80vh;overflow-y:auto;';
        dialog.innerHTML = `<h3 style="color:#FF6B6B;margin-top:0;">🗑️ Eliminar datos globales</h3><p style="font-size:13px;color:#888;">Seleccione qué datos desea eliminar:</p><div style="margin:12px 0;">${['📁 Historiales de chat (todos los dominios)','⚙️ Configuración (contexto, modos)','📍 Ubicación guardada','📋 Logs de errores','📐 Tamaño y posición de ventana','📊 Estadísticas de tokens'].map((t,i) => `<label style="display:block;margin:6px 0;font-size:13px;"><input type="checkbox" id="nomi-del-${i}" checked> ${t}</label>`).join('')}</div><div style="display:flex;gap:8px;margin-top:16px;"><button id="nomi-dialog-confirmar" style="flex:1;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;">Eliminar seleccionados</button><button id="nomi-dialog-cancelar" style="flex:1;padding:10px;background:#333;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;">Cancelar</button></div>`;
        document.body.appendChild(dialog);
        document.getElementById('nomi-dialog-cancelar').onclick = () => dialog.remove();
        document.getElementById('nomi-dialog-confirmar').onclick = () => {
            const checks = [document.getElementById('nomi-del-0').checked, document.getElementById('nomi-del-1').checked, document.getElementById('nomi-del-2').checked, document.getElementById('nomi-del-3').checked, document.getElementById('nomi-del-4').checked, document.getElementById('nomi-del-5').checked];
            const keysToRemove = [];
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('nomi_')) {
                    if (checks[0] && key.startsWith('nomi_historial_')) keysToRemove.push(key);
                    else if (checks[1] && [STORAGE_CONTEXTO, STORAGE_MODO_LIGERO, STORAGE_MODO_RESUMEN, STORAGE_BUSQUEDA_WEB, STORAGE_TAMANO_VENTANA, STORAGE_VALIDADO, STORAGE_API_KEY, STORAGE_MODELO, STORAGE_URL].includes(key)) keysToRemove.push(key);
                    else if (checks[2] && (key === STORAGE_UBICACION || key === STORAGE_UBICACION_ACTIVADA)) keysToRemove.push(key);
                    else if (checks[3] && key === STORAGE_ERROR_LOGS) keysToRemove.push(key);
                    else if (checks[4] && (key === STORAGE_POSICION || key === STORAGE_POSICION_VENTANA)) keysToRemove.push(key);
                    else if (checks[5] && [STORAGE_TOKENS, STORAGE_CONTADOR, STORAGE_RESUMEN].includes(key)) keysToRemove.push(key);
                    if (checks[0] && key.startsWith('nomi_chats_list_')) keysToRemove.push(key);
                }
            });
            if (keysToRemove.length === 0) { mostrarNotificacionTemporal('No hay datos seleccionados para eliminar.'); dialog.remove(); return; }
            if (confirm(`¿Eliminar ${keysToRemove.length} elemento(s)? Esta acción no se puede deshacer.`)) {
                keysToRemove.forEach(k => { localStorage.removeItem(k); eliminarValor(k); });
                mostrarNotificacionTemporal(`✅ ${keysToRemove.length} elemento(s) eliminado(s). La página se recargará.`);
                dialog.remove();
                setTimeout(() => location.reload(), 1500);
            }
        };
        menu.remove();
    };
    document.getElementById('nomi-menu-cerrar-sesion').onclick = () => {
        if (confirm('¿Cerrar sesión? Se borrarán los datos de validación y credenciales.')) {
            setValidado(false);
            ['STORAGE_API_KEY','STORAGE_TAVILY_KEY','STORAGE_MODELO','STORAGE_URL','STORAGE_POSICION','STORAGE_POSICION_VENTANA','STORAGE_RESUMEN','STORAGE_TOKENS','STORAGE_CONTADOR','STORAGE_CONTEXTO','STORAGE_MODO_LIGERO','STORAGE_MODO_RESUMEN','STORAGE_BUSQUEDA_WEB','STORAGE_TAMANO_VENTANA','STORAGE_UBICACION','STORAGE_UBICACION_ACTIVADA','STORAGE_ERROR_LOGS','STORAGE_CREDENCIALES_CARGADAS','STORAGE_CONFIG_INICIAL','STORAGE_MOTOR_BUSQUEDA'].forEach(k => eliminarValor(eval(k)));
            Object.keys(localStorage).filter(k => k.startsWith('nomi_historial_')).forEach(k => localStorage.removeItem(k));
            location.reload();
        }
    };
    document.getElementById('nomi-menu-restaurar').onclick = () => {
        const { w, h } = obtenerTamanoReal();
        const win = document.getElementById('nomi-chat');
        if (win) {
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = window.innerWidth - w - 20, top = window.innerHeight - h - 90;
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal('✅ Posición restaurada.');
    };
    document.getElementById('nomi-size-apply').onclick = () => {
        const w = parseInt(document.getElementById('nomi-width-input').value), h = parseInt(document.getElementById('nomi-height-input').value);
        if (w < MIN_WIDTH || h < MIN_HEIGHT) { mostrarNotificacionTemporal(`❌ El mínimo es ${MIN_WIDTH}x${MIN_HEIGHT}.`); return; }
        setTamanoVentana({ w, h });
        const win = document.getElementById('nomi-chat');
        if (win) {
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = Math.max(0, Math.min(window.innerWidth - w, win.offsetLeft)), top = Math.max(0, Math.min(window.innerHeight - h, win.offsetTop));
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal(`✅ Tamaño aplicado: ${w}x${h}`);
    };
    document.getElementById('nomi-size-default').onclick = () => {
        setTamanoVentana({ w: ANCHO_POR_DEFECTO, h: ALTO_POR_DEFECTO });
        const win = document.getElementById('nomi-chat');
        if (win) {
            const { w, h } = obtenerTamanoReal();
            win.style.width = w + 'px'; win.style.height = h + 'px';
            const left = window.innerWidth - w - 20, top = window.innerHeight - h - 90;
            win.style.left = left + 'px'; win.style.top = top + 'px';
            NoMiState.posicionVentana = { x: left, y: top };
            setPosicionVentana(NoMiState.posicionVentana);
        }
        menu.remove();
        mostrarNotificacionTemporal('✅ Tamaño predeterminado restaurado.');
    };
    document.querySelectorAll('input[name="contexto"]').forEach(el => {
        el.onchange = () => {
            NoMiState.contextoSeleccionado = parseInt(el.value);
            setContexto(NoMiState.contextoSeleccionado);
            const resumenCheck = document.getElementById('nomi-check-resumen');
            if (NoMiState.contextoSeleccionado !== 10) { resumenCheck.disabled = true; resumenCheck.checked = false; setModoResumen(false); NoMiState.modoResumenActivo = false; }
            else resumenCheck.disabled = false;
            actualizarContextoIndicador();
            menu.remove();
            mostrarNotificacionTemporal(`✅ Contexto actualizado a ${NoMiState.contextoSeleccionado} mensajes.`);
        };
    });
    document.getElementById('nomi-check-ligero').onchange = (e) => { NoMiState.modoLigeroActivo = e.target.checked; setModoLigero(NoMiState.modoLigeroActivo); menu.remove(); mostrarNotificacionTemporal(`✅ Modo ligero ${NoMiState.modoLigeroActivo ? 'activado' : 'desactivado'}.`); };
    document.getElementById('nomi-check-resumen').onchange = (e) => {
        if (NoMiState.contextoSeleccionado !== 10) { e.target.checked = false; return; }
        NoMiState.modoResumenActivo = e.target.checked;
        setModoResumen(NoMiState.modoResumenActivo);
        if (NoMiState.modoResumenActivo && !NoMiState.resumenPersistente) generarResumen(NoMiState.historial);
        actualizarContextoIndicador();
        menu.remove();
        mostrarNotificacionTemporal(`🧠 Resumen persistente ${NoMiState.modoResumenActivo ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-check-busqueda').onchange = (e) => {
        if (!NoMiState.credencialesCargadas) { e.target.checked = false; mostrarNotificacionTemporal('Primero configura tus credenciales en la sección "Credenciales".'); return; }
        NoMiState.busquedaWebActiva = e.target.checked;
        setBusquedaWeb(NoMiState.busquedaWebActiva);
        menu.remove();
        mostrarNotificacionTemporal(`🔍 Búsqueda web ${NoMiState.busquedaWebActiva ? 'activada' : 'desactivada'}.`);
    };
}

// ---- Poblado del selector de modelos gratuitos ----
// Reemplaza el texto del <select> por las opciones del catálogo filtrado (solo :free, precio 0).
// Mantiene el modelo actual seleccionado si sigue siendo gratuito; en caso de error
// conserva el modelo actual (nunca se cambia automáticamente).
async function cargarModelosAlMenu(force) {
    const select = document.getElementById('nomi-input-modelo');
    const estado = document.getElementById('nomi-estado-modelo');
    if (!select) return;
    estado.textContent = 'Cargando…';
    select.disabled = true;
    let lista = [];
    try {
        lista = await fetchFreeModelos(force);
    } catch (e) {
        estado.textContent = e instanceof OpenRouterRateLimitError
            ? 'Limitado (429). Conserva el modelo actual.'
            : 'No se pudo cargar. Conserva el modelo actual.';
        const actual = getModelo() || MODELO_POR_DEFECTO;
        select.innerHTML = `<option value="${actual}">${actual}</option>`;
        select.disabled = false;
        return;
    }
    const actual = getModelo() || MODELO_POR_DEFECTO;
    select.innerHTML = '';
    lista.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        let label = `${m.name} | ${m.id}`;
        if (m.context) label += ` | ctx ${m.context}`;
        if (m.posicion) label += ` | Latencia #${m.posicion}`;
        if (m.id === MODELO_POR_DEFECTO) label += ' — Recomendado';
        if (m.id === actual) opt.selected = true;
        opt.textContent = label;
        select.appendChild(opt);
    });
    if (!lista.some(m => m.id === actual)) {
        const opt = document.createElement('option');
        opt.value = actual; opt.disabled = true; opt.selected = true;
        opt.textContent = `${actual} — (no disponible gratis en esta lista)`;
        select.appendChild(opt);
    }
    estado.textContent = `${lista.length} modelos gratuitos`;
    select.disabled = false;
}

// ======== MODULO: nomi-core.js (bundle) ========
// ======== MÓDULO: Núcleo Lógico (Orquestación) ========
// NoMi Assistant – Funciones principales de orquestación

async function procesarBusqueda(consulta) {
    if (NoMiState.motorBusqueda === 'ninguno') {
        agregarMensaje('bot', 'ℹ️ La búsqueda web está desactivada. Puedes activarla en el menú (⚙️) si has importado una clave de Tavily.');
        return;
    }
    if (!NoMiState.tavilyKeyActual) {
        const mensaje = `ℹ️ No hay clave de Tavily configurada. Para buscar en internet, necesitas una clave de Tavily.\n\nPuedes obtener una gratis en: https://tavily.com\n(Regístrate, copia tu API key y pégala en el menú ⚙️).`;
        agregarMensaje('bot', mensaje);
        return;
    }
    agregarMensaje('bot', `🔍 Realizando búsqueda: "${consulta}"...`);
    try {
        let ubicacionTexto = '';
        let ubicacionCoordenadas = '';
        if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
            ubicacionTexto = `${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}`;
            ubicacionCoordenadas = `${NoMiState.ubicacionActual.lat}, ${NoMiState.ubicacionActual.lon}`;
        }
        let consultaFinal = consulta;
        if (ubicacionCoordenadas && requiereUbicacion(consulta)) {
            consultaFinal = `${consulta} en ${ubicacionTexto} (coordenadas: ${ubicacionCoordenadas})`;
        }
        const resultados = await buscarWeb(consultaFinal);
        if (!resultados || !resultados.results || resultados.results.length === 0) {
            const msg = `❌ No se encontraron resultados para esa consulta.`;
            NoMiState.historial.push({role: 'assistant', content: msg});
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', msg);
            return;
        }
        const resultadosTexto = resultados.results.map((r, i) => `${i+1}. ${r.title || 'Sin título'}\n   ${r.content || 'Sin descripción'}`).join('\n\n');
        const prompt = `El usuario se encuentra en ${ubicacionTexto} (coordenadas GPS: ${ubicacionCoordenadas}). **DEBES usar ESTA ubicación para todas las consultas de clima y eventos locales.** Ignora cualquier otra ubicación que puedas inferir de la IP.\n\nInvestigué en la web sobre: "${consultaFinal}". Estos son los resultados obtenidos:\n\n${resultadosTexto}\n\nPor favor, ofrezca una respuesta clara, concisa y en un tono profesional pero cercano. Evite el uso excesivo de tablas o datos innecesarios. Resume la información más importante en 2-3 párrafos. Si hay datos numéricos (temperatura, precios, etc.), menciónelos de forma fluida dentro de la conversación. Mantenga un tono de colaboración entre iguales, sin tuteo excesivo.`;
        const respuestaIA = await llamarIA(prompt);
        const respuestaConIndicador = `🔍 ${respuestaIA}`;
        NoMiState.historial.push({role: 'assistant', content: respuestaConIndicador});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', respuestaConIndicador);
    } catch (error) {
        const msg = `❌ Error en la búsqueda: ${error.message}`;
        NoMiState.historial.push({role: 'assistant', content: msg});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', msg);
    }
}

function iniciarAsistente() {
    NoMiState.historial = getHistorial();
    NoMiState.tokens = getTokens();
    NoMiState.contadorPreguntas = getContador();
    NoMiState.resumenPersistente = getResumen();
    NoMiState.contextoSeleccionado = getContexto();
    NoMiState.modoLigeroActivo = getModoLigero();
    NoMiState.modoResumenActivo = getModoResumen();
    NoMiState.busquedaWebActiva = getBusquedaWeb();
    NoMiState.tamanoVentana = getTamanoVentana();
    NoMiState.ubicacionActivada = getUbicacionActivada();
    NoMiState.ubicacionActual = getUbicacion();
    NoMiState.credencialesCargadas = getCredencialesCargadas();
    NoMiState.apiKeyActual = getApiKey();
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.configuracionInicialCompletada = getConfigInicial();
    NoMiState.motorBusqueda = getMotorBusqueda();

    crearBurbuja();
    crearVentanaChat();
    configurarTeclado();

    // Aviso único al inicio sobre el diagnóstico técnico (no se repite).
    if (NoMiState.diagnosticoActivo && !NoMiState.avisoDiagnosticoVisto) {
        NoMiState.avisoDiagnosticoVisto = true;
        setAvisoDiagnosticoVisto(true);
        mostrarNotificacionTemporal('🩺 NoMi envía un diagnóstico técnico anónimo de errores (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa. Puedes desactivarlo en ⚙️ Configuración.');
    }

    if (NoMiState.ubicacionActivada && !NoMiState.ubicacionActual) {
        actualizarUbicacion(true);
    }

    const mostrarConfig = !NoMiState.configuracionInicialCompletada || !NoMiState.credencialesCargadas;

    if (NoMiState.historial.length === 0) {
        const sistema = `Eres NoMi, un asistente profesional y formal pero cercano. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. El usuario espera respuestas útiles, concisas y bien estructuradas.\n\n**Si el usuario pregunta sobre su ubicación (ej: "¿dónde estoy?", "¿en qué ciudad estoy?"), usa los datos de ubicación que tienes en el contexto.** No digas que no tienes acceso a la ubicación.`;
        NoMiState.historial.unshift({ role: 'system', content: sistema });
        guardarHistorial(NoMiState.historial);

        let bienvenida = `Hola, soy **${NOMBRE_ASISTENTE}**, su asistente de navegación.\nPara ver la lista de comandos disponibles, escriba \`!cmd\`.\n`;
        if (mostrarConfig) bienvenida += `\n⚠️ **Es necesario configurar tus credenciales.**\nSe abrirá un asistente de configuración para que importes o ingreses tus claves de API.\n`;
        else if (!NoMiState.credencialesCargadas) bienvenida += `\n⚠️ **Aún no has configurado tus credenciales.** Ve al menú (⚙️) y selecciona "Importar credenciales" o ingresa tus claves manualmente para activar la búsqueda web y el acceso a la IA.\n`;
        else bienvenida += `\n✅ Credenciales cargadas correctamente.\n`;
        bienvenida += `\n¿En qué puedo ayudarle?`;
        NoMiState.historial.push({role: 'assistant', content: bienvenida});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', bienvenida);
    } else {
        cargarHistorial();
    }
    actualizarStats();
    if (!NoMiState.burbujaVisible) toggleBurbuja(true);

    if (mostrarConfig) {
        setTimeout(() => {
            if (NoMiState.ventanaAbierta) mostrarAsistenteConfiguracion();
            else {
                toggleVentana(true);
                setTimeout(() => mostrarAsistenteConfiguracion(), 300);
            }
        }, 800);
    }
        console.log(`✅ ${NOMBRE_ASISTENTE} V${VERSION_SCRIPT} activado!`);

    // Verificación de disponibilidad gratuita del modelo actual (segundo plano, no bloquea).
    // Se consulta una sola vez por pestaña/sesión (sessionStorage) en verificarModeloAlIniciar().
    void verificarModeloAlIniciar();
}

async function preguntar(texto) {
    if (!NoMiState.credencialesCargadas || !NoMiState.apiKeyActual) {
        agregarMensaje('bot', '⚠️ **No hay credenciales configuradas.**\n\nPor favor, ve al menú (⚙️) y configura tus claves de API (OpenRouter y Tavily) o importa un archivo `.enc`.\n\nMientras tanto, puedes usar comandos básicos como `!cmd` para ver la lista de comandos disponibles.');
        return;
    }
    const input = document.getElementById('nomi-input');
    if (input) input.value = '';
    if (!texto.trim() || NoMiState.isWaiting) return;
    if (texto.trim() === '!cmd' || texto.trim() === '!comandos') { mostrarAyuda(); return; }

    NoMiState.isWaiting = true;
    document.getElementById('nomi-modelo-display').textContent = '⏳ pensando...';

    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
        if (Date.now() - NoMiState.ubicacionActual.timestamp > UBICACION_EXPIRACION) actualizarUbicacion(true);
    }

    const cmdBusqueda = texto.match(/^(investiga|busca|investigar|buscar)\s*[:|]?\s*(.+)/i);
    let esBusqueda = false, consulta = '';
    if (cmdBusqueda) {
        consulta = cmdBusqueda[2].trim();
        if (consulta) {
            esBusqueda = true;
            if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
        }
    }
    if (NoMiState.busquedaForzada) {
        esBusqueda = true; consulta = texto.trim(); NoMiState.busquedaForzada = false;
        if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
    }
    if (!esBusqueda && NoMiState.busquedaWebActiva && requiereBusqueda(texto)) {
        esBusqueda = true; consulta = texto.trim();
    }
    if (esBusqueda && consulta) {
        ocultarCargando();
        document.getElementById('nomi-modelo-display').textContent = NoMiState.modeloActual;
        await procesarBusqueda(consulta);
        if (NoMiState.busquedaWebTemporal) { NoMiState.busquedaWebTemporal = false; }
        NoMiState.isWaiting = false;
        return;
    }

    const palabrasClave = ['analiza', 'examina', 'escanea', 'resume esta página'];
    const esAnalisis = palabrasClave.some(p => texto.toLowerCase().includes(p));
    const usarWeb = NoMiState.modoWebActivo || esAnalisis;
    let infoPagina = '';
    if (usarWeb) {
        const limite = NoMiState.modoLigeroActivo ? LIMITE_TEXTO_LIGERO : LIMITE_TEXTO_NORMAL;
        const info = extraerInformacionPagina(limite);
        infoPagina = `INFORMACIÓN DE LA PÁGINA ACTUAL:\nTítulo: ${info.titulo}\nURL: ${info.url}\nDescripción: ${info.metaDesc}\nEncabezados: ${info.encabezados.join(', ')}\nContenido principal (primeros ${limite} caracteres):\n${info.texto}\n---\n`;
        if (NoMiState.modoWebActivo) {
            NoMiState.modoWebActivo = false;
            document.getElementById('nomi-web-status').style.display = 'none';
            document.getElementById('nomi-web-btn').style.borderColor = '#555';
            document.getElementById('nomi-web-btn').style.color = '#888';
        }
    }

    const contextoFechaHora = obtenerContextoTiempo();
    let contextoUbicacion = '';
    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual && requiereUbicacion(texto)) {
        const fuente = NoMiState.ubicacionActual.fuente === 'gps' ? 'GPS' : 'IP aproximada';
        contextoUbicacion = `📍 Ubicación del usuario: ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais} (${fuente}). Coordenadas GPS: ${NoMiState.ubicacionActual.lat}, ${NoMiState.ubicacionActual.lon}. **DEBES usar ESTA ubicación.**`;
    } else if (NoMiState.ubicacionActivada && !NoMiState.ubicacionActual && requiereUbicacion(texto)) {
        contextoUbicacion = '📍 Ubicación: no disponible (solicitando...)';
    }
    const contextoCompleto = contextoUbicacion ? `${contextoFechaHora}\n${contextoUbicacion}` : contextoFechaHora;

    let mensajesParaEnviar = [];
    if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10 && NoMiState.resumenPersistente) {
        mensajesParaEnviar.push({ role: 'system', content: `Resumen de la conversación anterior:\n${NoMiState.resumenPersistente}` });
    }
    const limiteMensajes = Math.min(NoMiState.contextoSeleccionado, CONTEXTO_RECIENTE);
    const mensajesRecientes = NoMiState.historial.filter(m => m.role === 'user' || m.role === 'assistant').slice(-limiteMensajes);
    mensajesParaEnviar.push(...mensajesRecientes);
    let mensajeCompleto = texto;
    if (infoPagina) mensajeCompleto = infoPagina + '\nPregunta del usuario: ' + texto;
    const mensajeFinal = `${contextoCompleto}\n\nPregunta del usuario: ${mensajeCompleto}`;

    NoMiState.historial.push({role: 'user', content: texto});
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);

    const enviar = document.getElementById('nomi-enviar');
    if (input) input.disabled = true;
    if (enviar) enviar.disabled = true;
    mostrarCargando();

    try {
        const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.apiKeyActual,
                'HTTP-Referer': window.location.href,
                'X-Title': 'NoMi Asistente'
            },
            body: JSON.stringify({
                model: NoMiState.modeloActual,
                messages: [...mensajesParaEnviar, {role: 'user', content: mensajeFinal}],
                stream: false
            })
        });
        ocultarCargando();
        if (respuesta.choices && respuesta.choices[0]) {
            const respuestaTexto = respuesta.choices[0].message.content;
            document.getElementById('nomi-modelo-display').textContent = NoMiState.modeloActual;
            if (respuesta.usage) {
                NoMiState.tokens.total += respuesta.usage.total_tokens || 0;
                NoMiState.tokens.input += respuesta.usage.prompt_tokens || 0;
                NoMiState.tokens.output += respuesta.usage.completion_tokens || 0;
                setTokens(NoMiState.tokens);
            }
            NoMiState.contadorPreguntas++;
            setContador(NoMiState.contadorPreguntas);
            NoMiState.historial.push({role: 'assistant', content: respuestaTexto});
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', respuestaTexto);
            actualizarStats();
            if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) {
                setTimeout(() => generarResumen(NoMiState.historial), 100);
            }
        } else if (respuesta.error) {
            agregarMensaje('bot', '❌ Error: ' + (respuesta.error.message || JSON.stringify(respuesta.error)));
            NoMiState.historial.pop();
            guardarHistorial(NoMiState.historial);
            document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
            registrarError('api', respuesta.error.message || 'Error desconocido en API', `Modelo: ${NoMiState.modeloActual}`);
        } else {
            agregarMensaje('bot', '❌ Error inesperado');
            NoMiState.historial.pop();
            guardarHistorial(NoMiState.historial);
            document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
            registrarError('script', 'Respuesta inesperada de la API', 'Sin detalles');
        }
    } catch (error) {
        ocultarCargando();
        agregarMensaje('bot', '❌ Error de conexión: ' + error.message);
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
        registrarError('network', error.message, `URL: ${NoMiState.urlBaseActual}`);
    }
    if (input) input.disabled = false;
    if (enviar) enviar.disabled = false;
    if (input) input.focus();
    NoMiState.isWaiting = false;
}

async function generarResumen(historialCompleto) {
    if (!NoMiState.modoResumenActivo || NoMiState.contextoSeleccionado !== 10 || historialCompleto.length < 4) return;
    try {
        const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NoMiState.apiKeyActual },
            body: JSON.stringify({
                model: NoMiState.modeloActual,
                messages: [
                    { role: 'system', content: 'Eres un asistente que resume conversaciones. Genera un resumen COMPACTO (máximo 300 palabras) de toda la conversación. Incluye temas principales y decisiones. Responde SOLO con el resumen.' },
                    { role: 'user', content: `Resume esta conversación:\n\n${historialCompleto.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n')}` }
                ],
                stream: false, max_tokens: 500
            })
        });
        if (respuesta.choices && respuesta.choices[0]) {
            setResumen(respuesta.choices[0].message.content);
        }
    } catch (error) {
        registrarError('api', error.message, 'Generación de resumen');
    }
}

// ======== BOOTSTRAP (bundle) ========
// ======== BOOTSTRAP DEL USERSCRIPT (no editar manualmente; se incluye en el bundle) ========
(function() {
    'use strict';

    // ======== CARGA INICIAL DESDE PERSISTENCIA ========
    NoMiState.historial = getHistorial();
    NoMiState.tokens = getTokens();
    NoMiState.contadorPreguntas = getContador();
    NoMiState.resumenPersistente = getResumen();
    NoMiState.validado = getValidado();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
    NoMiState.posicionBurbuja = getPosicion();
    const posV = getPosicionVentana();
    if (posV) NoMiState.posicionVentana = posV;
    NoMiState.posicionOriginalVentana = posV ? posV.y : null;
    NoMiState.contextoSeleccionado = getContexto();
    NoMiState.modoLigeroActivo = getModoLigero();
    NoMiState.modoResumenActivo = getModoResumen();
    NoMiState.busquedaWebActiva = getBusquedaWeb();
    NoMiState.tamanoVentana = getTamanoVentana();
    NoMiState.ubicacionActivada = getUbicacionActivada();
    NoMiState.ubicacionActual = getUbicacion();
    NoMiState.credencialesCargadas = getCredencialesCargadas();
    NoMiState.apiKeyActual = getApiKey();
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.configuracionInicialCompletada = getConfigInicial();
    NoMiState.motorBusqueda = getMotorBusqueda();
    NoMiState.diagnosticoActivo = getDiagnosticoActivo();
    NoMiState.avisoDiagnosticoVisto = getAvisoDiagnosticoVisto();
    obtenerInstalacionId(); // genera/recupera el ID persistente anónimo de instalación

    limpiarHistorialesAntiguos();

    // ======== INICIO ========
    setTimeout(() => {
        setValor(STORAGE_VALIDADO, true);
        NoMiState.validado = true;
        iniciarAsistente();
    }, 500);
})();
