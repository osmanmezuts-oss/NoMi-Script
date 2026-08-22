// Pruebas de la ruta de búsqueda web NoMi (herramienta 'busqueda', Tavily SOLO
// en el Worker). El Worker autentica, aplica límite diario propio (20/día UTC,
// aislado de clima/cuota/bolsa/DO), llama a Tavily y SANEa los resultados
// (máx. 3, solo URLs http/https). Los fallos del proveedor revierten el cupo.
// Sin llamadas reales: fetch global se sustituye por un stub de Tavily.

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

// Stub de Tavily. Configurable por test vía `estado`. Registra las peticiones
// recibidas (para privacidad). Cualquier otra URL es un error de la prueba:
// la ruta de búsqueda NUNCA debe llamar a Groq ni a Open-Meteo.
function instalarFetchTavily(estado = {}) {
    globalThis.fetch = async (url, opts) => {
        const u = String(url);
        if (u.includes('api.tavily.com')) {
            if (estado.lanza) throw new Error('red caída');
            if (estado.errorStatus) return new Response('err', { status: estado.errorStatus });
            const results = estado.sinResultados ? [] : (estado.resultados || [
                { title: 'Resultado Uno', url: 'https://ejemplo.com/uno', content: 'Contenido útil uno.' },
                { title: 'Resultado Dos', url: 'https://ejemplo.com/dos', content: 'Contenido útil dos.' },
                { title: 'Resultado Tres', url: 'https://ejemplo.com/tres', content: 'Contenido útil tres.' },
            ]);
            estado.peticiones = estado.peticiones || [];
            let cuerpo = null;
            try { cuerpo = JSON.parse(opts.body); } catch { /* sin cuerpo */ }
            estado.peticiones.push({ url: u, cuerpo });
            return new Response(JSON.stringify({ results }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        throw new Error('URL inesperada en ruta de búsqueda (ni Groq ni Open-Meteo): ' + u);
    };
}

const RESULTADOS_OK = [
    { title: 'Resultado Uno', url: 'https://ejemplo.com/uno', content: 'Contenido útil uno.' },
    { title: 'Resultado Dos', url: 'https://ejemplo.com/dos', content: 'Contenido útil dos.' },
    { title: 'Resultado Tres', url: 'https://ejemplo.com/tres', content: 'Contenido útil tres.' },
];

test('busqueda NoMi devuelve hasta 3 resultados saneados sin Groq', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const estado = { resultados: RESULTADOS_OK };
    instalarFetchTavily(estado);
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'tiwanaku historia' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.ok, true);
    assert.equal(data.busquedaEstado, 'ok', 'señal explícita de búsqueda correcta');
    assert.ok(Array.isArray(data.resultados) && data.resultados.length === 3, 'máximo 3 resultados');
    data.resultados.forEach((res) => {
        assert.ok(/^https:\/\//.test(res.url), 'solo http/https');
        assert.ok(res.titulo && res.contenido, 'título y snippet presentes');
        assert.ok(res.titulo.length <= 70 && res.contenido.length <= 110, 'título ≤70 y snippet ≤110 (respuesta breve)');
    });
    // La clave Tavily del Worker NUNCA aparece en la respuesta.
    assert.ok(!JSON.stringify(data).includes('tavily-test'), 'sin secreto en la respuesta');
    // Aislamiento: cuota mensual de Groq, bolsa y DO intactos; sin marca de primer uso.
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 0, 'no afecta uso mensual de Groq');
    const creditos = await db.obtenerCreditos();
    assert.equal(creditos.bolsa, 4200000, 'no afecta la bolsa global');
    assert.equal(usuario.primer_uso_dia, null, 'no marca primer uso diario de Groq');
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 1, 'cupo de búsqueda consumido');
});

