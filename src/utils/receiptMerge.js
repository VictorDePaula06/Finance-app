// ── Juntar fotos de um cupom longo ──────────────────────────────────
// Compra grande não cabe numa foto. A pessoa fotografa em pedaços e, para
// não perder linha, sobrepõe um pouco entre uma foto e a seguinte.
//
// Cada lote vem na ORDEM em que os produtos aparecem no papel. O encaixe é
// o maior sufixo do que já foi lido que é igual ao começo do lote novo —
// mesmo problema de montar um panorama, só que com linhas.

import { parseNum } from './market.js';

const chaveItem = (i) => [
    String(i.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    Math.round(parseNum(i.qty) * 1000),
    Math.round(parseNum(i.unitPrice) * 100),
].join('|');

// Quantas linhas do começo de `novo` repetem o fim de `acc`.
// Exige pelo menos 2 linhas: uma linha repetida sozinha pode ser compra
// legítima do mesmo produto duas vezes, e apagar por engano some com um
// item — pior do que deixar duplicado, que fica visível na conferência.
export function tamanhoDaSobreposicao(acc, novo, minimo = 2) {
    const max = Math.min(acc.length, novo.length);
    for (let k = max; k >= minimo; k--) {
        let igual = true;
        for (let i = 0; i < k; i++) {
            if (chaveItem(acc[acc.length - k + i]) !== chaveItem(novo[i])) { igual = false; break; }
        }
        if (igual) return k;
    }
    return 0;
}

// Junta os lotes na ordem em que foram fotografados.
// Devolve { items, sobrepostos } — `sobrepostos` é quantas linhas repetidas
// foram descartadas, para a tela poder dizer o que fez.
export function juntarLotes(lotes) {
    const items = [];
    let sobrepostos = 0;
    for (const lote of lotes || []) {
        const novo = (lote?.items || []).filter(i => String(i?.name || '').trim());
        if (!novo.length) continue;
        if (!items.length) { items.push(...novo); continue; }
        const k = tamanhoDaSobreposicao(items, novo);
        sobrepostos += k;
        items.push(...novo.slice(k));
    }
    return { items, sobrepostos };
}

// O cupom traz o próprio total impresso — use-o como conferência.
// É o que permite dizer "confere" em vez de torcer para ter lido certo.
//
//   bate   → soma dos itens igual ao total impresso (até 2 centavos);
//   sobra  → somou MAIS que o total: provável linha repetida entre fotos;
//   falta  → somou MENOS: provável pedaço do cupom não fotografado.
export function conferir(items, totalImpresso) {
    const soma = Math.round((items || []).reduce(
        (a, i) => a + (parseNum(i.total) || parseNum(i.qty) * parseNum(i.unitPrice)), 0) * 100) / 100;
    if (!totalImpresso || totalImpresso <= 0) {
        return { soma, total: null, estado: 'semTotal', diferenca: null };
    }
    const dif = Math.round((soma - totalImpresso) * 100) / 100;
    const estado = Math.abs(dif) <= 0.02 ? 'bate' : dif > 0 ? 'sobra' : 'falta';
    return { soma, total: totalImpresso, estado, diferenca: dif };
}

// O total impresso aparece uma vez só, normalmente no último pedaço.
export const totalDosLotes = (lotes) => (lotes || [])
    .reduce((maior, l) => Math.max(maior, parseNum(l?.total)), 0);

// Loja e data: o primeiro lote que trouxer costuma ser o cabeçalho.
export const cabecalhoDosLotes = (lotes) => ({
    store: (lotes || []).find(l => l?.store)?.store || null,
    date: (lotes || []).find(l => l?.date)?.date || null,
});
