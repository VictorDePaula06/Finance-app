// Data e mês do WhatsApp no fuso do produto, não em UTC.
//
// O bug: `new Date().toISOString().slice(0, 7)` é UTC, e o Brasil é UTC-3.
// Entre 21h e 23h59 do último dia do mês, UTC já virou. Isso gravava gasto
// no mês errado — um lançamento às 22h de 31/10 ia para novembro, sumia do
// fechamento de outubro e ninguém tinha como descobrir por quê.
//
// Este teste fixa instantes exatos nessa janela e confere o resultado. É a
// única forma de verificar: num horário qualquer do dia o bug não aparece,
// e por isso ele sobreviveu.
//
// Rodar: node scripts/teste-whatsapp-fuso.mjs
import { readFileSync } from 'node:fs';

// Os auxiliares moram dentro de api/whatsapp.js, que não dá para importar
// (ele puxa firebase-admin e o módulo inteiro). Então extraio a definição
// do arquivo e avalio — assim o teste mede o CÓDIGO DE VERDADE, e não uma
// cópia que pode divergir dele sem ninguém notar.
const fonte = readFileSync('api/whatsapp.js', 'utf8');
// Extrai contando parênteses e chaves, não por regex: `mesAnteriorLocal`
// tem `;` dentro do corpo, e um `[^;]+;` cortaria no primeiro deles.
function extrair(nome) {
    const i = fonte.indexOf(`const ${nome} = `);
    if (i < 0) throw new Error(`não achei o auxiliar ${nome} em api/whatsapp.js`);
    let p = 0, c = 0;
    for (let j = i; j < fonte.length; j++) {
        const ch = fonte[j];
        if (ch === '(') p++; else if (ch === ')') p--;
        else if (ch === '{') c++; else if (ch === '}') c--;
        else if (ch === ';' && p === 0 && c === 0) return fonte.slice(i, j + 1);
    }
    throw new Error(`definição de ${nome} não termina`);
}

const codigo = [
    `const TZ = 'America/Sao_Paulo';`,
    extrair('diaLocal'),
    extrair('mesLocal'),
    extrair('mesAnteriorLocal'),
    extrair('dataLancamento'),
    'return { diaLocal, mesLocal, mesAnteriorLocal, dataLancamento };',
].join('\n');
const { diaLocal, mesLocal, mesAnteriorLocal, dataLancamento } = new Function(codigo)();

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// Congela o relógio num instante exato para testar a janela crítica.
const emQue = (iso, fn) => {
    const Real = Date;
    const fixo = new Real(iso);
    // eslint-disable-next-line no-global-assign
    Date = class extends Real {
        constructor(...a) { return a.length ? new Real(...a) : new Real(fixo); }
        static now() { return fixo.getTime(); }
    };
    try { return fn(); } finally { Date = Real; }
};

console.log('-- a janela que quebrava: 21h-23h59 do ultimo dia (BRT) --');
{
    // 31/10/2026 22:00 em Brasília = 01:00 UTC de 01/11.
    const r = emQue('2026-11-01T01:00:00Z', () => ({ dia: diaLocal(), mes: mesLocal(), data: dataLancamento() }));
    ok(r.mes === '2026-10', 'mes continua outubro as 22h de 31/10', r.mes);
    ok(r.dia === '2026-10-31', 'dia continua 31/10', r.dia);
    ok(r.data === '2026-10-31T00:00:00.000Z', 'data de lancamento no dia certo', r.data);
    // O que o codigo antigo produzia, para deixar o defeito registrado:
    ok(new Date('2026-11-01T01:00:00Z').toISOString().slice(0, 7) === '2026-11',
        'o codigo antigo dava 2026-11 nesse mesmo instante (defeito)');
}
{
    // 31/12/2026 23:30 BRT = 02:30 UTC de 01/01/2027 — vira o ANO tambem.
    const r = emQue('2027-01-01T02:30:00Z', () => ({ mes: mesLocal(), dia: diaLocal() }));
    ok(r.mes === '2026-12', 'virada de ANO: continua dezembro de 2026', r.mes);
    ok(r.dia === '2026-12-31', 'e dia 31/12/2026', r.dia);
}

console.log('');
console.log('-- horarios normais continuam certos --');
for (const [iso, mesEsperado, rotulo] of [
    ['2026-10-15T15:00:00Z', '2026-10', 'meio do mes, meio do dia'],
    ['2026-10-01T12:00:00Z', '2026-10', 'primeiro dia'],
    ['2026-10-31T12:00:00Z', '2026-10', 'ultimo dia, meio-dia'],
    ['2026-11-01T12:00:00Z', '2026-11', 'primeiro dia do mes seguinte'],
]) {
    const m = emQue(iso, mesLocal);
    ok(m === mesEsperado, rotulo, `${iso} -> ${m}`);
}

console.log('');
console.log('-- a madrugada tambem: 00h-03h BRT ainda e o dia local --');
{
    // 01/11/2026 00:30 BRT = 03:30 UTC do mesmo dia. Aqui UTC e local
    // concordam no mes, mas o teste garante que nao inverti o sinal.
    const r = emQue('2026-11-01T03:30:00Z', () => ({ mes: mesLocal(), dia: diaLocal() }));
    ok(r.mes === '2026-11', 'madrugada de 01/11 ja e novembro', r.mes);
    ok(r.dia === '2026-11-01', 'e dia 01/11', r.dia);
}

console.log('');
console.log('-- mes anterior --');
for (const [iso, esperado, rotulo] of [
    ['2026-10-15T15:00:00Z', '2026-09', 'outubro -> setembro'],
    ['2026-01-15T15:00:00Z', '2025-12', 'janeiro -> dezembro do ano passado'],
    ['2026-03-01T15:00:00Z', '2026-02', 'marco -> fevereiro'],
    ['2026-11-01T01:00:00Z', '2026-09', 'na janela critica, parte de outubro'],
]) {
    const m = emQue(iso, mesAnteriorLocal);
    ok(m === esperado, rotulo, `${iso} -> ${m}`);
}

console.log('');
console.log('-- a convencao de data bate com a do app web --');
{
    // O app web grava `new Date('2026-10-31').toISOString()`, que e
    // meia-noite UTC do dia local. O WhatsApp tem de gravar igual, senao
    // os lancamentos das duas origens nao ordenam juntos.
    const doApp = new Date('2026-10-31').toISOString();
    const doWhats = emQue('2026-11-01T01:00:00Z', dataLancamento);
    ok(doApp === doWhats, 'mesmo formato do app web', `${doApp} vs ${doWhats}`);
}

console.log('');
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);
