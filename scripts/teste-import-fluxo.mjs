// Duas faturas seguidas, do começo ao fim, com um Firestore de mentira.
//
// O teste de `_importDedup` prova a DECISÃO. Este prova o CAMINHO: que o
// que foi decidido vira — ou não vira — gravação. São coisas diferentes, e
// já aconteceu neste projeto de a lógica estar certa e o caminho errado.
//
// Aqui o banco é um dublê em memória que responde ao mesmo formato que o
// código usa (collection/where/get, batch.set/update/commit). Não é o
// Firestore de verdade, e isso está dito: o que este teste garante é que a
// classificação chega íntegra até o batch, não que o Firestore aceita.
//
// Rodar: node scripts/teste-import-fluxo.mjs
import { classificarImportacao, totalIgnorado } from '../api/_importDedup.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// ── O banco de mentira ──────────────────────────────────────────────
function bancoFalso(inicial = { subscriptions: [], transactions: [] }) {
    const dados = {
        subscriptions: inicial.subscriptions.map((x, i) => ({ id: `s${i}`, ...x })),
        transactions: inicial.transactions.map((x, i) => ({ id: `t${i}`, ...x })),
    };
    const gravacoes = { criados: [], atualizados: [] };
    return { dados, gravacoes };
}

// Reproduz o que o commit do whatsapp.js faz com o plano. Espelha o código
// real; se ele mudar, este espelho tem de mudar junto — e é por isso que o
// teste de contrato (teste-whatsapp-acoes) existe ao lado.
function aplicar(plano, banco, { cardId = 'c1', dueDay = 10 } = {}) {
    let lancados = 0, instNovos = 0, instAvancados = 0;
    for (const { it, inst } of plano.parcelaNova) {
        const novo = {
            id: `s_novo_${banco.dados.subscriptions.length}`,
            name: inst.name, value: Math.abs(it.amount), cardId,
            totalInstallments: inst.total, currentInstallment: inst.current,
            type: 'installment', isInstallment: true, day: dueDay,
        };
        banco.dados.subscriptions.push(novo);
        banco.gravacoes.criados.push(novo);
        instNovos++;
    }
    for (const { inst, atual } of plano.parcelaAvanca) {
        if (!atual.id) continue;
        const alvo = banco.dados.subscriptions.find(x => x.id === atual.id);
        if (alvo) { alvo.currentInstallment = inst.current; banco.gravacoes.atualizados.push(alvo); instAvancados++; }
    }
    for (const it of plano.novos) {
        const tx = { id: `t_novo_${banco.dados.transactions.length}`, description: it.description, amount: it.amount, date: it.date, selectedCardId: cardId };
        banco.dados.transactions.push(tx);
        lancados++;
    }
    return { lancados, instNovos, instAvancados, ignorados: totalIgnorado(plano) };
}

// Monta a entrada de `classificarImportacao` a partir do estado do banco,
// como `carregarJaExistente` faz.
const doBanco = (banco, cardId = 'c1') => ({
    assinaturas: banco.dados.subscriptions.filter(x => x.cardId === cardId && !(x.type === 'installment' || x.isInstallment)),
    parcelas: banco.dados.subscriptions.filter(x => x.cardId === cardId && (x.type === 'installment' || x.isInstallment)),
    lancados: banco.dados.transactions.filter(t => t.selectedCardId === cardId)
        .map(t => ({ description: t.description, amount: t.amount, date: t.date })),
});

const gasto = (description, amount, date) => ({ description, amount, date, type: 'expense', category: 'shopping' });

// ── O cenário do usuário ────────────────────────────────────────────
console.log('-- outubro: primeira fatura, cartao zerado --');
const banco = bancoFalso({
    // A Netflix já estava cadastrada como assinatura no app, que é o caso
    // de quem usa o produto antes de importar a fatura.
    subscriptions: [{ name: 'Netflix', value: 55.90, cardId: 'c1', type: 'subscription' }],
    transactions: [],
});
{
    const r = aplicar(classificarImportacao({
        items: [gasto('KABUM PARC03/12', 200, '2026-10-05'), gasto('NETFLIX.COM', 55.90, '2026-10-07'), gasto('Padaria', 18, '2026-10-09')],
        usaParcelas: true, ...doBanco(banco),
    }), banco);
    ok(r.instNovos === 1, 'cadastra 1 parcelamento', String(r.instNovos));
    ok(r.lancados === 1, 'lanca so a padaria (netflix ja e assinatura)', String(r.lancados));
    ok(r.ignorados === 1, 'ignora 1 (a netflix)', String(r.ignorados));
}

console.log('');
console.log('-- novembro: a fatura traz a parcela 4 e a netflix de novo --');
{
    const r = aplicar(classificarImportacao({
        items: [gasto('KABUM PARC04/12', 200, '2026-11-05'), gasto('NETFLIX.COM', 55.90, '2026-11-07'), gasto('Mercado', 230, '2026-11-08')],
        usaParcelas: true, ...doBanco(banco),
    }), banco);
    ok(r.instNovos === 0, 'NAO cadastra um segundo parcelamento', String(r.instNovos));
    ok(r.instAvancados === 1, 'avanca o parcelamento existente', String(r.instAvancados));
    ok(r.lancados === 1, 'lanca so o mercado', String(r.lancados));
    ok(r.ignorados === 1, 'ignora a netflix de novo', String(r.ignorados));

    const parc = banco.dados.subscriptions.filter(x => x.isInstallment);
    ok(parc.length === 1, 'continua existindo UM parcelamento no banco', String(parc.length));
    ok(parc[0].currentInstallment === 4, 'e ele esta na 4a parcela', String(parc[0].currentInstallment));
}

console.log('');
console.log('-- dezembro: a pessoa reenvia a fatura de NOVEMBRO por engano --');
{
    const antesTx = banco.dados.transactions.length;
    const antesParc = banco.dados.subscriptions.find(x => x.isInstallment).currentInstallment;
    const r = aplicar(classificarImportacao({
        items: [gasto('KABUM PARC04/12', 200, '2026-11-05'), gasto('NETFLIX.COM', 55.90, '2026-11-07'), gasto('Mercado', 230, '2026-11-08')],
        usaParcelas: true, ...doBanco(banco),
    }), banco);
    ok(r.lancados === 0, 'nao lanca nada de novo', String(r.lancados));
    ok(r.instNovos === 0 && r.instAvancados === 0, 'nao mexe no parcelamento');
    ok(banco.dados.transactions.length === antesTx, 'o banco nao cresceu');
    ok(banco.dados.subscriptions.find(x => x.isInstallment).currentInstallment === antesParc,
        'a parcela NAO retrocedeu nem avancou', String(antesParc));
}

console.log('');
console.log('-- o total ao longo dos tres envios --');
{
    const parcelamentos = banco.dados.subscriptions.filter(x => x.isInstallment).length;
    const transacoes = banco.dados.transactions.length;
    ok(parcelamentos === 1, 'UM parcelamento ao fim de tudo', String(parcelamentos));
    ok(transacoes === 2, 'DUAS transacoes: padaria e mercado', String(transacoes));
    const nomes = banco.dados.transactions.map(t => t.description).join(', ');
    ok(!/NETFLIX/i.test(nomes), 'nenhuma netflix lancada como transacao', nomes);
}

console.log('');
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);
