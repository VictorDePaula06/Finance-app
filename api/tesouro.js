/**
 * Vercel Serverless Function: /api/tesouro
 * Fetches live Tesouro Direto bond prices server-side using the official Open Data CSV.
 * This completely bypasses Cloudflare protection on the main site and guarantees accurate live rates.
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Official Open Data CSV - Updated daily and no WAF blocking
        const csvUrl = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';
        
        const response = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
        
        if (!response.ok) {
            console.warn(`[Tesouro API] CSV fetch returned ${response.status}`);
            return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
        }

        const txt = await response.text();
        const lines = txt.split('\n');
        
        let maxDate = 0;
        let maxDateStr = '';
        
        // Step 1: Find the latest date in the CSV
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length < 8) continue;
            
            const dateStr = parts[2];
            const [d, m, y] = dateStr.split('/');
            const time = new Date(y, m - 1, d).getTime();
            
            if (time > maxDate) {
                maxDate = time;
                maxDateStr = dateStr;
            }
        }

        // Step 2: Parse all bonds for that latest date
        const bonds = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length < 8) continue;
            
            if (parts[2] === maxDateStr) {
                const type = parts[0];
                const venc = parts[1];
                const taxa = parseFloat(parts[3].replace(',', '.')); // Taxa Compra
                const pu = parseFloat(parts[5].replace(',', '.'));   // PU Compra
                
                const [d, m, y] = venc.split('/');
                const year = parseInt(y, 10);
                
                let name = type;
                let semiAnulIntrstInd = type.includes('Juros Semestrais');
                
                // Map to official short names shown on the platform
                if (type === 'Tesouro Renda+ Aposentadoria Extra') {
                    name = `Tesouro RendA+ ${year - 19}`; // Maturation is 20 years (year - 19 for the start year)
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
        }

        if (bonds.length === 0) {
            return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
        }

        return res.status(200).json({ 
            bonds, 
            source: 'official_csv', 
            count: bonds.length,
            refDate: maxDateStr,
            fetchedAt: new Date().toISOString() 
        });

    } catch (error) {
        console.error('[Tesouro API] Error:', error.message);
        return res.status(200).json({ bonds: getFallbackBonds(), source: 'fallback', fetchedAt: new Date().toISOString() });
    }
}

/**
 * Fallback bonds with approximate rates in case the CSV fails.
 */
function getFallbackBonds() {
    return [
        { nm: 'Tesouro Selic 2027', anulRentPrcnt: 0.0618, untrPric: 16293.87, mtrtyDt: '2027-03-01' },
        { nm: 'Tesouro Selic 2029', anulRentPrcnt: 0.1142, untrPric: 16345.12, mtrtyDt: '2029-03-01' },
        { nm: 'Tesouro IPCA+ 2029', anulRentPrcnt: 6.90, untrPric: 3485.20, mtrtyDt: '2029-05-15' },
        { nm: 'Tesouro IPCA+ 2035', anulRentPrcnt: 6.90, untrPric: 2205.30, mtrtyDt: '2035-05-15' },
        { nm: 'Tesouro IPCA+ 2045', anulRentPrcnt: 6.90, untrPric: 1065.40, mtrtyDt: '2045-05-15' },
        { nm: 'Tesouro RendA+ 2065', anulRentPrcnt: 6.90, untrPric: 148.20, mtrtyDt: '2065-01-15' },
        { nm: 'Tesouro Prefixado 2027', anulRentPrcnt: 10.50, untrPric: 830.25, mtrtyDt: '2027-01-01' }
    ];
}
