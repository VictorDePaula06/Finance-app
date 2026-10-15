// ── Reconhecer o MESMO produto escrito de jeitos diferentes ─────────
//
// O cupom não escreve "filezinho". Ele escreve "FILE PEITO FGO SADIA 1KG"
// num mercado e "FILEZINHO FGO PERDIGAO 300G" no outro. Para saber quanto
// se comprou no mês, as duas linhas precisam cair no mesmo lugar.
//
// A `productKey` que já existia em market.js só tira acento e pontuação —
// resolve o mesmo nome digitado torto, não o mesmo produto de marcas
// diferentes. Este módulo vai além: tira peso, embalagem, marca, abreviação
// de cupom e plural, e usa o CONJUNTO de palavras que sobra.
//
// A escolha que importa: isto erra para MENOS, não para mais. "leite
// integral" e "leite condensado" continuam separados, porque juntá-los daria
// um preço médio que não existe e não ajuda ninguém. O preço de um produto
// só vale se o produto for o mesmo.
//
// O que a máquina não resolve, a pessoa resolve uma vez: `aliases` é o mapa
// de junções feitas à mão, e ele vence o automático sempre. Ver
// src/utils/apelidosProduto.js.

// Abreviações de cupom fiscal. Só as que não são ambíguas — "LT" ficou de
// fora de propósito: tanto faz leite quanto litro, e chutar errado junta
// produtos que não têm nada a ver.
const ABREVIACOES = {
    fgo: 'frango', fgos: 'frango', frg: 'frango',
    int: 'integral', integ: 'integral',
    desn: 'desnatado', semidesn: 'semidesnatado',
    refri: 'refrigerante', refrig: 'refrigerante',
    achoc: 'achocolatado', choc: 'chocolate',
    cond: 'condensado',
    marg: 'margarina', mant: 'manteiga',
    det: 'detergente', deterg: 'detergente',
    amac: 'amaciante', sab: 'sabao',
    hig: 'higienico',
    bisc: 'biscoito', bolach: 'bolacha',
    iog: 'iogurte', req: 'requeijao',
    muss: 'mussarela', mussar: 'mussarela', mozzarella: 'mussarela', muçarela: 'mussarela',
    ling: 'linguica', linguic: 'linguica',
    presunt: 'presunto',
    cerv: 'cerveja',
    far: 'farinha', acuc: 'acucar', acucr: 'acucar',
    fil: 'file', filet: 'file', filezinho: 'file',
    peit: 'peito', carn: 'carne',
    cebol: 'cebola', batat: 'batata', cenour: 'cenoura', banan: 'banana',
    tomat: 'tomate',
    azeit: 'azeite',
    macarr: 'macarrao',
};

// Marcas grandes do mercado brasileiro. A lista nunca vai ficar completa, e
// não precisa: marca que sobrar vira só mais uma palavra na chave, e o
// resultado é separar demais — que é o erro barato, consertável com um toque.
const MARCAS = new Set(`
sadia perdigao seara aurora friboi swift korin
italac piracanjuba parmalat elege batavo nestle danone vigor tirol lider
camil tiojoao pratofino urbano
soya liza concordia qualy doriana delicia becel primor
coca cocacola pepsi guarana antarctica brahma skol itaipava heineken budweiser
omo ariel tixan ype limpol minuano veja pinhosol mrmusculo
colgate sorriso closeup oralb dove lux protex palmolive johnson nivea rexona
pampers huggies mamypoko intimus always
kelloggs nescau toddy ovomaltine quaker mucilon maizena
droetker fleischmann bauducco marilan triunfo piraque vitarella aymore nissin
maggi knorr arisco hellmanns heinz quero predilecta bonare fugini
tang kibon nestea dellvale purity sufresh
anhembi santaamalia renata adria galo
`.trim().split(/\s+/));

// Embalagem, promoção e adjetivo de rótulo: dizem como veio, não o que é.
const RUIDO = new Set(`
pacote pct pack lata latao pet garrafa gfa caixa cx sache saco sc bandeja bdj
unid unidade un und uni duzia dz granel gr grs
tipo tp t1 t2 premium especial extra tradicional trad selecionado select
congelado cong resfriado resf fatiado fat ralado rald picado pic moido
promocao promo oferta leve pague gratis brinde novo new
kg g ml l lt litro litros mg
c s p
`.trim().split(/\s+/));

