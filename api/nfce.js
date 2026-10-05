/**
 * Vercel Serverless Function: /api/nfce
 *
 * Lê uma NFC-e a partir da URL do QR Code impresso no cupom e devolve os
 * produtos já estruturados, item a item.
 *
 * Query: url=<URL completa do QR Code>
 * Resposta: { store, date, total, items: [{ name, qty, unit, unitPrice, total }], key }
 *
 * Por que no servidor: a consulta da SEFAZ não libera CORS, então o
 * navegador não consegue buscar direto.
 *
 * SEGURANÇA: o parâmetro é uma URL que o servidor vai buscar — isto é um
 * SSRF esperando acontecer se aceitar qualquer endereço. Só passam hosts da
 * lista abaixo, e só com uma chave de 44 dígitos no parâmetro `p`.
 */

import { rateLimit } from './_rateLimit.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Portais de consulta de NFC-e. O do RJ é o primeiro porque é o alvo;
// os demais entram porque o QR é o mesmo padrão nacional (NT 2015/002)
// e o cupom pode ser de outro estado.
const HOSTS = new Set([
    'www4.fazenda.rj.gov.br',
    'www.fazenda.rj.gov.br',
    'consultadfe.fazenda.rj.gov.br',
    'www.nfce.fazenda.sp.gov.br',
    'nfce.fazenda.sp.gov.br',
    'nfce.fazenda.mg.gov.br',
    'www.sefaz.mt.gov.br',
    'nfce.sefaz.rs.gov.br',
    'www.sefaz.rs.gov.br',
    'nfce.fazenda.pr.gov.br',
    'www.fazenda.pr.gov.br',
    'nfce.sefaz.go.gov.br',
    'nfe.sefaz.ba.gov.br',
    'nfce.sefaz.ce.gov.br',
    'nfce.set.rn.gov.br',
    'nfce.sefaz.pe.gov.br',
    'www.sefaz.es.gov.br',
    'dfe-portal.svrs.rs.gov.br',
]);

