/**
 * Vercel Serverless Function: /api/fipe
 * Proxy server-side para a Tabela FIPE (evita CORS/limites do navegador).
 *
 * Query:
 *   ?p=marcas
 *   ?p=marcas/59/modelos
 *   ?p=marcas/59/modelos/123/anos
 *   ?p=marcas/59/modelos/123/anos/2020-1
 *
 * Estratégia:
 *   1. parallelum.com.br/fipe/api/v1/carros/<p>
 *   2. fallback para BrasilAPI quando p === 'marcas' (lista de marcas)
 */
const PARALLELUM = 'https://parallelum.com.br/fipe/api/v1/carros';
const BRASILAPI_MARCAS = 'https://brasilapi.com.br/api/fipe/marcas/v1/carros';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'finance-app/1.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const p = (req.query.p || 'marcas').toString().replace(/^\/+/, '');

  // F-07: aceita apenas o formato esperado dos caminhos FIPE (evita traversal/SSRF).
  if (!/^[a-zA-Z0-9/_-]{1,60}$/.test(p)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  // 1) parallelum
  try {
    const data = await fetchJson(`${PARALLELUM}/${p}`);
    return res.status(200).json(data);
  } catch (e) {
    // 2) fallback só para marcas (BrasilAPI)
    if (p === 'marcas') {
      try {
        const list = await fetchJson(BRASILAPI_MARCAS);
        const mapped = (Array.isArray(list) ? list : []).map(m => ({ codigo: String(m.valor), nome: m.nome }));
        if (mapped.length) return res.status(200).json(mapped);
      } catch { /* ignore */ }
    }
    return res.status(502).json({ error: 'FIPE upstream indisponível', detail: String(e?.message || e) });
  }
}