const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'sem', 'em', 'a', 'o', 'no', 'na', 'para', 'pra', 'ao']);

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Plural para singular, nas regras do português que aparecem em rótulo.
 * Conservador: palavra curta fica como está, porque cortar "s" de "arroz"
 * ou "gas" estraga mais do que conserta.
 */
function singular(p) {
    if (p.length <= 3) return p;
    if (p.endsWith('oes') || p.endsWith('aes')) return p.slice(0, -3) + 'ao';
    if (p.endsWith('ais')) return p.slice(0, -3) + 'al';
    if (p.endsWith('eis')) return p.slice(0, -3) + 'el';
    if (p.endsWith('ois')) return p.slice(0, -3) + 'ol';
    if (p.endsWith('ns')) return p.slice(0, -2) + 'm';
    if (p.endsWith('zes') || p.endsWith('res') || p.endsWith('ses')) return p.slice(0, -2);
    if (p.endsWith('s') && !p.endsWith('ss')) return p.slice(0, -1);
    return p;
}

/**
 * Diminutivo só no caso limpo: -zinho/-zinha. "filezinho" vira "file",
 * "pãozinho" vira "pao". O -inho genérico ficou de fora porque transforma
 * "caminho" em "camo" — e um erro desses é pior que não agrupar.
 */
function semDiminutivo(p) {
    if (p.length > 6 && (p.endsWith('zinho') || p.endsWith('zinha'))) return p.slice(0, -5);
    return p;
}

/** As palavras que de fato identificam o produto, já limpas. */
export function palavrasDe(nome) {
    const bruto = semAcento(nome)
        .toLowerCase()
        // "coca cola", "tio joao": marca de duas palavras vira uma só para
        // poder ser reconhecida na lista.
        .replace(/\bcoca\s+cola\b/g, 'cocacola')
        .replace(/\btio\s+joao\b/g, 'tiojoao')
        .replace(/\bprato\s+fino\b/g, 'pratofino')
        .replace(/\bpinho\s+sol\b/g, 'pinhosol')
        .replace(/\bclose\s+up\b/g, 'closeup')
        .replace(/\bdr\.?\s*oetker\b/g, 'droetker')
        // Peso e volume colados ou separados: 300g, 1,5 L, 2X500ML.
        .replace(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*(kg|g|gr|ml|l|lt)\b/g, ' ')
        .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|gr|ml|l|lt|mg|un|und|pct|cx|dz)\b/g, ' ')
        // Qualquer número solto: código interno, gramatura sem unidade, "t1".
        .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const saida = [];
    for (let p of bruto.split(/\s+/)) {
        if (!p || STOPWORDS.has(p)) continue;
        p = ABREVIACOES[p] || p;
        if (MARCAS.has(p) || RUIDO.has(p)) continue;
        p = semDiminutivo(singular(p));
        p = ABREVIACOES[p] || p;          // "filezinho" → "file" entra aqui
        if (!p || p.length < 2 || MARCAS.has(p) || RUIDO.has(p) || STOPWORDS.has(p)) continue;
        if (!saida.includes(p)) saida.push(p);
    }
    return saida;
}

/**
 * Chave automática: o CONJUNTO de palavras, em ordem alfabética — assim
 * "file de peito" e "peito file" são a mesma coisa.
 *
 * Nome que some inteiro na limpeza (só marca e peso) devolve o nome cru
 * normalizado, para não virar tudo uma chave vazia só.
 */
