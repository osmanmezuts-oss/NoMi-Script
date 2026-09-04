// ======== nomi-api Worker · Clima vía Open-Meteo (sin Groq, sin Tavily) ========
// El Worker es el ÚNICO intermediario: autentica al invitado, resuelve la ciudad
// con el geocoding de Open-Meteo y consulta el forecast. NUNCA llama a Groq ni
// consume cuota/tokens de Groq. No guarda consultas, ubicaciones ni respuestas.
//
// Límite diario (20/día UTC, por usuario) gestionado en D1 (db.js), aislado de la
// cuota mensual, la bolsa global y el RateLimiterDO de Groq.

import { E } from './errores.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Normaliza la ubicación recibida ANTES del geocoding eliminando SOLO comillas,
// apóstrofes o puntuación EXTERNOS (inicio/final). Conserva apóstrofes internos
// legítimos (p. ej. "Sant'Agata") y no toca el interior de la cadena: evita que
// un apóstrofo de cierre pegado por el cliente (p. ej. "Santa Cruz de la Sierra'")
// llegue a Open-Meteo y rompa la resolución. Espejo EXACTO de la normalización
// del cliente (normalizarUbicacionClima en modules/nomi-core.js): defiende en el
// Worker aunque el cliente no la aplique (defensa en profundidad).
function normalizarUbicacionClima(ubicacion) {
    let s = String(ubicacion || '').trim();
    s = s.replace(/^[\s"'“”‘’]+/, '').replace(/[\s"'“”‘’]+$/, '');
    s = s.replace(/^[¿¡…]+/, '');
    s = s.replace(/[?!.,;:…]+$/, '');
    return s.trim();
}

// Códigos meteorológicos WMO -> texto español conciso (sin relleno).
const CONDICIONES_WMO = {
    0: 'despejado', 1: 'mayormente despejado', 2: 'parcialmente nublado', 3: 'nublado',
    45: 'niebla', 48: 'niebla con escarcha',
    51: 'llovizna débil', 53: 'llovizna', 55: 'llovizna densa',
    56: 'llovizna helada débil', 57: 'llovizna helada',
    61: 'lluvia débil', 63: 'lluvia', 65: 'lluvia fuerte',
    66: 'lluvia helada débil', 67: 'lluvia helada fuerte', 71: 'nieve débil', 73: 'nieve', 75: 'nieve fuerte', 77: 'granizo',
    80: 'chubascos débiles', 81: 'chubascos', 82: 'chubascos fuertes',
    85: 'chubascos de nieve débiles', 86: 'chubascos de nieve',
    95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta con granizo',
};

function mapearCondicion(code) {
    if (code === null || code === undefined) return null;
    return CONDICIONES_WMO[code] || null;
}

function redondear(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
    return Math.round(Number(n));
}

// Respuesta determinista en español de 2–4 líneas. Sin pronóstico semanal ni relleno.
function construirRespuestaClima(nombre, pais, f) {
    const lineas = [];
    const lugar = pais ? `${nombre}, ${pais}` : nombre;
    lineas.push(`Clima en ${lugar}:`);

    const cur = (f && f.current) || {};
    const cond = mapearCondicion(cur.weather_code);
    const temp = redondear(cur.temperature_2m);
    const viento = redondear(cur.wind_speed_10m);
    if (temp !== null) {
        let l = `Ahora: ${cond ? cond + ', ' : ''}${temp}°C`;
        if (viento !== null) l += `, viento ${viento} km/h`;
        l += '.';
        lineas.push(l);
    }

    const d = (f && f.daily) || {};
    const max = (d.temperature_2m_max && d.temperature_2m_max[0] != null) ? redondear(d.temperature_2m_max[0]) : null;
    const min = (d.temperature_2m_min && d.temperature_2m_min[0] != null) ? redondear(d.temperature_2m_min[0]) : null;
    const prob = (d.precipitation_probability_max && d.precipitation_probability_max[0] != null) ? redondear(d.precipitation_probability_max[0]) : null;
    if (max !== null && min !== null) {
        let l = `Hoy: máx ${max}°C / mín ${min}°C`;
        if (prob !== null) l += `, prob. lluvia ${prob}%`;
        l += '.';
        lineas.push(l);
    }

    if (lineas.length === 1) lineas.push('Sin datos detallados del clima en este momento.');
    return { texto: lineas.join('\n') };
}

// Devuelve { texto } o { error: 'ciudad_no_encontrada' | 'fallo_proveedor' }.
// No lanza: el caller traduce a mensaje humano. No guarda nada.
export async function consultarClima(env, ubicacion) {
    // Defensa en profundidad: el Worker normaliza ANTES del geocoding igual que
    // el cliente, para no depender de él (comillas/apóstrofes/puntuación externos).
    const ubicacionLimpia = normalizarUbicacionClima(ubicacion);
    const q = encodeURIComponent(ubicacionLimpia);
    let geo;
    try {
        const r = await fetch(`${GEOCODING_URL}?name=${q}&count=1&language=es&format=json`);
        if (!r.ok) return { error: 'fallo_proveedor' };
        geo = await r.json();
    } catch {
        return { error: 'fallo_proveedor' };
    }
    const res = geo && geo.results && geo.results[0];
    if (!res || res.latitude == null || res.longitude == null) return { error: 'ciudad_no_encontrada' };

    const nombre = res.name || ubicacionLimpia;
    const pais = res.country || res.country_code || '';

    let f;
    try {
        const r2 = await fetch(`${FORECAST_URL}?latitude=${res.latitude}&longitude=${res.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
        if (!r2.ok) return { error: 'fallo_proveedor' };
        f = await r2.json();
    } catch {
        return { error: 'fallo_proveedor' };
    }
    return construirRespuestaClima(nombre, pais, f);
}

export const _internosClima = { mapearCondicion, construirRespuestaClima, CONDICIONES_WMO, normalizarUbicacionClima };
