// Toda chave de texto usada no código existe nos três idiomas?
//
// Quando não existe, o app mostra a CHAVE na tela. Foi o que apareceu no
// dashboard: "health.metaDebts" embaixo de Dívidas, e a frase "Baseado em
// sobra, reservahealth.andSuperfluous" — o nome da variável colado no meio
// do texto, para o usuário ler.
//
// Isso não quebra nada, não aparece no console e o build passa. Por isso
// durou: só é visível para quem OLHA aquela parte da tela, e eram quatro
// chaves num canto que ninguém revisava.
//
// A paridade entre idiomas já era conferida à mão a cada mudança. O que
// faltava era o outro lado: o que o código PEDE e o dicionário não tem.
//
// Rodar: node scripts/checa-i18n.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IDIOMAS = ['pt', 'en', 'es'];

// As chaves de cada dicionário.
const dicionario = {};
for (const lang of IDIOMAS) {
    const txt = readFileSync(`src/locales/${lang}.js`, 'utf8');
    dicionario[lang] = new Set([...txt.matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]));
}

// Os arquivos que usam t().
const fontes = [];
(function varre(dir) {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) { varre(p); continue; }
        if (/\.(jsx?|tsx?)$/.test(nome) && !p.includes(join('src', 'locales'))) fontes.push(p);
    }
})('src');

// `t('chave')` e `t("chave")`. Chave montada em variável não dá para
// conferir estaticamente, e por isso fica de fora — este teste cobre o
// caso comum, que é o literal.
const usos = new Map();          // chave -> arquivos
for (const arq of fontes) {
    const txt = readFileSync(arq, 'utf8');
    for (const m of txt.matchAll(/\bt\(\s*['"]([a-zA-Z][\w.]*)['"]/g)) {
        if (!usos.has(m[1])) usos.set(m[1], new Set());
        usos.get(m[1]).add(arq);
    }
}

let falhas = 0;
console.log(`${usos.size} chaves usadas em ${fontes.length} arquivos`);
console.log('');

for (const [chave, arquivos] of [...usos].sort()) {
    const faltando = IDIOMAS.filter(l => !dicionario[l].has(chave));
    if (!faltando.length) continue;
    falhas++;
    console.log(`FALHA  ${chave}`);
    console.log(`       falta em: ${faltando.join(', ')}`);
    console.log(`       usada em: ${[...arquivos].join(', ')}`);
}

// E o contrário: chave no dicionário que ninguém usa. Não é erro — há
// chaves montadas dinamicamente — então isto só informa, não reprova.
const orfas = [...dicionario.pt].filter(k => !usos.has(k));
console.log('');
console.log(falhas
    ? `${falhas} chave(s) que o código pede e o dicionário não tem`
    : `tudo certo — nenhuma chave aparece crua na tela (${orfas.length} no dicionário sem uso literal)`);
process.exit(falhas ? 1 : 0);
