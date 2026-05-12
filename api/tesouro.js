/**
 * Vercel Serverless Function: /api/tesouro
 * Fetches live Tesouro Direto bond prices server-side (bypasses Cloudflare).
 * Returns official bond names, rates, and unit prices (PU).
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const tesouroUrl = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';

    try {
        const response = await fetch(tesouroUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm',
                'Origin': 'https://www.tesourodireto.com.br',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.warn(`[Tesouro API] Direct fetch returned ${response.status}`);
            return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
        }

        const data = await response.json();
        const bondList = data?.response?.TrsrBondPricLogList;

        if (!bondList || bondList.length === 0) {
            console.warn('[Tesouro API] No bonds in response');
            return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
        }

        // Map to clean format
        const bonds = bondList.map(item => {
            const bond = item.TrsrBond;
            return {
                nm: bond.nm,                                     // Official name (e.g., "Tesouro Selic 2029")
                mtrtyDt: bond.mtrtyDt,                           // Maturity date
                anulRentPrcnt: bond.anulRentPrcnt,               // Annual rate %
                untrPric: bond.untrPric,                         // Unit price (PU) for purchase
                minInvstmtAmt: bond.minInvstmtAmt,              // Min investment
                semiAnulIntrstInd: bond.semiAnulIntrstInd,       // Pays semi-annual interest?
                currencyType: bond.currencyType || 'BRL',
                // Redemption data
                untrRedVal: bond.untrRedVal,                     // Unit redemption value
                anulInvstmtRate: bond.anulInvstmtRate,           // Annual investment rate for redemption
            };
        });

        return res.status(200).json({ 
            bonds, 
            source: 'official', 
            count: bonds.length,
            fetchedAt: new Date().toISOString() 
        });

    } catch (error) {
        console.error('[Tesouro API] Error:', error.message);
        return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
    }
}

/**
 * Fallback bonds with official names matching tesourodireto.com.br
 * Updated periodically — these are approximate values used when API is unavailable
 */
function getFallbackBonds() {
    return [
        // Tesouro Selic
        { nm: 'Tesouro Selic 2027', anulRentPrcnt: 0.0618, untrPric: 16293.87, mtrtyDt: '2027-03-01' },
        { nm: 'Tesouro Selic 2029', anulRentPrcnt: 0.1142, untrPric: 16345.12, mtrtyDt: '2029-03-01' },
        { nm: 'Tesouro Selic 2031', anulRentPrcnt: 0.1258, untrPric: 16120.45, mtrtyDt: '2031-03-01' },

        // Tesouro IPCA+
        { nm: 'Tesouro IPCA+ 2029', anulRentPrcnt: 7.68, untrPric: 3485.20, mtrtyDt: '2029-05-15' },
        { nm: 'Tesouro IPCA+ 2035', anulRentPrcnt: 7.48, untrPric: 2205.30, mtrtyDt: '2035-05-15' },
        { nm: 'Tesouro IPCA+ 2040', anulRentPrcnt: 7.30, untrPric: 1520.60, mtrtyDt: '2040-05-15' },
        { nm: 'Tesouro IPCA+ 2045', anulRentPrcnt: 7.25, untrPric: 1065.40, mtrtyDt: '2045-05-15' },
        { nm: 'Tesouro IPCA+ 2055', anulRentPrcnt: 7.15, untrPric: 520.80, mtrtyDt: '2055-05-15' },

        // Tesouro IPCA+ com Juros Semestrais
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2032', anulRentPrcnt: 7.52, untrPric: 4520.30, mtrtyDt: '2032-08-15', semiAnulIntrstInd: true },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2040', anulRentPrcnt: 7.35, untrPric: 4380.10, mtrtyDt: '2040-08-15', semiAnulIntrstInd: true },
        { nm: 'Tesouro IPCA+ com Juros Semestrais 2055', anulRentPrcnt: 7.18, untrPric: 4250.50, mtrtyDt: '2055-05-15', semiAnulIntrstInd: true },

        // Tesouro Prefixado
        { nm: 'Tesouro Prefixado 2027', anulRentPrcnt: 14.82, untrPric: 830.25, mtrtyDt: '2027-01-01' },
        { nm: 'Tesouro Prefixado 2029', anulRentPrcnt: 14.58, untrPric: 620.30, mtrtyDt: '2029-01-01' },
        { nm: 'Tesouro Prefixado 2032', anulRentPrcnt: 14.45, untrPric: 420.80, mtrtyDt: '2032-01-01' },

        // Tesouro Prefixado com Juros Semestrais
        { nm: 'Tesouro Prefixado com Juros Semestrais 2029', anulRentPrcnt: 14.55, untrPric: 960.40, mtrtyDt: '2029-01-01', semiAnulIntrstInd: true },
        { nm: 'Tesouro Prefixado com Juros Semestrais 2035', anulRentPrcnt: 14.40, untrPric: 880.20, mtrtyDt: '2035-01-01', semiAnulIntrstInd: true },

        // Tesouro RendA+
        { nm: 'Tesouro RendA+ 2030', anulRentPrcnt: 7.45, untrPric: 1150.30, mtrtyDt: '2030-01-15' },
        { nm: 'Tesouro RendA+ 2035', anulRentPrcnt: 7.40, untrPric: 860.20, mtrtyDt: '2035-01-15' },
        { nm: 'Tesouro RendA+ 2040', anulRentPrcnt: 7.35, untrPric: 640.50, mtrtyDt: '2040-01-15' },
        { nm: 'Tesouro RendA+ 2045', anulRentPrcnt: 7.30, untrPric: 475.40, mtrtyDt: '2045-01-15' },
        { nm: 'Tesouro RendA+ 2050', anulRentPrcnt: 7.25, untrPric: 355.60, mtrtyDt: '2050-01-15' },
        { nm: 'Tesouro RendA+ 2055', anulRentPrcnt: 7.20, untrPric: 265.30, mtrtyDt: '2055-01-15' },
        { nm: 'Tesouro RendA+ 2060', anulRentPrcnt: 7.15, untrPric: 198.40, mtrtyDt: '2060-01-15' },
        { nm: 'Tesouro RendA+ 2065', anulRentPrcnt: 7.10, untrPric: 148.20, mtrtyDt: '2065-01-15' },

        // Tesouro Educa+
        { nm: 'Tesouro Educa+ 2030', anulRentPrcnt: 7.42, untrPric: 1120.50, mtrtyDt: '2030-01-15' },
        { nm: 'Tesouro Educa+ 2033', anulRentPrcnt: 7.38, untrPric: 920.30, mtrtyDt: '2033-01-15' },
        { nm: 'Tesouro Educa+ 2036', anulRentPrcnt: 7.35, untrPric: 750.60, mtrtyDt: '2036-01-15' },
        { nm: 'Tesouro Educa+ 2039', anulRentPrcnt: 7.30, untrPric: 615.40, mtrtyDt: '2039-01-15' },
        { nm: 'Tesouro Educa+ 2042', anulRentPrcnt: 7.28, untrPric: 500.20, mtrtyDt: '2042-01-15' },
    ];
}
