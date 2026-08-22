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
// @version      5.16
// @description  Asistente IA con importación de credenciales, actualización automática y mejoras multiplataforma
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      nomi-diagnostics.osmanmezuts.workers.dev
// @connect      nomi-api-worker.osmanmezuts.workers.dev
// @connect      openrouter.ai
// @connect      api.tavily.com
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
const VERSION_SCRIPT = '5.16';
const FECHA_LANZAMIENTO = '19/08/2026';

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
const STORAGE_CLIMA_AUTOMATICO = 'nomi_clima_automatico';
const STORAGE_BUSQUEDA_WEB_NOMI = 'nomi_busqueda_web_nomi';
const STORAGE_ERROR_LOGS = 'nomi_error_logs';
const STORAGE_CREDENCIALES_CARGADAS = 'nomi_credenciales_cargadas';
const STORAGE_CONFIG_INICIAL = 'nomi_config_inicial';
const STORAGE_MOTOR_BUSQUEDA = 'nomi_motor_busqueda';
const STORAGE_DIAGNOSTICO_ACTIVO = 'nomi_diagnostico_activo';
const STORAGE_INSTALACION_ID = 'nomi_instalacion_id';
const STORAGE_DIAGNOSTICO_AVISO = 'nomi_diagnostico_aviso_visto';

// Endpoint del Worker de diagnóstico (envío de errores anónimo y mínimo).
const DIAGNOSTICS_URL = 'https://nomi-diagnostics.osmanmezuts.workers.dev/v1/diagnostics';

// ===== Acceso compartido NoMi (Worker de Cloudflare) =====
// Modo de acceso explícito que usa el Worker en lugar de OpenRouter/Tavily directo.
// SOLO se guardan la URL pública del Worker y el token opaco de instalación.
// NUNCA se incluyen ni leen GROQ_API_KEY, ADMIN_SECRET ni ACCESS_TOKEN_SECRET.
const MODO_ACCESO_OPENROUTER = 'openrouter';
const MODO_ACCESO_NOMI = 'nomi';
const MODO_ACCESO_POR_DEFECTO = MODO_ACCESO_OPENROUTER;
const NOMI_WORKER_URL_POR_DEFECTO = 'https://nomi-api-worker.osmanmezuts.workers.dev';
const NOMI_MODELO_POR_DEFECTO = 'openai/gpt-oss-20b';
// Etiquetas legibles del proveedor activo para el indicador superior.
const PROVEEDOR_NOMI_LABEL = 'NoMi Worker / Groq';
const PROVEEDOR_OPENROUTER_LABEL = 'OpenRouter';
// "API Personal" es la capa OpenAI-compatible que puede apuntar a OpenRouter
// u otro proveedor (DeepSeek, Groq, Mistral, Together, etc.). El catálogo de
// modelos gratuitos y los headers HTTP-Referer/X-Title solo aplican a OpenRouter.
// Detección segura por hostname real: solo openrouter.ai y sus subdominios
// (*.openrouter.ai). Dominios falsos (openrouter.ai.evil.com, evil.com/.../openrouter.ai)
// o URLs inválidas devuelven false (fallback seguro vía try/catch).
function esOpenRouter(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
        const host = new URL(url).hostname;
        return host === 'openrouter.ai' || host.endsWith('.openrouter.ai');
    } catch (e) {
        return false;
    }
}
// Construye los headers del Chat Personal (OpenAI-compatible). Los headers
// HTTP-Referer y X-Title se envían SOLO a OpenRouter; en otra URL no se envían.
function construirHeadersPersonal(apiKey, urlBase) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (apiKey || '')
    };
    if (esOpenRouter(urlBase)) {
        headers['HTTP-Referer'] = (typeof window !== 'undefined' && window.location && window.location.href) || '';
        headers['X-Title'] = 'NoMi Asistente';
    }
    return headers;
}
const NOMI_PERSONA_SISTEMA = 'Eres NoMi, un asistente profesional y formal pero cercano. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. El usuario espera respuestas útiles, concisas y bien estructuradas.';

const STORAGE_MODO_ACCESO = 'nomi_modo_acceso';
const STORAGE_NOMI_WORKER_URL = 'nomi_worker_url';
const STORAGE_NOMI_TOKEN = 'nomi_token';
const STORAGE_NOMI_MODELO = 'nomi_modelo_nomi';
const STORAGE_NOMI_ACCESO_ACTIVO = 'nomi_acceso_activo';

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
    climaAutomatico: true,
    busquedaWebNomi: true,
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
    avisoDiagnosticoVisto: false,
    modoAcceso: MODO_ACCESO_OPENROUTER,
    nomiWorkerUrl: NOMI_WORKER_URL_POR_DEFECTO,
    nomiToken: '',
    nomiModelo: NOMI_MODELO_POR_DEFECTO,
    nomiAccesoActivo: false,
    // ===== Estado transitorio del HUD (NO se persiste) =====
    // estadoHud: null (calculado desde el acceso) | 'acceso_invalido' |
    // 'limite' | 'capacidad' | 'sin_conexion'. El "Pensando…" se deriva de isWaiting.
    estadoHud: null,
    usoNoMi: null,
    reintentarPregunta: ''
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
// Preferencia independiente "clima automático NoMi": desactivable desde
// Configuración aunque no haya API Personal/Tavily. Por defecto activada.
function getClimaAutomatico() { const v = getValor(STORAGE_CLIMA_AUTOMATICO, null); return v === null ? true : !!v; }
function setClimaAutomatico(v) { setValor(STORAGE_CLIMA_AUTOMATICO, !!v); NoMiState.climaAutomatico = !!v; }
// Preferencia independiente "Búsqueda web NoMi": Tavily SOLO en el Worker, sin
// clave del usuario y sin API Personal. Visible/desactivable siempre.
function getBusquedaWebNomi() { const v = getValor(STORAGE_BUSQUEDA_WEB_NOMI, null); return v === null ? true : !!v; }
function setBusquedaWebNomi(v) { setValor(STORAGE_BUSQUEDA_WEB_NOMI, !!v); NoMiState.busquedaWebNomi = !!v; }
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

// ===== Acceso compartido NoMi (Worker) =====
// Se guarda únicamente la URL pública del Worker y el token opaco de instalación.
function getModoAcceso() { return getValor(STORAGE_MODO_ACCESO, MODO_ACCESO_POR_DEFECTO); }
function setModoAcceso(m) { setValor(STORAGE_MODO_ACCESO, m); NoMiState.modoAcceso = m; }
function getNomiWorkerUrl() { return getValor(STORAGE_NOMI_WORKER_URL, NOMI_WORKER_URL_POR_DEFECTO); }
function setNomiWorkerUrl(u) { setValor(STORAGE_NOMI_WORKER_URL, u); NoMiState.nomiWorkerUrl = u; }
function getNomiToken() { return getValor(STORAGE_NOMI_TOKEN, ''); }
function setNomiToken(t) { setValor(STORAGE_NOMI_TOKEN, t); NoMiState.nomiToken = t; }
function getNomiModelo() { return getValor(STORAGE_NOMI_MODELO, NOMI_MODELO_POR_DEFECTO); }
function setNomiModelo(m) { setValor(STORAGE_NOMI_MODELO, m); NoMiState.nomiModelo = m; }
function getNomiAccesoActivo() { return getValor(STORAGE_NOMI_ACCESO_ACTIVO, false); }
function setNomiAccesoActivo(v) { setValor(STORAGE_NOMI_ACCESO_ACTIVO, !!v); NoMiState.nomiAccesoActivo = !!v; }
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
    const nombreMsg = document.createElement('b');
    nombreMsg.style.color = color;
    nombreMsg.textContent = `${nombre}:`;
    msg.appendChild(nombreMsg);
    msg.appendChild(document.createTextNode(' ' + texto));
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Valida y normaliza una URL de fuente con el API URL (no solo regex): exige
// protocolo http/https absoluto y elimina query/hash (defensa en profundidad
// sobre la saneación del Worker). Devuelve null si no es segura.
function nomiUrlFuenteSegura(u) {
    if (typeof u !== 'string' || !u.trim()) return null;
    try {
        const parsed = new URL(u.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return null;
    }
}

// Mensaje de resultados de búsqueda web NoMi. Renderizado 100% seguro (CSP /
// Trusted Types): solo createElement/textContent/appendChild, sin HTML crudo.
// Máximo 3 resultados (los que llegan del Worker), cada uno con título/snippet y
// fuente clicable SOLO si la URL pasa nomiUrlFuenteSegura (http/https, sin
// query/hash); enlaces con target="_blank" y rel="noopener noreferrer". Sin
// truncamientos arbitrarios adicionales a los ya aplicados por el Worker.
function agregarMensajeConFuentes(resultados) {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return null;
    const color = '#34a853';
    const msg = document.createElement('div');
    msg.style.cssText = 'margin:4px 0; padding:6px 10px; border-radius:10px; background:#34a85333; border-left:3px solid #34a853; font-size:12px; word-wrap:break-word;';
    const nombreMsg = document.createElement('b');
    nombreMsg.style.color = color;
    nombreMsg.textContent = NOMBRE_ASISTENTE + ':';
    msg.appendChild(nombreMsg);
    msg.appendChild(document.createTextNode(' Esto es lo que encontré en la web:'));
    const lista = (Array.isArray(resultados) ? resultados : []).slice(0, 3);
    if (lista.length === 0) {
        const vacio = document.createElement('div');
        vacio.textContent = '(sin resultados)';
        msg.appendChild(vacio);
    }
    lista.forEach((r) => {
        const item = document.createElement('div');
        item.style.cssText = 'margin-top:6px;';
        const lineaTitulo = document.createElement('div');
        const vineta = document.createElement('b');
        vineta.textContent = '• ';
        lineaTitulo.appendChild(vineta);
        const urlSegura = nomiUrlFuenteSegura(r && r.url);
        if (urlSegura && r.titulo) {
            const a = document.createElement('a');
            a.href = urlSegura;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.color = '#8ab4ff';
            a.textContent = String(r.titulo);
            lineaTitulo.appendChild(a);
        } else if (urlSegura) {
            const a = document.createElement('a');
            a.href = urlSegura;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.color = '#8ab4ff';
            a.style.wordBreak = 'break-all';
            a.textContent = urlSegura;
            lineaTitulo.appendChild(a);
        } else if (r && r.titulo) {
            const spanTitulo = document.createElement('span');
            spanTitulo.textContent = String(r.titulo);
            lineaTitulo.appendChild(spanTitulo);
        }
        item.appendChild(lineaTitulo);
        if (r && r.contenido) {
            const snippet = document.createElement('div');
            snippet.style.cssText = 'color:#ccc;';
            snippet.textContent = String(r.contenido);
            item.appendChild(snippet);
        }
        msg.appendChild(item);
    });
    const nota = document.createElement('div');
    nota.style.cssText = 'color:#888;margin-top:4px;font-size:11px;';
    nota.textContent = 'La consulta se envió a Tavily (proveedor externo) a través del servidor NoMi.';
    msg.appendChild(nota);
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msg;
}

function cargarHistorial() {
    const chatBody = document.getElementById('nomi-chat-body');
    if (!chatBody) return;
    nomiVaciarNodo(chatBody);
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
        const nombreMsg = document.createElement('b');
        nombreMsg.style.color = color;
        nombreMsg.textContent = `${nombre}:`;
        msgDiv.appendChild(nombreMsg);
        msgDiv.appendChild(document.createTextNode(' ' + msg.content));
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
    // El modelo mostrado respeta el proveedor activo: NoMi NO debe ser
    // sobrescrito por el modelo Personal (OpenRouter).
    actualizarIndicadorModelo();
    actualizarContextoIndicador();
    actualizarBarraUbicacion();
}

// Deshabilita los controles de envío (input, enviar y búsqueda) durante un
// envío. Se restauran SIEMPRE con restaurarControlesEnvio().
function deshabilitarControlesEnvio() {
    const input = document.getElementById('nomi-input');
    const enviar = document.getElementById('nomi-enviar');
    const buscar = document.getElementById('nomi-search-btn');
    if (input) input.disabled = true;
    if (enviar) enviar.disabled = true;
    if (buscar) buscar.disabled = true;
}

// Restaura los controles de envío (input, enviar y búsqueda) y devuelve el
// foco al input. Se llama en todas las salidas de preguntar().
function restaurarControlesEnvio() {
    const input = document.getElementById('nomi-input');
    const enviar = document.getElementById('nomi-enviar');
    const buscar = document.getElementById('nomi-search-btn');
    if (input) { input.disabled = false; input.focus(); }
    if (enviar) enviar.disabled = false;
    if (buscar) buscar.disabled = false;
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
        // Al abrir el chat, NoMi consulta el uso una vez (sin polling).
        actualizarHud();
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken) consultarUsoNoMi();
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
                        const e = new Error(`Error ${resp.status}: ${resp.responseText}`);
                        e.status = resp.status;
                        reject(e);
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
                    if (!r.ok) {
                        const e = new Error(`Error ${r.status}: ${await r.text()}`);
                        e.status = r.status;
                        throw e;
                    }
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

// ======== MODULO: nomi-acceso-nomi.js (bundle) ========
// ======== MÓDULO: Acceso compartido NoMi (Worker) ========
// NoMi Assistant – Integración con el Worker de Cloudflare (modo explícito).
//
// Seguridad:
//   - El endpoint del Worker es FIJO (NOMI_WORKER_URL_POR_DEFECTO). Nunca se
//     usa una URL controlada por el usuario para hacer peticiones.
//   - SOLO se guardan la URL pública por defecto y el token opaco de instalación.
//   - NUNCA se incluyen ni leen las claves secretas del Worker (API key de Groq,
//     secreto de administración ni secreto de firma de tokens).
//   - El token se envía como Bearer solo en POST /v1/chat. GET /v1/catalog es
//     público y NO lleva Authorization.
//   - Ante 401 se indica token inválido/revocado y NO se hace fallback a OpenRouter.
//
// Compatibilidad: reutiliza hacerPeticion (GM_xmlhttpRequest + fetch) para
// funcionar en Violentmonkey y Tampermonkey sin dependencias extra.

// Error específico de token inválido/revocado del Worker.
class NoMiTokenInvalidoError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NoMiTokenInvalidoError';
    }
}

// Devuelve SIEMPRE la URL fija del Worker. No se usa ninguna URL de usuario.
function nomiWorkerBase() {
    return NOMI_WORKER_URL_POR_DEFECTO;
}

// Resetea cualquier URL persistida distinta a la oficial (seguridad: evita
// que un valor antiguamente editable quede activo).
function resetearUrlWorkerNoMi() {
    if (getNomiWorkerUrl() !== NOMI_WORKER_URL_POR_DEFECTO) {
        setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO);
    }
}

