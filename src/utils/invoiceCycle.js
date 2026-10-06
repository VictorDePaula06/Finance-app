// ── Ciclo da fatura do cartão ───────────────────────────────────────
// Qual fatura está "atual" depende de duas coisas: a próxima data de
// vencimento E se aquela fatura já foi paga. Pagar ANTES do fechamento é
// comum, e sem olhar os pagamentos a tela segue mostrando como a vencer
// uma fatura que já foi quitada.

export const mkOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Quais faturas já foram pagas, em dois baldes:
//
//   precisos — pagamentos novos, que gravam `invoiceDueMonth`: o mês de
//              VENCIMENTO da fatura quitada. Não tem ambiguidade.
//   soltos   — pagamentos antigos, que só têm o mês em que o pagamento foi
//              feito. Aproximamos pelo mês de vencimento, que acerta o caso
//              comum (pagar no mesmo mês em que vence).
export function mesesPagos(pagamentos) {
    const precisos = new Set();
    const soltos = new Set();
    for (const p of pagamentos || []) {
        if (p?.invoiceDueMonth) { precisos.add(p.invoiceDueMonth); continue; }
        const m = p?.invoiceMonthPaid || String(p?.date || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) soltos.add(m);
    }
    return { precisos, soltos };
}

export const faturaPaga = (mk, { precisos, soltos }) => precisos.has(mk) || soltos.has(mk);

// Próximo vencimento ainda EM ABERTO, pulando as faturas já pagas.
// `hoje` entra como parâmetro para o cálculo ser testável.
export function proximoVencimento(dueDay, hoje, pagamentos, maxMeses = 24) {
    const dia = parseInt(dueDay, 10);
    if (!dia || dia < 1 || dia > 31) return null;

    const today = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const pagos = mesesPagos(pagamentos);

    let due = new Date(today.getFullYear(), today.getMonth(), dia);
    if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, dia);

    let pulou = 0;
    for (let i = 0; i < maxMeses; i++) {
        if (!faturaPaga(mkOf(due), pagos)) break;
        due = new Date(due.getFullYear(), due.getMonth() + 1, dia);
        pulou += 1;
    }

    return {
        due,
        mk: mkOf(due),
        days: Math.round((due - today) / 86400000),
        pulou,          // quantas faturas já pagas ficaram para trás
    };
}

// Mês de vencimento da fatura que está sendo paga AGORA — é o que fica
// gravado no pagamento para a próxima leitura não precisar adivinhar.
export function mesDeVencimentoAtual(dueDay, hoje) {
    const dia = parseInt(dueDay, 10);
    if (!dia) return null;
    const today = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    let due = new Date(today.getFullYear(), today.getMonth(), dia);
    if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, dia);
    return mkOf(due);
}
