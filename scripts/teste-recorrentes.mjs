// Testes do reconhecimento de baixa + do saldo que ela gera.
//
// Nasceram de um caso real: dois salários com o MESMO nome, e só um somava
// na conta — o segundo aparecia "recebido" sem nunca ter gerado lançamento.
//
// Rodar: node scripts/teste-recorrentes.mjs
import { buildWalletLedger, walletAffecting } from '../src/utils/financialLogic.js';
import { statusOf, paidTxOf } from '../src/utils/recorrentes.js';

const mk = '2026-10';
let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// Lançamento como a baixa grava.
const baixa = (recId, nome, valor, dia) => ({
    id: `tx_${recId}`, description: nome, amount: valor, type: 'income', category: 'salary',
    date: `2026-10-${String(dia).padStart(2, '0')}T12:00:00.000Z`, month: mk,
    createdAt: Date.parse(`2026-10-${String(dia).padStart(2, '0')}T12:00:00Z`),
    isFixed: true, source: 'recorrente_baixa', recorrenteId: recId,
});

// ── O caso que deu problema ─────────────────────────────────────────
{
    const a = { id: 'r1', name: 'Salário', value: 3000, day: 5, lastPaidMonth: mk };
    const b = { id: 'r2', name: 'Salário', value: 2000, day: 5 };   // mesmo nome, não confirmado
    const txs = [baixa('r1', 'Salário', 3000, 5)];
    ok(statusOf(a, txs, mk) === 'pago', 'o salário confirmado fica "pago"');
    ok(statusOf(b, txs, mk) !== 'pago', 'o OUTRO salário de mesmo nome NÃO fica "pago"',
        `veio "${statusOf(b, txs, mk)}"`);
    ok(paidTxOf(b, txs, mk) === null, 'e não rouba a baixa do primeiro');
}

// ── Lançamento antigo, sem recorrenteId: ainda casa pelo nome ───────
{
    const r = { id: 'r9', name: 'Aluguel recebido', value: 1800, day: 10 };
    const antigo = { ...baixa('x', 'Aluguel recebido', 1800, 10), recorrenteId: undefined };
    ok(statusOf(r, [antigo], mk) === 'pago', 'baixa antiga (sem id) continua reconhecida');
}

// ── A baixa soma na conta ───────────────────────────────────────────
{
    ok(walletAffecting(baixa('r1', 'Salário', 4500, 5)) === true, 'a baixa de entrada mexe no saldo');
    const { finalBalance } = buildWalletLedger([baixa('r1', 'Salário', 3000, 5), baixa('r2', 'Salário', 2000, 5)], mk);
    ok(Math.abs(finalBalance - 5000) < 0.005, 'os DOIS salários somam na conta', `veio ${finalBalance}`);
}
{
    const txs = [
        baixa('r1', 'Salário', 4500, 5),
        { description: 'Luz', amount: 200, type: 'expense', category: 'conta_fixa', paymentMethod: 'pix', date: '2026-10-06T10:00:00.000Z', month: mk, createdAt: 9 },
        { description: 'Mercado', amount: 150, type: 'expense', category: 'alimentacao', paymentMethod: 'credito', date: '2026-10-07T10:00:00.000Z', month: mk, createdAt: 10 },
    ];
    const { finalBalance } = buildWalletLedger(txs, mk);
    ok(Math.abs(finalBalance - 4300) < 0.005, 'despesa no crédito não debita a conta', `veio ${finalBalance}`);
}
{
    // Saldo inicial DEFINE o saldo; não soma. Lançado depois, apaga o que veio antes.
    const txs = [
        baixa('r1', 'Salário', 4500, 5),
        { description: 'Saldo inicial', amount: 1000, type: 'income', category: 'initial_balance', date: '2026-10-08T10:00:00.000Z', month: mk, createdAt: 99 },
    ];
    ok(Math.abs(buildWalletLedger(txs, mk).finalBalance - 1000) < 0.005,
        'um "Saldo inicial" posterior redefine o saldo (é o combinado)');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
