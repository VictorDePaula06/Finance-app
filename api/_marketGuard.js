/**
 * Helpers de validação de entrada para as APIs de mercado (F-07).
 * Arquivos iniciados com "_" não são tratados como rotas pela Vercel.
 *
 * Objetivo: impedir abuso/amplificação (muitos símbolos por request) e
 * entradas malformadas que poderiam ser usadas para manipular as URLs
 * dos provedores externos.
 */

// Máximo de símbolos processados por request (fan-out de fetches externos).
export const MAX_SYMBOLS = 25;

// Tickers válidos: letras, dígitos e os caracteres usados por índices/commodities
// (ex.: ^BVSP, GC=F, XAUUSD=X, S&P500, PETR4.SA, BRK-B). Tamanho limitado.
const TICKER_RE = /^[A-Z0-9.^=&-]{1,15}$/;

export function isValidTicker(t) {
    return typeof t === 'string' && TICKER_RE.test(t);
}

/**
 * Constrói pares {sym, meta} alinhados por índice (ex.: ticker+tipo, símbolo+grupo),
 * descartando símbolos inválidos e limitando a quantidade total.
 */
export function sanitizePairs(rawSyms, rawMetas, metaDefault, max = MAX_SYMBOLS) {
    const syms = String(rawSyms || '').split(',').map(s => s.trim().toUpperCase());
    const metas = String(rawMetas || '').split(',').map(s => s.trim().toLowerCase());
    const pairs = [];
    for (let i = 0; i < syms.length; i++) {
        if (!isValidTicker(syms[i])) continue;
        pairs.push({ sym: syms[i], meta: metas[i] || metaDefault });
        if (pairs.length >= max) break;
    }
    return pairs;
}
