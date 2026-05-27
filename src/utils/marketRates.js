/**
 * Shared market-rates fetcher with module-level cache and dedupe.
 *
 * Antes: 5+ componentes faziam fetch separado do CDI (BCB) e USD/BRL
 * (awesomeapi), gerando requisições duplicadas a cada abertura de aba.
 *
 * Agora: o fetch é único por sessão. Se múltiplos componentes pedirem
 * o valor simultaneamente, todos recebem a mesma Promise. TTLs:
 *   - CDI: 1 hora (mexe pouco no curto prazo)
 *   - USD: 5 minutos (mais volátil)
 *
 * Uso:
 *   import { useCdiRate, useUsdRate } from '../utils/marketRates';
 *   const cdiRate = useCdiRate();   // % anualizado
 *   const usdRate = useUsdRate();   // R$ por USD
 *
 * Funções imperativas também disponíveis (getCdiRate / getUsdRate)
 * para usar fora de hooks (ex.: dentro de outras funções).
 */

import { useEffect, useState } from 'react';

const CDI_TTL_MS = 1000 * 60 * 60; // 1 hour
const USD_TTL_MS = 1000 * 60 * 5;  // 5 minutes

const CDI_FALLBACK = 10.65;
const USD_FALLBACK = 5.0;

let cdiCache = { value: null, fetchedAt: 0, promise: null };
let usdCache = { value: null, fetchedAt: 0, promise: null };

export async function getCdiRate() {
    const now = Date.now();
    if (cdiCache.value && (now - cdiCache.fetchedAt < CDI_TTL_MS)) {
        return cdiCache.value;
    }
    if (cdiCache.promise) return cdiCache.promise;

    cdiCache.promise = fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
        .then(r => r.json())
        .then(d => {
            if (d && d[0] && d[0].valor) {
                const annual = parseFloat(d[0].valor) * 365;
                if (isFinite(annual) && annual > 0) {
                    cdiCache = { value: annual, fetchedAt: Date.now(), promise: null };
                    return annual;
                }
            }
            cdiCache.promise = null;
            return cdiCache.value || CDI_FALLBACK;
        })
        .catch((err) => {
            console.warn('[marketRates] CDI fetch failed:', err?.message || err);
            cdiCache.promise = null;
            return cdiCache.value || CDI_FALLBACK;
        });

    return cdiCache.promise;
}

export async function getUsdRate() {
    const now = Date.now();
    if (usdCache.value && (now - usdCache.fetchedAt < USD_TTL_MS)) {
        return usdCache.value;
    }
    if (usdCache.promise) return usdCache.promise;

    usdCache.promise = fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
        .then(r => r.json())
        .then(d => {
            const rate = parseFloat(d?.USDBRL?.bid);
            if (isFinite(rate) && rate > 0) {
                usdCache = { value: rate, fetchedAt: Date.now(), promise: null };
                return rate;
            }
            usdCache.promise = null;
            return usdCache.value || USD_FALLBACK;
        })
        .catch((err) => {
            console.warn('[marketRates] USD fetch failed:', err?.message || err);
            usdCache.promise = null;
            return usdCache.value || USD_FALLBACK;
        });

    return usdCache.promise;
}

// React hook helpers — auto-fetch on mount, return cached value while loading.
export function useCdiRate(fallback = CDI_FALLBACK) {
    const [rate, setRate] = useState(cdiCache.value || fallback);
    useEffect(() => {
        let mounted = true;
        getCdiRate().then(v => { if (mounted) setRate(v); });
        return () => { mounted = false; };
    }, []);
    return rate;
}

export function useUsdRate(fallback = USD_FALLBACK) {
    const [rate, setRate] = useState(usdCache.value || fallback);
    useEffect(() => {
        let mounted = true;
        getUsdRate().then(v => { if (mounted) setRate(v); });
        return () => { mounted = false; };
    }, []);
    return rate;
}