export function rotuloDe(nome) {
    // As mesmas palavras da chave, porém NA ORDEM EM QUE FORAM ESCRITAS —
    // a chave ordena em alfabética para comparar, e "Integral leite" não é
    // nome de nada. Aqui a ordem original volta: "Leite integral".
    const ps = palavrasDe(nome);
    if (!ps.length) return String(nome || '').trim();
    const texto = ps.join(' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function chaveAuto(nome) {
    const ps = palavrasDe(nome);
    if (ps.length) return [...ps].sort().join(' ');
    return semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Unidades ────────────────────────────────────────────────────────
// Somar 300 g com 1 kg tem que dar 1,3 kg, não 301. Mas somar "un" com "kg"
// não dá nada: são grandezas diferentes, e inventar uma conversão seria
// mentira. Então cada grandeza soma na sua.

const BASES = {
    kg: { base: 'g', fator: 1000 }, g: { base: 'g', fator: 1 }, gr: { base: 'g', fator: 1 },
    l: { base: 'ml', fator: 1000 }, lt: { base: 'ml', fator: 1000 }, ml: { base: 'ml', fator: 1 },
    dz: { base: 'un', fator: 12 },
    un: { base: 'un', fator: 1 }, und: { base: 'un', fator: 1 },
};

export const baseDaUnidade = (unit) => {
    const u = String(unit || 'un').toLowerCase();
    return BASES[u] || { base: u, fator: 1 };   // pct, cx: somam entre si
};

/** Quantidade na unidade de leitura humana: 1300 g vira "1,3 kg". */
export function formataQtd(qtdBase, base, locale = 'pt-BR') {
    let valor = qtdBase, unidade = base;
    if (base === 'g' && Math.abs(qtdBase) >= 1000) { valor = qtdBase / 1000; unidade = 'kg'; }
    if (base === 'ml' && Math.abs(qtdBase) >= 1000) { valor = qtdBase / 1000; unidade = 'L'; }
    const casas = Number.isInteger(valor) ? 0 : (Math.abs(valor) < 10 ? 2 : 1);
    return `${valor.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: casas })} ${unidade}`;
}

// ── Apelidos: a correção da pessoa vence a máquina ──────────────────
// Um mapa { chaveDeOrigem: chaveDeDestino }. Quando alguém diz "isto aqui é
// a mesma coisa que aquilo", grava-se a seta — e ela vale para todas as
// compras, as de trás e as da frente, sem precisar repetir.

/** Segue as setas até o fim. O limite existe porque A→B→A trava o laço. */
export function resolveChave(chave, mapa) {
    let k = chave;
    for (let i = 0; i < 12; i++) {
        const prox = mapa?.[k];
        if (!prox || prox === k) break;
        k = prox;
    }
    return k;
}

/** A chave final de um nome: automática, e depois corrigida pelos apelidos. */
export const chaveDe = (nome, mapa) => resolveChave(chaveAuto(nome), mapa);

// ── Quanto se comprou no mês ────────────────────────────────────────
// Sai das compras lançadas, nunca de estimativa. Por produto: o que foi
// gasto, quanto entrou (somado por grandeza) e o último preço pago — que é
// o número que serve na próxima ida ao mercado.

export function consumoDoMes(purchases, mk, mapa, rotulos) {
    const porProduto = new Map();

    // Em ordem de data: assim "o último preço" é mesmo o último.
    const doMes = (purchases || [])
        .filter(p => String(p?.date || '').slice(0, 7) === mk)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    for (const p of doMes) {
        for (const it of p.items || []) {
            const nome = String(it?.name || '').trim();
            if (!nome) continue;
            const chave = chaveDe(nome, mapa);
            if (!chave) continue;

            if (!porProduto.has(chave)) {
                porProduto.set(chave, {
                    chave, rotulo: null, gasto: 0, vezes: 0,
                    quantidades: new Map(),      // base -> qtd somada
                    nomes: new Map(),            // nome cru -> quantas vezes
                    ultimo: null,
                });
            }
            const g = porProduto.get(chave);

            const qtd = Number(it.qty) || 0;
            const preco = Number(it.unitPrice) || 0;
            g.gasto += Math.round(qtd * preco * 100) / 100;
            g.vezes += 1;

            const { base, fator } = baseDaUnidade(it.unit);
            g.quantidades.set(base, (g.quantidades.get(base) || 0) + qtd * fator);
            g.nomes.set(nome, (g.nomes.get(nome) || 0) + 1);

            // Preço só vale se existir; linha sem preço não apaga o anterior.
            if (preco > 0) g.ultimo = { preco, unit: it.unit || 'un', store: p.store || null, date: p.date };
        }
    }

    return [...porProduto.values()].map(g => ({
        chave: g.chave,
        // O rótulo escolhido à mão ganha; senão, o nome que mais apareceu —
        // é o que a pessoa vai reconhecer na prateleira.
        // O nome escolhido à mão ganha sempre. Sem ele, o nome do cupom que
        // mais apareceu, LIMPO: "FILEZINHO FGO SADIA 300G" vira "File
        // frango". O cru continua visível na folha de juntar, para conferir.
        rotulo: rotulos?.[g.chave]
            || rotuloDe([...g.nomes.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0])
            || g.chave,
        gasto: Math.round(g.gasto * 100) / 100,
        vezes: g.vezes,
        quantidades: [...g.quantidades.entries()].map(([base, qtd]) => ({ base, qtd })),
        nomes: [...g.nomes.keys()],
        ultimo: g.ultimo,
    })).sort((a, b) => b.gasto - a.gasto);
}