test('URLs no http/https del proveedor se descartan', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    instalarFetchTavily({ resultados: [
        { title: 'Malicioso', url: 'javascript:alert(1)', content: 'x' },
        { title: 'FTP', url: 'ftp://ejemplo.com/archivo', content: 'x' },
        { title: 'Valido', url: 'https://ejemplo.com/ok?q=1&utm=x#top', content: 'Contenido válido.' },
    ] });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'prueba saneado' } },
    });
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'ok');
    assert.equal(data.resultados.length, 1, 'solo la URL http/https sobrevive');
    assert.equal(data.resultados[0].url, 'https://ejemplo.com/ok', 'sin query ni hash');
});

test('sin resultados: mensaje humano y cupo consumido', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    instalarFetchTavily({ sinResultados: true });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'xyzabc sin nada' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'sin_resultados', 'señal explícita sin resultados');
    assert.ok(/No encontré resultados/i.test(data.respuesta), 'mensaje humano');
    const usuario = await db.buscarPorToken(token);
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 1, 'la petición llegó a Tavily: consume cupo');
});

test('límite diario: 20 permitidas, 21 rechazada; aislado de clima/Groq/bolsa', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    instalarFetchTavily({});
    for (let i = 0; i < 20; i++) {
        const r = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { herramienta: { tipo: 'busqueda', consulta: 'consulta ' + i } },
        });
        assert.equal(r.status, 200, 'las 20 primeras deben responder 200');
    }
    const r21 = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'consulta 21' } },
    });
    assert.equal(r21.status, 200, 'la 21 sigue siendo 200 (mensaje humano)');
    const d21 = await r21.json();
    assert.equal(d21.busquedaEstado, 'limite_diario', 'señal explícita de límite diario');
    assert.ok(/límite de búsquedas/i.test(d21.respuesta), 'mensaje de límite diario');
    const usuario = await db.buscarPorToken(token);
    const dia = diaActual();
    assert.equal(await db.contarConsultasBusqueda(usuario.id, dia), 20, 'contador de búsqueda en 20');
    assert.equal(await db.contarConsultasClima(usuario.id, dia), 0, 'aislado del contador de clima');
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 0, 'aislado de cuota mensual de Groq');
    const creditos = await db.obtenerCreditos();
    assert.equal(creditos.bolsa, 4200000, 'aislado de la bolsa global');
});

test('fallo Tavily (5xx/red/401/403/429) revierte cupo y permite reintento', async () => {
    const casos = [
        { etiqueta: '500', estado: { errorStatus: 500 } },
        { etiqueta: '401', estado: { errorStatus: 401 } },
        { etiqueta: '403', estado: { errorStatus: 403 } },
        { etiqueta: '429', estado: { errorStatus: 429 } },
        { etiqueta: 'red', estado: { lanza: true } },
    ];
    for (const caso of casos) {
        const env = envNuevo();
        const { token, db } = await crearInvitado(env);
        instalarFetchTavily(caso.estado);
        const r = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { herramienta: { tipo: 'busqueda', consulta: 'prueba fallo ' + caso.etiqueta } },
        });
        assert.equal(r.status, 200, caso.etiqueta + ': sigue siendo 200');
        const data = await r.json();
        assert.equal(data.busquedaEstado, 'fallo_proveedor', caso.etiqueta + ': señal explícita de fallo temporal');
        assert.ok(/No se pudo realizar la búsqueda/i.test(data.respuesta), caso.etiqueta + ': mensaje humano');
        const usuario = await db.buscarPorToken(token);
        assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 0, caso.etiqueta + ': cupo revertido');
        // La consulta inmediatamente siguiente funciona con cupo completo.
        instalarFetchTavily({});
        const r2 = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { herramienta: { tipo: 'busqueda', consulta: 'reintento tras ' + caso.etiqueta } },
        });
        const data2 = await r2.json();
        assert.equal(data2.busquedaEstado, 'ok', caso.etiqueta + ': reintento con cupo completo');
    }
});

test('límite de bytes de la consulta: 400 sin consumir cupo', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    instalarFetchTavily({});
    const consultaLarga = 'x'.repeat(1000); // > 600 bytes
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: consultaLarga } },
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'consulta-busqueda-invalida', 'código estable distinto del 400 de Worker antiguo');
    const usuario = await db.buscarPorToken(token);
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 0, 'no consume cupo si la validación falla');
});

