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
```

---
