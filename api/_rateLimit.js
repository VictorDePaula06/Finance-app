/**
 * Rate limiter simples (janela fixa) via Upstash Redis REST API.
 * Arquivos iniciados com "_" não viram rota na Vercel.
 *
 * INERTE por padrão: se UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN não
 * estiverem definidas, retorna ok=true (não limita) — zero impacto no fluxo atual.
 * FAIL-OPEN em erro de infra (Redis fora do ar não derruba o app).
 *
 * Para ativar: crie um Redis no Upstash (ou Vercel KV) e configure as 2 env vars
 * na Vercel. Nenhuma mudança de código é necessária depois disso.
 */
export async function rateLimit(key, { limit = 20, windowSec = 60 } = {}) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return { ok: true, remaining: limit }; // inerte

    const rk = `rl:${key}`;
    const headers = { Authorization: `Bearer ${token}` };
    try {
        const incrRes = await fetch(`${url}/incr/${encodeURIComponent(rk)}`, { headers });
        const { result: count } = await incrRes.json();
        // Na 1ª requisição da janela, define o TTL (expira a contagem).
        if (count === 1) {
            await fetch(`${url}/expire/${encodeURIComponent(rk)}/${windowSec}`, { headers });
        }
        return { ok: count <= limit, remaining: Math.max(0, limit - count) };
    } catch {
        return { ok: true, remaining: limit }; // fail-open: não bloqueia por falha de infra
    }
}
