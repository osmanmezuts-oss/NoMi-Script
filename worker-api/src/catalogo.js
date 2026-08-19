// Catálogo estático de modelos disponibles vía este Worker.
// El futuro NoMi lo consultará en GET /v1/catalog; NO se hardcodea en el userscript.
// OpenRouter solo aparece como "experimental/no incluido" (sin ejecutar llamadas).

export const CATALOGO = [
    {
        proveedor: 'groq',
        id: 'openai/gpt-oss-120b',
        nombre: 'GPT-OSS 120B',
        estado: 'activo',
        calidad: 'Excelente calidad, recomendado para respuestas completas.',
        velocidad: 'Rápido',
        contexto: 128000,
        politica_consumo: 'Consume 1 crédito NoMi por token.',
        aviso: 'Recomendado.',
    },
    {
        proveedor: 'groq',
        id: 'openai/gpt-oss-20b',
        nombre: 'GPT-OSS 20B',
        estado: 'activo',
        calidad: 'Buen equilibrio calidad/velocidad.',
        velocidad: 'Muy rápido',
        contexto: 128000,
        politica_consumo: 'Consume 1 crédito NoMi por token.',
        aviso: 'Alternativa rápida.',
    },
    {
        proveedor: 'openrouter',
        id: 'openrouter/experimental',
        nombre: 'OpenRouter (catálogo ampliado)',
        estado: 'experimental',
        calidad: 'No incluido: solo referencia para el futuro.',
        velocidad: 'Variable',
        contexto: null,
        politica_consumo: 'No se ejecutan llamadas vía OpenRouter en esta fase.',
        aviso: 'Experimental / no incluido. No requiere clave OpenRouter.',
    },
];

export function modeloPermitido(id) {
    return CATALOGO.some(m => m.proveedor === 'groq' && m.id === id && m.estado === 'activo');
}

export function catalogoPublico() {
    return CATALOGO;
}