// Indica si el modo NoMi puede usarse ahora (modo activo, token y acceso vigente).
function puedeUsarAccesoNoMi() {
    return NoMiState.modoAcceso === MODO_ACCESO_NOMI
        && !!NoMiState.nomiToken
        && NoMiState.nomiAccesoActivo === true;
}

// Estado legible del acceso compartido NoMi.
function estadoAccesoNoMi() {
    if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI) return 'desactivado';
    if (!NoMiState.nomiToken) return 'pendiente';
    return NoMiState.nomiAccesoActivo ? 'activo' : 'revocado';
}

// Longitud en bytes UTF-8 de una cadena.
function byteLengthUTF8(s) {
    return new TextEncoder().encode(s).length;
}

// Recorta una cadena para que ocupe como máximo maxBytes bytes UTF-8,
// sin cortar en medio de un carácter multibyte.
function recortarUTF8Seguro(s, maxBytes) {
    if (maxBytes <= 0) return '';
    const bytes = new TextEncoder().encode(s);
    if (bytes.length <= maxBytes) return s;
    let end = maxBytes;
    while (end > 0 && (bytes[end] & 0xC0) === 0x80) end--; // retrocede bytes de continuación
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, end));
}

// Construye el mensaje único para /v1/chat preservando continuidad y respetando
// siempre <=6000 bytes UTF-8 (contando persona, contexto, resumen, historial y
// TODOS los separadores, incluido el previo al historial).
//
// Estrategia de recorte (el bloque final "Pregunta del usuario" se preserva):
//   1) Se separa la pregunta final del contexto (fecha/ubicación/contenido de página).
//   2) Se RESERVA espacio para el bloque final de pregunta (con su separador).
//      Si la pregunta por sí sola supera el límite, se recorta UTF-8 de forma
//      segura e se indica claramente.
//   3) El contexto (fecha/ubicación/página) se recorta ANTES que la pregunta.
//   4) Resumen e historial solo se añaden si caben en el presupuesto restante.
// No altera el contrato del Worker.
function construirMensajeWorkerNoMi(promptActual) {
    const separador = '\n\n';
    const maxBytes = 6000;
    const persona = NOMI_PERSONA_SISTEMA;
    const indicadorRecorte = '[pregunta recortada por límite de tamaño]';

    // Separar la pregunta final del contexto (fecha/ubicación/contenido de página).
    let contexto = String(promptActual || '');
    let pregunta = contexto;
    const idx = contexto.lastIndexOf('Pregunta del usuario:');
    if (idx !== -1) {
        pregunta = contexto.slice(idx);
        contexto = contexto.slice(0, idx);
    }

    // Reservar el bloque final de pregunta; si solo él excede, recortarlo UTF-8
    // seguro e indicarlo claramente (el indicador también se reserva, sin separador extra).
    let cola = pregunta;
    if (byteLengthUTF8(persona + separador + cola) > maxBytes) {
        const disponible = maxBytes - byteLengthUTF8(persona + separador) - byteLengthUTF8(indicadorRecorte) - 1;
        cola = recortarUTF8Seguro(pregunta, disponible) + indicadorRecorte;
    }

    // Presupuesto para la cabecera (persona + contexto + resumen + historial),
    // reservando el separador y bloque final de pregunta.
    let headBudget = maxBytes - byteLengthUTF8(persona) - byteLengthUTF8(separador + cola);
    let head = persona;

    // 1) Contexto (fecha/ubicación/página) — se recorta ANTES que la pregunta.
    if (headBudget > 0 && contexto.trim().length > 0) {
        const bloque = separador + contexto.trim();
        if (byteLengthUTF8(bloque) <= headBudget) {
            head += bloque;
            headBudget -= byteLengthUTF8(bloque);
        } else if (headBudget > byteLengthUTF8(separador) + 1) {
            head += separador + recortarUTF8Seguro(contexto.trim(), headBudget - byteLengthUTF8(separador) - 1);
            headBudget = 0;
        }
    }

    // 2) Resumen (si cabe en el presupuesto restante).
    if (headBudget > 0 && NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10 && NoMiState.resumenPersistente) {
        const head2 = separador + 'Resumen de la conversación anterior:\n';
        const bloque = head2 + NoMiState.resumenPersistente;
        if (byteLengthUTF8(bloque) <= headBudget) {
            head += bloque;
            headBudget -= byteLengthUTF8(bloque);
        } else if (headBudget > byteLengthUTF8(head2) + 1) {
            head += head2 + recortarUTF8Seguro(NoMiState.resumenPersistente, headBudget - byteLengthUTF8(head2) - 1);
            headBudget = 0;
        }
    }

    // 3) Historial reciente (del más reciente al más antiguo) mientras quepa.
    if (headBudget > 0) {
        const limite = Math.min(NoMiState.contextoSeleccionado, CONTEXTO_RECIENTE);
        const recientes = NoMiState.historial
            .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
            .slice(-limite);
        const secciones = [];
        for (let i = recientes.length - 1; i >= 0; i--) {
            const rol = recientes[i].role === 'user' ? 'Usuario' : 'Asistente';
            const sec = (secciones.length === 0 ? 'Historial reciente (del más reciente al más antiguo):\n' : '') + rol + ': ' + recientes[i].content;
            // El separador inicial (\n\n) antes de "Historial reciente..." se descuenta
            // aquí para que el presupuesto coincida exactamente con lo concatenado.
            const bloque = (secciones.length ? '\n' : separador) + sec;
            if (byteLengthUTF8(bloque) > headBudget) break;
            secciones.push(sec);
            headBudget -= byteLengthUTF8(bloque);
        }
        if (secciones.length) {
            head += separador + secciones.slice().reverse().join('\n');
        }
    }

    return head + separador + cola;
}

// Construye el prompt de resumen para /v1/chat: instrucción compacta + historial
// recortado para respetar <=6000 bytes UTF-8. Conserva la instrucción.
function construirMensajeResumenNoMi(historialCompleto) {
    const separador = '\n\n';
    const maxBytes = 6000;
    const instruccion = 'Eres un asistente que resume conversaciones. Genera un resumen COMPACTO (máximo 300 palabras) de toda la conversación. Incluye temas principales y decisiones. Responde SOLO con el resumen.';
    const texto = (historialCompleto || [])
        .map(m => (m.role === 'user' ? 'Usuario' : 'Asistente') + ': ' + (m.content || ''))
        .join('\n');
    const head = instruccion + separador + 'Resume esta conversación:\n';
    let prompt = head + texto;
    if (byteLengthUTF8(prompt) > maxBytes) {
        prompt = head + recortarUTF8Seguro(texto, maxBytes - byteLengthUTF8(head) - 1);
    }
    return prompt;
}

// Activa el acceso: canjea el código de invitación y guarda el token opaco.
// Devuelve el token en éxito; lanza Error descriptivo en fallo (sin guardar token).
async function activarAccesoNoMi(codigo) {
    resetearUrlWorkerNoMi();
    const base = nomiWorkerBase();
    const cuerpo = JSON.stringify({ codigo: String(codigo || '').trim().toUpperCase() });
    let datos;
    try {
        datos = await hacerPeticion(base + '/v1/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: cuerpo
        });
    } catch (err) {
        throw new Error(mapearErrorActivacion(err));
    }
    if (!datos || !datos.token) {
        throw new Error('El servidor NoMi no devolvió un token de instalación.');
    }
    setNomiWorkerUrl(NOMI_WORKER_URL_POR_DEFECTO);
    setNomiToken(datos.token);
    setNomiAccesoActivo(true);
    // Intenta obtener el catálogo para fijar un modelo groq activo por defecto.
    try {
        const cat = await obtenerCatalogoNoMi();
        const m = (cat && cat.modelos || []).find(x => x && x.proveedor === 'groq' && x.estado === 'activo');
        if (m && m.id) setNomiModelo(m.id);
    } catch (_) { /* el catálogo es opcional para la activación */ }
    return datos.token;
}

// Convierte errores HTTP de activación en mensajes claros para el usuario.
function mapearErrorActivacion(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 400) return 'Código de invitación inválido o ya usado.';
    if (status === 503) return 'Capacidad de NoMi temporalmente llena. Intenta de nuevo más tarde.';
    if (status === 401) return 'No autorizado por el servidor NoMi.';
    return (err && err.message) ? err.message : 'No se pudo activar el acceso NoMi.';
}

// Obtiene el catálogo PÚBLICO de modelos del Worker (sin Authorization).
async function obtenerCatalogoNoMi() {
    const base = nomiWorkerBase();
    return await hacerPeticion(base + '/v1/catalog', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
}

// Detecta de forma robusta un 401 del Worker (status, mensaje o error tipado).
function esError401NoMi(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    return status === 401
        || (err instanceof NoMiTokenInvalidoError)
        || !!(err && err.message && /401/.test(err.message));
}

// Llama al chat del Worker. Devuelve el texto de la respuesta.
// `herramienta` (opcional) permite rutas especiales del Worker (p. ej. clima) sin
// pasar por Groq. Ante 401 marca el acceso como revocado y lanza
// NoMiTokenInvalidoError (sin fallback).
async function llamarIANoMi(mensaje, maxTokens, herramienta) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(mensaje || '')
    };
    if (herramienta && typeof herramienta === 'object') cuerpo.herramienta = herramienta;
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken
            },
            body: JSON.stringify(cuerpo)
        });
        if (datos && typeof datos.respuesta === 'string') return datos.respuesta;
        throw new Error((datos && datos.error && datos.error.message) || 'Respuesta inesperada del Worker NoMi.');
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        throw err;
    }
}

// Estados explícitos que la ruta de clima del Worker reporta en `climaEstado`.
const ESTADOS_CLIMA_NO_MI = ['ok', 'ciudad_no_encontrada', 'limite_diario', 'fallo_proveedor'];

// Llama a la ruta de clima del Worker y devuelve { texto, estado } con estado
// ∈ ok | ciudad_no_encontrada | limite_diario | fallo_proveedor. La señal es
// explícita: el cliente NUNCA infiere el resultado del texto humano. Con un
// Worker anterior sin `climaEstado` se asume 'ok' (compatibilidad hacia atrás).
// Errores HTTP/red idénticos a llamarIANoMi (401 → NoMiTokenInvalidoError, sin
// fallback); NO altera llamarIANoMi ni el chat normal.
async function llamarClimaNoMi(texto, ubicacion) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(texto || ''),
        herramienta: { tipo: 'clima', ubicacion: String(ubicacion || '') },
    };
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken,
            },
            body: JSON.stringify(cuerpo),
        });
        if (datos && typeof datos.respuesta === 'string') {
            const estado = ESTADOS_CLIMA_NO_MI.indexOf(datos.climaEstado) >= 0 ? datos.climaEstado : 'ok';
            return { texto: datos.respuesta, estado };
        }
        throw new Error((datos && datos.error && datos.error.message) || 'Respuesta inesperada del Worker NoMi.');
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        throw err;
    }
}

// Estados explícitos que la ruta de búsqueda del Worker reporta en `busquedaEstado`.
const ESTADOS_BUSQUEDA_NO_MI = ['ok', 'sin_resultados', 'limite_diario', 'fallo_proveedor'];

// Mensaje claro cuando el Worker desplegado aún no conoce la herramienta
// 'busqueda' (rechazo 400 parametros-invalidos) o responde sin la señal esperada.
// SIN fallback a API Personal y SIN usar claves locales; solo informa.
function respuestaActualizacionRequerida() {
    return {
        estado: 'actualizacion_requerida',
        texto: 'Tu acceso NoMi necesita una actualización del servidor para usar la búsqueda web. Avisa al administrador para actualizar el Worker.',
    };
}

// Validación local de la consulta, IDÉNTICA a la del Worker: si falla aquí,
// ni siquiera se llama al Worker (y un 400 remoto jamás será por esto).
function consultaBusquedaValidaLocal(consulta) {
    const c = String(consulta || '').trim();
    if (c.length < 2 || c.length > 300) return false;
    return new TextEncoder().encode(c).length <= 600;
}

// Extrae `error` del cuerpo JSON que hacerPeticion adjunta en err.message
// ("Error <status>: <cuerpo JSON>"). Parsing ESTRUCTURADO defensivo: si no hay
// JSON válido devuelve null (el caller aplica su caso genérico). Nunca se
// interpreta texto humano libre para decidir estados.
function extraerCodigoErrorCuerpo(err) {
    try {
        const m = err && typeof err.message === 'string' ? err.message.match(/^\s*Error\s+\d+:\s*([\s\S]+)$/) : null;
        if (!m) return null;
        const datos = JSON.parse(m[1]);
        return datos && typeof datos.error === 'string' ? datos.error : null;
    } catch {
        return null;
    }
}

// Llama a la ruta de búsqueda del Worker y devuelve:
//   { estado: 'ok', resultados: [{ titulo, url, contenido }] }  (máx. 3)
//   { estado, texto } con estado ∈ sin_resultados | limite_diario |
//                         fallo_proveedor | consulta_invalida |
//                         actualizacion_requerida.
// La señal es explícita (`busquedaEstado`): NUNCA se infiere del texto humano.
// Un HTTP 400 se distingue por CÓDIGO estable del cuerpo JSON:
//   - 'consulta-busqueda-invalida' -> Worker ACTUAL rechazando la consulta
//     (defensa; la validación local ya debería evitarlo) -> mensaje humano de
//     validación, sin reintento ni falso aviso de actualización.
//   - cualquier otro / sin JSON    -> Worker ANTIGUO que no conoce la
//     herramienta -> actualización requerida.
// Errores HTTP/red idénticos a llamarIANoMi (401 → NoMiTokenInvalidoError, sin
// fallback). NO altera llamarIANoMi ni el chat normal ni API Personal.
async function llamarBusquedaNoMi(consulta) {
    if (!NoMiState.nomiToken) {
        throw new NoMiTokenInvalidoError('No hay token de acceso NoMi. Actívalo con un código de invitación en ⚙️ Configuración.');
    }
    // P1-2: validación local antes de red. Con la consulta ya validada, un 400
    // remoto SOLO puede venir de un Worker que no conoce la herramienta.
    if (!consultaBusquedaValidaLocal(consulta)) {
        return { estado: 'consulta_invalida', texto: 'Esa búsqueda no es válida. Indica qué buscar entre 2 y 300 caracteres.' };
    }
    const base = nomiWorkerBase();
    const cuerpo = {
        modelo: NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO,
        mensaje: String(consulta),
        herramienta: { tipo: 'busqueda', consulta: String(consulta) },
    };
    try {
        const datos = await hacerPeticion(base + '/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + NoMiState.nomiToken,
            },
            body: JSON.stringify(cuerpo),
        });
        const estadoBruto = datos ? datos.busquedaEstado : undefined;
        if (ESTADOS_BUSQUEDA_NO_MI.indexOf(estadoBruto) >= 0) {
            if (estadoBruto === 'ok' && Array.isArray(datos.resultados)) {
                return { estado: 'ok', resultados: datos.resultados };
            }
            if (estadoBruto !== 'ok' && typeof datos.respuesta === 'string') {
                return { estado: estadoBruto, texto: datos.respuesta };
            }
        }
        // 200 sin señal conocida: Worker antiguo/inesperado -> actualización requerida.
        return respuestaActualizacionRequerida();
    } catch (err) {
        if (esError401NoMi(err)) {
            setNomiAccesoActivo(false);
            throw new NoMiTokenInvalidoError('Tu token de acceso NoMi es inválido o fue revocado. Vuelve a activarlo en ⚙️ Configuración.');
        }
        // P1-2: distinguir 400 por código estable del cuerpo JSON.
        const status = err && typeof err.status === 'number' ? err.status : null;
        if (status === 400) {
            if (extraerCodigoErrorCuerpo(err) === 'consulta-busqueda-invalida') {
                return { estado: 'consulta_invalida', texto: 'Esa búsqueda no es válida. Indica qué buscar entre 2 y 300 caracteres.' };
            }
            return respuestaActualizacionRequerida();
        }
        throw err;
    }
}

