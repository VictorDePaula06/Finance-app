// O hash do script inline do index.html bate com o declarado na CSP?
//
// O index.html tem um <script> inline que aplica o tema salvo antes da
// primeira pintura. A CSP não permite 'unsafe-inline', então o script só roda
// se o hash dele estiver na diretiva script-src.
//
// O problema é que o hash muda a cada letra que se mexe no script, e o
// navegador não reclama alto: ele bloqueia e segue. O site continua de pé,
// só que abrindo no tema errado — foi assim que passou despercebido.
//
// Rodar: node scripts/checa-csp-hash.mjs
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Lê o index.html do BUILD, não o fonte: o Vite mexe no inline (comentários,
// espaços) e quem o navegador recebe — e cujo hash ele confere — é o do dist.
if (!existsSync('dist/index.html')) {
    console.log('dist/index.html não existe — rode `npm run build` antes.');
    process.exit(1);
}
const html = readFileSync('dist/index.html', 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

if (!inline.length) {
    console.log('index.html não tem script inline — nada a conferir.');
    process.exit(0);
}

// CRLF -> LF antes de somar: o parser de HTML normaliza a quebra de linha ao
// montar o DOM, e a CSP confere o hash do texto JÁ normalizado. Num repo
// com CRLF, hashear os bytes crus dá um valor que o navegador nunca pede.
const normaliza = (txt) => txt.split('\r\n').join('\n');
const esperados = inline.map(c => 'sha256-' + createHash('sha256').update(normaliza(c), 'utf8').digest('base64'));

let problemas = 0;
for (const arquivo of ['vercel.json', 'vite.config.js']) {
    const csp = readFileSync(arquivo, 'utf8');
    for (const h of esperados) {
        if (csp.includes(`'${h}'`)) {
            console.log(`ok     ${arquivo}  ${h}`);
        } else {
            console.log(`FALTA  ${arquivo}  ${h}`);
            console.log(`       o script inline mudou; acrescente esse hash em script-src`);
            problemas++;
        }
    }
}

console.log(problemas
    ? `\n${problemas} problema(s) — o script de tema seria bloqueado em produção`
    : `\ntudo certo — ${esperados.length} script(s) inline liberado(s) na CSP`);
process.exit(problemas ? 1 : 0);
