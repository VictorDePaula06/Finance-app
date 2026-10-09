// ── Situação dos recorrentes ────────────────────────────────────────
// Contas puras sobre os dados: dado um recorrente e os lançamentos do mês,
// dizem se ele já foi pago/recebido, qual lançamento registrou isso e quantos
// dias faltam para o vencimento.
//
// Moram aqui, e não na página, para poderem ser testadas sem navegador
// (scripts/teste-recorrentes.mjs).

// A baixa deste recorrente, neste mês. O casamento é pelo `recorrenteId` —
// pelo NOME, duas entradas chamadas "Salário" dividiriam a mesma baixa e a
// segunda apareceria como recebida sem nunca ter somado na conta.
//
// O nome só vale para lançamentos antigos, que não têm o id gravado: sem essa
// ressalva, baixas feitas antes disto voltariam a aparecer como pendentes.
export function baixaDesteRecorrente(t, rec, mk) {
    if (!t?.isFixed) return false;
    if ((t.month || String(t.date || '').slice(0, 7)) !== mk) return false;
    if (t.recorrenteId) return t.recorrenteId === rec.id;
    return String(t.description || '').trim().toLowerCase() === String(rec.name || '').trim().toLowerCase();
}

export function statusOf(rec, transactions, mk) {
    const paid = rec.lastPaidMonth === mk
        || transactions.some(t => baixaDesteRecorrente(t, rec, mk));
    if (paid) return 'pago';
    const now = new Date();
    const [y, m] = String(mk).split('-').map(Number);
    const day = Math.min(31, Math.max(1, rec.day || 1));
    // Vencimento deste mês (fim do dia).
    const due = new Date(y, (m || 1) - 1, day, 23, 59, 59);
    // Só é "atrasado" se o vencimento já passou E o recorrente já existia
    // até a data de vencimento. Um recorrente cadastrado DEPOIS do vencimento
    // não nasce vencido — fica pendente para o próximo ciclo.
    const existedByDue = rec.createdAt ? new Date(rec.createdAt) <= due : true;
    if (now > due && existedByDue) return 'atrasado';
    return 'pendente';
}

// Lançamento (baixa) deste mês que corresponde ao recorrente — pra mostrar valor/data pagos.
export function paidTxOf(rec, transactions, mk) {
    return transactions.find(t => baixaDesteRecorrente(t, rec, mk)) || null;
}

// Dias até o vencimento neste mês (negativo = já passou).
export function daysToDue(day, mk) {
    const [y, m] = String(mk).split('-').map(Number);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(y, (m || 1) - 1, Math.min(31, Math.max(1, day || 1)));
    return Math.round((due - today) / 86400000);
}