const limpa = (s) => String(s || '').replace(/&nbsp;/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// "1.234,56" → 1234.56 ; "5,99" → 5.99
const numBR = (s) => {
    const t = String(s || '').replace(/[^\d.,-]/g, '');
    if (!t) return 0;
    const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
};

/**
 * O portal de consulta da NFC-e usa o mesmo HTML de referência em quase
 * todos os estados: cada produto é uma linha com spans de classe fixa.
 *
 *   <span class="txtTit">ARROZ TIPO 1 5KG</span>
 *   <span class="Rqtd"><strong>Qtde.:</strong>1</span>
 *   <span class="RUN"><strong>UN: </strong>UN</span>
 *   <span class="RvlUnit"><strong>Vl. Unit.:</strong> 28,90</span>
 *   <span class="valor">28,90</span>
 */
function parseItens(html) {
    const itens = [];

    // Cada produto começa num txtTit e termina antes do próximo.
    const blocos = html.split(/<span\s+class=["']txtTit["']\s*>/i).slice(1);
    for (const bruto of blocos) {
        const bloco = bruto.slice(0, 2000);          // uma linha não passa disso

        const name = limpa(bloco.split('</span>')[0]);
        if (!name) continue;

        const qtd = bloco.match(/class=["']Rqtd["'][^>]*>([\s\S]*?)<\/span>/i);
        const un = bloco.match(/class=["']RUN["'][^>]*>([\s\S]*?)<\/span>/i);
        const vu = bloco.match(/class=["']RvlUnit["'][^>]*>([\s\S]*?)<\/span>/i);
        const vl = bloco.match(/class=["']valor["'][^>]*>([\s\S]*?)<\/span>/i);

        // Sem quantidade nem valor não é linha de produto (é cabeçalho, rodapé…).
        if (!qtd && !vl) continue;

        const qty = numBR(limpa(qtd?.[1]).replace(/qtde\.?:?/i, '')) || 1;
        const unit = (limpa(un?.[1]).replace(/un:?/i, '').trim() || 'un').toLowerCase();
        const totalLinha = numBR(limpa(vl?.[1]));
        let unitPrice = numBR(limpa(vu?.[1]).replace(/vl\.?\s*unit\.?:?/i, ''));
        // Alguns portais omitem o unitário: deriva do total.
        if (!unitPrice && totalLinha && qty) unitPrice = Math.round((totalLinha / qty) * 100) / 100;

        itens.push({
            name,
            qty,
            unit: unit.slice(0, 6),
            unitPrice,
            total: totalLinha || Math.round(qty * unitPrice * 100) / 100,
        });
    }
    return itens;
}

function parseCabecalho(html) {
    const loja = html.match(/class=["']txtTopo["'][^>]*>([\s\S]*?)<\/(?:div|h4|span)>/i);
    const emissao = html.match(/Emiss[ãa]o\s*:?\s*<\/strong>\s*([\d/]{8,10})/i)
        || html.match(/Emiss[ãa]o\s*:?\s*([\d/]{8,10})/i);
    const total = html.match(/class=["'][^"']*totalNumb[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

    let date = null;
    if (emissao) {
        const [d, m, a] = limpa(emissao[1]).split('/');
        if (d && m && a) date = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return {
        store: loja ? limpa(loja[1]).slice(0, 120) : null,
        date,
        total: total ? numBR(limpa(total[1])) : 0,
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');      // cupom é dado da pessoa
    if (req.method === 'OPTIONS') return res.status(200).end();

    const bruta = String(req.query.url || '').trim();
    if (!bruta) return res.status(400).json({ error: 'missing_url' });

    let alvo;
    try {
        alvo = new URL(bruta);
    } catch {
        return res.status(400).json({ error: 'invalid_url' });
    }

    // Só https/http e só portal de SEFAZ conhecido.
    if (!/^https?:$/.test(alvo.protocol) || !HOSTS.has(alvo.hostname.toLowerCase())) {
        return res.status(400).json({ error: 'host_not_allowed' });
    }

    // O `p` começa sempre pela chave de acesso de 44 dígitos.
    const p = alvo.searchParams.get('p') || '';
    const chave = (p.split('|')[0] || '').replace(/\D/g, '');
    if (chave.length !== 44) return res.status(400).json({ error: 'invalid_key' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'anon';
    const rl = await rateLimit(`nfce:${ip}`, { limit: 30, windowSec: 60 });
    if (!rl.ok) return res.status(429).json({ error: 'rate_limited' });

    // Alguns portais só respondem num dos esquemas; tenta os dois.
    const tentativas = [alvo.toString()];
    if (alvo.protocol === 'http:') tentativas.unshift(alvo.toString().replace(/^http:/, 'https:'));
    else tentativas.push(alvo.toString().replace(/^https:/, 'http:'));

    try {
        let html = null;
        let bloqueio = null;

        for (const u of tentativas) {
            let r;
            try {
                r = await fetch(u, {
                    headers: {
                        'User-Agent': UA,
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'pt-BR,pt;q=0.9',
                    },
                    redirect: 'follow',
                });
            } catch {
                continue;
            }
            if (!r.ok) continue;
            const corpo = await r.text();

            // O portal responde 200 com a página do cupom OU com uma barreira.
            // Reconhece a barreira pelo conteúdo, não pelo código HTTP.
            if (/txtTit|tabResult/i.test(corpo)) { html = corpo; break; }
            if (/Queremos saber se é humano|support ID|captcha/i.test(corpo)) { bloqueio = bloqueio || 'sefaz_captcha'; continue; }
            if (/manuten[çc][ãa]o|bloqueado e\/ou negado|Acesso bloqueado/i.test(corpo)) { bloqueio = bloqueio || 'sefaz_blocked'; continue; }
        }

        if (!html) return res.status(502).json({ error: bloqueio || 'sefaz_unreachable' });

        const itens = parseItens(html);
        if (!itens.length) return res.status(422).json({ error: 'no_items', key: chave });

        const cab = parseCabecalho(html);
        return res.status(200).json({
            key: chave,
            store: cab.store,
            date: cab.date,
            total: cab.total || Math.round(itens.reduce((a, i) => a + i.total, 0) * 100) / 100,
            items: itens,
        });
    } catch (e) {
        console.error('nfce:', e?.message || e);
        return res.status(502).json({ error: 'sefaz_unreachable' });
    }
}
