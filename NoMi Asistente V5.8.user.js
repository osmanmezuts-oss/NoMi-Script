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

// ==UserScript==
// @name         NoMi Asistente V5.8
// @namespace    http://tampermonkey.net/
// @version      5.8
// @description  Asistente IA con importación de credenciales, actualización automática y mejoras multiplataforma
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-config-estatica.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-deteccion-sistema.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-criptografia.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-procesamiento-lenguaje.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-state.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-utilities.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-limpieza.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-persistencia.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-logging.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-estadisticas.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-chat.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-red.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-credenciales.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-ubicacion.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-ui.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-asistente-config.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-menu-config.js
// @require      https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/modules/nomi-core.js
// @updateURL    https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/NoMi%20Asistente%20V5.8.user.js
// @downloadURL  https://raw.githubusercontent.com/osmanmezuts-oss/NoMi-Script/main/NoMi%20Asistente%20V5.8.user.js
// ==/UserScript==

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
    NoMiState.posicionOriginalVentana = posV?.y || null;
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

    limpiarHistorialesAntiguos();

    // ======== INICIO ========
    setTimeout(() => {
        setValor(STORAGE_VALIDADO, true);
        NoMiState.validado = true;
        iniciarAsistente();
    }, 500);
})();