// Cierra el acceso compartido NoMi en ESTE NAVEGADOR: borra el token local.
// NO revoca el token en el servidor (eso lo hace el administrador).
function cerrarAccesoNoMi() {
    setNomiToken('');
    setNomiAccesoActivo(false);
    mostrarNotificacionTemporal('🔌 Acceso compartido NoMi cerrado en este navegador (el token sigue activo en el servidor hasta que un administrador lo revoque).');
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
                if (json.openrouter) {
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
                            if (resultado && resultado.openrouter) {
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
                            if (resultado && resultado.openrouter) {
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
                if (resultado && resultado.openrouter) {
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

            aplicarCredencialesImportadas(credenciales);

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
    // La API key es obligatoria (cualquier proveedor OpenAI-compatible).
    // Tavily es OPCIONAL: la búsqueda web funciona solo si se proporciona;
    // el chat normal funciona sin ella. Retrocompatible con OpenRouter+Tavily.
    if (!apiKey) {
        mostrarNotificacionTemporal('❌ Debes ingresar al menos la API key de tu API Personal.');
        return false;
    }
    setApiKey(apiKey);
    // Tavily opcional: se guarda si se ingresó; si se deja vacío se ELIMINA
    // explícitamente la clave previa (no queda una cadena vacía suelta).
    if (tavilyKey) setTavilyKey(tavilyKey);
    else {
        setTavilyKey('');
        eliminarValor(STORAGE_TAVILY_KEY);
    }
    if (modelo) setModelo(modelo);
    if (urlBase) setUrlBase(urlBase);
    setCredencialesCargadas(true);
    setConfigInicial(true);
    NoMiState.apiKeyActual = apiKey;
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
    mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
    return true;
}

// Aplica un conjunto de credenciales importado (JSON/.enc). Tavily es opcional:
// si el archivo NO trae campo tavily, se ELIMINA la Tavily previa. Retrocompatible
// con configuraciones completas OpenRouter+Tavily (se conservan todas las claves).
function aplicarCredencialesImportadas(credenciales) {
    setApiKey(credenciales.openrouter);
    if (credenciales.tavily) setTavilyKey(credenciales.tavily);
    else {
        setTavilyKey('');
        eliminarValor(STORAGE_TAVILY_KEY);
    }
    if (credenciales.modelo) setModelo(credenciales.modelo);
    if (credenciales.url) setUrlBase(credenciales.url);
    setCredencialesCargadas(true);
    setConfigInicial(true);
    NoMiState.apiKeyActual = credenciales.openrouter;
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.modeloActual = getModelo();
    NoMiState.urlBaseActual = getUrlBase();
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

// Constructor seguro de nodos DOM (sin sinks HTML ejecutables). Reutilizable por
// todos los módulos del bundle porque las declaraciones de función se elevan al
// ámbito global del userscript concatenado.
function nomiCrearNodo(tag, props) {
    const el = document.createElement(tag);
    if (!props) return el;
    if (props.id) el.id = props.id;
    if (props.clase) el.className = props.clase;
    if (props.css) el.style.cssText = props.css;
    if (props.titulo) el.title = props.titulo;
    if (props.valor != null) el.value = props.valor;
    if (props.marcado) el.checked = true;
    if (props.seleccionado) el.selected = true;
    if (props.deshabilitado) el.disabled = true;
    if (props.atributos) {
        for (const k in props.atributos) el.setAttribute(k, props.atributos[k]);
    }
    if (props.texto != null) el.textContent = props.texto;
    if (props.hijos) {
        for (const child of props.hijos) {
            if (child == null) continue;
            el.appendChild(child);
        }
    }
    return el;
}

// Vacía un nodo sin asignar HTML ni usar el método de vaciado moderno
// (incompatible con WebViews/Android antiguos). Usa firstChild/removeChild,
// soportado en todos los navegadores. Seguro frente a CSP/Trusted Types.
function nomiVaciarNodo(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

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

    const header = nomiCrearNodo('div', { css: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:#fff;flex-shrink:0;', hijos: [
        nomiCrearNodo('div', { css: 'display:flex;align-items:center;gap:8px;', hijos: [
            nomiCrearNodo('b', { css: 'font-size:13px;color:#FF6B6B;', texto: NOMBRE_ASISTENTE }),
            nomiCrearNodo('span', { id: 'nomi-proveedor-display', css: 'font-size:9px;color:#36c5f0;font-weight:bold;' }),
            nomiCrearNodo('span', { id: 'nomi-modelo-display', css: 'font-size:9px;color:#888;', texto: NoMiState.modeloActual }),
            nomiCrearNodo('span', { id: 'nomi-hud-status', css: 'font-size:9px;font-weight:bold;color:#888;cursor:default;padding:1px 6px;border-radius:8px;background:#00000033;' }),
            nomiCrearNodo('button', { id: 'nomi-hud-accion', css: 'display:none;margin-left:6px;background:#4a6cf7;border:none;border-radius:8px;padding:1px 8px;color:#fff;font-size:9px;cursor:pointer;', texto: '' })
        ]}),
        nomiCrearNodo('div', { hijos: [
            nomiCrearNodo('button', { id: 'nomi-web-btn', css: 'background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;', texto: '🌐' }),
            nomiCrearNodo('button', { id: 'nomi-stats-btn', titulo: 'Estadísticas', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;', texto: '📊' }),
            nomiCrearNodo('button', { id: 'nomi-export-btn', titulo: 'Exportar historial', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;margin-right:4px;', texto: '📤' }),
            nomiCrearNodo('button', { id: 'nomi-menu-btn', css: 'background:none;border:1px solid #555;border-radius:6px;padding:2px 8px;color:#888;font-size:12px;cursor:pointer;margin-right:4px;', texto: '⚙️' })
        ]})
    ]});
    win.appendChild(header);

    const filaCtx = nomiCrearNodo('div', { css: 'display:flex;justify-content:space-between;font-size:9px;color:#555;flex-shrink:0;margin-bottom:4px;', hijos: [
        nomiCrearNodo('span', { id: 'nomi-contexto-indicador', texto: `📚 Contexto: ${NoMiState.contextoSeleccionado} mensajes` }),
        nomiCrearNodo('span', { id: 'nomi-web-status', css: 'display:none;color:#34a853;', texto: '🌐 Web activo' }),
        nomiCrearNodo('span', { id: 'nomi-hud-quota', css: 'display:none;color:#36c5f0;' })
    ]});
    win.appendChild(filaCtx);

    const chatBody = nomiCrearNodo('div', { id: 'nomi-chat-body', css: 'flex:1;background:#0d0d1a;border-radius:12px;padding:8px;overflow-y:auto;margin-bottom:8px;font-size:12px;color:#ccc;min-height:100px;' });
    chatBody.appendChild(nomiCrearNodo('div', { css: 'color:#666;text-align:center;', texto: 'Cargando conversación...' }));
    win.appendChild(chatBody);

    const loading = nomiCrearNodo('div', { id: 'nomi-loading', css: 'display:none;color:#888;font-size:11px;font-style:italic;margin-bottom:4px;flex-shrink:0;', texto: '✍️ Escribiendo' });
    loading.appendChild(nomiCrearNodo('span', { id: 'nomi-dots', texto: '.' }));
    win.appendChild(loading);

    const input = nomiCrearNodo('input', { id: 'nomi-input', atributos: { type: 'text', placeholder: 'Pregunta...', autocomplete: 'off' } });
    input.style.cssText = 'flex:1;padding:8px;border-radius:10px;border:none;background:#0d0d1a;color:#fff;font-size:13px;';
    const filaInput = nomiCrearNodo('div', { css: 'display:flex;gap:6px;flex-shrink:0;', hijos: [
        input,
        nomiCrearNodo('button', { id: 'nomi-search-btn', titulo: 'Forzar búsqueda web de esta pregunta', css: 'background:#4a6cf7;border:none;border-radius:10px;padding:8px 12px;color:#fff;font-size:14px;cursor:pointer;margin-right:4px;', texto: '🔍' }),
        nomiCrearNodo('button', { id: 'nomi-enviar', css: 'background:#FF6B6B;border:none;border-radius:10px;padding:8px 14px;color:#fff;font-weight:bold;cursor:pointer;', texto: '➤' })
    ]});
    win.appendChild(filaInput);

    const ubicDisplay = nomiCrearNodo('span', { id: 'nomi-ubicacion-display', css: 'color:#888;font-size:10px;' });
    ubicDisplay.textContent = NoMiState.ubicacionActual ? `📍 ${NoMiState.ubicacionActual.ciudad}, ${NoMiState.ubicacionActual.pais}` : 'Ubicación desactivada';
    const tokLabel = nomiCrearNodo('span');
    tokLabel.appendChild(document.createTextNode('📊 Tokens: '));
    tokLabel.appendChild(nomiCrearNodo('span', { id: 'nomi-token-counter', texto: '0' }));
    const filaAbajo = nomiCrearNodo('div', { css: 'margin-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#555;flex-shrink:0;', hijos: [
        nomiCrearNodo('div', { hijos: [
            nomiCrearNodo('button', { id: 'nomi-lock-toggle', titulo: 'Bloquear/Desbloquear movimiento de la ventana', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0;z-index:999999;', texto: '🔓' })
        ]}),
        nomiCrearNodo('div', { css: 'display:flex;align-items:center;gap:6px;', hijos: [
            ubicDisplay,
            nomiCrearNodo('button', { id: 'nomi-ubicacion-update', titulo: 'Actualizar ubicación', css: 'background:none;border:none;color:#4a6cf7;font-size:12px;cursor:pointer;padding:0 4px;', texto: '⟳' }),
            tokLabel,
            nomiCrearNodo('button', { id: 'nomi-cerrar-chat', titulo: 'Cerrar chat', css: 'background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:0 6px;margin-left:4px;', texto: '✕' })
        ]})
    ]});
    win.appendChild(filaAbajo);
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

    document.getElementById('nomi-stats-btn').onclick = () => mostrarEstadisticas();
    document.getElementById('nomi-export-btn').onclick = () => mostrarExportacion();
    document.getElementById('nomi-menu-btn').onclick = () => mostrarMenu();

    const hudStatus = document.getElementById('nomi-hud-status');
    if (hudStatus) hudStatus.onclick = () => {
        if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI) return;
        if (NoMiState.estadoHud === 'acceso_invalido' || !NoMiState.nomiAccesoActivo) {
            mostrarMenu();
            return;
        }
        if (NoMiState.estadoHud === 'sin_conexion' && NoMiState.reintentarPregunta) {
            const p = NoMiState.reintentarPregunta;
            NoMiState.reintentarPregunta = '';
            preguntar(p);
            return;
        }
        consultarUsoNoMi();
    };

    actualizarContextoIndicador();
    actualizarStats();
    actualizarBarraUbicacion();
}

// ======== Indicador superior de proveedor y modelo ========
// Actualiza un solo dato del DOM a la vez. Devuelve el elemento o null (los
// stubs de los tests devuelven null para getElementById).
function actualizarIndicadorProveedor() {
    const el = document.getElementById('nomi-proveedor-display');
    if (!el) return;
    const esNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
    el.textContent = esNoMi ? PROVEEDOR_NOMI_LABEL : PROVEEDOR_OPENROUTER_LABEL;
    el.style.color = esNoMi ? '#36c5f0' : '#f5a623';
}

// Actualiza el texto del modelo mostrado según el proveedor activo.
function actualizarIndicadorModelo() {
    const el = document.getElementById('nomi-modelo-display');
    if (!el) return;
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
        el.textContent = (NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO);
    } else {
        el.textContent = NoMiState.modeloActual || MODELO_POR_DEFECTO;
    }
}

// Actualiza proveedor + modelo en una sola llamada.
function actualizarIndicador() {
    actualizarIndicadorProveedor();
    actualizarIndicadorModelo();
}

// ======== HUD de estado NoMi / Personal ========
// Estado transitorio centralizado en NoMiState (sin persistencia). El HUD
// muestra siempre modo + estado; el modelo se muestra aparte (ver
// actualizarIndicadorModelo). La cuota solo se muestra en modo NoMi tras
// obtener uso real del Worker; NUNCA se exponen bolsa global, IDs ni detalles
// técnicos del endpoint.

// Devuelve { texto, color } según el estado actual (sin tocar el DOM).
function calcularTextoHud() {
    if (NoMiState.isWaiting) return { texto: 'Pensando…', color: '#f5a623' };
    const e = NoMiState.estadoHud;
    if (e === 'acceso_invalido') return { texto: 'Acceso no válido', color: '#ff4d4d' };
    if (e === 'limite') return { texto: 'Límite alcanzado', color: '#ff4d4d' };
    if (e === 'capacidad') return { texto: 'Capacidad limitada', color: '#ffa500' };
    if (e === 'sin_conexion') return { texto: 'No se pudo conectar', color: '#ff4d4d' };
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
        if (NoMiState.nomiToken && NoMiState.nomiAccesoActivo) return { texto: 'NoMi · Activo', color: '#34a853' };
        return { texto: 'NoMi · Sin acceso', color: '#ffa500' };
    }
    if (NoMiState.credencialesCargadas && NoMiState.apiKeyActual) return { texto: 'Personal · Activo', color: '#34a853' };
    return { texto: 'Personal · Sin acceso', color: '#ffa500' };
}

// Pinta el texto/color del HUD. Si no hay DOM (stubs de test) no hace nada.
function actualizarHud() {
    const el = document.getElementById('nomi-hud-status');
    if (!el) return;
    const { texto, color } = calcularTextoHud();
    el.textContent = texto;
    el.style.color = color;
    el.style.cursor = NoMiState.modoAcceso === MODO_ACCESO_NOMI && (NoMiState.estadoHud || !NoMiState.nomiAccesoActivo) ? 'pointer' : 'default';
    actualizarBotonAccionHud();
}

// Botón de acción contextual junto al HUD (oculto en estado normal).
// 401/sin acceso -> "Activar" abre Configuración.
// sin conexión + pregunta fallida -> "Reintentar" reenvía esa pregunta.
// sin conexión solo por /v1/usage -> "Actualizar" consulta usage (sin reenviar).
function actualizarBotonAccionHud() {
    const btn = document.getElementById('nomi-hud-accion');
    if (!btn) return;
    const esNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
    let texto = '', accion = null;
    if (esNoMi) {
        if (NoMiState.estadoHud === 'acceso_invalido' || !NoMiState.nomiAccesoActivo) {
            texto = 'Activar'; accion = () => mostrarMenu();
        } else if (NoMiState.estadoHud === 'sin_conexion' && NoMiState.reintentarPregunta) {
            texto = 'Reintentar';
            accion = () => { const p = NoMiState.reintentarPregunta; NoMiState.reintentarPregunta = ''; preguntar(p); };
        } else if (NoMiState.estadoHud === 'sin_conexion' && !NoMiState.reintentarPregunta) {
            texto = 'Actualizar'; accion = () => consultarUsoNoMi();
        }
    }
    if (accion) {
        btn.textContent = texto;
        btn.onclick = accion;
        btn.style.display = 'inline-block';
    } else {
        btn.style.display = 'none';
        btn.onclick = null;
    }
}

// Fija el estado explícito del HUD (null = calcular desde el acceso).
// Recibe: null | 'acceso_invalido' | 'limite' | 'capacidad' | 'sin_conexion'.
function establecerEstadoHud(estado) {
    NoMiState.estadoHud = estado;
    actualizarHud();
}

// Muestra la cuota en modo NoMi tras obtener uso. Nunca bolsa global ni IDs.
// Contrato real de /v1/usage: cuota_mensual_invitado y tokens_usados son
// créditos/tokens; solicitudes_usadas es el número de solicitudes.
function actualizarQuotaHud() {
    const el = document.getElementById('nomi-hud-quota');
    if (!el) return;
    const u = NoMiState.usoNoMi;
    if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI || !u || typeof u !== 'object') {
        el.style.display = 'none';
        return;
    }
    const tokens = Number(u.tokens_usados);
    const cuota = Number(u.cuota_mensual_invitado);
    if (Number.isFinite(tokens) && Number.isFinite(cuota) && cuota > 0) {
        el.textContent = `Créditos: ${tokens}/${cuota} este mes`;
        el.style.display = 'inline';
        return;
    }
    const solicitudes = Number(u.solicitudes_usadas);
    if (Number.isFinite(solicitudes)) {
        el.textContent = `Consultas usadas: ${solicitudes}`;
        el.style.display = 'inline';
        return;
    }
    el.style.display = 'none';
}

// Consulta /v1/usage (NoMi) al abrir chat, tras activación y tras respuesta
// exitosa. Sin polling. Actualiza cuota y refleja errores en el HUD.
async function consultarUsoNoMi() {
    if (NoMiState.modoAcceso !== MODO_ACCESO_NOMI || !NoMiState.nomiToken) {
        NoMiState.usoNoMi = null;
        actualizarQuotaHud();
        return;
    }
    const base = nomiWorkerBase();
    try {
        const datos = await hacerPeticion(base + '/v1/usage', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + NoMiState.nomiToken, 'Accept': 'application/json' }
        });
        NoMiState.usoNoMi = (datos && typeof datos === 'object') ? datos : null;
        establecerEstadoHud(null);
        actualizarQuotaHud();
    } catch (err) {
        mapearErrorHudNoMi(err);
    }
}

// Mensaje humano único para errores NoMi (401/429/503/red). El detalle
// técnico se conserva solo en registrarError().
function mensajeHumanoErrorNoMi(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 401 || err instanceof NoMiTokenInvalidoError) {
        return '🔑 Tu acceso NoMi es inválido o fue revocado. Ábrelo en ⚙️ Configuración > Acceso compartido NoMi para reactivarlo.';
    }
    if (status === 429) return '⏳ Alcanzaste el límite de uso de NoMi. Intenta de nuevo más tarde.';
    if (status === 503) return '🚧 NoMi tiene capacidad limitada ahora mismo. Intenta de nuevo más tarde.';
    return '📡 No se pudo conectar con NoMi. Pulsa “Reintentar” en el indicador para volver a intentarlo.';
}

// Mapea un error de red/Worker NoMi a un estado de HUD (401/429/503/red).
// 401 conserva el token pero marca el acceso inactivo. No agrega mensajes de
// chat (eso lo hace preguntar() con mensajeHumanoErrorNoMi).
function mapearErrorHudNoMi(err) {
    const status = err && typeof err.status === 'number' ? err.status : null;
    if (status === 401 || err instanceof NoMiTokenInvalidoError) {
        setNomiAccesoActivo(false);
        NoMiState.reintentarPregunta = '';
        establecerEstadoHud('acceso_invalido');
    } else if (status === 429) {
        establecerEstadoHud('limite');
    } else if (status === 503) {
        establecerEstadoHud('capacidad');
    } else {
        establecerEstadoHud('sin_conexion');
    }
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
    const cabecera = nomiCrearNodo('div', { css: 'text-align:center;margin-bottom:16px;', hijos: [
        nomiCrearNodo('h1', { css: 'color:#FF6B6B;margin:0;font-size:24px;', texto: `🤖 ${NOMBRE_ASISTENTE}` }),
        nomiCrearNodo('p', { css: 'color:#888;font-size:13px;margin:4px 0;', texto: 'Asistente IA para navegación' }),
        nomiCrearNodo('p', { css: 'color:#555;font-size:11px;', texto: `Versión ${VERSION_SCRIPT} | ${FECHA_LANZAMIENTO}` })
    ]});
    asistente.appendChild(cabecera);

    const scroll = nomiCrearNodo('div', { css: 'flex:1;overflow-y:auto;padding:8px 0;' });
    const cajaCreds = nomiCrearNodo('div', { css: 'background:#0d0d1a;border-radius:12px;padding:16px;margin-bottom:16px;' });
    cajaCreds.appendChild(nomiCrearNodo('h3', { css: 'color:#4a6cf7;margin:0 0 12px 0;font-size:15px;', texto: '🔑 Configuración de credenciales' }));
    cajaCreds.appendChild(nomiCrearNodo('p', { css: 'color:#888;font-size:12px;margin-bottom:16px;', texto: `Para usar ${NOMBRE_ASISTENTE}, necesitas configurar tus claves de API. Puedes importarlas desde un archivo .enc (si tienes uno) o ingresarlas manualmente.` }));
    cajaCreds.appendChild(nomiCrearNodo('button', { id: 'nomi-config-importar', css: 'width:100%;padding:12px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:12px;', texto: '📥 Importar desde archivo .enc' }));
    const subCaja = nomiCrearNodo('div', { css: 'border-top:1px solid #333;padding-top:12px;margin-top:8px;' });
    subCaja.appendChild(nomiCrearNodo('p', { css: 'color:#888;font-size:12px;margin-bottom:8px;', texto: '✏️ O ingresa tus claves manualmente:' }));

    const filaOpenrouter = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaOpenrouter.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'API Key (API Personal) *' }));
    filaOpenrouter.appendChild(nomiCrearNodo('input', { id: 'nomi-config-openrouter', atributos: { type: 'password', placeholder: 'sk-or-v1-...' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaOpenrouter);

    const filaTavily = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaTavily.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Tavily API Key (opcional)' }));
    filaTavily.appendChild(nomiCrearNodo('input', { id: 'nomi-config-tavily', atributos: { type: 'password', placeholder: 'tvly-...' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaTavily);

    const filaModelo = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaModelo.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo (opcional)' }));
    const selModelo = nomiCrearNodo('select', { id: 'select', css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' });
    selModelo.id = 'nomi-config-modelo';
    selModelo.appendChild(nomiCrearNodo('option', { valor: MODELO_POR_DEFECTO, texto: `${MODELO_POR_DEFECTO} — Recomendado` }));
    filaModelo.appendChild(selModelo);
    const inputModeloManualA = nomiCrearNodo('input', { id: 'nomi-config-modelo-manual', valor: getModelo(), atributos: { type: 'text', placeholder: 'p. ej. gpt-4o-mini' }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;margin-top:4px;display:none;' });
    filaModelo.appendChild(inputModeloManualA);
    filaModelo.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-config-refrescar-modelos', css: 'flex:1;padding:6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;', texto: 'Actualizar modelos' }),
        nomiCrearNodo('span', { id: 'nomi-config-estado-modelo', css: 'font-size:10px;color:#aaa;' })
    ]}));
    filaModelo.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:4px;', texto: 'En OpenRouter se lista por latencia estimada. En otra API compatible, escribe el modelo manualmente.' }));
    subCaja.appendChild(filaModelo);

    const filaUrl = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaUrl.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'URL Base (opcional)' }));
    filaUrl.appendChild(nomiCrearNodo('input', { id: 'nomi-config-url', atributos: { type: 'text', placeholder: URL_BASE_POR_DEFECTO }, css: 'width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    subCaja.appendChild(filaUrl);
    subCaja.appendChild(nomiCrearNodo('button', { id: 'nomi-config-guardar', css: 'width:100%;padding:10px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '💾 Guardar credenciales' }));
    cajaCreds.appendChild(subCaja);
    scroll.appendChild(cajaCreds);

    const cajaInfo = nomiCrearNodo('div', { css: 'background:#0d0d1a;border-radius:12px;padding:12px;border:1px solid #333;' });
    const pInfo = nomiCrearNodo('p', { css: 'color:#555;font-size:10px;margin:0;text-align:center;' });
    pInfo.appendChild(document.createTextNode('ℹ️ Las claves se guardan localmente en tu navegador.'));
    pInfo.appendChild(document.createElement('br'));
    pInfo.appendChild(document.createTextNode('Puedes cambiarlas en cualquier momento desde el menú (⚙️).'));
    cajaInfo.appendChild(pInfo);
    scroll.appendChild(cajaInfo);
    asistente.appendChild(scroll);

    const pie = nomiCrearNodo('div', { css: 'margin-top:12px;display:flex;gap:8px;flex-shrink:0;' });
    pie.appendChild(nomiCrearNodo('button', { id: 'nomi-config-cerrar', css: 'flex:1;padding:8px;background:#333;border:none;border-radius:8px;color:#888;font-size:12px;cursor:pointer;', texto: 'Cerrar (configurar más tarde)' }));
    asistente.appendChild(pie);
    document.body.appendChild(asistente);

    void cargarModelosAsistente(false);

    document.getElementById('nomi-config-importar').onclick = () => importarCredenciales();
    // "Actualizar modelos": si la URL es OpenRouter, consulta el catálogo; si no,
    // muestra el campo manual. Se reevalúa al cambiar la URL base.
    const evaluarUrlAsistente = () => {
        const url = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(url);
        const sel = document.getElementById('nomi-config-modelo');
        const inp = document.getElementById('nomi-config-modelo-manual');
        if (sel) sel.style.display = esOR ? 'block' : 'none';
        if (inp) inp.style.display = esOR ? 'none' : 'block';
    };
    const urlAsistente = document.getElementById('nomi-config-url');
    if (urlAsistente) urlAsistente.addEventListener('change', () => { evaluarUrlAsistente(); cargarModelosAsistente(false); });
    evaluarUrlAsistente();
    document.getElementById('nomi-config-refrescar-modelos').onclick = () => cargarModelosAsistente(true);
    document.getElementById('nomi-config-guardar').onclick = () => {
        const apiKey = document.getElementById('nomi-config-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-config-tavily').value.trim();
        const urlBase = document.getElementById('nomi-config-url').value.trim() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(urlBase);
        const modelo = esOR
            ? (document.getElementById('nomi-config-modelo').value.trim() || MODELO_POR_DEFECTO)
            : (document.getElementById('nomi-config-modelo-manual').value.trim() || MODELO_POR_DEFECTO);
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
    // El catálogo SOLO se consulta si la URL es OpenRouter; en otra API se
    // conserva el modelo manual sin intentar catálogo.
    const url = (document.getElementById('nomi-config-url') && document.getElementById('nomi-config-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
    if (!esOpenRouter(url)) {
        if (estado) estado.textContent = 'API propia: usa el modelo manual.';
        const inp = document.getElementById('nomi-config-modelo-manual');
        if (inp && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
        return;
    }
    if (!force && select.options.length > 1) return; // ya poblado previamente.
    estado.textContent = 'Cargando…';
    try {
        const lista = await fetchFreeModelos(force);
        const actual = select.value || MODELO_POR_DEFECTO;
        nomiVaciarNodo(select);
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

    const lineaEspacio = nomiCrearNodo('div', { css: 'margin-bottom:8px;font-size:11px;color:#555;' });
    lineaEspacio.appendChild(document.createTextNode('💾 Espacio ocupado: '));
    lineaEspacio.appendChild(nomiCrearNodo('span', { css: 'color:#888;', texto: espacioFormateado }));
    if (logs.length > 0) {
        lineaEspacio.appendChild(document.createTextNode(' | 📋 Errores: '));
        lineaEspacio.appendChild(nomiCrearNodo('span', { css: 'color:#f55036;', texto: String(logs.length) }));
    }
    lineaEspacio.appendChild(document.createTextNode(credCargadas ? ' | ✅ Credenciales cargadas' : ' | ❌ Credenciales no configuradas'));

    const secOpen = nomiCrearNodo('div', { id: 'nomi-seccion-openrouter', css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' + (NoMiState.modoAcceso === 'nomi' ? 'opacity:0.5;pointer-events:none;' : '') });
    secOpen.appendChild(nomiCrearNodo('h3', { css: 'color:#4a6cf7;margin:0 0 8px 0;font-size:14px;', texto: '🔑 API Personal' }));
    if (NoMiState.modoAcceso === 'nomi') {
        secOpen.appendChild(nomiCrearNodo('div', { clase: 'nomi-openrouter-aviso', css: 'font-size:10px;color:#f5a623;margin-bottom:6px;font-weight:bold;', texto: 'Solo disponible en modo API Personal. Cambia el modo de acceso para usarlas.' }));
    }
    const filaOR = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaOR.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'API Key (API Personal)' }));
    filaOR.appendChild(nomiCrearNodo('input', { id: 'nomi-input-openrouter', valor: apiKeyActual, atributos: { type: 'password' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secOpen.appendChild(filaOR);
    const filaTav = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaTav.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Tavily API Key (opcional)' }));
    filaTav.appendChild(nomiCrearNodo('input', { id: 'nomi-input-tavily', valor: tavilyKeyActual, atributos: { type: 'password' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    filaTav.appendChild(nomiCrearNodo('div', { css: 'font-size:9px;color:#555;margin-top:2px;', texto: 'Opcional: solo para búsqueda web. Si no tienes, obtén una gratis en tavily.com' }));
    secOpen.appendChild(filaTav);
    const filaModeloMenu = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaModeloMenu.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo' }));
    // OpenRouter: selector poblado por el catálogo. Otra API: campo manual.
    const selModeloMenu = nomiCrearNodo('select', { id: 'nomi-input-modelo', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' });
    const inputModeloManual = nomiCrearNodo('input', { id: 'nomi-input-modelo-manual', valor: modeloActual, atributos: { type: 'text', placeholder: 'p. ej. gpt-4o-mini' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;display:none;' });
    filaModeloMenu.appendChild(selModeloMenu);
    filaModeloMenu.appendChild(inputModeloManual);
    filaModeloMenu.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-actualizar-modelos', css: 'flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;', texto: 'Actualizar' }),
        nomiCrearNodo('span', { id: 'nomi-estado-modelo', css: 'font-size:9px;color:#aaa;' })
    ]}));
    filaModeloMenu.appendChild(nomiCrearNodo('div', { id: 'nomi-nota-modelo', css: 'font-size:9px;color:#888;margin-top:4px;', texto: 'En OpenRouter se lista por latencia estimada. En otra API compatible, escribe el modelo manualmente.' }));
    secOpen.appendChild(filaModeloMenu);
    const filaUrl = nomiCrearNodo('div', { css: 'margin-bottom:8px;' });
    filaUrl.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'URL Base' }));
    filaUrl.appendChild(nomiCrearNodo('input', { id: 'nomi-input-url', valor: urlBaseActual, atributos: { type: 'text' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secOpen.appendChild(filaUrl);
    secOpen.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-guardar-creds', css: 'flex:1;padding:8px;background:#4a6cf7;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '💾 Guardar' }),
        nomiCrearNodo('button', { id: 'nomi-importar-creds-menu', css: 'flex:1;padding:8px;background:#34a853;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;', texto: '📥 Importar .enc' })
    ]}));
    secOpen.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#555;margin-top:4px;', texto: 'Las claves se guardan localmente en tu navegador.' }));

    const secMotor = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secMotor.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '🔍 Motor de búsqueda' }));
    secMotor.appendChild(nomiCrearNodo('select', { id: 'nomi-select-motor', css: 'width:100%;padding:8px;border-radius:8px;background:#0d0d1a;color:#fff;border:1px solid #555;', hijos: [
        nomiCrearNodo('option', { valor: 'tavily', seleccionado: motor === 'tavily', texto: 'Tavily (requiere clave)' }),
        nomiCrearNodo('option', { valor: 'ninguno', seleccionado: motor === 'ninguno', texto: 'Ninguno (sin búsqueda web)' })
    ]}));
    secMotor.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Elige el motor de búsqueda para obtener información actualizada.' }));

    const secDiag = nomiCrearNodo('div', { css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' });
    secDiag.appendChild(nomiCrearNodo('h3', { css: 'color:#36c5f0;margin:0 0 8px 0;font-size:14px;', texto: '🩺 Diagnóstico técnico' }));
    secDiag.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px;', hijos: [
        document.createTextNode('Enviar diagnóstico de errores'),
        nomiCrearNodo('input', { id: 'nomi-check-diagnostico', marcado: diagnosticoActivo, atributos: { type: 'checkbox' } })
    ]}));
    secDiag.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:4px;', texto: 'Solo errores y contexto técnico (dispositivo, red, batería). Nunca se envían claves, chats, ubicación ni URL completa.' }));

    const estadoAcc = estadoAccesoNoMi();
    const txtEstadoAcc = estadoAcc === 'activo' ? '✅ Activo' : estadoAcc === 'revocado' ? '⛔ Revocado/inválido' : estadoAcc === 'pendiente' ? '⏳ Pendiente de activación' : 'Desactivado';
    const sinAccesoNoMi = estadoAcc !== 'activo';
    const secNomi = nomiCrearNodo('div', { css: 'margin-bottom:16px;padding:12px;background:#0d0d1a;border-radius:12px;border:1px solid #333;' });
    secNomi.appendChild(nomiCrearNodo('h3', { css: 'color:#b06bff;margin:0 0 8px 0;font-size:14px;', texto: '🌐 Acceso NoMi' }));
    secNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;margin-bottom:8px;', texto: 'Principal: usa NoMi con tu invitación, sin claves propias.' }));
    secNomi.appendChild(nomiCrearNodo('label', { css: 'font-size:12px;color:#888;display:block;margin-bottom:2px;', texto: 'Modo de acceso' }));
    secNomi.appendChild(nomiCrearNodo('select', { id: 'nomi-select-modo', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;', hijos: [
        nomiCrearNodo('option', { valor: 'nomi', seleccionado: NoMiState.modoAcceso === 'nomi', texto: 'NoMi — acceso con invitación' }),
        nomiCrearNodo('option', { valor: 'openrouter', seleccionado: NoMiState.modoAcceso === 'openrouter', texto: 'API Personal — avanzada' })
    ]}));
    secNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#aaa;margin:8px 0 4px;', hijos: [
        document.createTextNode('Estado: '),
        nomiCrearNodo('span', { id: 'nomi-estado-acceso', texto: txtEstadoAcc })
    ]}));
    const ctaActivar = nomiCrearNodo('button', { id: 'nomi-cta-activar', css: 'width:100%;padding:8px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-bottom:8px;', texto: '🔑 Activar acceso NoMi' });
    if (!sinAccesoNoMi) ctaActivar.style.display = 'none';
    ctaActivar.onclick = () => {
        const sel = document.getElementById('nomi-select-modo');
        if (sel) sel.value = 'nomi';
        aplicarCambioModo('nomi');
        const codigo = document.getElementById('nomi-input-codigo');
        if (codigo) codigo.focus();
    };
    secNomi.appendChild(ctaActivar);
    const secWorker = nomiCrearNodo('div', { id: 'nomi-seccion-worker', css: `display:${NoMiState.modoAcceso === 'nomi' ? 'block' : 'none'};margin-top:8px;` });
    secWorker.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#666;margin-bottom:6px;', hijos: [
        document.createTextNode('Worker: '),
        nomiCrearNodo('span', { css: 'color:#888;', texto: NOMI_WORKER_URL_POR_DEFECTO }),
        document.createTextNode(' (fijo, no editable)')
    ]}));
    const filaCodigo = nomiCrearNodo('div', { css: 'margin-bottom:6px;' });
    filaCodigo.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Código de invitación' }));
    filaCodigo.appendChild(nomiCrearNodo('input', { id: 'nomi-input-codigo', atributos: { type: 'text', placeholder: 'XXXX-XXXX' }, css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;' }));
    secWorker.appendChild(filaCodigo);
    secWorker.appendChild(nomiCrearNodo('button', { id: 'nomi-activar-acceso', css: 'width:100%;padding:8px;background:#b06bff;border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;margin-bottom:6px;', texto: '🔑 Activar con código' }));
    const filaModeloNomi = nomiCrearNodo('div', { css: 'margin-bottom:6px;' });
    filaModeloNomi.appendChild(nomiCrearNodo('label', { css: 'font-size:11px;color:#888;display:block;margin-bottom:2px;', texto: 'Modelo NoMi' }));
    const nomiModeloActual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    filaModeloNomi.appendChild(nomiCrearNodo('select', { id: 'nomi-select-modelo-nomi', css: 'width:100%;padding:6px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;font-size:12px;', hijos: [
        nomiCrearNodo('option', { valor: nomiModeloActual, texto: nomiModeloActual })
    ]}));
    filaModeloNomi.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:4px;align-items:center;margin-top:4px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-actualizar-modelos-nomi', css: 'flex:1;padding:4px 6px;background:#3a4a6a;border:none;border-radius:6px;color:#fff;font-size:10px;cursor:pointer;', texto: 'Cargar modelos' }),
        nomiCrearNodo('span', { id: 'nomi-estado-modelo-nomi', css: 'font-size:9px;color:#aaa;' })
    ]}));
    secWorker.appendChild(filaModeloNomi);
    secWorker.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#555;margin-top:2px;', texto: 'Solo se guardan la URL pública (fija) y el token opaco. Nunca se guardan claves del Worker.' }));
    secWorker.appendChild(nomiCrearNodo('button', { id: 'nomi-cerrar-acceso-nomi', css: 'width:100%;padding:6px;background:#f55036;border:none;border-radius:8px;color:#fff;font-size:11px;cursor:pointer;margin-top:6px;', texto: '🗑️ Cerrar acceso (borra el token de este navegador)' }));
    secNomi.appendChild(secWorker);

    // Preferencia independiente de clima NoMi: desactivable aunque no haya API
    // Personal/Tavily configurada. No afecta a Tavily de Personal.
    const filaClimaAuto = nomiCrearNodo('div', { css: 'margin-top:10px;padding-top:8px;border-top:1px solid #333;' });
    filaClimaAuto.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;', hijos: [
        document.createTextNode('🌦️ Clima automático NoMi'),
        nomiCrearNodo('input', { id: 'nomi-check-clima-nomi', marcado: getClimaAutomatico(), atributos: { type: 'checkbox' } })
    ]}));
    filaClimaAuto.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:2px;', texto: 'Detecta consultas de clima en modo NoMi sin Tavily ni API Personal. Desactívalo para enviarlas por el chat normal.' }));
    secNomi.appendChild(filaClimaAuto);

    // Preferencia independiente "Búsqueda web NoMi": Tavily SOLO en el Worker,
    // sin clave del usuario ni API Personal. Visible siempre y activada por defecto.
    const filaBusqNomi = nomiCrearNodo('div', { css: 'margin-top:10px;' });
    filaBusqNomi.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:13px;', hijos: [
        document.createTextNode('🔎 Búsqueda web NoMi'),
        nomiCrearNodo('input', { id: 'nomi-check-busqueda-nomi', marcado: getBusquedaWebNomi(), atributos: { type: 'checkbox' } })
    ]}));
    filaBusqNomi.appendChild(nomiCrearNodo('div', { css: 'font-size:10px;color:#888;margin-top:2px;', texto: 'Busca en internet vía Tavily desde el servidor NoMi (sin tu clave ni API Personal). Desactívalo para enviar esas consultas por el chat normal.' }));
    secNomi.appendChild(filaBusqNomi);

    const secUbi = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secUbi.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('📍 Ubicación'),
        nomiCrearNodo('input', { id: 'nomi-check-ubicacion', marcado: NoMiState.ubicacionActivada, atributos: { type: 'checkbox' } })
    ]}));
    secUbi.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Permite a NoMi conocer su ubicación para respuestas más precisas (clima, eventos, etc.).' }));

    const secLig = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secLig.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🌿 Modo Ligero'),
        nomiCrearNodo('input', { id: 'nomi-check-ligero', marcado: NoMiState.modoLigeroActivo, atributos: { type: 'checkbox' } })
    ]}));
    secLig.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Reduce el texto extraído de páginas a 500 caracteres.' }));

    const secCtx = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secCtx.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '📌 Contexto' }));
    const radiosCtx = nomiCrearNodo('div', { css: 'display:flex;gap:8px;' });
    CONTEXTOS_DISPONIBLES.forEach(c => {
        radiosCtx.appendChild(nomiCrearNodo('label', { css: 'font-size:13px;display:flex;align-items:center;gap:4px;', hijos: [
            nomiCrearNodo('input', { atributos: { type: 'radio', name: 'contexto', value: String(c) }, marcado: NoMiState.contextoSeleccionado === c }),
            document.createTextNode(String(c))
        ]}));
    });
    secCtx.appendChild(radiosCtx);
    secCtx.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: 'Número de mensajes enviados al modelo (recomendado: 10).' }));

    const secRes = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secRes.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🧠 Resumen persistente'),
        nomiCrearNodo('input', { id: 'nomi-check-resumen', marcado: NoMiState.modoResumenActivo, deshabilitado: resumenDisabled, atributos: { type: 'checkbox' } })
    ]}));
    secRes.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: resumenDisabled ? 'Solo disponible con 10 mensajes.' : 'Guarda un resumen de la conversación para contexto a largo plazo.' }));

    const secTam = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secTam.appendChild(nomiCrearNodo('label', { css: 'font-size:14px;display:block;margin-bottom:4px;', texto: '📐 Tamaño de la ventana' }));
    secTam.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;margin-top:4px;', hijos: [
        nomiCrearNodo('label', { hijos: [
            document.createTextNode('Ancho (px): '),
            nomiCrearNodo('input', { id: 'nomi-width-input', valor: String(w), atributos: { type: 'number', min: '280', step: '10' }, css: 'width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;' })
        ]}),
        nomiCrearNodo('label', { hijos: [
            document.createTextNode('Alto (px): '),
            nomiCrearNodo('input', { id: 'nomi-height-input', valor: String(h), atributos: { type: 'number', min: '300', step: '10' }, css: 'width:70px;padding:4px;border-radius:6px;border:1px solid #555;background:#0d0d1a;color:#fff;' })
        ]})
    ]}));
    secTam.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:6px;margin-top:6px;', hijos: [
        nomiCrearNodo('button', { id: 'nomi-size-apply', css: 'padding:4px 12px;background:#4a6cf7;border:none;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Aplicar' }),
        nomiCrearNodo('button', { id: 'nomi-size-default', css: 'padding:4px 12px;background:#555;border:none;border-radius:6px;color:#fff;cursor:pointer;', texto: 'Predeterminado' })
    ]}));

    const secBusq = nomiCrearNodo('div', { css: 'margin-bottom:12px;' });
    secBusq.appendChild(nomiCrearNodo('label', { css: 'display:flex;justify-content:space-between;align-items:center;font-size:14px;', hijos: [
        document.createTextNode('🔍 Búsqueda web'),
        nomiCrearNodo('input', { id: 'nomi-check-busqueda', marcado: NoMiState.busquedaWebActiva, deshabilitado: !credCargadas, atributos: { type: 'checkbox' } })
    ]}));
    secBusq.appendChild(nomiCrearNodo('div', { css: 'font-size:11px;color:#888;', texto: credCargadas ? 'Activa la búsqueda web automática (detección de palabras clave).' : 'Primero configura tus credenciales.' }));

    // ---- API Personal (avanzado): agrupa OpenRouter/Tavily ----
    // Cerrada por defecto solo si NO hay credenciales Y el modo activo no es
    // Personal (openrouter). Se abre sola si ya está configurada o activa.
    const personalCerrado = !(credCargadas || NoMiState.modoAcceso === MODO_ACCESO_OPENROUTER);
    const secPersonal = nomiCrearNodo('div', { css: 'margin-bottom:16px;' });
    const personalHeader = nomiCrearNodo('button', { id: 'nomi-personal-toggle', css: 'width:100%;padding:10px;background:#0d0d1a;border:1px solid #333;border-radius:12px;color:#fff;font-size:14px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;', hijos: [
        nomiCrearNodo('span', { texto: '🔧 API Personal (avanzado)' }),
        nomiCrearNodo('span', { id: 'nomi-personal-indicador', css: 'font-size:12px;color:#888;', texto: personalCerrado ? '▸' : '▾' })
    ]});
    const personalContent = nomiCrearNodo('div', { id: 'nomi-personal-content', css: 'margin-top:8px;' });
    personalContent.style.display = personalCerrado ? 'none' : 'block';
    personalContent.appendChild(secOpen);
    secPersonal.appendChild(personalHeader);
    secPersonal.appendChild(personalContent);
    personalHeader.onclick = () => {
        const c = document.getElementById('nomi-personal-content');
        const ind = document.getElementById('nomi-personal-indicador');
        if (!c) return;
        const oculto = c.style.display === 'none';
        c.style.display = oculto ? 'block' : 'none';
        if (ind) ind.textContent = oculto ? '▾' : '▸';
    };

    const contenedor = nomiCrearNodo('div', { css: 'margin:10px 0;' });
    contenedor.appendChild(lineaEspacio);
    contenedor.appendChild(secNomi);
    contenedor.appendChild(secPersonal);
    contenedor.appendChild(secMotor);
    contenedor.appendChild(secDiag);
    contenedor.appendChild(secUbi);
    contenedor.appendChild(secLig);
    contenedor.appendChild(secCtx);
    contenedor.appendChild(secRes);
    contenedor.appendChild(secTam);
    contenedor.appendChild(secBusq);
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-restaurar', css: 'width:100%;padding:10px;background:#555;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🔄 Restaurar posición' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-limpiar', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🗑️ Limpiar datos antiguos' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-exportar-logs', css: 'width:100%;padding:10px;background:#4a6cf7;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '📤 Exportar logs de error' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-eliminar-global', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🗑️ Eliminar datos globales' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-cerrar-sesion', css: 'width:100%;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;margin-bottom:8px;', texto: '🚪 Cerrar sesión' }));
    contenedor.appendChild(nomiCrearNodo('button', { id: 'nomi-menu-cerrar', css: 'width:100%;padding:10px;background:none;border:none;color:#888;font-size:14px;cursor:pointer;', texto: 'Cerrar' }));

    const pieAcerca = nomiCrearNodo('div', { css: 'margin-top:16px;padding-top:12px;border-top:1px solid #333;font-size:11px;color:#555;text-align:center;' });
    pieAcerca.appendChild(document.createTextNode('ℹ️ Acerca de NoMi'));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Asistente IA desarrollado por ${DISEÑADOR}`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode('Powered by API Personal (OpenAI-compatible)'));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Modelo: ${modeloActual}`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(document.createTextNode(`Versión: ${VERSION_SCRIPT} (${FECHA_LANZAMIENTO})`));
    pieAcerca.appendChild(document.createElement('br'));
    pieAcerca.appendChild(nomiCrearNodo('span', { css: 'color:#444;', texto: 'ℹ️ En páginas de configuración de Google (accounts.google.com), la burbuja puede no aparecer. Vuelva a la página anterior o recargue.' }));

    menu.appendChild(nomiCrearNodo('h2', { css: 'color:#FF6B6B;margin-top:0;', texto: '⚙️ Configuración' }));
    menu.appendChild(contenedor);
    menu.appendChild(pieAcerca);
    document.body.appendChild(menu);

    document.getElementById('nomi-menu-cerrar').onclick = () => menu.remove();
    document.getElementById('nomi-guardar-creds').onclick = () => {
        const apiKey = document.getElementById('nomi-input-openrouter').value.trim();
        const tavilyKey = document.getElementById('nomi-input-tavily').value.trim();
        const urlBase = document.getElementById('nomi-input-url').value.trim() || URL_BASE_POR_DEFECTO;
        // El modelo se toma del selector (OpenRouter) o del campo manual (otra API).
        const esOR = esOpenRouter(urlBase);
        const modelo = esOR
            ? (document.getElementById('nomi-input-modelo').value.trim() || MODELO_POR_DEFECTO)
            : (document.getElementById('nomi-input-modelo-manual').value.trim() || MODELO_POR_DEFECTO);
        if (guardarCredencialesManual(apiKey, tavilyKey, modelo, urlBase)) {
            const modelDisplay = document.getElementById('nomi-modelo-display');
            if (modelDisplay) modelDisplay.textContent = NoMiState.modeloActual;
            actualizarStats();
            menu.remove();
            mostrarNotificacionTemporal('✅ Credenciales guardadas correctamente.');
        }
        };

    // ---- Visibilidad del campo Modelo según la URL ----
    // OpenRouter: selector poblado por el catálogo. Otra API compatible: campo manual.
    const actualizarVisibilidadModelo = () => {
        const url = (document.getElementById('nomi-input-url') && document.getElementById('nomi-input-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
        const esOR = esOpenRouter(url);
        const sel = document.getElementById('nomi-input-modelo');
        const inp = document.getElementById('nomi-input-modelo-manual');
        const btn = document.getElementById('nomi-actualizar-modelos');
        if (!sel || !inp) return;
        sel.style.display = esOR ? 'block' : 'none';
        inp.style.display = esOR ? 'none' : 'block';
        if (btn) btn.style.display = esOR ? 'flex' : 'none';
        if (!esOR && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
    };

    // ---- Selector guiado de modelo (OpenRouter) ----
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
    // Campo manual (otra API): persiste el modelo escrito sin consultar catálogo.
    const inpManual = document.getElementById('nomi-input-modelo-manual');
    if (inpManual) inpManual.addEventListener('input', () => {
        const v = inpManual.value.trim();
        if (v) setModelo(v);
    });
    // Al cambiar la URL base, se reevalúa si es OpenRouter y se muestra el control adecuado.
    const urlInput = document.getElementById('nomi-input-url');
    if (urlInput) urlInput.addEventListener('change', () => { actualizarVisibilidadModelo(); cargarModelosAlMenu(); });
    document.getElementById('nomi-actualizar-modelos').onclick = () => cargarModelosAlMenu(true);
    // Puebla el selector al abrir el menú (el caché de sessionStorage evita consultas repetidas).
    actualizarVisibilidadModelo();
    cargarModelosAlMenu();

    document.getElementById('nomi-importar-creds-menu').onclick = () => { importarCredenciales(); menu.remove(); };
    document.getElementById('nomi-check-diagnostico').onchange = (e) => {
        NoMiState.diagnosticoActivo = e.target.checked;
        setDiagnosticoActivo(NoMiState.diagnosticoActivo);
        menu.remove();
        mostrarNotificacionTemporal(`🩺 Diagnóstico técnico ${NoMiState.diagnosticoActivo ? 'activado' : 'desactivado'}.`);
    };

    // ---- Acceso compartido NoMi (Worker) ----
    // Alterna la sección OpenRouter (credenciales/modelo/URL) según el modo:
    // en modo NoMi se deshabilita visual y funcionalmente con el texto indicado.
    const alternarSeccionOpenRouter = () => {
        const sec = document.getElementById('nomi-seccion-openrouter');
        if (!sec) return;
        const esNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
        sec.style.opacity = esNoMi ? '0.5' : '1';
        sec.style.pointerEvents = esNoMi ? 'none' : 'auto';
        // Añade/quita el aviso "Solo disponible en modo API Personal".
        let aviso = sec.querySelector('.nomi-openrouter-aviso');
        const texto = 'Solo disponible en modo API Personal. Cambia el modo de acceso para usarlas.';
        if (esNoMi) {
            if (!aviso) {
                aviso = document.createElement('div');
                aviso.className = 'nomi-openrouter-aviso';
                aviso.style.cssText = 'font-size:10px;color:#f5a623;margin-bottom:6px;font-weight:bold;';
                sec.insertBefore(aviso, sec.firstChild.nextSibling);
            }
            aviso.textContent = texto;
        } else if (aviso) {
            aviso.remove();
        }
    };
    const aplicarCambioModo = (m) => {
        setModoAcceso(m);
        const sec = document.getElementById('nomi-seccion-worker');
        if (sec) sec.style.display = m === 'nomi' ? 'block' : 'none';
        alternarSeccionOpenRouter();
        actualizarIndicador();
        // Al cambiar de modo se limpia el estado HUD transitorio y la cuota
        // obsoleta (nunca se hereda límite/acceso inválido/capacidad de NoMi a Personal).
        NoMiState.usoNoMi = null;
        establecerEstadoHud(null);
        actualizarQuotaHud();
        mostrarNotificacionTemporal(`🌐 Modo de acceso: ${m === 'nomi' ? 'Acceso NoMi' : 'API Personal'}`);
    };
    const selModoNoMi = document.getElementById('nomi-select-modo');
    if (selModoNoMi) selModoNoMi.onchange = (e) => aplicarCambioModo(e.target.value);
    const activarNoMiBtn = document.getElementById('nomi-activar-acceso');
    if (activarNoMiBtn) activarNoMiBtn.onclick = async () => {
        const codigo = document.getElementById('nomi-input-codigo').value.trim();
        if (!codigo) { mostrarNotificacionTemporal('❌ Introduce el código de invitación.'); return; }
        activarNoMiBtn.disabled = true;
        activarNoMiBtn.textContent = '⏳ Activando…';
        try {
            await activarAccesoNoMi(codigo);
            setModoAcceso(MODO_ACCESO_NOMI);
            const sel = document.getElementById('nomi-select-modo');
            if (sel) sel.value = 'nomi';
            const sec = document.getElementById('nomi-seccion-worker');
            if (sec) sec.style.display = 'block';
            alternarSeccionOpenRouter();
            actualizarIndicador();
            const est = document.getElementById('nomi-estado-acceso');
            if (est) est.textContent = '✅ Activo';
            mostrarNotificacionTemporal('✅ Acceso NoMi activado. Ya puedes chatear.');
            cargarModelosNoMiAlMenu();
            establecerEstadoHud(null);
            consultarUsoNoMi();
            const ctaAct = document.getElementById('nomi-cta-activar');
            if (ctaAct) ctaAct.style.display = 'none';
        } catch (err) {
            mostrarNotificacionTemporal('❌ ' + err.message);
        } finally {
            activarNoMiBtn.disabled = false;
            activarNoMiBtn.textContent = '🔑 Activar con código';
        }
    };
    const cerrarNoMiBtn = document.getElementById('nomi-cerrar-acceso-nomi');
    if (cerrarNoMiBtn) cerrarNoMiBtn.onclick = () => {
        cerrarAccesoNoMi();
        const est = document.getElementById('nomi-estado-acceso');
        if (est) est.textContent = '⏳ Pendiente de activación';
        const ctaAct = document.getElementById('nomi-cta-activar');
        if (ctaAct) ctaAct.style.display = 'block';
    };
    const actualizarNoMiModelos = document.getElementById('nomi-actualizar-modelos-nomi');
    if (actualizarNoMiModelos) actualizarNoMiModelos.onclick = () => cargarModelosNoMiAlMenu();
    if (getNomiToken()) cargarModelosNoMiAlMenu();
    document.getElementById('nomi-check-clima-nomi').onchange = (e) => {
        NoMiState.climaAutomatico = e.target.checked;
        setClimaAutomatico(NoMiState.climaAutomatico);
        menu.remove();
        mostrarNotificacionTemporal(`🌦️ Clima automático NoMi ${NoMiState.climaAutomatico ? 'activado' : 'desactivado'}.`);
    };
    document.getElementById('nomi-check-busqueda-nomi').onchange = (e) => {
        NoMiState.busquedaWebNomi = e.target.checked;
        setBusquedaWebNomi(NoMiState.busquedaWebNomi);
        menu.remove();
        mostrarNotificacionTemporal(`🔎 Búsqueda web NoMi ${NoMiState.busquedaWebNomi ? 'activada' : 'desactivada'}.`);
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
        const opcionesGlobal = ['📁 Historiales de chat (todos los dominios)','⚙️ Configuración (contexto, modos)','📍 Ubicación guardada','📋 Logs de errores','📐 Tamaño y posición de ventana','📊 Estadísticas de tokens'];
        dialog.appendChild(nomiCrearNodo('h3', { css: 'color:#FF6B6B;margin-top:0;', texto: '🗑️ Eliminar datos globales' }));
        dialog.appendChild(nomiCrearNodo('p', { css: 'font-size:13px;color:#888;', texto: 'Seleccione qué datos desea eliminar:' }));
        const cajaChecks = nomiCrearNodo('div', { css: 'margin:12px 0;' });
        opcionesGlobal.forEach((t, i) => {
            cajaChecks.appendChild(nomiCrearNodo('label', { css: 'display:block;margin:6px 0;font-size:13px;', hijos: [
                nomiCrearNodo('input', { id: `nomi-del-${i}`, marcado: true, atributos: { type: 'checkbox' } }),
                document.createTextNode(' ' + t)
            ]}));
        });
        dialog.appendChild(cajaChecks);
        dialog.appendChild(nomiCrearNodo('div', { css: 'display:flex;gap:8px;margin-top:16px;', hijos: [
            nomiCrearNodo('button', { id: 'nomi-dialog-confirmar', css: 'flex:1;padding:10px;background:#f55036;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;', texto: 'Eliminar seleccionados' }),
            nomiCrearNodo('button', { id: 'nomi-dialog-cancelar', css: 'flex:1;padding:10px;background:#333;border:none;border-radius:10px;color:#fff;font-size:14px;cursor:pointer;', texto: 'Cancelar' })
        ]}));
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
    // El catálogo de modelos gratuitos SOLO se consulta si la URL es OpenRouter.
    // En otra API compatible se conserva el modelo manual sin intentar catálogo.
    const url = (document.getElementById('nomi-input-url') && document.getElementById('nomi-input-url').value.trim()) || getUrlBase() || URL_BASE_POR_DEFECTO;
    if (!esOpenRouter(url)) {
        if (estado) estado.textContent = 'API propia: usa el modelo manual.';
        const inp = document.getElementById('nomi-input-modelo-manual');
        if (inp && !inp.value) inp.value = getModelo() || MODELO_POR_DEFECTO;
        return;
    }
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
        nomiVaciarNodo(select);
        const optActual = document.createElement('option');
        optActual.value = actual;
        optActual.textContent = actual;
        select.appendChild(optActual);
        select.disabled = false;
        return;
    }
    const actual = getModelo() || MODELO_POR_DEFECTO;
    nomiVaciarNodo(select);
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

// ---- Selector de modelos del catálogo NoMi (Worker) ----
// Puebla el <select id="nomi-select-modelo-nomi"> con los modelos groq activos
// del catálogo público. Conserva el modelo actual si no aparece.
async function cargarModelosNoMiAlMenu() {
    const select = document.getElementById('nomi-select-modelo-nomi');
    const estado = document.getElementById('nomi-estado-modelo-nomi');
    if (!select) return;
    if (estado) estado.textContent = 'Cargando…';
    try {
        const cat = await obtenerCatalogoNoMi();
        const lista = (cat && cat.modelos || []).filter(m => m && m.proveedor === 'groq' && m.estado === 'activo');
        const actual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
        nomiVaciarNodo(select);
        lista.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.nombre || m.id} | ${m.id}`;
            if (m.id === actual) opt.selected = true;
            select.appendChild(opt);
        });
        select.onchange = () => { setNomiModelo(select.value); actualizarIndicador(); };
        if (estado) estado.textContent = `${lista.length} modelos`;
    } catch (e) {
        if (estado) estado.textContent = 'No se pudo cargar el catálogo.';
        const actual = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
        nomiVaciarNodo(select);
        const optActual = document.createElement('option');
        optActual.value = actual;
        optActual.textContent = actual;
        select.appendChild(optActual);
    }
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
        const respuestaIA = NoMiState.modoAcceso === MODO_ACCESO_NOMI
            ? await llamarIANoMi(prompt)
            : await llamarIA(prompt);
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

// Decide si debe abrirse el asistente de configuración inicial.
// En modo NoMi con token activo NO se exige OpenRouter/Tavily ni se abre el asistente.
function debeMostrarConfiguracionInicial() {
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken && NoMiState.nomiAccesoActivo) {
        return false;
    }
    return !NoMiState.configuracionInicialCompletada || !NoMiState.credencialesCargadas;
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
    NoMiState.climaAutomatico = getClimaAutomatico();
    NoMiState.busquedaWebNomi = getBusquedaWebNomi();
    NoMiState.ubicacionActual = getUbicacion();
    NoMiState.credencialesCargadas = getCredencialesCargadas();
    NoMiState.apiKeyActual = getApiKey();
    NoMiState.tavilyKeyActual = getTavilyKey();
    NoMiState.configuracionInicialCompletada = getConfigInicial();
    NoMiState.motorBusqueda = getMotorBusqueda();
    NoMiState.modoAcceso = getModoAcceso();
    NoMiState.nomiWorkerUrl = getNomiWorkerUrl() || NOMI_WORKER_URL_POR_DEFECTO;
    NoMiState.nomiToken = getNomiToken();
    NoMiState.nomiModelo = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    NoMiState.nomiAccesoActivo = getNomiAccesoActivo();
    // El endpoint del Worker es fijo: cualquier URL persistida distinta se resetea.
    resetearUrlWorkerNoMi();

    crearBurbuja();
    crearVentanaChat();
    // Fija el indicador superior según el modo persistido (NoMi/OpenRouter).
    actualizarIndicador();
    actualizarHud();
    actualizarQuotaHud();
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

    const mostrarConfig = debeMostrarConfiguracionInicial();

    if (NoMiState.historial.length === 0) {
        const sistema = `Eres NoMi, un asistente profesional y formal pero cercano. Responde con claridad, respeto y precisión. Evita el tuteo excesivo y mantén un tono de colaboración entre iguales. El usuario espera respuestas útiles, concisas y bien estructuradas.\n\n**Si el usuario pregunta sobre su ubicación (ej: "¿dónde estoy?", "¿en qué ciudad estoy?"), usa los datos de ubicación que tienes en el contexto.** No digas que no tienes acceso a la ubicación.`;
        NoMiState.historial.unshift({ role: 'system', content: sistema });
        guardarHistorial(NoMiState.historial);

        let bienvenida = `Hola, soy **${NOMBRE_ASISTENTE}**, su asistente de navegación.\nPara ver la lista de comandos disponibles, escriba \`!cmd\`.\n`;
        if (mostrarConfig) bienvenida += `\n⚠️ **Es necesario configurar tus credenciales.**\nSe abrirá un asistente de configuración para que importes o ingreses tus claves de API.\n`;
        else if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && NoMiState.nomiToken && NoMiState.nomiAccesoActivo) bienvenida += `\n🌐 Acceso compartido NoMi activo. Puedes chatear directamente.\n`;
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

// ---- Clima vía Worker NoMi (sin Tavily, sin Groq) ----
// Sufijos temporales que pueden seguir a la ciudad ("en La Paz mañana") y que NO
// deben enviarse a Open-Meteo como parte de la ubicación (auditoría hallazgo 1).
const SUFIJOS_TEMPORALES_CLIMA = [
    'hoy', 'mañana', 'manana', 'madrugada', 'ayer', 'pasado', 'ahora', 'luego', 'después', 'despues',
    'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo',
    'próxima', 'proxima', 'próximo', 'proximo', 'semana', 'mismo', 'durante', 'noche', 'tarde',
    'mediodía', 'mediodia',
];
const CONJUNTO_SUFIJOS = new Set(SUFIJOS_TEMPORALES_CLIMA);

function limpiarSufijosTemporalesCiudad(ciudad) {
    const partes = String(ciudad || '').trim().split(/\s+/);
    while (partes.length > 1 && CONJUNTO_SUFIJOS.has(partes[partes.length - 1].toLowerCase())) {
        partes.pop();
    }
    return partes.join(' ').trim();
}

// Detección conservadora de consultas meteorológicas en modo NoMi. Devuelve la
// ubicación a consultar o null (entonces el chat sigue normal).
// - Palabras fuertes: clima, pronóstico/pronostico, temperatura, lluvia, viento.
// - "tiempo" SOLO en expresiones meteorológicas claras ("qué tiempo hace/hará",
//   "tiempo hoy/mañana"); nunca como palabra aislada ("¿cuánto tiempo tardas?",
//   "tiempo de ejecución") para evitar falsos positivos.
// - Se activa solo con ciudad tras "en …" (recortando sufijos temporales) O
//   ubicación local previamente habilitada.
function detectarClimaNoMi(texto) {
    if (typeof texto !== 'string' || !texto.trim()) return null;
    const t = texto.trim();
        const climaFuerte = /\b(clima|pronóstico|pronostico|temperatura|lluvia|viento)\b/i.test(t);
    // Límite compatible con tildes: `\b` en JS no contempla á/é/ó/ñ como `\w`, por
    // lo que `hará\b`/`está\b`/`será\b` fallan cuando van seguidos de espacio o
    // puntuación (p. ej. "qué tiempo hará mañana"). Tras hace/hará/hara/está/
    // esta/este/será/sera usamos el look-ahead positivo `(?=$|[\s?.,!¿¡])`,
    // compatible con espacio, puntuación o fin de texto sin romper acentos. Los
    // falsos positivos ("cuánto tiempo tardas…", "tiempo de ejecución…") se
    // siguen bloqueando por la estructura de la frase, no por el límite.
    const climaPorTiempo = /\btiempo\b/i.test(t) && (
        /\b(qué|que|cómo|como)\s+tiempo\s+(hace|hará|hara|está|esta|este|será|sera)(?=$|[\s?.,!¿¡])/i.test(t) ||
        /\btiempo\s+(hoy|mañana|manana|ahora)\b/i.test(t)
    );
    if (!climaFuerte && !climaPorTiempo) return null;
    // a) Ciudad identificable tras "en …" (eliminando sufijos temporales).
    const m = t.match(/\ben\s+([^?.,!¿¡]+)/i);
    if (m && m[1].trim().length >= 3) {
        const ciudad = limpiarSufijosTemporalesCiudad(m[1].trim());
        if (ciudad.length >= 3) return ciudad;
    }
    // b) Ubicación local explícitamente habilitada.
    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual && NoMiState.ubicacionActual.ciudad) {
        const u = NoMiState.ubicacionActual;
        return (u.ciudad + (u.pais ? ', ' + u.pais : '')).trim();
    }
    return null;
}

// Detecta solicitudes de búsqueda web en modo NoMi (Tavily SOLO vía Worker).
// Devuelve la consulta a buscar o null (el chat sigue su flujo normal).
// - Comandos explícitos ("busca X", "investiga X"): SIEMPRE activan, sin exigir !search.
// - Auto-detección SOLO de intención temporal inequívoca: patrones COMPUESTOS
//   (evento/noticia + recencia). Palabras genéricas aisladas ("noticias",
//   "precio", "resultados") NO activan nada por sí solas para evitar falsos
//   positivos. El clima tiene prioridad y se evalúa antes en preguntar().
function detectarBusquedaNoMi(texto) {
    if (typeof texto !== 'string' || !texto.trim()) return null;
    const t = texto.trim();
    const mComando = t.match(/^(?:busca|buscar|investiga|investigar)\b\s*[:|]?\s*(.+)$/i);
    if (mComando) {
        const consulta = mComando[1].trim().replace(/^["']+|["']+$/g, '');
        return consulta.length >= 2 ? consulta : null;
    }
    const patronesTemporales = [
        /\b(?:noticias|novedades|actualidad)\s+(?:de|del|sobre|acerca\s+de)\s+\S/i,
        /\b[uú]ltim[ao]s?\s+(?:hora|horas|noticias?|novedades)\b/i,
        /\bqu[eé]\s+(?:ha\s+)?pasado\b[\s\S]*\b(?:hoy|ayer|anoche|esta\s+semana|recientemente)\b/i,
        /\bqui[eé]n\s+gan[oó]\b[\s\S]*\b(?:hoy|ayer|anoche|esta\s+semana)\b/i,
        /\b(?:hoy|ayer|anoche|esta\s+semana|este\s+fin\s+de\s+semana)\b[\s\S]{0,60}\b(?:partido|resultad[oa]s?|final(?:es)?|elecci[oó]n(?:es)?|lanzamiento)\b/i,
        /\b(?:precio|cotizaci[oó]n)\s+(?:actual|hoy|de\s+hoy|del\s+d[ií]a)\b/i,
    ];
    for (const re of patronesTemporales) {
        if (re.test(t)) return t;
    }
    return null;
}

// Maneja una consulta de clima en modo NoMi: llama al Worker con `herramienta`
// y pinta la respuesta breve. El Worker nunca pasa por Groq ni usa Tavily.
async function manejarClimaNoMi(texto, ubicacion) {
    NoMiState.isWaiting = true;
    deshabilitarControlesEnvio();
    actualizarHud();
    NoMiState.historial.push({ role: 'user', content: texto });
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);
    mostrarCargando();
    try {
        // Señal explícita del Worker (`climaEstado`, vía llamarClimaNoMi):
        // distingue éxito real de ciudad inexistente, límite diario y fallo
        // temporal del proveedor SIN inspeccionar el texto humano.
        const resultado = await llamarClimaNoMi(texto, ubicacion);
        const respuestaTexto = resultado.texto;
        ocultarCargando();
        if (resultado.estado === 'fallo_proveedor') {
            // Fallo temporal de Open-Meteo (el Worker ya revirtió la cuota):
            // mismo tratamiento blando y reintentable que una caída de red,
            // conservando el mensaje humano recibido.
            NoMiState.historial.pop();
            guardarHistorial(NoMiState.historial);
            const dispFallo = document.getElementById('nomi-modelo-display');
            if (dispFallo) dispFallo.textContent = '⚠️ error';
            agregarMensaje('bot', respuestaTexto);
            NoMiState.reintentarPregunta = texto;
            mapearErrorHudNoMi({}); // estado HUD 'sin_conexion' -> botón "Reintentar"
            registrarError('network', 'Clima: fallo temporal del proveedor (Open-Meteo).', `Modo: NoMi (clima), URL: ${NoMiState.nomiWorkerUrl}`);
        } else {
            // ok / ciudad_no_encontrada / limite_diario: consulta atendida y no
            // reintentable tal cual; el mensaje humano ya explica cada caso.
            NoMiState.contadorPreguntas++;
            setContador(NoMiState.contadorPreguntas);
            NoMiState.historial.push({ role: 'assistant', content: respuestaTexto });
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', respuestaTexto);
            NoMiState.reintentarPregunta = '';
            actualizarStats();
        }
    } catch (error) {
        ocultarCargando();
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        const disp = document.getElementById('nomi-modelo-display');
        if (disp) disp.textContent = '⚠️ error';
        // Igual que el chat NoMi normal: la pregunta queda guardada para el
        // reintento explícito del HUD ("Reintentar"). mapearErrorHudNoMi la
        // limpia en 401 (acceso inválido no es reintentable).
        NoMiState.reintentarPregunta = texto;
        // Error humano breve sin fuga técnica.
        agregarMensaje('bot', mensajeHumanoErrorNoMi(error));
        mapearErrorHudNoMi(error);
        registrarError('network', error.message, `Modo: NoMi (clima), URL: ${NoMiState.nomiWorkerUrl}`);
    }
    restaurarControlesEnvio();
    NoMiState.isWaiting = false;
    actualizarHud();
}

// Versión de texto plano (para el historial persistente) de los resultados de
// búsqueda: incluye título, URL y snippet. Se guarda SOLO en el localStorage del
// usuario; nunca viaja al servidor ni a diagnósticos.
function construirTextoBusquedaPlano(resultados) {
    const lista = Array.isArray(resultados) ? resultados.slice(0, 3) : [];
    if (lista.length === 0) return 'No encontré resultados útiles en la web.';
    const lineas = ['Esto es lo que encontré en la web:'];
    lista.forEach((r, i) => {
        lineas.push((i + 1) + '. ' + (r.titulo || '(sin título)'));
        const urlPlana = nomiUrlFuenteSegura(r.url);
        if (urlPlana) lineas.push('   ' + urlPlana);
        if (r.contenido) lineas.push('   ' + r.contenido);
    });
    return lineas.join('\n');
}

// Maneja una búsqueda web en modo NoMi: llama al Worker con
// `herramienta: { tipo: 'busqueda', consulta }` (Tavily SOLO en el Worker, sin
// clave del usuario) y pinta hasta 3 resultados con fuentes seguras. El Worker
// nunca pasa por Groq ni usa Tavily local de API Personal. Señal explícita
// `busquedaEstado`: ok | sin_resultados | limite_diario | fallo_proveedor
// (| actualizacion_requerida si el Worker aún no soporta la herramienta).
async function manejarBusquedaNoMi(texto, consulta) {
    NoMiState.isWaiting = true;
    deshabilitarControlesEnvio();
    actualizarHud();
    NoMiState.historial.push({ role: 'user', content: texto });
    guardarHistorial(NoMiState.historial);
    agregarMensaje('yo', texto);
    mostrarCargando();
    try {
        const res = await llamarBusquedaNoMi(consulta);
        ocultarCargando();
        if (res.estado === 'fallo_proveedor') {
            // Fallo temporal de Tavily/red (el Worker ya revirtió la cuota):
            // mismo tratamiento blando y reintentable que una caída de red,
            // conservando el mensaje humano recibido.
            NoMiState.historial.pop();
            guardarHistorial(NoMiState.historial);
            const dispFallo = document.getElementById('nomi-modelo-display');
            if (dispFallo) dispFallo.textContent = '⚠️ error';
            agregarMensaje('bot', res.texto);
            NoMiState.reintentarPregunta = texto;
            mapearErrorHudNoMi({}); // estado HUD 'sin_conexion' -> botón "Reintentar"
            // Sin contenido de la consulta en el diagnóstico (privacidad).
            registrarError('network', 'Búsqueda NoMi: fallo temporal del proveedor (Tavily).', `Modo: NoMi (busqueda), URL: ${NoMiState.nomiWorkerUrl}`);
        } else if (res.estado === 'ok') {
            NoMiState.contadorPreguntas++;
            setContador(NoMiState.contadorPreguntas);
            NoMiState.historial.push({ role: 'assistant', content: construirTextoBusquedaPlano(res.resultados) });
            guardarHistorial(NoMiState.historial);
            agregarMensajeConFuentes(res.resultados);
            NoMiState.reintentarPregunta = '';
            actualizarStats();
        } else {
            // sin_resultados / limite_diario: atendidos y contabilizados.
            // consulta_invalida / actualizacion_requerida: informativos, sin
            // contar pregunta y sin reintento.
            NoMiState.historial.push({ role: 'assistant', content: res.texto });
            guardarHistorial(NoMiState.historial);
            agregarMensaje('bot', res.texto);
            NoMiState.reintentarPregunta = '';
            if (res.estado === 'sin_resultados' || res.estado === 'limite_diario') {
                NoMiState.contadorPreguntas++;
                setContador(NoMiState.contadorPreguntas);
            }
            actualizarStats();
        }
    } catch (error) {
        ocultarCargando();
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        const disp = document.getElementById('nomi-modelo-display');
        if (disp) disp.textContent = '⚠️ error';
        // Igual que el chat NoMi normal: la pregunta queda guardada para el
        // reintento explícito del HUD ("Reintentar"). mapearErrorHudNoMi la
        // limpia en 401 (acceso inválido no es reintentable).
        NoMiState.reintentarPregunta = texto;
        agregarMensaje('bot', mensajeHumanoErrorNoMi(error));
        mapearErrorHudNoMi(error);
        registrarError('network', error.message, `Modo: NoMi (busqueda), URL: ${NoMiState.nomiWorkerUrl}`);
    }
    restaurarControlesEnvio();
    NoMiState.isWaiting = false;
    actualizarHud();
}

// Defensa en profundidad (respaldo, no el mecanismo principal): si un modelo
// normal responde con una línea aislada `!search`, NO se muestra como respuesta
// útil ni se ejecuta. Se registra diagnóstico SIN contenido y se muestra un error
// humano breve.
function esRespuestaComandoInseguro(texto) {
    return typeof texto === 'string' && /^\s*!search(\s|$)/i.test(texto);
}

async function preguntar(texto) {
    if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
        // Modo explícito NoMi: exige token Y acceso activo. Sin eso, informa y
        // NO se hace ninguna petición HTTP (tampoco fallback a OpenRouter).
        if (!NoMiState.nomiToken) {
            agregarMensaje('bot', '🔑 **No tienes un token de acceso NoMi.**\n\nActívalo con un código de invitación en ⚙️ Configuración > Acceso compartido NoMi.\nNo se usa OpenRouter en este modo.');
            return;
        }
        if (!NoMiState.nomiAccesoActivo) {
            agregarMensaje('bot', '⛔ **Tu acceso NoMi no está activo o fue revocado.**\n\nVuelve a activar un código de invitación en ⚙️ Configuración > Acceso compartido NoMi.\nNo se usa OpenRouter en este modo.');
            return;
        }
        // Clima vía Worker (solo NoMi): detección conservadora, sin Tavily ni Groq.
        // Si el usuario desactivó "clima automático NoMi", la consulta sigue el chat
        // normal sin herramienta (sin pasar por Open-Meteo).
        const ubicacionClima = NoMiState.climaAutomatico ? detectarClimaNoMi(texto) : null;
        if (ubicacionClima) {
            // Igual que el chat normal: el texto enviado sale del input (el mensaje
            // ya queda pintado en el chat e historial por manejarClimaNoMi).
            const inputClima = document.getElementById('nomi-input');
            if (inputClima) inputClima.value = '';
            await manejarClimaNoMi(texto, ubicacionClima);
            return;
        }
        // Búsqueda web NoMi (Tavily SOLO en el Worker): el clima tiene prioridad
        // (arriba). Sin fallback a API Personal y sin usar la clave Tavily local
        // del usuario; desactivable con la preferencia "Búsqueda web NoMi".
        if (!ubicacionClima && NoMiState.nomiToken && NoMiState.nomiAccesoActivo && NoMiState.busquedaWebNomi) {
            const consultaWeb = detectarBusquedaNoMi(texto);
            if (consultaWeb) {
                const inputBusq = document.getElementById('nomi-input');
                if (inputBusq) inputBusq.value = '';
                await manejarBusquedaNoMi(texto, consultaWeb);
                return;
            }
        }
    } else if (!NoMiState.credencialesCargadas || !NoMiState.apiKeyActual) {
        agregarMensaje('bot', '⚠️ **No hay credenciales configuradas.**\n\nPor favor, ve al menú (⚙️) y configura tu API Personal (URL base + API key) o importa un archivo `.enc`.\n\nMientras tanto, puedes usar comandos básicos como `!cmd` para ver la lista de comandos disponibles.');
        return;
    }
    const input = document.getElementById('nomi-input');
    if (input) input.value = '';
    if (!texto.trim() || NoMiState.isWaiting) return;
    if (texto.trim() === '!cmd' || texto.trim() === '!comandos') { mostrarAyuda(); return; }

    NoMiState.isWaiting = true;
    deshabilitarControlesEnvio();
    actualizarHud();

    if (NoMiState.ubicacionActivada && NoMiState.ubicacionActual) {
        if (Date.now() - NoMiState.ubicacionActual.timestamp > UBICACION_EXPIRACION) actualizarUbicacion(true);
    }

    // En modo NoMi la búsqueda web legada (procesarBusqueda/buscarWeb con clave
    // Tavily local o API Personal) NUNCA aplica —ni con preferencia NoMi activada
    // ni desactivada—: comandos, auto-detección y busquedaForzada siguen SIEMPRE
    // el chat NoMi normal, conforme al texto de la preferencia en la UI.
    const modoNoMi = NoMiState.modoAcceso === MODO_ACCESO_NOMI;
    const cmdBusqueda = !modoNoMi ? texto.match(/^(investiga|busca|investigar|buscar)\s*[:|]?\s*(.+)/i) : null;
    let esBusqueda = false, consulta = '';
    if (cmdBusqueda) {
        consulta = cmdBusqueda[2].trim();
        if (consulta) {
            esBusqueda = true;
            if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
        }
    }
    if (NoMiState.busquedaForzada) {
        NoMiState.busquedaForzada = false; // se consume siempre para no fugarse a Personal después
        if (!modoNoMi) {
            esBusqueda = true; consulta = texto.trim();
            if (!NoMiState.busquedaWebActiva) NoMiState.busquedaWebTemporal = true;
        }
    }
    if (!esBusqueda && !modoNoMi && NoMiState.busquedaWebActiva && requiereBusqueda(texto)) {
        esBusqueda = true; consulta = texto.trim();
    }
    if (esBusqueda && consulta) {
        ocultarCargando();
        actualizarIndicadorModelo();
        await procesarBusqueda(consulta);
        if (NoMiState.busquedaWebTemporal) { NoMiState.busquedaWebTemporal = false; }
        restaurarControlesEnvio();
        NoMiState.isWaiting = false;
        actualizarHud();
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

    mostrarCargando();

    try {
        let respuestaTexto;
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            // Modo explícito "Acceso compartido NoMi": usa el Worker (Bearer token).
            // El mensaje conserva continuidad (persona + resumen + turnos recientes
            // + contexto completo: fecha, ubicación y contenido de página) y
            // respeta el límite de bytes del Worker.
            actualizarIndicadorProveedor();
            document.getElementById('nomi-modelo-display').textContent = NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO;
            respuestaTexto = await llamarIANoMi(construirMensajeWorkerNoMi(mensajeFinal));
        } else {
            // Chat Personal (OpenAI-compatible): /chat/completions con la URL
            // base configurada. Los headers HTTP-Referer/X-Title solo se envían
            // si la URL es OpenRouter (construirHeadersPersonal lo gestiona).
            const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
                method: 'POST',
                headers: construirHeadersPersonal(NoMiState.apiKeyActual, NoMiState.urlBaseActual),
                body: JSON.stringify({
                    model: NoMiState.modeloActual,
                    messages: [...mensajesParaEnviar, {role: 'user', content: mensajeFinal}],
                    stream: false
                })
            });
            if (respuesta.choices && respuesta.choices[0]) {
                respuestaTexto = respuesta.choices[0].message.content;
                document.getElementById('nomi-modelo-display').textContent = NoMiState.modeloActual;
                if (respuesta.usage) {
                    NoMiState.tokens.total += respuesta.usage.total_tokens || 0;
                    NoMiState.tokens.input += respuesta.usage.prompt_tokens || 0;
                    NoMiState.tokens.output += respuesta.usage.completion_tokens || 0;
                    setTokens(NoMiState.tokens);
                }
            } else if (respuesta.error) {
                agregarMensaje('bot', '❌ Error: ' + (respuesta.error.message || JSON.stringify(respuesta.error)));
                NoMiState.historial.pop();
                guardarHistorial(NoMiState.historial);
                document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
                registrarError('api', respuesta.error.message || 'Error desconocido en API', `Modelo: ${NoMiState.modeloActual}`);
                restaurarControlesEnvio();
                NoMiState.isWaiting = false;
                actualizarHud();
                return;
            } else {
                agregarMensaje('bot', '❌ Error inesperado');
                NoMiState.historial.pop();
                guardarHistorial(NoMiState.historial);
                document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
                registrarError('script', 'Respuesta inesperada de la API', 'Sin detalles');
                restaurarControlesEnvio();
                NoMiState.isWaiting = false;
                actualizarHud();
                return;
            }
        }
        // Defensa en profundidad SOLO en modo NoMi: una respuesta que empieza por una
        // línea aislada `!search` NO se muestra como resultado útil ni se ejecuta
        // (respaldo; el mecanismo principal es el Worker). Se registra diagnóstico
        // SIN contenido. En API Personal no se aplica (auditoría hallazgo 4).
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI && esRespuestaComandoInseguro(respuestaTexto)) {
            ocultarCargando();
                        const disp = document.getElementById('nomi-modelo-display');
            // La defensa conserva el modelo de NoMi (no el de Personal/OpenRouter):
            // en modo NoMi el indicador de modelo debe seguir mostrando nomiModelo.
            if (disp) disp.textContent = NoMiState.nomiModelo || NOMI_MODELO_POR_DEFECTO;
            registrarError('script', 'Respuesta del modelo con comando interno !search no ejecutada (sin contenido de usuario).', 'Seguridad');
            agregarMensaje('bot', '❌ No pude completar esa respuesta de forma segura. Reformula tu pregunta.');
            restaurarControlesEnvio();
            NoMiState.isWaiting = false;
            actualizarHud();
            return;
        }
        // Ruta de éxito común a ambos modos.
        ocultarCargando();
        NoMiState.contadorPreguntas++;
        setContador(NoMiState.contadorPreguntas);
        NoMiState.historial.push({role: 'assistant', content: respuestaTexto});
        guardarHistorial(NoMiState.historial);
        agregarMensaje('bot', respuestaTexto);
        NoMiState.reintentarPregunta = '';
        actualizarStats();
        // NoMi: tras respuesta exitosa, refresca cuota y limpia estado de error.
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) await consultarUsoNoMi();
        if (NoMiState.modoResumenActivo && NoMiState.contextoSeleccionado === 10) {
            setTimeout(() => generarResumen(NoMiState.historial), 100);
        }
    } catch (error) {
        ocultarCargando();
        NoMiState.historial.pop();
        guardarHistorial(NoMiState.historial);
        document.getElementById('nomi-modelo-display').textContent = '⚠️ error';
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            // Error NoMi: un único mensaje humano; el detalle técnico queda solo
            // en registrarError(). La pregunta se guarda para reintento explícito.
            NoMiState.reintentarPregunta = texto;
            agregarMensaje('bot', mensajeHumanoErrorNoMi(error));
            mapearErrorHudNoMi(error);
            registrarError('network', error.message, `Modo: NoMi, URL: ${NoMiState.nomiWorkerUrl}`);
        } else {
            agregarMensaje('bot', '❌ ' + error.message);
            registrarError('network', error.message, `Modo: ${NoMiState.modoAcceso}, URL: ${NoMiState.urlBaseActual}`);
        }
    }
    restaurarControlesEnvio();
    NoMiState.isWaiting = false;
    actualizarHud();
}

