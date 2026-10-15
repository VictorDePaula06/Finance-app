// O `currentUser` do AuthContext nao tem os metodos do Firebase.
//
// Em AuthContext.jsx o usuario e reespalhado num objeto literal para pendurar
// os dados da assinatura: `setCurrentUser(prev => ({ ...prev, subscriptionInfo }))`.
// O spread copia os campos e perde o prototype — `getIdToken`, `reload`,
// `delete` e companhia somem. O objeto continua parecendo um usuario, e so
// quebra na hora de chamar o metodo.
//
// Foi exatamente assim que a leitura de cupom quebrou em producao: o erro
// chegou na tela como "Sua sessao expirou", e a sessao estava perfeita.
//
// Quem precisa de metodo usa `auth.currentUser`, de services/firebase.
//
// Rodar: node scripts/checa-metodos-do-usuario.mjs
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const METODOS = ['getIdToken', 'getIdTokenResult', 'reload', 'delete', 'toJSON'];
const PALAVRA = (c) => c !== undefined && /[A-Za-z0-9_$.]/.test(c);

const arquivos = [];
(function varre(dir) {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) varre(p);
        else if (/\.(jsx?|tsx?)$/.test(nome)) arquivos.push(p);
    }
})('src');

let falhas = 0;
for (const arq of arquivos) {
    const txt = readFileSync(arq, 'utf8');
    if (!txt.includes('useAuth()')) continue;

    // Quais nomes vieram DO CONTEXTO neste arquivo.
    const nomes = new Set();
    for (const m of txt.matchAll(/const\s*\{([^}]*)\}\s*=\s*useAuth\(\)/g)) {
        for (const parte of m[1].split(',')) {
            const n = parte.split(':').pop().trim();
            if (n) nomes.add(n);
        }
    }
    if (!nomes.size) continue;

    txt.split('\n').forEach((linha, i) => {
        for (const nome of nomes) {
            for (const metodo of METODOS) {
                for (const sep of ['.', '?.']) {
                    const alvo = nome + sep + metodo + '(';
                    let at = linha.indexOf(alvo);
                    while (at !== -1) {
                        // `auth.currentUser.getIdToken()` contem
                        // `currentUser.getIdToken()` e esta certo: o que vale e
                        // o nome SOZINHO, sem nada colado antes dele.
                        if (!PALAVRA(linha[at - 1])) {
                            falhas++;
                            console.log(`FALHA  ${arq}:${i + 1}`);
                            console.log(`       ${nome}${sep}${metodo}() — esse objeto nao tem metodos.`);
                            console.log(`       Use auth.currentUser.${metodo}() (import { auth } from 'services/firebase').`);
                        }
                        at = linha.indexOf(alvo, at + 1);
                    }
                }
            }
        }
    });
}

console.log(falhas
    ? `\n${falhas} uso(s) de metodo num usuario que nao tem metodo`
    : `\ntudo certo — ${arquivos.length} arquivos conferidos`);
process.exit(falhas ? 1 : 0);