test('privacidad: D1 no guarda consulta ni resultados', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    const estado = { resultados: RESULTADOS_OK };
    instalarFetchTavily(estado);
    await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'consulta privada 2026' } },
    });
    const filas = env.NOMI_DB._tablas.uso_busqueda_diario;
    assert.equal(filas.length, 1, 'una fila de contador');
    assert.deepEqual(Object.keys(filas[0]).sort(), ['dia', 'solicitudes', 'usuario_id'], 'solo recuento, sin query/resultados');
    const serializado = JSON.stringify(env.NOMI_DB._tablas);
    assert.ok(!serializado.includes('consulta privada'), 'la consulta no queda en D1');
    assert.ok(!serializado.includes('Resultado Uno'), 'los resultados no quedan en D1');
    // Tavily recibió la consulta como proveedor externo (esperado y reconocido).
    assert.equal(estado.peticiones.length, 1);
    assert.equal(estado.peticiones[0].cuerpo.query, 'consulta privada 2026', 'Tavily recibe la consulta');
    // La clave va solo en el header Authorization; nunca repetida en el cuerpo.
    assert.ok(!JSON.stringify(estado.peticiones[0].cuerpo).includes('tavily-test'), 'clave fuera del cuerpo');
});

test('respuesta realmente breve: títulos y snippets acotados en conjunto', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    const largo = 'Palabra '.repeat(60); // ~480 chars
    instalarFetchTavily({ resultados: RESULTADOS_OK.map((r0, i) => ({ title: 'Titulo largo '.repeat(20) + i, url: r0.url, content: largo })) });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'prueba brevedad' } },
    });
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'ok');
    let totalVisibles = 0;
    data.resultados.forEach((res) => {
        assert.ok(res.titulo.length <= 70, 'título ≤ 70');
        assert.ok(res.contenido.length <= 110, 'snippet ≤ 110');
        totalVisibles += res.titulo.length + res.contenido.length;
    });
    assert.ok(totalVisibles <= 600, 'títulos+snippets ≤ 600 chars visibles en conjunto: ' + totalVisibles);
});

test('timeout de Tavily (env TAVILY_TIMEOUT_MS) -> fallo_proveedor con rollback', async () => {
    const env = { ...crearEnv(), TAVILY_TIMEOUT_MS: 50 };
    const { token, db } = await crearInvitado(env);
    // Proveedor colgado: la promesa solo se rechaza cuando el Worker aborta.
    globalThis.fetch = async (url, opts) => new Promise((resolve, reject) => {
        if (opts && opts.signal) opts.signal.addEventListener('abort', () => reject(new Error('abort')));
    });
    const t0 = Date.now();
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'prueba timeout' } },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'fallo_proveedor', 'timeout tratado como fallo del proveedor');
    assert.ok(Date.now() - t0 < 5000, 'corta mucho antes del default de 10 s');
    const usuario = await db.buscarPorToken(token);
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 0, 'cupo revertido tras timeout');
});

test('sin token -> 401; herramienta inválida -> 400; chat normal sigue vía Groq', async () => {
    const env = envNuevo();
    instalarFetchTavily({});
    const rSinToken = await llamar(env, '/v1/chat', {
        metodo: 'POST',
        body: { herramienta: { tipo: 'busqueda', consulta: 'algo' } },
    });
    assert.equal(rSinToken.status, 401);
    const { token } = await crearInvitado(env);
    const rInvalida = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'traducir', consulta: 'x' } },
    });
    assert.equal(rInvalida.status, 400);
    // Chat normal intacto: va a Groq (el stub lanza si la ruta se cruza).
    globalThis.fetch = async (url) => {
        assert.ok(String(url).includes('groq.com'), 'chat normal debe ir a Groq');
        return new Response(JSON.stringify({
            choices: [{ message: { content: 'Hola, soy NoMi.' } }],
            usage: { total_tokens: 12, prompt_tokens: 6, completion_tokens: 6 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const rChat = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'hola' },
    });
    assert.equal(rChat.status, 200);
    assert.ok((await rChat.json()).respuesta.includes('Hola'));
});
