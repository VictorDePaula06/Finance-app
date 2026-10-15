// Toda funcao de api/ tem que CARREGAR no Node da hospedagem.
//
// O que aconteceu: firebase-admin/auth puxa jwks-rsa, que faz require('jose'),
// e jose@6 e ESM puro. require() de ESM so existe a partir do Node 22.12 — e a
// Vercel estava rodando abaixo disso. O modulo nao carregava, entao a funcao
// morria ANTES de executar uma linha nossa. Nenhum try/catch dentro do handler
// pega isso: nao ha handler ainda.
//
// Na tela chegou um 500 sem corpo. Tres endpoints estavam mortos assim
// (leitura de cupom, push e upgrade de assinatura) e dois deles em silencio,
// porque ninguem tinha testado desde o deploy.
//
// Este checador carrega cada modulo com require(esm) DESLIGADO, que e o pior
// caso. Se carrega aqui, carrega em qualquer Node que a hospedagem escolher.
//
// Rodar: node scripts/checa-carga-api.mjs
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { execFileSync } from 'child_process';

const arquivos = readdirSync('api').filter(n => n.endsWith('.js')).sort();

let falhas = 0;
for (const nome of arquivos) {
    const url = pathToFileURL(resolve(join('api', nome))).href;
    try {
        execFileSync(process.execPath, [
            '--no-experimental-require-module',
            '--input-type=module',
            '-e', 'await import(' + JSON.stringify(url) + ')',
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        console.log('ok     api/' + nome);
    } catch (e) {
        falhas++;
        const linhas = String(e.stderr || '').split(String.fromCharCode(10));
        const saida = (linhas.find(l => l.includes('Error')) || '').trim();
        console.log('FALHA  api/' + nome);
        console.log('       ' + saida.slice(0, 160));
        if (saida.includes('ERR_REQUIRE_ESM')) {
            console.log('       Pacote CJS exigindo ESM. Veja api/_verifyToken.js para');
            console.log('       o jeito de autenticar sem firebase-admin/auth.');
        }
    }
}

console.log('');
console.log(falhas
    ? falhas + ' modulo(s) que nao carregam no pior caso'
    : 'tudo certo — ' + arquivos.length + ' modulos de api/ carregam');
process.exit(falhas ? 1 : 0);
