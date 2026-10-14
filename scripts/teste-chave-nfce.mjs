// Testes da chave de acesso da NFC-e.
//
// É dado fiscal: um dígito lido errado vira outra nota, ou uma nota que não
// existe. O verificador (módulo 11) é o que separa "digitei errado" de
// "o portal está fora do ar" — e essa diferença é a mensagem que a pessoa lê.
//
// Rodar: node scripts/teste-chave-nfce.mjs
import { readFileSync } from 'node:fs';
import { lerChave, dvDaChave, digitosDaChave, formataChave, formataCnpj, urlDeConsulta } from '../src/utils/chaveNfce.js';

let falhas = 0;
const ok = (cond, nome, extra = '') => {
    if (!cond) falhas++;
    console.log(`${cond ? 'ok   ' : 'FALHA'}  ${nome}${extra ? '  — ' + extra : ''}`);
};

// Monta uma chave válida: 43 dígitos + o DV calculado.
const comDv = (d43) => d43 + dvDaChave(d43);

// RJ (33), emitida em 2026-10, CNPJ 12345678000195, NFC-e (65), série 1, nº 123
const base = '33' + '2610' + '12345678000195' + '65' + '001' + '000000123' + '1' + '00000001';
ok(base.length === 43, 'a base tem 43 dígitos antes do DV', `tem ${base.length}`);
const chave = comDv(base);

// ── O que a chave diz ───────────────────────────────────────────────
{
    const i = lerChave(chave);
    ok(i.ok, 'chave válida é aceita', i.erro || '');
    ok(i.uf === 'RJ', 'estado lido do código IBGE', i.uf);
    ok(i.mesEmissao === '2026-10', 'ano e mês da emissão', i.mesEmissao);
    ok(i.cnpj === '12345678000195', 'CNPJ do emitente', i.cnpj);
    ok(i.ehNfce === true, 'reconhece modelo 65 como NFC-e');
    ok(i.numero === 123, 'número da nota', String(i.numero));
    ok(i.serie === 1, 'série', String(i.serie));
}

// ── Erros, cada um com seu motivo ───────────────────────────────────
ok(lerChave('').erro === 'vazia', 'vazio tem motivo próprio');
ok(lerChave('123').erro === 'curta', 'curta demais');
ok(lerChave(chave + '7').erro === 'longa', 'longa demais');
{
    // Troca o último dígito: DV deixa de bater.
    const errado = chave.slice(0, 43) + ((Number(chave[43]) + 1) % 10);
    ok(lerChave(errado).erro === 'dv', 'dígito verificador errado é pego');
}
{
    // Dois dígitos trocados de lugar no meio — o erro de digitação clássico.
    const t = chave.split('');
    [t[10], t[11]] = [t[11], t[10]];
    const trocado = t.join('');
    ok(trocado !== chave, 'a troca realmente mudou a chave');
    ok(lerChave(trocado).ok === false, 'transposição de dígitos é pega pelo DV');
}
ok(lerChave(comDv('99' + base.slice(2))).erro === 'uf', 'código de estado inexistente');
ok(lerChave(comDv(base.slice(0, 4) + '13' + base.slice(6))).erro === 'dv' || lerChave(comDv(base.slice(0, 2) + '2613' + base.slice(6))).erro === 'data',
    'mês fora de 1..12 é recusado');

// ── Entrada suja ────────────────────────────────────────────────────
{
    const sujo = formataChave(chave);            // em blocos de 4
    ok(digitosDaChave(sujo) === chave, 'blocos de 4 voltam a ser a chave');
    ok(lerChave(sujo).ok, 'aceita a chave como vem impressa, com espaços');
    ok(lerChave(` ${chave}\n`).ok, 'aceita com espaço e quebra de linha em volta');
    ok(lerChave('Chave: ' + sujo).ok, 'aceita colada junto com texto ao redor');
}

// ── Portal ──────────────────────────────────────────────────────────
{
    const i = lerChave(chave);
    const u = urlDeConsulta(i);
    ok(u.includes('fazenda.rj.gov.br'), 'RJ aponta para o portal do RJ', u.slice(0, 48));
    ok(u.endsWith(chave), 'a URL termina com a chave');
    const sp = lerChave(comDv('35' + base.slice(2)));
    ok(urlDeConsulta(sp).includes('nfce.fazenda.sp.gov.br'), 'SP aponta para o portal de SP');
    const ap = lerChave(comDv('16' + base.slice(2)));   // Amapá: sem portal próprio
    ok(urlDeConsulta(ap).includes('svrs.rs.gov.br'), 'estado sem portal próprio cai no SVRS');
    ok(urlDeConsulta({ ok: false }) === null, 'chave inválida não vira URL');
}

// ── Formatação ──────────────────────────────────────────────────────
ok(formataCnpj('12345678000195') === '12.345.678/0001-95', 'CNPJ mascarado', formataCnpj('12345678000195'));
ok(formataChave(chave).split(' ').length === 11, 'chave sai em 11 blocos de 4');

// ── Os portais que monto são aceitos pelo servidor? ─────────────────
// O api/_nfce.js só busca em hosts de uma allowlist. Se eu montar uma URL
// para um host fora dela, a consulta morre com `host_not_allowed` e parece
// problema da SEFAZ — quando é divergência entre dois arquivos nossos.
{
    const nfce = readFileSync(new URL('../api/_nfce.js', import.meta.url), 'utf8');
    const i0 = nfce.indexOf('const HOSTS');
    const bloco = nfce.slice(i0, nfce.indexOf(']);', i0));
    const permitidos = new Set([...bloco.matchAll(/'([^']+)'/g)].map(m => m[1]));
    ok(permitidos.size > 5, 'li a allowlist do servidor', `${permitidos.size} hosts`);

    const CODIGO = {
        RJ: '33', SP: '35', MG: '31', MT: '51', RS: '43', PR: '41',
        GO: '52', BA: '29', CE: '23', RN: '24', PE: '26', ES: '32', AP: '16',
    };
    for (const [uf, cod] of Object.entries(CODIGO)) {
        const host = new URL(urlDeConsulta(lerChave(comDv(cod + base.slice(2))))).hostname;
        ok(permitidos.has(host), `${uf}: o host que monto está na allowlist`, host);
    }
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
