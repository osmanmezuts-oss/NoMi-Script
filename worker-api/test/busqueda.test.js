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
        assert.ok(res.titulo.length <= 70 && res.contenido.length <= 110, 'ruta heredada conserva título ≤70 y snippet ≤110');
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
        { title: 'Duplicado', url: 'https://ejemplo.com/ok?otra=1', content: 'Contenido repetido.' },
        { title: 'Sin evidencia', url: 'https://ejemplo.com/vacio', content: '   ' },
    ] });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { herramienta: { tipo: 'busqueda', consulta: 'prueba saneado' } },
    });
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'ok');
    assert.equal(data.resultados.length, 1, 'solo sobrevive una fuente segura, única y con evidencia');
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
    assert.ok(/No encontré fuentes útiles/i.test(data.respuesta), 'mensaje humano');
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
        assert.ok(/No se pudo consultar la web/i.test(data.respuesta), caso.etiqueta + ': mensaje humano');
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

test('evidencia interna acotada para síntesis', async () => {
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
        assert.ok(res.titulo.length <= 70, 'título legado ≤ 70');
        assert.ok(res.contenido.length <= 110, 'snippet legado ≤ 110');
        assert.ok(new TextEncoder().encode(res.titulo).length <= 140, 'título legado UTF-8 acotado');
        assert.ok(new TextEncoder().encode(res.contenido).length <= 220, 'snippet legado UTF-8 acotado');
        totalVisibles += res.titulo.length + res.contenido.length;
    });
    assert.ok(totalVisibles <= 540, 'salida heredada acotada a 540 chars: ' + totalVisibles);
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

