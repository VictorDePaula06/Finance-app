// Procura componente usado em JSX sem estar importado nem declarado.
//
// Nasceu de um erro real: ao mover o modal de WhatsApp para fora do
// Dashboard, o import não entrou junto. O build passou (um identificador
// livre não é erro de bundling) e o lint também — a regra que pegaria isso
// não está ligada. Só quebrou no clique, em produção.
//
// Rodar: node scripts/checa-jsx-indefinido.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '@babel/parser';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(RAIZ, 'src');

const arquivos = [];
(function varrer(dir) {
    for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) varrer(p);
        else if (nome.endsWith('.jsx')) arquivos.push(p);
    }
})(SRC);

// Nomes que o JSX resolve sozinho, sem import.
const GLOBAIS = new Set(['React', 'Fragment']);

let problemas = 0;

for (const arquivo of arquivos) {
    const codigo = readFileSync(arquivo, 'utf8');
    let ast;
    try {
        ast = parse(codigo, { sourceType: 'module', plugins: ['jsx'] });
    } catch (e) {
        console.log(`PARSE  ${relative(RAIZ, arquivo)}: ${e.message}`);
        problemas++;
        continue;
    }

    const definidos = new Set(GLOBAIS);
    const usados = new Map();   // nome -> linha

    const registrarPadrao = (no) => {
        if (!no) return;
        if (no.type === 'Identifier') definidos.add(no.name);
        else if (no.type === 'ObjectPattern') no.properties.forEach(p => registrarPadrao(p.value || p.argument));
        else if (no.type === 'ArrayPattern') no.elements.forEach(registrarPadrao);
        else if (no.type === 'AssignmentPattern') registrarPadrao(no.left);
        else if (no.type === 'RestElement') registrarPadrao(no.argument);
    };

    const andar = (no, dentro = false) => {
        if (!no || typeof no !== 'object') return;
        if (Array.isArray(no)) { no.forEach(x => andar(x, dentro)); return; }
        if (!no.type) return;

        if (no.type === 'ImportDeclaration') no.specifiers.forEach(e => definidos.add(e.local.name));
        if (no.type === 'VariableDeclarator') registrarPadrao(no.id);
        if (no.type === 'FunctionDeclaration' || no.type === 'ClassDeclaration') {
            if (no.id) definidos.add(no.id.name);
            no.params?.forEach(registrarPadrao);
        }
        if (no.type === 'FunctionExpression' || no.type === 'ArrowFunctionExpression') no.params?.forEach(registrarPadrao);

        // <Algo> — só nomes que começam com maiúscula são componentes; o
        // resto (<div>, <span>) é tag de HTML e não precisa de import.
        if (no.type === 'JSXOpeningElement') {
            let n = no.name;
            while (n.type === 'JSXMemberExpression') n = n.object;   // <Foo.Bar> → Foo
            if (n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name) && !usados.has(n.name)) {
                usados.set(n.name, no.loc.start.line);
            }
        }

        for (const chave of Object.keys(no)) {
            if (chave === 'loc' || chave === 'start' || chave === 'end') continue;
            andar(no[chave], dentro);
        }
    };

    andar(ast.program.body);

    for (const [nome, linha] of usados) {
        if (!definidos.has(nome)) {
            console.log(`FALTA  ${relative(RAIZ, arquivo)}:${linha}  <${nome}> usado mas não importado`);
            problemas++;
        }
    }
}

console.log(problemas
    ? `\n${problemas} problema(s) em ${arquivos.length} arquivos`
    : `\ntudo certo — ${arquivos.length} arquivos .jsx conferidos`);
process.exit(problemas ? 1 : 0);
