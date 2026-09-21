import { CATEGORIES } from '../constants/categories';

// ── Teto de gasto por categoria ─────────────────────────────────────
// O teto vive em userPrefs.manualConfig.categoryBudgets ({ [catId]: valor }),
// o mesmo campo usado por Análises/Metas — uma fonte só. Estas funções são
// compartilhadas por Cadastros (definir), Dashboard (alertar) e espelham a
// regra usada pela Alívia no WhatsApp (api/whatsapp.js).

// Categorias que NÃO são gasto do dia a dia (transferências / quitação).
export const NON_SPENDING = ['investment', 'vault', 'credit_card_bill'];
export const CEILING_CATEGORIES = CATEGORIES.expense.filter(c => !NON_SPENDING.includes(c.id));

// A partir de quanto do teto a Alívia começa a avisar ("próximo do teto").
export const NEAR_RATIO = 0.8;

// { catId: número > 0 } — ignora vazios/zeros.
export const ceilingsFrom = (userPrefs) => {
    const raw = userPrefs?.manualConfig?.categoryBudgets || {};
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
        const n = parseFloat(String(v ?? '').replace(',', '.'));
        if (n > 0) out[id] = n;
    }
    return out;
};

// Gasto do mês por categoria (todas as despesas, inclusive no cartão; exclui transferências).
export const spentByCategory = (transactions, mk) => {
    const map = {};
    for (const t of transactions) {
        if (t.type !== 'expense' || t.isTransfer) continue;
        const tMk = t.month || String(t.date || '').slice(0, 7);
        if (tMk !== mk) continue;
        const c = t.category || 'other';
        map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0);
    }
    return map;
};

// 'ok' | 'near' | 'over'
export const ceilingLevel = (spent, ceiling) => {
    if (!(ceiling > 0)) return 'ok';
    const r = spent / ceiling;
    if (r >= 1) return 'over';
    if (r >= NEAR_RATIO) return 'near';
    return 'ok';
};

// Linhas com status para TODAS as categorias de gasto (com ou sem teto).
export const ceilingRows = (transactions, ceilings, mk) => {
    const spent = spentByCategory(transactions, mk);
    return CEILING_CATEGORIES.map(c => {
        const ceiling = ceilings[c.id] || 0;
        const s = spent[c.id] || 0;
        const ratio = ceiling > 0 ? s / ceiling : 0;
        return { id: c.id, label: c.label, icon: c.icon, color: c.color, ceiling, spent: s, ratio, pct: Math.round(ratio * 100), level: ceilingLevel(s, ceiling) };
    });
};

// Só o que merece aviso (perto ou acima do teto), do mais grave pro menos.
export const ceilingAlerts = (transactions, ceilings, mk) =>
    ceilingRows(transactions, ceilings, mk)
        .filter(r => r.ceiling > 0 && r.level !== 'ok')
        .sort((a, b) => b.ratio - a.ratio);

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Frase da Alívia para um alerta (mesmo tom do WhatsApp).
export const ceilingMessage = (r) => {
    const over = r.spent - r.ceiling;
    if (r.level === 'over') {
        return `Você passou do teto de ${r.label}: já foram R$ ${money(r.spent)} de um limite de R$ ${money(r.ceiling)} (${r.pct}%). Passou R$ ${money(over)} — vale segurar essa categoria até o fim do mês.`;
    }
    const left = r.ceiling - r.spent;
    return `Você está a ${r.pct}% do teto de ${r.label}: R$ ${money(r.spent)} de R$ ${money(r.ceiling)}. Ainda cabem R$ ${money(left)} este mês.`;
};