// Stub secuencial del flujo nuevo: Groq decide -> Tavily -> Groq sintetiza.
// Registra cuerpos para comprobar contrato, límites y ausencia de fugas.
function instalarFetchSemantico(config = {}) {
    const estado = { groq: [], tavily: [], urls: [] };
    let indiceGroq = 0;
    globalThis.fetch = async (url, opts = {}) => {
        const u = String(url);
        estado.urls.push(u);
        if (u.includes('groq.com')) {
            const cuerpo = JSON.parse(opts.body || '{}');
            estado.groq.push(cuerpo);
            const definida = (config.groq || [])[indiceGroq++] || { texto: 'Respuesta normal.', total: 10 };
            if (definida.status) return new Response('error Groq', { status: definida.status });
            const message = definida.toolCalls
                ? { content: definida.texto ?? null, tool_calls: definida.toolCalls }
                : { content: definida.texto || '' };
            return new Response(JSON.stringify({
                choices: [{ message, finish_reason: definida.finishReason || 'stop' }],
                usage: { total_tokens: definida.total || 10, prompt_tokens: 5, completion_tokens: Math.max(0, (definida.total || 10) - 5) },
            }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (u.includes('api.tavily.com')) {
            const cuerpo = JSON.parse(opts.body || '{}');
            estado.tavily.push(cuerpo);
            if (config.tavilyLanza) throw new Error('red Tavily');
            if (config.tavilyStatus) return new Response('error', { status: config.tavilyStatus });
            return new Response(JSON.stringify({ results: config.resultados || RESULTADOS_OK }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }
        throw new Error('URL inesperada en flujo semántico: ' + u);
    };
    return estado;
}

function toolBusqueda(argumentos, id = 'call_busqueda_1') {
    return [{
        id,
        type: 'function',
        function: { name: 'busqueda_web', arguments: JSON.stringify(argumentos) },
    }];
}

test('decisión semántica: chat estable responde con una Groq y cero Tavily', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const estado = instalarFetchSemantico({ groq: [{ texto: 'La fotosíntesis convierte luz en energía química.', total: 13 }] });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'Explícame la fotosíntesis', permitirBusqueda: true },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.match(data.respuesta, /fotosíntesis/i);
    assert.equal(data.busquedaProtocolo, 1, 'señal estable incluso cuando no hizo falta buscar');
    assert.equal(data.busquedaEstado, undefined, 'sin estado web cuando el modelo no busca');
    assert.equal(estado.groq.length, 1, 'una sola llamada Groq');
    assert.equal(estado.tavily.length, 0, 'cero Tavily');
    assert.equal(estado.groq[0].tool_choice, 'auto');
    assert.equal(estado.groq[0].parallel_tool_calls, false);
    assert.equal(estado.groq[0].tools[0].function.name, 'busqueda_web');
    assert.match(estado.groq[0].messages[0].content, /significado, la intención y el contexto/i, 'la decisión no depende de palabras clave');
    assert.match(estado.groq[0].messages[0].content, /datos no confiables/i, 'historial y página no pueden inyectar instrucciones');
    const usuario = await db.buscarPorToken(token);
    assert.equal((await db.obtenerUso(usuario.id)).solicitudes, 1, 'una petición Groq contabilizada');
});

test('decisión semántica: Groq busca y sintetiza con tema, recencia y fuentes compactas', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const consulta = 'noticias económicas de Santa Cruz de la Sierra Bolivia hoy';
    const estado = instalarFetchSemantico({
        groq: [
            { toolCalls: toolBusqueda({ consulta, tema: 'news', recencia: 'day' }), total: 30 },
            { texto: 'La actividad económica regional tuvo dos novedades relevantes [1] [2]', total: 40 },
        ],
        resultados: [
            { title: 'Economía cruceña', url: 'https://medio.bo/nota?utm_source=x#parte', content: 'Datos económicos recientes de Santa Cruz.', published_date: '2026-09-04' },
            { title: 'Sector productivo', url: 'https://otro.bo/economia', content: 'El sector productivo informó novedades.', published_date: '2026-09-04' },
        ],
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: {
            modelo: 'openai/gpt-oss-120b',
            mensaje: 'Historial reciente:\nUsuario: noticias económicas en Santa Cruz\nAsistente: ¿Qué aspecto?\n\nPregunta del usuario: tienen que ser actuales',
            permitirBusqueda: true,
        },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'ok');
    assert.equal(data.busquedaProtocolo, 1);
    assert.match(data.respuesta, /económica/i, 'entrega síntesis, no dump de Tavily');
    assert.deepEqual(data.fuentes.map(f => f.url), ['https://medio.bo/nota', 'https://otro.bo/economia']);
    assert.ok(data.fuentes.every(f => !Object.hasOwn(f, 'contenido')), 'el cliente no recibe snippets');
    assert.equal(estado.groq.length, 2, 'dos llamadas Groq');
    assert.equal(estado.tavily.length, 1, 'una llamada Tavily');
    assert.equal(estado.tavily[0].query, consulta, 'consulta autosuficiente conserva tema y lugar');
    assert.equal(estado.tavily[0].topic, 'news');
    assert.equal(estado.tavily[0].time_range, 'day');
    assert.ok(!estado.groq[1].tools, 'segunda llamada sin tools: no hay bucle infinito');
    assert.equal(estado.groq[0].reasoning_effort, 'low', 'decisión web deja presupuesto para la herramienta');
    assert.equal(estado.groq[0].reasoning_format, 'hidden', 'tool calling oculta razonamiento interno');
    assert.equal(estado.groq[1].max_tokens, 640, 'síntesis con margen para una respuesta terminada');
    assert.equal(estado.groq[1].reasoning_effort, 'low', 'síntesis breve evita agotar el presupuesto razonando');
    assert.match(estado.groq[1].messages[0].content, /máximo 160 palabras/i, 'la instrucción limita la extensión');
    assert.match(estado.groq[1].messages[1].content, /Datos económicos recientes/, 'la síntesis recibe evidencia saneada');

    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 70, 'suma usage real de ambas llamadas Groq');
    assert.equal(uso.solicitudes, 2, 'contabiliza ambas peticiones Groq');
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 1, 'una búsqueda diaria');
    const snap = await (await env.RATE_LIMITER.get('global').fetch('https://internal/snapshot', { method: 'GET' })).json();
    assert.equal(snap.tokens_dia, 70, 'DO concilia la suma real de ambas llamadas');
    assert.equal(snap.solicitudes_dia, 2, 'DO contabiliza ambas llamadas');
    const persistido = JSON.stringify(env.NOMI_DB._tablas);
    assert.ok(!persistido.includes(consulta), 'D1 no guarda consulta');
    assert.ok(!persistido.includes('Datos económicos recientes'), 'D1 no guarda evidencia');
});

test('síntesis con texto Unicode permanece dentro del presupuesto Groq', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    const consulta = '😀'.repeat(150); // 300 unidades JS, 600 bytes UTF-8
    const estado = instalarFetchSemantico({
        groq: [
            { toolCalls: toolBusqueda({ consulta }), total: 15 },
            { texto: 'Síntesis Unicode verificada con evidencia [1].', total: 16 },
        ],
        resultados: [0, 1, 2].map(i => ({
            title: '😀'.repeat(45),
            url: 'https://unicode.example/' + i,
            content: '😀'.repeat(150),
            published_date: '😀'.repeat(20),
        })),
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: '😀'.repeat(250), permitirBusqueda: true },
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).busquedaEstado, 'ok');
    const promptSintesis = estado.groq[1].messages[1].content;
    assert.ok(new TextEncoder().encode(promptSintesis).length <= 5000, 'evidencia Unicode no desborda la segunda llamada');
});

