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
// llegue a Open-Meteo y rompa la resolución. La normalización vive solo en el
// Worker: el cliente ya no extrae ciudades mediante reglas léxicas.
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

function fechaUtc(fecha) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
    if (!m) return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toISOString().slice(0, 10) === fecha ? d : null;
}

function etiquetaFecha(fecha, fechaLocal) {
    const objetivo = fechaUtc(fecha);
    const base = fechaUtc(fechaLocal);
    const fechaLegible = objetivo
        ? new Intl.DateTimeFormat('es', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(objetivo)
        : fecha;
    if (objetivo && base) {
        const dias = Math.round((objetivo.getTime() - base.getTime()) / 86400000);
        if (dias === 0) return `Hoy, ${fechaLegible}`;
        if (dias === 1) return `Mañana, ${fechaLegible}`;
        if (dias === 2) return `Pasado mañana, ${fechaLegible}`;
    }
    if (!objetivo) return fecha;
    return new Intl.DateTimeFormat('es', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(objetivo);
}

function resumenFranja(hourly, fecha, desde, hasta) {
    const tiempos = Array.isArray(hourly.time) ? hourly.time : [];
    const temperaturas = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
    const lluvias = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
    const codigos = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
    const vientos = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];
    const indices = [];
    tiempos.forEach((tiempo, indice) => {
        const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(String(tiempo || ''));
        if (m && m[1] === fecha) {
            const hora = Number(m[2]);
            if (hora >= desde && hora <= hasta) indices.push(indice);
        }
    });
    if (!indices.length) return null;
    const numeros = (arr) => indices.map(i => Number(arr[i])).filter(Number.isFinite);
    const ts = numeros(temperaturas);
    const ps = numeros(lluvias);
    const ws = numeros(vientos);
    const frecuencia = new Map();
    indices.forEach(i => {
        const code = Number(codigos[i]);
        if (Number.isFinite(code)) frecuencia.set(code, (frecuencia.get(code) || 0) + 1);
    });
    const code = [...frecuencia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
        condicion: mapearCondicion(code) || 'condiciones variables',
        min: ts.length ? Math.round(Math.min(...ts)) : null,
        max: ts.length ? Math.round(Math.max(...ts)) : null,
        lluvia: ps.length ? Math.round(Math.max(...ps)) : null,
        viento: ws.length ? Math.round(Math.max(...ws)) : null,
    };
}

function textoFranja(nombre, horas, datos) {
    if (!datos) return `${nombre} (${horas}): sin datos horarios.`;
    const temp = datos.min === null ? '' : (datos.min === datos.max ? `${datos.min}°C` : `${datos.min}–${datos.max}°C`);
    const lluvia = datos.lluvia === null ? '' : `, lluvia ${datos.lluvia}%`;
    const viento = datos.viento === null ? '' : `, viento hasta ${datos.viento} km/h`;
    return `${nombre} (${horas}): ${datos.condicion}${temp ? ', ' + temp : ''}${lluvia}${viento}.`;
}

function recomendacionPractica(franjas) {
    const validas = franjas.filter(Boolean);
    const lluvia = Math.max(...validas.map(f => f.lluvia ?? 0));
    const calor = Math.max(...validas.map(f => f.max ?? -100));
    const frio = Math.min(...validas.map(f => f.min ?? 100));
    const viento = Math.max(...validas.map(f => f.viento ?? 0));
    const acciones = [];
    if (lluvia >= 40) acciones.push('lleve paraguas o impermeable');
    if (calor >= 30) acciones.push('priorice hidratación y protección solar');
    else if (frio <= 15) acciones.push('lleve una capa de abrigo');
    if (viento >= 35 && acciones.length < 2) acciones.push('asegure objetos ligeros por el viento');
    return acciones.length ? acciones.slice(0, 2).join('; ') : 'no se requieren precauciones especiales';
}

// Respuesta determinista: conclusión, tres franjas del día y una recomendación.
function construirRespuestaClima(nombre, pais, f, fechaObjetivo, fechaLocal) {
    const lugar = pais ? `${nombre}, ${pais}` : nombre;
    const hourly = (f && f.hourly) || {};
    const manana = resumenFranja(hourly, fechaObjetivo, 6, 11);
    const tarde = resumenFranja(hourly, fechaObjetivo, 12, 17);
    const noche = resumenFranja(hourly, fechaObjetivo, 18, 23);
    if (!manana || !tarde || !noche) return { error: 'fallo_proveedor' };
    const franjas = [manana, tarde, noche];
    const min = Math.min(...franjas.map(x => x.min).filter(x => x !== null));
    const max = Math.max(...franjas.map(x => x.max).filter(x => x !== null));
    const lluvia = Math.max(...franjas.map(x => x.lluvia ?? 0));
    const etiqueta = etiquetaFecha(fechaObjetivo, fechaLocal);
    const conclusion = `${etiqueta}, en ${lugar} (horario local): ${lluvia >= 40 ? 'hay probabilidad relevante de lluvia' : 'la lluvia es poco probable'}, con ${min}–${max}°C.`;
    return { texto: [
        conclusion,
        textoFranja('Mañana', '06–11', manana),
        textoFranja('Tarde', '12–17', tarde),
        textoFranja('Noche', '18–23', noche),
        `Recomendación: ${recomendacionPractica(franjas)}.`,
    ].join('\n') };
}

// Devuelve { texto } o { error: 'ciudad_no_encontrada' | 'fallo_proveedor' }.
// No lanza: el caller traduce a mensaje humano. No guarda nada.
export async function consultarClima(env, ubicacion, opciones = {}) {
    // Defensa en profundidad: el Worker normaliza ANTES del geocoding igual que
    // el cliente, para no depender de él (comillas/apóstrofes/puntuación externos).
    const ubicacionLimpia = normalizarUbicacionClima(ubicacion);
    const q = encodeURIComponent(ubicacionLimpia);
    let geo;
    try {
        const r = await fetch(`${GEOCODING_URL}?name=${q}&count=5&language=es&format=json`);
        if (!r.ok) return { error: 'fallo_proveedor' };
        geo = await r.json();
    } catch {
        return { error: 'fallo_proveedor' };
    }
    const resultados = geo && Array.isArray(geo.results) ? geo.results : [];
    const partes = ubicacionLimpia.toLocaleLowerCase('es').split(',').map(x => x.trim()).filter(Boolean);
    const res = resultados.find(candidato => {
        const nombrePais = `${candidato.name || ''}, ${candidato.country || candidato.country_code || ''}`.toLocaleLowerCase('es');
        return partes.every(parte => nombrePais.includes(parte));
    }) || resultados[0];
    if (!res || res.latitude == null || res.longitude == null) return { error: 'ciudad_no_encontrada' };

    const nombre = res.name || ubicacionLimpia;
    const pais = res.country || res.country_code || '';

    let f;
    try {
        const fechaObjetivo = String(opciones.fecha || opciones.fechaLocal || '').trim();
        if (!fechaUtc(fechaObjetivo)) return { error: 'fecha_invalida' };
        const r2 = await fetch(`${FORECAST_URL}?latitude=${res.latitude}&longitude=${res.longitude}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${encodeURIComponent(fechaObjetivo)}&end_date=${encodeURIComponent(fechaObjetivo)}`);
        if (!r2.ok) return { error: 'fallo_proveedor' };
        f = await r2.json();
        return construirRespuestaClima(nombre, pais, f, fechaObjetivo, String(opciones.fechaLocal || fechaObjetivo));
    } catch {
        return { error: 'fallo_proveedor' };
    }
}

export const _internosClima = { mapearCondicion, construirRespuestaClima, CONDICIONES_WMO, normalizarUbicacionClima, etiquetaFecha, resumenFranja, recomendacionPractica, fechaUtc };
