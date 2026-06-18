import React, { useState, useEffect, useMemo } from 'react';
import { Landmark } from 'lucide-react';

// Fontes de logo por ativo (mesma cadeia do site). Nenhuma cobre 100% dos
// tickers, então tentamos em ordem e caímos no monograma quando todas falham.
function buildLogoCandidates(asset) {
  const sym = (asset.symbol || '').trim();
  if (!sym) return [];
  if (asset.type === 'crypto') {
    return [`https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`];
  }
  const up = sym.toUpperCase();
  return [
    `https://financialmodelingprep.com/image-stock/${up}.png`,
    `https://assets.parqet.com/logos/symbol/${up}?format=png`,
  ];
}

// Logo real do ativo com fallback em cadeia → monograma (ou ícone de renda fixa).
export default function AssetLogo({ asset, size = 36, color = '#c084fc' }) {
  const candidates = useMemo(() => buildLogoCandidates(asset), [asset.symbol, asset.type]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [asset.symbol, asset.type]);

  const box = { width: size, height: size };
  const wrap = 'rounded-xl overflow-hidden flex items-center justify-center shrink-0';

  // Renda fixa não tem ticker → ícone de instituição.
  if (asset.type === 'renda_fixa') {
    return <span className={wrap} style={{ ...box, background: '#3b82f622' }}><Landmark style={{ width: size * 0.5, height: size * 0.5, color: '#3b82f6' }} /></span>;
  }

  if (candidates.length === 0 || idx >= candidates.length) {
    const mono = (asset.symbol || asset.name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '•';
    return <span className={wrap} style={{ ...box, background: `${color}22` }}><span className="text-[11px] font-black leading-none" style={{ color }}>{mono}</span></span>;
  }

  return (
    <span className={wrap} style={{ ...box, background: '#fff' }}>
      <img
        src={candidates[idx]}
        alt={asset.symbol || asset.name || ''}
        className="w-full h-full object-contain p-1"
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
      />
    </span>
  );
}
