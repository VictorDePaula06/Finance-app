// ── Mercado ─────────────────────────────────────────────────────────
// Lista de compras e compras lançadas. A lista vive em `market_items`
// (um documento por produto, para marcar no corredor sem recarregar tudo);
// cada compra vive em `market_purchases` com os produtos DENTRO do próprio
// documento — uma nota fiscal é uma unidade, e assim o preço de cada item
// fica amarrado à compra que o originou.

export const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz'];

// Preferência do usuário: { enabled, ceiling }. Vem desmarcado por padrão.
export const marketPrefs = (userPrefs) => {
    const raw = userPrefs?.manualConfig?.market || {};
    const ceiling = parseFloat(String(raw.ceiling ?? '').replace(',', '.'));
    return {
        enabled: raw.enabled === true,
        ceiling: ceiling > 0 ? ceiling : null,
    };
};

// Chave para reconhecer o MESMO produto entre compras diferentes. O cupom
// escreve o nome de jeitos levemente diferentes, então tiramos acento,
// pontuação e espaço sobrando.
export const productKey = (name) => String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const monthKeyOf = (iso) => String(iso || '').slice(0, 7);

// Aceita o que o usuário digita E o que volta do banco. A pegadinha: o que
// está gravado já é NÚMERO (7.5), e tratar o ponto como separador de milhar
// nesse caso transformaria 7,50 em 75.
const num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v ?? '').trim();
    if (!s) return 0;
    // Com vírgula, é formato brasileiro: ponto é milhar ("1.234,56").
    // Sem vírgula, o ponto é o decimal ("7.5").
    const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
    return isFinite(n) ? n : 0;
};
export const parseNum = num;

// Total de um item: quantidade × preço unitário, com uma casa de folga para
// não acumular erro de centavo.
export const itemTotal = (item) => Math.round((num(item.qty) * num(item.unitPrice)) * 100) / 100;

export const purchaseTotal = (p) => {
    if (!p?.items?.length) return num(p?.total);
    return Math.round(p.items.reduce((a, i) => a + itemTotal(i), 0) * 100) / 100;
};

// ── Análise ─────────────────────────────────────────────────────────
// Tudo sai das compras lançadas; nada é estimado.
export function analyze(purchases, mk, ceiling) {
    const doMes = (purchases || []).filter(p => monthKeyOf(p.date) === mk);
    const spentMonth = doMes.reduce((a, p) => a + purchaseTotal(p), 0);
    const count = doMes.length;

    // Gasto por produto no mês — onde o dinheiro realmente vai.
    const porProduto = new Map();
    for (const p of doMes) {
        for (const it of p.items || []) {
            const k = productKey(it.name);
            if (!k) continue;
            const atual = porProduto.get(k) || { key: k, name: it.name, total: 0, qty: 0 };
            atual.total += itemTotal(it);
            atual.qty += num(it.qty);
            porProduto.set(k, atual);
        }
    }
    const topProducts = [...porProduto.values()].sort((a, b) => b.total - a.total);

    // Preço por produto ao longo do tempo (todas as compras, não só do mês):
    // último preço pago e como mudou em relação à vez anterior.
    const historico = new Map();
    for (const p of [...(purchases || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
        for (const it of p.items || []) {
            const k = productKey(it.name);
            if (!k) continue;
            const preco = num(it.unitPrice);
            if (preco <= 0) continue;
            if (!historico.has(k)) historico.set(k, { key: k, name: it.name, precos: [] });
            historico.get(k).precos.push({ date: p.date, price: preco });
        }
    }
    const priceWatch = [...historico.values()].map(h => {
        const n = h.precos.length;
        const last = h.precos[n - 1];
        const prev = n > 1 ? h.precos[n - 2] : null;
        const changePct = prev && prev.price > 0 ? ((last.price - prev.price) / prev.price) * 100 : null;
        return { key: h.key, name: h.name, times: n, lastPrice: last.price, lastDate: last.date, changePct };
    }).sort((a, b) => b.times - a.times || b.lastPrice - a.lastPrice);

    return {
        spentMonth: Math.round(spentMonth * 100) / 100,
        count,
        avgTicket: count ? Math.round((spentMonth / count) * 100) / 100 : 0,
        ceilingPct: ceiling ? (spentMonth / ceiling) * 100 : null,
        topProducts,
        priceWatch,
    };
}
