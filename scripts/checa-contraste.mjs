// A identidade da Alívia tem que continuar LEGÍVEL.
//
// O Manual de Identidade Visual define as cores e o papel de cada uma. O
// que ele não define — porque não é trabalho dele — é se a combinação
// passa no contraste mínimo de leitura. E é aí que paleta bonita vira
// tela que ninguém consegue usar.
//
// Este checador existe porque o app JÁ tinha esse defeito antes da marca
// nova: `bg-emerald-500 text-white` em 144 botões dava 2,2:1 com o verde
// claro do tema escuro, quando o mínimo para texto é 4,5:1. Ninguém
// percebeu porque nada media.
//
// Os números saem do próprio src/index.css — se alguém trocar um valor lá,
// este teste fala. Não é decoração: é a diferença entre a marca na tela e
// a marca ilegível na tela.
//
// Referência: WCAG 2.1 — 4,5:1 para texto normal, 3:1 para texto grande e
// para elementos de interface (bordas, ícones, limites de botão).
//
// Rodar: node scripts/checa-contraste.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';

const css = readFileSync('src/index.css', 'utf8');

// As variáveis do tema CLARO moram no :root — ele é o tema padrão. As do
// escuro moram em `.theme-dark`. Ler cada uma do bloco certo é o que faz
// este teste medir o que a tela realmente usa, e não um valor parecido
// que aparece primeiro no arquivo.
// O arquivo é CRLF, então o seletor é achado por regex e não por texto
// literal com \n — procurar '.theme-dark {\n' não acha nada aqui, a busca
// cai no arquivo inteiro e o teste passa a medir o tema errado. Foi o que
// aconteceu na primeira versão: o escuro reprovava com os valores do claro.
const bloco = (re) => {
    const m = css.match(re);
    if (!m) throw new Error('não achei o bloco ' + re);
    // Começa NO início do match: a primeira propriedade do bloco faz parte
    // dele, e pular o match inteiro a deixaria de fora.
    return [m.index, css.indexOf('}', m.index)];
};
const BLOCO = {
    root: bloco(/:root\s*\{/),
    light: bloco(/\.theme-light\s*\{\s*[\r\n]+\s*--color-slate-50/),
    dark: bloco(/\.theme-dark\s*\{\s*[\r\n]+\s*--bg-primary/),
};

function valor(nome, onde = 'root') {
    const [a, b] = BLOCO[onde];
    const m = css.slice(a, b).match(new RegExp('--' + nome + '\\s*:\\s*(#[0-9a-fA-F]{6})'));
    if (!m) throw new Error(`não achei --${nome} em ${onde}`);
    return m[1].toLowerCase();
}

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lumi = (h) => {
    const [r, g, b] = hex(h).map(c => c / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
    const [x, y] = [lumi(a), lumi(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};

let falhas = 0;
function exige(nome, frente, fundo, minimo) {
    const c = contraste(frente, fundo);
    const ok = c >= minimo;
    if (!ok) falhas++;
    console.log(`${ok ? 'ok   ' : 'FALHA'}  ${nome.padEnd(46)} ${c.toFixed(2)}:1  (mín ${minimo})`);
}

const TEXTO = 4.5;      // texto normal
const UI = 3;           // ícone, borda, limite de botão

// ── Tema claro ──────────────────────────────────────────────────────
console.log('-- TEMA CLARO (fundo Leveza) --');
{
    const bg = valor('bg-primary');
    const B = (n) => valor(n, 'light');

    exige('texto principal sobre a página', valor('text-primary'), bg, TEXTO);
    exige('texto secundário sobre a página', valor('text-secondary'), bg, TEXTO);
    exige('acento como TEXTO sobre a página', B('color-emerald-500'), bg, TEXTO);
    exige('ícone (emerald-400) sobre a página', B('color-emerald-400'), bg, UI);

    // Os 144 botões de ação: rótulo branco sobre o acento.
    exige('rótulo branco no botão de ação', '#ffffff', B('color-emerald-500'), TEXTO);
    exige('rótulo branco no botão em hover', '#ffffff', B('color-emerald-600'), TEXTO);

    // Texto esmaecido é texto: tem de passar igual.
    for (const [classe, cor] of [...css.matchAll(/\.theme-light \.text-slate-(\d+) \{ color: (#[0-9a-f]{6})/g)]
        .map(m => [m[1], m[2]])) {
        exige(`text-slate-${classe} (forçado) sobre a página`, cor, bg, TEXTO);
    }
}

// ── Tema escuro ─────────────────────────────────────────────────────
console.log('');
console.log('-- TEMA ESCURO --');
{
    const bg = valor('bg-primary', 'dark');
    const D = (n) => valor(n, 'dark');

    exige('texto principal sobre a página', valor('text-primary', 'dark'), bg, TEXTO);
    exige('texto secundário sobre a página', valor('text-secondary', 'dark'), bg, TEXTO);
    exige('acento como TEXTO sobre a página', D('color-emerald-500'), bg, TEXTO);
    exige('ícone (emerald-400) sobre a página', D('color-emerald-400'), bg, UI);

    // No escuro o acento é claro, então o rótulo do botão é que escurece.
    // Este é o conserto do defeito de 2,2:1 que existia antes da marca nova.
    const rotulo = (css.match(/\.theme-dark :is\([^)]*\)\.text-white \{\s*color: (#[0-9a-f]{6})/) || [])[1];
    if (!rotulo) { falhas++; console.log('FALHA  não achei a regra do rótulo escuro dos botões'); }
    else {
        exige('rótulo escuro no botão de ação', rotulo, D('color-emerald-500'), TEXTO);
        exige('rótulo escuro no botão em hover', rotulo, D('color-emerald-600'), TEXTO);
        exige('botão se destaca da página', D('color-emerald-500'), bg, UI);
    }
}

// ── A paleta do manual continua sendo a paleta do manual ────────────
console.log('');
console.log('-- CORES DO MANUAL, intactas --');
{
    const MANUAL = {
        'alv-leveza': '#e6f7f5', 'alv-paz': '#b2dfdb', 'alv-harmonia': '#54978b',
        'alv-alivio': '#2a6257', 'alv-reflexo': '#9eccc6',
        'alv-celeste': '#d9f0f6', 'alv-acqua': '#9cdad8', 'alv-terracota': '#d9a88d',
        'alv-profundo': '#3b5966', 'alv-areia': '#e8dcc8',
    };
    for (const [nome, esperado] of Object.entries(MANUAL)) {
        const achado = valor(nome);
        const ok = achado === esperado;
        if (!ok) falhas++;
        console.log(`${ok ? 'ok   ' : 'FALHA'}  --${nome.padEnd(42)} ${achado}${ok ? '' : ' — o manual diz ' + esperado}`);
    }
}

// ── O logotipo tem que aparecer no ícone do app ─────────────────────
// Erro cometido: ao aplicar o manual eu troquei o fundo do ícone
// adaptativo por Leveza, porque Leveza é "o fundo da marca". Mas o
// logotipo da Alívia é claro — sobre Leveza ele cai para 1,7:1 e some.
// O ícone do app ficou um disco quase vazio, e eu só percebi porque me
// perguntaram.
//
// A amostra vem de brand/logo-amostra.json, escrito por
// scripts/gera-icones.py. Assim ela acompanha o logo: trocar a arte
// regenera a amostra, e este teste continua medindo a arte de verdade em
// vez de cores que alguém digitou uma vez.
//
// O critério é o percentil 75 de brilho, não a cor mais frequente: a
// arte tem sombreado 3D, e as cores mais comuns nela são verdes escuros.
// Quem desenha a forma do logo são os brilhos — medir a cor mais
// frequente reprovaria um ícone que lê perfeitamente bem.
console.log('');
console.log('-- o logo aparece no ícone do app --');
{
    const amostra = 'brand/logo-amostra.json';
    const corArq = 'mobile/resources/android/cor-de-fundo.txt';
    if (!existsSync(amostra) || !existsSync(corArq)) {
        falhas++;
        console.log('FALHA  rode `python scripts/gera-icones.py` — falta ' +
            (existsSync(amostra) ? corArq : amostra));
    } else {
        const a = JSON.parse(readFileSync(amostra, 'utf8'));
        const fundo = readFileSync(corArq, 'utf8').trim().toLowerCase();

        // A amostra guarda o fundo com que foi medida. Se alguém mudar a
        // cor à mão sem regenerar, os dois discordam e é melhor saber.
        if (a.fundo.toLowerCase() !== fundo) {
            falhas++;
            console.log(`FALHA  a amostra foi medida sobre ${a.fundo}, mas o ícone usa ${fundo}`);
            console.log('       rode `python scripts/gera-icones.py` de novo');
        }
        const c = contraste(a.p75, fundo);
        const ok = c >= 4.5;
        if (!ok) falhas++;
        console.log(`${ok ? 'ok   ' : 'FALHA'}  brilho do logo sobre ${fundo.padEnd(27)} ${c.toFixed(2)}:1  (mín 4.5)`);
        if (!ok) console.log('       o ícone do app ficaria quase vazio — use um fundo escuro da marca');
    }
}

// ── A identidade antiga não pode voltar ─────────────────────────────
// Ela saiu em quatro escondidos diferentes, e o último foi o pior: o
// #69C8B9 estava escrito como `rgba(105, 200, 185, .25)`, em DECIMAL.
// Toda busca por hexadecimal passou por cima dele, e ele chegou até
// dentro do APK. Por isso este teste procura as duas formas.
console.log('');
console.log('-- identidade antiga, nas duas formas --');
{
    const ANTIGAS = [
        ['verde-respira', '69c8b9', [105, 200, 185]],
        ['azul-ceu', '5cceea', [92, 206, 234]],
        ['crema-paz', 'fff08c', [255, 240, 140]],
        ['ouro-suave', 'fff09a', [255, 240, 154]],
        ['acento antigo', '3dc590', [61, 197, 144]],
        ['azul-ardosia', '0f172a', [15, 23, 42]],
    ];
    const fontes = [];
    (function varre(dir) {
        for (const nome of readdirSync(dir)) {
            const p = dir + '/' + nome;
            if (statSync(p).isDirectory()) varre(p);
            else if (/\.(css|jsx?|html)$/.test(nome)) fontes.push(p);
        }
    })('src');
    fontes.push('index.html', 'tailwind.config.js');

    for (const [nome, hexa, [r, g, b]] of ANTIGAS) {
        const achados = [];
        for (const arq of fontes) {
            const txt = readFileSync(arq, 'utf8');
            if (txt.toLowerCase().includes('#' + hexa)) achados.push(arq + ' (hex)');
            // A forma decimal: foi ela que escapou da primeira limpeza.
            // Montada sem escapes para não depender de como a string é
            // lida — o backslash já se perdeu uma vez no caminho.
            const esp = String.raw`\s*`;
            const dec = new RegExp(
                String.raw`rgba?\(` + esp + r + esp + ',' + esp + g + esp + ',' + esp + b + esp + '[,)]');
            if (dec.test(txt)) achados.push(arq + ' (rgb)');
        }
        const ok = achados.length === 0;
        if (!ok) falhas++;
        console.log(`${ok ? 'ok   ' : 'FALHA'}  ${nome.padEnd(20)} #${hexa}${ok ? ' — fora' : '  ainda em: ' + achados.join(', ')}`);
    }
}

console.log('');
console.log(falhas ? `${falhas} problema(s) de contraste ou de paleta` : 'tudo certo — a marca está legível');
process.exit(falhas ? 1 : 0);
