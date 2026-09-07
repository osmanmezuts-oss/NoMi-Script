// Pruebas de persistencia compatible con Userscripts/Safari y VM/TM.
// Ejecutar: node modules/test/run-nomi-persistencia.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..', '..');
const MOD = path.join(ROOT, 'modules');
const fuentes = [
    fs.readFileSync(path.join(MOD, 'nomi-config-estatica.js'), 'utf8'),
    fs.readFileSync(path.join(MOD, 'nomi-state.js'), 'utf8'),
    fs.readFileSync(path.join(MOD, 'nomi-persistencia.js'), 'utf8'),
    fs.readFileSync(path.join(MOD, 'nomi-red.js'), 'utf8'),
].join('\n');

function almacenamientoLocal(inicial = {}) {
    const datos = new Map(Object.entries(inicial));
    return {
        datos,
        api: {
            getItem: (k) => datos.has(k) ? datos.get(k) : null,
            setItem: (k, v) => datos.set(k, String(v)),
            removeItem: (k) => datos.delete(k),
        },
    };
}

function contextoModerno(host, globalStore, localInicial = {}) {
    const local = almacenamientoLocal(localInicial);
    const ctx = {
        console,
        Map,
        Promise,
        Date,
        setTimeout,
        Uint8Array,
        crypto: { randomUUID: () => 'uuid-test' },
        location: { hostname: host, pathname: '/' },
        localStorage: local.api,
        GM: {
            getValue: async (k, d) => globalStore.has(k) ? globalStore.get(k) : d,
            setValue: async (k, v) => { await Promise.resolve(); globalStore.set(k, v); },
            deleteValue: async (k) => { await Promise.resolve(); globalStore.delete(k); },
        },
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fuentes, ctx);
    return { ctx, local };
}

(async () => {
    const globalStore = new Map();

    // 1) Primera ejecución: migra el token/mode legacy del dominio actual a GM global.
    const tab1 = contextoModerno('youtube.com', globalStore, {
        nomi_token: JSON.stringify('TOKEN-IOS'),
        nomi_acceso_activo: JSON.stringify(true),
        nomi_modo_acceso: JSON.stringify('nomi'),
    });
    assert.strictEqual(await tab1.ctx.inicializarPersistencia(), true);
    assert.strictEqual(tab1.ctx.getNomiToken(), 'TOKEN-IOS');
    assert.strictEqual(tab1.ctx.getNomiAccesoActivo(), true);
    assert.strictEqual(tab1.ctx.getModoAcceso(), 'nomi');
    assert.strictEqual(globalStore.get('nomi_token'), 'TOKEN-IOS');
    assert.strictEqual(tab1.local.datos.has('nomi_token'), false, 'el token migrado se elimina del storage del sitio');

    // 2) Otra pestaña y otro dominio leen el mismo token sin reintroducir invitación.
    const tab2 = contextoModerno('example.org', globalStore);
    await tab2.ctx.inicializarPersistencia();
    assert.strictEqual(tab2.ctx.getNomiToken(), 'TOKEN-IOS');
    assert.strictEqual(tab2.ctx.getNomiAccesoActivo(), true);
    assert.strictEqual(tab2.ctx.getModoAcceso(), 'nomi');

    // 3) Las escrituras async actualizan caché y quedan confirmadas globalmente.
    tab2.ctx.setNomiToken('TOKEN-NUEVO');
    assert.strictEqual(tab2.ctx.getNomiToken(), 'TOKEN-NUEVO', 'la caché refleja el valor de inmediato');
    await tab2.ctx.esperarPersistenciaGlobal();
    assert.strictEqual(globalStore.get('nomi_token'), 'TOKEN-NUEVO');
    tab2.ctx.eliminarValor('nomi_token');
    await tab2.ctx.esperarPersistenciaGlobal();
    assert.strictEqual(globalStore.has('nomi_token'), false);

    // 4) Userscripts puede hacer peticiones con GM.xmlHttpRequest moderno.
    let urlModerna = '';
    tab2.ctx.GM.xmlHttpRequest = (detalles) => {
        urlModerna = detalles.url;
        setTimeout(() => detalles.onload({ status: 200, responseText: '{"ok":true}' }), 0);
        return Promise.resolve();
    };
    const respuestaRed = await tab2.ctx.hacerPeticion('https://example.org/api', { method: 'GET' });
    assert.strictEqual(urlModerna, 'https://example.org/api');
    assert.strictEqual(respuestaRed.ok, true);

    // 5) VM/TM legado conserva lectura/escritura síncrona.
    const legacyStore = new Map([['nomi_token', 'TOKEN-VM']]);
    const localLegacy = almacenamientoLocal();
    const legacy = {
        console, Map, Promise, Date, setTimeout, Uint8Array,
        crypto: { randomUUID: () => 'uuid-legacy' },
        location: { hostname: 'example.net', pathname: '/' },
        localStorage: localLegacy.api,
        GM_getValue: (k, d) => legacyStore.has(k) ? legacyStore.get(k) : d,
        GM_setValue: (k, v) => legacyStore.set(k, v),
        GM_deleteValue: (k) => legacyStore.delete(k),
    };
    legacy.window = legacy;
    vm.createContext(legacy);
    vm.runInContext(fuentes, legacy);
    assert.strictEqual(legacy.getNomiToken(), 'TOKEN-VM');
    legacy.setNomiToken('TOKEN-VM-2');
    assert.strictEqual(legacy.getNomiToken(), 'TOKEN-VM-2');
    assert.strictEqual(legacyStore.get('nomi_token'), 'TOKEN-VM-2');

    console.log('OK: persistencia global compatible con Userscripts/Safari y VM/TM');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
