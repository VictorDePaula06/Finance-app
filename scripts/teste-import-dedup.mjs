// A fatura do mês seguinte não pode lançar tudo de novo.
//
// O caso que originou isto, dito pelo usuário: "lancei a fatura do meu
// cartão e tinha alguns parcelamentos, no mês seguinte quando eu enviar a
// fatura também vai ter as mesmas parcelas".
//
// É um erro que não aparece no primeiro uso — só no segundo mês, quando a
// pessoa já confiou nos números. Por isso os testes aqui simulam DUAS
// importações seguidas, e não uma.
//
// Rodar: node scripts/teste-import-dedup.mjs
import { classificarImportacao, parseInstallment, casaNome, totalIgnorado } from '../api/_importDedup.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

const gasto = (description, amount, date = '2026-10-10') =>
    ({ description, amount, date, type: 'expense', category: 'shopping' });

console.log('-- o caso do usuario: fatura de outubro, depois a de novembro --');
{
    // Outubro: cartão sem nada cadastrado ainda.
    const out = classificarImportacao({
        items: [gasto('KABUM PARC03/12', 200), gasto('NETFLIX.COM', 55.90), gasto('Padaria', 18)],
        usaParcelas: true, assinaturas: [], parcelas: [], lancados: [],
    });
    ok(out.parcelaNova.length === 1, 'outubro: a parcela vira UM parcelamento novo');
    ok(out.novos.length === 2, 'outubro: netflix e padaria entram como gasto', `${out.novos.length}`);

    // Novembro: agora o parcelamento existe (na 3ª), e a Netflix foi
    // cadastrada como assinatura. A fatura traz as duas de novo.
    const nov = classificarImportacao({
        items: [gasto('KABUM PARC04/12', 200, '2026-11-10'), gasto('NETFLIX.COM', 55.90, '2026-11-05'), gasto('Mercado', 230, '2026-11-08')],
        usaParcelas: true,
        parcelas: [{ id: 'p1', name: 'KABUM', value: 200, totalInstallments: 12, currentInstallment: 3 }],
        assinaturas: [{ id: 'a1', name: 'Netflix', value: 55.90 }],
        lancados: [],
    });
    ok(nov.parcelaNova.length === 0, 'novembro: NAO cria um segundo parcelamento');
    ok(nov.parcelaAvanca.length === 1, 'novembro: avanca a parcela existente para a 4a');
    ok(nov.parcelaAvanca[0]?.inst.current === 4, 'e a altura certa', String(nov.parcelaAvanca[0]?.inst.current));
    ok(nov.assinaturaRepetida.length === 1, 'novembro: a Netflix e reconhecida como assinatura ja cadastrada');
    ok(nov.novos.length === 1 && nov.novos[0].description === 'Mercado', 'so o Mercado entra', `${nov.novos.length} novo(s)`);
    ok(totalIgnorado(nov) === 1, 'um item ignorado, para contar no resumo', String(totalIgnorado(nov)));
}

console.log('');
console.log('-- reenviar a MESMA fatura nao duplica nada --');
{
    const itens = [gasto('KABUM PARC03/12', 200), gasto('Padaria', 18)];
    const r = classificarImportacao({
        items: itens,
        usaParcelas: true,
        parcelas: [{ id: 'p1', name: 'KABUM', value: 200, totalInstallments: 12, currentInstallment: 3 }],
        lancados: [{ description: 'Padaria', amount: 18, date: '2026-10-10' }],
    });
    ok(r.parcelaNova.length === 0 && r.parcelaAvanca.length === 0, 'a parcela nao anda (ja esta na 3a)');
    ok(r.novos.length === 0, 'a padaria nao entra de novo');
    ok(r.duplicados.length === 2, 'as duas contam como duplicadas', String(r.duplicados.length));
}

console.log('');
console.log('-- a MESMA linha repetida dentro do proprio PDF --');
{
    const r = classificarImportacao({
        items: [gasto('Uber', 23), gasto('Uber', 23)],
        usaParcelas: false,
    });
    ok(r.novos.length === 1, 'entra uma vez so', String(r.novos.length));
    ok(r.duplicados.length === 1, 'a segunda e marcada como duplicada');
}

