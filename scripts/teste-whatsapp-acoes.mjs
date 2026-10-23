// O contrato entre o que a IA é instruída a produzir e o que o app executa.
//
// O risco real de reescrever o SYSTEM é silencioso: some uma ação do prompt
// e aquela funcionalidade simplesmente para de existir — a IA nunca mais a
// emite, o executor nunca mais é chamado, e nada no build ou no console
// acusa. A pessoa só descobre quando pede e a Alívia responde que não dá.
//
// O inverso também quebra: o executor espera `action.action === 'report'`,
// então se o prompt passar a mandar "relatorio", o JSON chega e é ignorado.
//
// Este teste casa os dois lados lendo o próprio api/whatsapp.js:
//   · toda ação ensinada no prompt tem tratamento no executor;
//   · todo tratamento no executor está ensinado no prompt;
//   · as categorias e prioridades do prompt são as que o app aceita.
//
// Rodar: node scripts/teste-whatsapp-acoes.mjs
import { readFileSync } from 'node:fs';

const fonte = readFileSync('api/whatsapp.js', 'utf8');

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// ── As ações que o prompt ENSINA ────────────────────────────────────
const iniSys = fonte.indexOf('const SYSTEM = `');
const fimSys = fonte.indexOf('`;', fonte.indexOf('# 11. LIMITES'));
ok(iniSys >= 0 && fimSys > iniSys, 'o SYSTEM foi encontrado no arquivo');
const sys = fonte.slice(iniSys, fimSys);

const ensinadas = new Set([...sys.matchAll(/\{"action"\s*:\s*"([a-z_]+)"/g)].map(m => m[1]));

// ── As ações que o executor TRATA ───────────────────────────────────
const executor = fonte.slice(fimSys);
const tratadas = new Set([...executor.matchAll(/action\?\.action === '([a-z_]+)'/g)].map(m => m[1]));

console.log(`prompt ensina ${ensinadas.size} ações; executor trata ${tratadas.size}`);
console.log('');

// As 17 que existiam antes da reescrita. Se alguma sumir, é regressão —
// esta lista é o contrato com o que já estava no ar.
const ESPERADAS = [
    'add_expense', 'add_card_expense', 'add_income', 'add_to_reserve',
    'set_reserve_goal', 'add_fixed_expense', 'add_fixed_income',
    'baixa_recorrente', 'delete_transaction', 'report', 'report_pdf',
    'list_recurring', 'debts_check', 'list_transactions', 'wallet_check',
    'reserve_advice', 'add_asset',
];

console.log('-- as 17 acoes continuam ensinadas no prompt --');
for (const a of ESPERADAS) {
    ok(ensinadas.has(a), a);
}

console.log('');
console.log('-- toda acao ensinada tem quem a execute --');
{
    // Nem toda ação é casada por `action?.action === '...'`. O `add_expense`
    // é reconhecido por REGEX dentro de parseExpense, procurando o literal
    // "add_expense" no texto do modelo. Então o teste aceita as duas formas:
    // o que importa é existir código no executor que referencie a ação.
    const semSystem = fonte.slice(0, iniSys) + executor;
    for (const a of ensinadas) {
        const porIgualdade = tratadas.has(a);
        const porLiteral = semSystem.includes(`"${a}"`) || semSystem.includes(`'${a}'`);
        ok(porIgualdade || porLiteral, a, porIgualdade ? '' : 'casado por regex/literal');
    }
}

console.log('');
console.log('-- todo tratamento do executor esta ensinado --');
for (const a of tratadas) {
    ok(ensinadas.has(a), a, ensinadas.has(a) ? '' : 'o executor trata mas o prompt não ensina — ação inalcançável');
}

console.log('');
console.log('-- categorias e prioridades vem das constantes do app --');
{
    // O prompt interpola EXPENSE_CATS e PRIORITIES. Se alguém trocar por uma
    // lista escrita à mão, ela passa a divergir do que o app aceita sem que
    // nada reclame.
    ok(sys.includes('${EXPENSE_CATS.join'), 'categorias interpoladas de EXPENSE_CATS');
    ok(sys.includes('${PRIORITIES.join'), 'prioridades interpoladas de PRIORITIES');
}

console.log('');
console.log('-- as secoes pedidas estao todas la --');
for (const sec of ['# 1. IDENTIDADE', '# 2. TAMANHO', '# 3. DADOS FINANCEIROS',
    '# 4. CLASSIFICAÇÃO', '# 5. DATA, VALOR', '# 6. QUANDO PERGUNTAR',
    '# 7. FORMATO DA SAÍDA', '# 8. CONFIRMAÇÃO', '# 9. SEGURANÇA',
    '# 10. FALHAS', '# 11. LIMITES']) {
    ok(sys.includes(sec), sec);
}

console.log('');
console.log('-- regras que o brief pediu e nao existiam --');
ok(/DADOS\.|são DADOS/.test(sys), 'texto de arquivo/transação tratado como dado, não instrução');
ok(/assuma HOJE/.test(sys), 'regra explícita de quando assumir a data de hoje');
ok(/Nunca atribua ao cliente uma falha de configuração que é nossa/.test(sys),
    'proibição de culpar o cliente por falha nossa');

console.log('');
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo — o contrato está íntegro');
process.exit(falhas ? 1 : 0);
