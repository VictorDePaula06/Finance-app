// Confere se cada import resolveria num sistema de arquivos CASE-SENSITIVE,
// e se o arquivo importado está versionado.
//
// O Windows não diferencia maiúscula de minúscula: `./Foo` acha `foo.jsx` e
// o build passa. O Linux da Vercel diferencia — lá o mesmo import não acha
// nada e o build morre. É o tipo de erro que só aparece no deploy.
//
// Também pega arquivo importado que ficou fora do git (ignorado ou nunca
// adicionado): existe aqui, não existe no servidor.
//
// Rodar: node scripts/checa-imports-linux.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { execSync } from 'node:child_process';

const RAIZ = process.cwd();
const EXTS = ['', '.js', '.jsx', '.mjs', '.json', '.css', '/index.js', '/index.jsx'];

// Tudo que o git conhece, no caso exato em que ele guarda.
const versionados = new Set(
    execSync('git ls-files', { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 })
        .toString().split('\n').filter(Boolean).map(p => p.replace(/\//g, '\\')),
);

const arquivos = [];
(function varrer(dir) {
    for (const nome of readdirSync(dir)) {
        if (nome === 'node_modules' || nome === 'dist' || nome === 'dev-dist' || nome.startsWith('.')) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.(jsx?|mjs)$/.test(nome)) arquivos.push(p);
    }
})(join(RAIZ, 'src'));
for (const extra of ['index.html']) {
    const p = join(RAIZ, extra);
    if (existsSync(p)) arquivos.push(p);
}

// O nome existe no disco com ESTA grafia exata?
const grafiaConfere = (caminho) => {
    const pasta = dirname(caminho);
    if (!existsSync(pasta)) return false;
    return readdirSync(pasta).includes(basename(caminho));
};

let problemas = 0;

for (const arquivo of arquivos) {
    const codigo = readFileSync(arquivo, 'utf8');
    const linhas = codigo.split('\n');

    linhas.forEach((linha, i) => {
        // import ... from './x'  ·  import './x'  ·  import('./x')
        const m = linha.match(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/);
        if (!m) return;
        const pedido = m[1];
        const base = resolve(dirname(arquivo), pedido);

        const achado = EXTS.map(e => base + e).find(p => existsSync(p));
        if (!achado) {
            console.log(`NAO RESOLVE  ${relative(RAIZ, arquivo)}:${i + 1}  '${pedido}'`);
            problemas++;
            return;
        }
        if (!grafiaConfere(achado)) {
            console.log(`CAIXA        ${relative(RAIZ, arquivo)}:${i + 1}  '${pedido}' -> ${relative(RAIZ, achado)} (grafia diferente no disco)`);
            problemas++;
            return;
        }
        const rel = relative(RAIZ, achado);
        if (!versionados.has(rel)) {
            console.log(`FORA DO GIT  ${relative(RAIZ, arquivo)}:${i + 1}  '${pedido}' -> ${rel} não está versionado`);
            problemas++;
        }
    });
}

console.log(problemas
    ? `\n${problemas} problema(s) — este build quebraria no Linux`
    : `\ntudo certo — ${arquivos.length} arquivos conferidos`);
process.exit(problemas ? 1 : 0);
