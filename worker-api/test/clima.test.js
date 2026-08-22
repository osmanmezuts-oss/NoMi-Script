// Pruebas de la ruta de clima (herramienta) del Worker NoMi.
// El Worker autentica, resuelve la ciudad con Open-Meteo y consulta el forecast,
// SIN llamar a Groq ni consumir cuota/tokens de Groq. Límite diario 20/usuario.
// Sin llamadas reales: fetch global se sustituye por un stub de Open-Meteo.

import './setup-crypto.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { crearEnv } from './stubs.js';
import { BaseDatos } from '../src/db.js';
import { diaActual } from '../src/limites.js';

function envNuevo() { return crearEnv(); }

async function llamar(env, ruta, { metodo = 'GET', body, token } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const req = new Request('https://nomi-api.workers.dev' + ruta, {
        method: metodo, headers, body: body ? JSON.stringify(body) : undefined,
    });
    return worker.fetch(req, env);
}

async function crearInvitado(env) {
    const db = new BaseDatos(env.NOMI_DB, env.ACCESS_TOKEN_SECRET);
    const { codigo } = await db.crearInvitacion();
    const resp = await llamar(env, '/v1/activate', { metodo: 'POST', body: { codigo } });
    const data = await resp.json();
    return { token: data.token, db };
}

// Stub de Open-Meteo. Configurable por test vía el objeto `estado`.
function instalarFetchOpenMeteo(estado = {}) {
    globalThis.fetch = async (url) => {
        const u = String(url);
        if (u.includes('geocoding-api.open-meteo.com')) {
            if (estado.geoError) return new Response('err', { status: 500 });
            const results = estado.ciudadNoEncontrada ? [] : (estado.geoResults || [
                { name: 'Santa Cruz de la Sierra', country: 'Bolivia', country_code: 'BO', latitude: -17.78, longitude: -63.18 },
            ]);
            return new Response(JSON.stringify({ results }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (u.includes('api.open-meteo.com')) {
            if (estado.forecastError) return new Response('err', { status: 500 });
            if (estado.forecastLanza) throw new Error('red caída');
            return new Response(JSON.stringify(estado.forecast || {
                current: { temperature_2m: 25.3, weather_code: 1, wind_speed_10m: 12.0 },
                daily: {
                    time: ['2026-08-21'],
                    weather_code: [1],
                    temperature_2m_max: [30.0],
                    temperature_2m_min: [18.0],
                    precipitation_probability_max: [10],
                },
            }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        // Cualquier otra URL (p. ej. Groq) no debe llamarse en la ruta de clima.
        throw new Error('URL inesperada en ruta de clima: ' + u);
    };
}

const GEO_OK = { geoResults: [{ name: 'Santa Cruz de la Sierra', country: 'Bolivia', country_code: 'BO', latitude: -17.78, longitude: -63.18 }] };

test('clima NoMi devuelve respuesta breve sin Groq', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    instalarFetchOpenMeteo(GEO_OK);
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.ok, true);
    assert.equal(data.climaEstado, 'ok', 'señal explícita de clima correcto');
    assert.ok(data.respuesta.includes('Clima en Santa Cruz de la Sierra'), 'debe resolver la ciudad');
    assert.ok(data.respuesta.includes('°C'), 'debe incluir temperatura');
    assert.ok(/máx \d+°C \/ mín \d+°C/.test(data.respuesta), 'debe incluir máx/mín del día');
    // 2–4 líneas, determinista, sin relleno semanal.
    const lineas = data.respuesta.split('\n').filter(l => l.trim().length > 0);
    assert.ok(lineas.length >= 2 && lineas.length <= 4, 'respuesta de 2–4 líneas: ' + JSON.stringify(lineas));
    assert.ok(!/semana/i.test(data.respuesta), 'sin pronóstico semanal');
    // No consumió cuota mensual de Groq (la ruta no toca uso_mensual).
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 0, 'la ruta de clima no consume cuota mensual de Groq');
});

test('ciudad inexistente pide ciudad/país', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    instalarFetchOpenMeteo({ ciudadNoEncontrada: true });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Lugarquenexisteparatest' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.ok(/No encontré la ciudad/i.test(data.respuesta), 'mensaje humano de ciudad no encontrada');
    assert.ok(data.respuesta.includes('país'), 'pide ciudad y país');
    assert.equal(data.climaEstado, 'ciudad_no_encontrada', 'señal explícita de ciudad inexistente');
});

test('Open-Meteo 5xx y red devuelven mensaje sin fuga técnica', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    instalarFetchOpenMeteo({ ...GEO_OK, forecastError: true });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    let data = await r.json();
    assert.ok(/No se pudo consultar el clima ahora/i.test(data.respuesta), 'fallo 5xx: mensaje amable');
    assert.equal(data.climaEstado, 'fallo_proveedor', 'señal explícita de fallo temporal (5xx)');

    instalarFetchOpenMeteo({ ...GEO_OK, forecastLanza: true });
    const r2 = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    data = await r2.json();
    assert.ok(/No se pudo consultar el clima ahora/i.test(data.respuesta), 'fallo de red: mensaje amable');
    assert.equal(data.climaEstado, 'fallo_proveedor', 'señal explícita de fallo temporal (red)');
});

test('fallo de Open-Meteo NO consume el cupo diario de clima', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    // Forecast caído (5xx del proveedor): fallo técnico ajeno al usuario.
    instalarFetchOpenMeteo({ ...GEO_OK, forecastError: true });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.ok(/No se pudo consultar el clima/i.test(data.respuesta), 'mensaje humano de reintento');
    // El registro diario debe quedar liberado (rollback atómico).
    const usuario = await db.buscarPorToken(token);
    assert.equal(await db.contarConsultasClima(usuario.id, diaActual()), 0, 'el fallo del proveedor no consume cupo');
    // La consulta inmediatamente posterior funciona con cupo completo.
    instalarFetchOpenMeteo(GEO_OK);
    const r2 = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    assert.equal(r2.status, 200);
    assert.ok((await r2.json()).respuesta.includes('Clima en'), 'reintento tras fallo usa cupo normal');
});