async function generarResumen(historialCompleto) {
    if (!NoMiState.modoResumenActivo || NoMiState.contextoSeleccionado !== 10 || historialCompleto.length < 4) return;
    try {
        let textoResumen = null;
        if (NoMiState.modoAcceso === MODO_ACCESO_NOMI) {
            textoResumen = await llamarIANoMi(construirMensajeResumenNoMi(historialCompleto));
        } else {
            const respuesta = await hacerPeticion(NoMiState.urlBaseActual + '/chat/completions', {
                method: 'POST',
                headers: construirHeadersPersonal(NoMiState.apiKeyActual, NoMiState.urlBaseActual),
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
                textoResumen = respuesta.choices[0].message.content;
            }
        }
        if (textoResumen) setResumen(textoResumen);
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
    NoMiState.modoAcceso = getModoAcceso();
    NoMiState.nomiWorkerUrl = getNomiWorkerUrl() || NOMI_WORKER_URL_POR_DEFECTO;
    NoMiState.nomiToken = getNomiToken();
    NoMiState.nomiModelo = getNomiModelo() || NOMI_MODELO_POR_DEFECTO;
    NoMiState.nomiAccesoActivo = getNomiAccesoActivo();
    resetearUrlWorkerNoMi(); // el endpoint es fijo: descarta cualquier URL persistida distinta
    obtenerInstalacionId(); // genera/recupera el ID persistente anónimo de instalación

    limpiarHistorialesAntiguos();

    // ======== INICIO ========
    setTimeout(() => {
        setValor(STORAGE_VALIDADO, true);
        NoMiState.validado = true;
        iniciarAsistente();
    }, 500);
})();