test('preferencia apagada no ofrece tools ni llama Tavily', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    const estado = instalarFetchSemantico({ groq: [{ texto: 'Respuesta sin navegación.', total: 12 }] });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: '¿Qué pasó hoy?', permitirBusqueda: false },
    });
    assert.equal(r.status, 200);
    assert.equal(estado.groq.length, 1);
    assert.equal(estado.tavily.length, 0);
    assert.equal(estado.groq[0].tools, undefined, 'no se ofrecen herramientas');
    assert.equal(estado.groq[0].tool_choice, undefined);
});

test('búsqueda forzada obliga una herramienta sin depender de palabras ni preferencia', async () => {
    const env = envNuevo();
    const { token } = await crearInvitado(env);
    const estado = instalarFetchSemantico({
        groq: [
            { toolCalls: toolBusqueda({ consulta: 'dato exacto a verificar' }), total: 11 },
            { texto: 'Dato verificado con la fuente [1].', total: 12 },
        ],
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: {
            modelo: 'openai/gpt-oss-20b',
            mensaje: 'Comprueba esto',
            permitirBusqueda: false,
            forzarBusqueda: true,
        },
    });
    const data = await r.json();
    assert.equal(r.status, 200);
    assert.equal(data.busquedaEstado, 'ok');
    assert.equal(data.busquedaProtocolo, 1);
    assert.equal(estado.tavily.length, 1, 'una búsqueda obligatoria');
    assert.deepEqual(estado.groq[0].tool_choice, {
        type: 'function',
        function: { name: 'busqueda_web' },
    });
});

test('tool call inválida o múltiple no ejecuta Tavily', async () => {
    const casos = [
        [{ id: 'x', type: 'function', function: { name: 'otra_funcion', arguments: '{}' } }],
        [...toolBusqueda({ consulta: 'consulta uno' }, 'a'), ...toolBusqueda({ consulta: 'consulta dos' }, 'b')],
        [{ id: 'x', type: 'function', function: { name: 'busqueda_web', arguments: '{json roto' } }],
        toolBusqueda({ consulta: 'consulta', campo_no_permitido: 'x' }),
    ];
    for (const toolCalls of casos) {
        const env = envNuevo();
        const { token } = await crearInvitado(env);
        const estado = instalarFetchSemantico({ groq: [{ toolCalls, total: 9 }] });
        const r = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { modelo: 'openai/gpt-oss-20b', mensaje: 'consulta', permitirBusqueda: true },
        });
        assert.equal(r.status, 200);
        assert.equal((await r.json()).busquedaEstado, 'consulta_invalida');
        assert.equal(estado.tavily.length, 0, 'Tavily no se ejecuta con tool call inválida');
    }
});

test('fallo Tavily semántico conserva solo el primer uso Groq y revierte cupo web', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const estado = instalarFetchSemantico({
        groq: [{ toolCalls: toolBusqueda({ consulta: 'noticias Bolivia hoy', tema: 'news', recencia: 'day' }), total: 17 }],
        tavilyStatus: 503,
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'Cuéntame qué está pasando', permitirBusqueda: true },
    });
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'fallo_proveedor');
    assert.equal(estado.groq.length, 1, 'no intenta síntesis sin evidencia');
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 17, 'la decisión Groq sí se contabiliza');
    assert.equal(uso.solicitudes, 1);
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 0, 'cupo web revertido');
});

