/**
 * Vercel Serverless Function: /api/tesouro
 * Fetches live Tesouro Direto bond prices server-side.
 *
 * Strategy chain (each one is tried in order, first success wins):
 *  1. Tesouro Direto official JSON API (smallest, freshest — intraday)
 *  2. Tesouro Transparente CSV (daily updated, government open data)
 *  3. Hardcoded fallback (last-known rates)
 *
 * IMPORTANT: We read **Taxa de Venda** (the rate at which Tesouro sells to
 * investors, i.e. what the investor sees on the buy screen). Reading "Taxa
 * Compra" gives a different number — that bug caused the displayed rate to
 * not match what the user sees on tesourodireto.com.br.
 */

export const config = {
    maxDuration: 25, // give the function room to fetch + parse the CSV
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Cache for 15 min on the edge, allow stale for 1h while revalidating
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ---------------------------------------------------------------------
    // Strategy 1: Tesouro Direto official JSON API
    // ---------------------------------------------------------------------
    try {
        const jsonBonds = await fetchFromTesouroJsonApi();
        if (jsonBonds && jsonBonds.length > 0) {
            return res.status(200).json({
                bonds: jsonBonds,
                source: 'tesouro_direto_json',
                count: jsonBonds.length,
                refDate: new Date().toLocaleDateString('pt-BR'),
                fetchedAt: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.warn('[Tesouro API] JSON API failed:', e.message);
    }

    // ---------------------------------------------------------------------
    // Strategy 2: Tesouro Transparente CSV
    // ---------------------------------------------------------------------
    try {
        const csvResult = await fetchFromCsv();
        if (csvResult && csvResult.bonds.length > 0) {
            return res.status(200).json({
                bonds: csvResult.bonds,
                source: 'official_csv',
                count: csvResult.bonds.length,
                refDate: csvResult.refDate,
                fetchedAt: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.warn('[Tesouro API] CSV strategy failed:', e.message);
    }

    // ---------------------------------------------------------------------
    // Strategy 3: Fallback
    // ---------------------------------------------------------------------
    console.warn('[Tesouro API] All live sources failed, using fallback');
    return res.status(200).json({
        bonds: getFallbackBonds(),
        source: 'fallback',
        count: getFallbackBonds().length,
        refDate: 'aproximado',
        fetchedAt: new Date().toISOString(),
    });
}

// =====================================================================
// Strategy 1: Tesouro Direto JSON API
// =====================================================================
async function fetchFromTesouroJsonApi() {
    const url = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';

    const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Referer': 'https://www.tesourodireto.com.br/',
            'Origin': 'https://www.tesourodireto.com.br',
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const list = data?.response?.TrsrBondPricLogList;
    if (!Array.isArray(list)) return null;

    // The JSON wraps each item in `{ TrsrBond: { ... } }`. Normalize to the
    // shape the client already understands.
    return list
        .map(item => item.TrsrBond)
        .filter(b => b && b.nm && typeof b.anulRentPrcnt !== 'undefined')
        .map(b => ({
            nm: b.nm,
            anulRentPrcnt: parseFloat(b.anulRentPrcnt),
            untrPric: parseFloat(b.untrPric || b.untrInvstmtVal || 0),
            mtrtyDt: b.mtrtyDt || null,
            semiAnulIntrstInd: !!b.semiAnulIntrstInd,
            currencyType: b.currencyType || 'BRL',
        }));
}

// =====================================================================
// Strategy 2: CSV (Tesouro Transparente / Open Data)
// =====================================================================
async function fetchFromCsv() {
    const csvUrl =
        'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';

    const response = await fetch(csvUrl, {
        signal: AbortSignal.timeout(18000),
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AliviaFinance/1.0; +https://alivia.app)',
            'Accept': 'text/csv, text/plain, */*',
        },
    });

    if (!response.ok) {
        throw new Error(`CSV fetch HTTP ${response.status}`);
    }

    const txtRaw = await response.text();
    // Remove BOM if present and handle CRLF
    const txt = txtRaw.replace(/^﻿/, '').replace(/\r/g, '');
    const lines = txt.split('\n');

    if (lines.length < 2) {
        throw new Error('CSV is empty');
    }

    // Parse header to find the correct columns by name (resilient to reordering)
    const header = lines[0].split(';').map(h => h.trim().toLowerCase());
    const idx = {
        type: header.findIndex(h => h.startsWith('tipo')),
        venc: header.findIndex(h => h.startsWith('data vencimento')),
        base: header.findIndex(h => h.startsWith('data base')),
        // We want "Taxa Venda" (rate Tesouro sells to investor = rate shown on the site)
        taxaVenda: header.findIndex(h => h.startsWith('taxa venda')),
        taxaCompra: header.findIndex(h => h.startsWith('taxa compra')),
        puVenda: header.findIndex(h => h.startsWith('pu venda')),
        puCompra: header.findIndex(h => h.startsWith('pu compra')),
    };

    // Fall back to positional indices if header parsing failed
    if (idx.type === -1) idx.type = 0;
    if (idx.venc === -1) idx.venc = 1;
    if (idx.base === -1) idx.base = 2;
    if (idx.taxaCompra === -1) idx.taxaCompra = 3;
    if (idx.taxaVenda === -1) idx.taxaVenda = 4;
    if (idx.puCompra === -1) idx.puCompra = 5;
    if (idx.puVenda === -1) idx.puVenda = 6;

    // Step 1: Find the latest "Data Base" in the CSV
    let maxDate = 0;
    let maxDateStr = '';
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');
        if (parts.length < 7) continue;
        const dateStr = (parts[idx.base] || '').trim();
        if (!dateStr) continue;
        const [d, m, y] = dateStr.split('/');
        if (!d || !m || !y) continue;
        const time = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)).getTime();
        if (time > maxDate) {
            maxDate = time;
            maxDateStr = dateStr;
        }
    }

    if (!maxDateStr) {
        throw new Error('No valid dates found in CSV');
    }

    // Step 2: Parse bonds for that latest date — use Taxa Venda (rate investor receives when buying)
    const bonds = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');
        if (parts.length < 7) continue;
        if ((parts[idx.base] || '').trim() !== maxDateStr) continue;

        const type = (parts[idx.type] || '').trim();
        const venc = (parts[idx.venc] || '').trim();

        // Prefer Taxa Venda (what investor sees), fallback to Taxa Compra if missing
        const taxaRaw = (parts[idx.taxaVenda] || parts[idx.taxaCompra] || '').replace(',', '.').trim();
        const puRaw = (parts[idx.puVenda] || parts[idx.puCompra] || '').replace(',', '.').trim();

        const taxa = parseFloat(taxaRaw);
        const pu = parseFloat(puRaw);
        if (!isFinite(taxa) || !type || !venc) continue;

        const [d, m, y] = venc.split('/');
        const year = parseInt(y, 10);
        if (!isFinite(year)) continue;

        let name;
        const semiAnulIntrstInd = type.includes('Juros Semestrais');

        // Map to short names used on tesourodireto.com.br
        if (type === 'Tesouro Renda+ Aposentadoria Extra') {
            // Renda+ has a 20-year payment phase; the listing year is (maturity - 19)
            name = `Tesouro RendA+ ${year - 19}`;
        } else if (type.includes('Tesouro Educa+')) {
            name = `Tesouro Educa+ ${year}`;
        } else {
            name = `${type} ${year}`;
        }

        bonds.push({
            nm: name,
            anulRentPrcnt: taxa,
            untrPric: pu,
            mtrtyDt: `${y}-${m}-${d}`,
            semiAnulIntrstInd,
            currencyType: 'BRL',
        });
    }

    // Deduplicate (CSV can have multiple rows for same bond/date in edge cases)
    const seen = new Set();
    const unique = bonds.filter(b => {
        if (seen.has(b.nm)) return false;
        seen.add(b.nm);
        return true;
    });

    return { bonds: unique, refDate: maxDateStr };
}

// =====================================================================
// Strategy 3: Fallback — last-known rates (May 2026 reference).
// Updated periodically when live sources have been down for too long.
// =====================================================================
function getFallbackBonds() {
    return [
        // Selic
        { nm: 'Tesouro Selic 2029', anulRentPrcnt: 0.05, untrPric: 18892.85 },
        { nm: 'Tesouro Selic 2028', anulRentPrcnt: 0.02, untrPric: 18910.93 },
        { nm: 'Tesouro Selic 2027', anulRentPrcnt: 0.0, untrPric: 18916.44 },
        { nm: 'Tesouro Selic 2031', anulRentPrcnt: 0.08, untrPric: 18842.4 },

        // Prefixado
        { nm: 'Tesouro Prefixado 2031', anulRentPrcnt: 13.78, untrPric: 549.71 },
        { nm: 'Tesouro Prefixado 2029', anulRentPrcnt: 13.74, untrPric: 711.22 },
        { nm: 'Tesouro Prefixado 2032', anulRentPrcnt: 13.84, untrPric: 481.7 },
        { nm: 'Tesouro Prefixado 2028', anulRentPrcnt: 13.74, untrPric: 807.29 },
        { nm: 'Tesouro Prefixado 2027', anulRentPrcnt: 13.88, untrPric: 916.99 },

        // IPCA+
        { nm: 'Tesouro IPCA+ 2035', anulRentPrcnt: 7.4, untrPric: 2472.6 },
        { nm: 'Tesouro IPCA+ 2026', anulRentPrcnt: 9.09, untrPric: 4574.67 },
        { nm: 'Tesouro IPCA+ 2050', anulRentPrcnt: 7.07, untrPric: 910.35 },
        { nm: 'Tesouro IPCA+ 2032', anulRentPrcnt: 7.64, untrPric: 2961.37 },
        { nm: 'Tesouro IPCA+ 2040', anulRentPrcnt: 7.09, untrPric: 1773.01 },
        { nm: 'Tesouro IPCA+ 2045', anulRentPrcnt: 6.98, untrPric: 1309.27 },

        // IPCA+ com Juros Semestrais
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2035', anulRentPrcnt: 7.47, untrPric: 4399.98 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2030', anulRentPrcnt: 7.82, untrPric: 4463.94 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2040', anulRentPrcnt: 7.23, untrPric: 4270.2 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2050', anulRentPrcnt: 7.1, untrPric: 4190.97 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2026', anulRentPrcnt: 9.09, untrPric: 4709.91 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2060', anulRentPrcnt: 7.27, untrPric: 4075.43 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2045', anulRentPrcnt: 7.14, untrPric: 4300.99 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2055', anulRentPrcnt: 7.09, untrPric: 4230.13 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2037', anulRentPrcnt: 7.39, untrPric: 4363.11 },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2032', anulRentPrcnt: 7.67, untrPric: 4386.28 },

        // Prefixado com Juros Semestrais
        { nm: 'Tesouro Prefixado com Juros Semestrais 2035', anulRentPrcnt: 13.89, untrPric: 851 },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2031', anulRentPrcnt: 13.87, untrPric: 911.3 },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2029', anulRentPrcnt: 13.75, untrPric: 956.79 },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2033', anulRentPrcnt: 13.91, untrPric: 875.78 },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2027', anulRentPrcnt: 13.95, untrPric: 1009.14 },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2037', anulRentPrcnt: 13.89, untrPric: 830.91 },

        // RendA+ (rates updated May 2026 — closer to current market)
        { nm: 'Tesouro RendA+ 2030', anulRentPrcnt: 7.42, untrPric: 1946.92 },
        { nm: 'Tesouro RendA+ 2035', anulRentPrcnt: 7.27, untrPric: 1395.42 },
        { nm: 'Tesouro RendA+ 2040', anulRentPrcnt: 7.17, untrPric: 1004.17 },
        { nm: 'Tesouro RendA+ 2045', anulRentPrcnt: 7.11, untrPric: 722.42 },
        { nm: 'Tesouro RendA+ 2050', anulRentPrcnt: 7.09, untrPric: 516.51 },
        { nm: 'Tesouro RendA+ 2055', anulRentPrcnt: 7.09, untrPric: 367.47 },
        { nm: 'Tesouro RendA+ 2060', anulRentPrcnt: 7.09, untrPric: 261.41 },
        { nm: 'Tesouro RendA+ 2065', anulRentPrcnt: 7.09, untrPric: 185.99 },

        // Educa+
        { nm: 'Tesouro Educa+ 2027', anulRentPrcnt: 7.88, untrPric: 3755.74 },
        { nm: 'Tesouro Educa+ 2028', anulRentPrcnt: 7.85, untrPric: 3486.72 },
        { nm: 'Tesouro Educa+ 2030', anulRentPrcnt: 7.88, untrPric: 3694.18 },
        { nm: 'Tesouro Educa+ 2031', anulRentPrcnt: 7.82, untrPric: 3726.42 },
        { nm: 'Tesouro Educa+ 2032', anulRentPrcnt: 7.76, untrPric: 3465.32 },
        { nm: 'Tesouro Educa+ 2033', anulRentPrcnt: 7.7, untrPric: 3226.16 },
        { nm: 'Tesouro Educa+ 2034', anulRentPrcnt: 7.64, untrPric: 3006.28 },
        { nm: 'Tesouro Educa+ 2035', anulRentPrcnt: 7.56, untrPric: 2808.27 },
        { nm: 'Tesouro Educa+ 2036', anulRentPrcnt: 7.49, untrPric: 2625.46 },
        { nm: 'Tesouro Educa+ 2037', anulRentPrcnt: 7.42, untrPric: 2457.91 },
        { nm: 'Tesouro Educa+ 2038', anulRentPrcnt: 7.34, untrPric: 2306.58 },
        { nm: 'Tesouro Educa+ 2039', anulRentPrcnt: 7.28, untrPric: 2163.33 },
        { nm: 'Tesouro Educa+ 2040', anulRentPrcnt: 7.22, untrPric: 2030.78 },
        { nm: 'Tesouro Educa+ 2041', anulRentPrcnt: 7.16, untrPric: 1908.41 },
        { nm: 'Tesouro Educa+ 2042', anulRentPrcnt: 7.11, untrPric: 1793.11 },
        { nm: 'Tesouro Educa+ 2043', anulRentPrcnt: 7.07, untrPric: 1683.86 },
        { nm: 'Tesouro Educa+ 2044', anulRentPrcnt: 7.04, untrPric: 1580.2 },
        { nm: 'Tesouro Educa+ 2045', anulRentPrcnt: 7.02, untrPric: 1481.53 },
        { nm: 'Tesouro Educa+ 2046', anulRentPrcnt: 7.0, untrPric: 1389.61 },
        { nm: 'Tesouro Educa+ 2047', anulRentPrcnt: 6.98, untrPric: 1303.99 },
        { nm: 'Tesouro Educa+ 2048', anulRentPrcnt: 6.97, untrPric: 1221.83 },
    ];
}