console.log('');
console.log('-- o que NAO pode ser confundido --');
{
    // Duas compras diferentes na mesma loja, mesmo nº de parcelas, valores
    // distintos: são DUAS, e juntar faria sumir uma dívida real.
    const r = classificarImportacao({
        items: [gasto('KABUM PARC02/10', 150)],
        usaParcelas: true,
        parcelas: [{ id: 'p1', name: 'KABUM', value: 480, totalInstallments: 10, currentInstallment: 1 }],
    });
    ok(r.parcelaNova.length === 1, 'valor diferente = outra compra, cadastra separado');

    // Mesmo nome, mesmo dia, valores diferentes: duas idas ao mesmo lugar.
    const r2 = classificarImportacao({
        items: [gasto('Padaria', 25)],
        lancados: [{ description: 'Padaria', amount: 18, date: '2026-10-10' }],
    });
    ok(r2.novos.length === 1, 'mesmo lugar com valor diferente entra normalmente');

    // Mesmo nome e valor, DIAS diferentes: a assinatura mensal é pega pelo
    // cadastro, mas uma compra avulsa repetida em outro dia é real.
    const r3 = classificarImportacao({
        items: [gasto('Padaria', 18, '2026-10-20')],
        lancados: [{ description: 'Padaria', amount: 18, date: '2026-10-10' }],
    });
    ok(r3.novos.length === 1, 'mesmo valor em outro dia e outra compra');

    // Entrada (estorno) não pode ser confundida com assinatura.
    const r4 = classificarImportacao({
        items: [{ description: 'NETFLIX.COM', amount: 55.90, date: '2026-11-05', type: 'income', category: 'other' }],
        assinaturas: [{ id: 'a1', name: 'Netflix', value: 55.90 }],
    });
    ok(r4.assinaturaRepetida.length === 0 && r4.novos.length === 1, 'estorno de assinatura entra (e abate a fatura)');
}

console.log('');
console.log('-- o nome que a operadora escreve bate com o do app --');
{
    for (const [daFatura, doApp] of [
        ['NETFLIX.COM', 'Netflix'],
        ['NETFLIX *MENSAL', 'Netflix'],
        ['Spotify.com BR', 'Spotify'],
        ['AMAZON PRIME BR', 'Amazon Prime'],
        ['MERCADOLIVRE*MPARC', 'Mercado Livre'],
    ]) {
        ok(casaNome(daFatura, doApp), `"${daFatura}" casa com "${doApp}"`);
    }
    // E o que NÃO pode casar:
    ok(!casaNome('Netflix', 'Spotify'), 'nomes diferentes nao casam');
}

console.log('');
console.log('-- a leitura da parcela --');
{
    for (const [desc, c, t] of [
        ['MLP *KABUM-PARC10/10', 10, 10],
        ['MERCADOLIVRE*MPARC03/04', 3, 4],
        ['PARCELA 3 DE 10', 3, 10],
        ['KABUM 04/04', 4, 4],
    ]) {
        const i = parseInstallment(desc);
        ok(i && i.current === c && i.total === t, `"${desc}"`, i ? `${i.current}/${i.total}` : 'não leu');
    }
    // Não é parcela: data e código de loja cairiam aqui se a faixa não
    // fosse validada, e um falso positivo cobraria meses que não existem.
    for (const desc of ['Mercado 15/03', 'Loja 99/99', 'Posto 01/01']) {
        ok(parseInstallment(desc) === null, `"${desc}" NAO e parcela`);
    }
}

console.log('');
console.log('-- desligar a leitura de parcelas ("a vista") --');
{
    const r = classificarImportacao({
        items: [gasto('KABUM PARC03/12', 200)],
        usaParcelas: false,
    });
    ok(r.parcelaNova.length === 0 && r.novos.length === 1, 'com usaParcelas=false, entra como compra normal');
}

console.log('');
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);