test('fallo de síntesis Groq mantiene acotado el uso Tavily y contabiliza los dos intentos', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const estado = instalarFetchSemantico({
        groq: [
            { toolCalls: toolBusqueda({ consulta: 'noticias verificadas Bolivia' }), total: 19 },
            { status: 503 },
        ],
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-20b', mensaje: 'Dame la actualización', permitirBusqueda: true },
    });
    assert.equal(r.status, 200, 'el fallo posterior conserva un mensaje recuperable');
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'fallo_sintesis');
    assert.equal(data.busquedaProtocolo, 1);
    assert.match(data.respuesta, /no pude preparar la respuesta/i);
    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(estado.groq.length, 2, 'la decisión y el intento de síntesis llegaron a Groq');
    assert.equal(uso.tokens, 19, 'solo se cobran tokens reales devueltos por Groq');
    assert.equal(uso.solicitudes, 2, 'ambos intentos al proveedor cuentan como solicitudes');
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()), 1, 'Tavily respondió: consume cupo y evita reintentos externos ilimitados');
});

test('síntesis truncada o fragmentaria no muestra enlaces sin respuesta y permite reintento', async () => {
    for (const salida of [
        { texto: '**Noticias de', finishReason: 'length' },
        { texto: '**Noticias de', finishReason: 'stop' },
    ]) {
        const env = envNuevo();
        const { token } = await crearInvitado(env);
        const estado = instalarFetchSemantico({
            groq: [
                { toolCalls: toolBusqueda({ consulta: 'noticias Santa Cruz hoy', tema: 'news', recencia: 'day' }), total: 18 },
                { ...salida, total: 20 },
            ],
        });
        const r = await llamar(env, '/v1/chat', {
            metodo: 'POST', token,
            body: { modelo: 'openai/gpt-oss-20b', mensaje: '¿Qué noticias hay hoy en Santa Cruz?', permitirBusqueda: true },
        });
        const data = await r.json();
        assert.equal(data.busquedaEstado, 'fallo_sintesis');
        assert.match(data.respuesta, /no pude preparar la respuesta/i);
        assert.equal(data.fuentes, undefined, 'un fragmento no se acompaña de enlaces como si fuera respuesta');
        assert.equal(estado.groq.length, 2);
    }
});
test('búsqueda exitosa: exactamente 1 Tavily + 2 Groq, sin groq/compound ni búsqueda nativa', async () => {
    const env = envNuevo();
    const { token, db } = await crearInvitado(env);
    const estado = instalarFetchSemantico({
        groq: [
            { toolCalls: toolBusqueda({ consulta: 'novedades de inteligencia artificial hoy', tema: 'news', recencia: 'day' }), total: 20 },
            { texto: 'Resumen con evidencia [1] [2].', total: 25 },
        ],
    });
    const r = await llamar(env, '/v1/chat', {
        metodo: 'POST', token,
        body: { modelo: 'openai/gpt-oss-120b', mensaje: 'Cuéntame las novedades de IA hoy', permitirBusqueda: true },
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.busquedaEstado, 'ok');
    assert.equal(data.busquedaProtocolo, 1);

    // Flujo exacto: Groq decisión -> Tavily -> Groq síntesis.
    assert.equal(estado.groq.length, 2, 'exactamente dos llamadas Groq');
    assert.equal(estado.tavily.length, 1, 'exactamente una llamada Tavily');
    assert.ok(estado.urls[0].includes('groq.com'), '1ª llamada: Groq (decisión semántica)');
    assert.ok(estado.urls[1].includes('api.tavily.com'), '2ª llamada: Tavily');
    assert.ok(estado.urls[2].includes('groq.com'), '3ª llamada: Groq (síntesis)');
    assert.equal(estado.urls.length, 3, 'ninguna llamada extra (sin buscador nativo ni duplicados)');

    // Modelos permitidos: nunca groq/compound ni búsqueda web nativa.

    for (const cuerpo of estado.groq) {
        assert.notEqual(cuerpo.model, 'groq/compound', 'no usa groq/compound');
        assert.match(cuerpo.model, /^openai\/gpt-oss-(20b|120b)$/, 'solo modelos de la allowlist Groq');
    }
    // El stub lanza para cualquier URL distinta a Groq chat completions o Tavily,
    // de modo que esta aserción adicional confirma que no hubo búsqueda nativa.

    assert.ok(estado.urls.every(u => u.includes('groq.com') || u.includes('api.tavily.com')), 'solo chat completions de Groq y Tavily: cero búsqueda web nativa de Groq');

    const usuario = await db.buscarPorToken(token);
    const uso = await db.obtenerUso(usuario.id);
    assert.equal(uso.tokens, 45, 'suma el usage real de ambas llamadas Groq');
    assert.equal(uso.solicitudes, 2);
    assert.equal(await db.contarConsultasBusqueda(usuario.id, diaActual()),  1, 'una búsqueda diaria contabilizada');
});