test('límite diario: 20 permitidas, 21 rechazada; aislado de cuota/bolsa DO', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    instalarFetchOpenMeteo(GEO_OK);
    for (let i = 0; i < 20; i++) {
        const r = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
        });
        assert.equal(r.status, 200, 'las 20 primeras deben responder 200');
    }
    const r21 = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'clima', ubicacion: 'Santa Cruz de la Sierra' } },
    });
    assert.equal(r21.status, 200, 'la 21 sigue siendo 200 (mensaje humano, no error técnico)');
    const d21 = await r21.json();
    assert.ok(/límite de consultas de clima/i.test(d21.respuesta), '21ª: mensaje de límite diario');
    assert.ok(/20/.test(d21.respuesta), 'menciona el tope de 20');
    assert.equal(d21.climaEstado, 'limite_diario', 'señal explícita de límite diario');

    // Aislamiento: la cuota mensual de Groq sigue en 0 (no tocó uso/bolsa/DO).
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 0, 'clima no afecta uso mensual de Groq');
    const creditos = await db.obtenerCreditos();
    assert.equal(creditos.bolsa, 4200000, 'clima no afecta la bolsa global');
});

test('herramienta no soportada es rechazada', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    instalarFetchOpenMeteo(GEO_OK);
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'traducir', ubicacion: 'x' } },
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'parametros-invalidos');
});

test('WMO 67 mapea a lluvia helada fuerte', async () => {
    const { _internosClima } = await import('../src/clima.js');
    const cond = _internosClima.mapearCondicion(67);
    assert.ok(cond, 'WMO 67 debe tener condición (antes devolvía null por el valor 0)');
    assert.strictEqual(typeof cond, 'string');
    assert.ok(cond.length > 0, 'el texto no debe estar vacío');
    assert.strictEqual(cond, 'lluvia helada fuerte', 'WMO 67 → lluvia helada fuerte');
    // Assertion mínima directa sobre el mapeo WMO (tarea 3).
    assert.strictEqual(_internosClima.CONDICIONES_WMO[67], 'lluvia helada fuerte', 'mapeo directo WMO 67 → lluvia helada fuerte');
});

test('chat normal sin herramienta sigue vía Groq (no clima)', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    // Groq stub (la ruta normal NO es de clima).
    globalThis.fetch = async (url) => {
        assert.ok(url.includes('groq.com'), 'chat normal debe ir a Groq');
        return new Response(JSON.stringify({
            choices: [{ message: { content: 'Hola, soy NoMi.' } }],
            usage: { total_tokens: 12, prompt_tokens: 6, completion_tokens: 6 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.ok(data.respuesta.includes('Hola'), 'chat normal responde vía Groq');
});
