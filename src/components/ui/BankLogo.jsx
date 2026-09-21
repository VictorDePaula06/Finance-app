import React, { useState } from 'react';
import { Landmark } from 'lucide-react';

// ── Bancos conhecidos: detecção pelo nome + logo real + cor da marca ──
// O logo vem do favicon oficial do site do banco (serviço de favicons do
// Google, com DuckDuckGo como reserva). Não guardamos nenhuma marca no repo;
// se a imagem não carregar (offline, banco sem favicon), cai num ícone neutro.
//
// `grad` é o gradiente Tailwind aplicado ao cartão quando o banco é reconhecido
// (a pessoa ainda pode trocar a cor à mão no formulário).

export const BANKS = [
    { id: 'nubank',      label: 'Nubank',          domain: 'nubank.com.br',        match: /\bnu\s?bank\b|\bnubank\b|\broxinho\b|\bnu\b/i, grad: 'from-[#8a05be] to-[#5a0a8a]' },
    { id: 'picpay',      label: 'PicPay',          domain: 'picpay.com',           match: /pic\s?pay/i,                                  grad: 'from-[#21c25e] to-[#0f8a3f]' },
    { id: 'itau',        label: 'Itaú',            domain: 'itau.com.br',          match: /ita[uú]/i,                                    grad: 'from-[#ff7a00] to-[#003a70]' },
    { id: 'inter',       label: 'Inter',           domain: 'bancointer.com.br',    match: /\binter\b/i,                                  grad: 'from-[#ff7a00] to-[#c25a00]' },
    { id: 'bradesco',    label: 'Bradesco',        domain: 'bradesco.com.br',      match: /bradesco/i,                                   grad: 'from-[#cc092f] to-[#7a0a1f]' },
    { id: 'santander',   label: 'Santander',       domain: 'santander.com.br',     match: /santander/i,                                  grad: 'from-[#ec0000] to-[#8a0000]' },
    { id: 'caixa',       label: 'Caixa',           domain: 'caixa.gov.br',         match: /\bcaixa\b|\bcef\b/i,                          grad: 'from-[#005ca9] to-[#f39200]' },
    { id: 'bb',          label: 'Banco do Brasil', domain: 'bb.com.br',            match: /banco do brasil|\bbb\b|ourocard/i,            grad: 'from-[#f8d117] to-[#1b3f8f]' },
    { id: 'c6',          label: 'C6 Bank',         domain: 'c6bank.com.br',        match: /\bc6\b/i,                                     grad: 'from-[#2b2b2b] to-[#000000]' },
    { id: 'xp',          label: 'XP',              domain: 'xpi.com.br',           match: /\bxp\b/i,                                     grad: 'from-[#1f1f1f] to-[#3a3a3a]' },
    { id: 'mercadopago', label: 'Mercado Pago',    domain: 'mercadopago.com.br',   match: /mercado\s?pago/i,                             grad: 'from-[#00b1ea] to-[#0a5fa6]' },
    { id: 'neon',        label: 'Neon',            domain: 'neon.com.br',          match: /\bneon\b/i,                                   grad: 'from-[#00a3e0] to-[#0d47a1]' },
    { id: 'next',        label: 'Next',            domain: 'banconext.com.br',     match: /\bnext\b/i,                                   grad: 'from-[#00ff5f] to-[#0b8a3a]' },
    { id: 'btg',         label: 'BTG Pactual',     domain: 'btgpactual.com',       match: /\bbtg\b/i,                                    grad: 'from-[#0b1e3f] to-[#1a3c7a]' },
    { id: 'sicoob',      label: 'Sicoob',          domain: 'sicoob.com.br',        match: /sicoob/i,                                     grad: 'from-[#00ae9d] to-[#003641]' },
    { id: 'sicredi',     label: 'Sicredi',         domain: 'sicredi.com.br',       match: /sicredi/i,                                    grad: 'from-[#3fa110] to-[#1f5e0a]' },
    { id: 'pan',         label: 'Banco Pan',       domain: 'bancopan.com.br',      match: /\bpan\b/i,                                    grad: 'from-[#00a1e0] to-[#004e8a]' },
    { id: 'will',        label: 'Will Bank',       domain: 'willbank.com.br',      match: /\bwill\b/i,                                   grad: 'from-[#f5d000] to-[#c99a00]' },
    { id: 'digio',       label: 'Digio',           domain: 'digio.com.br',         match: /digio/i,                                      grad: 'from-[#0a2a6c] to-[#0d47a1]' },
    { id: 'original',    label: 'Original',        domain: 'original.com.br',      match: /original/i,                                   grad: 'from-[#0bb37d] to-[#04704d]' },
    { id: 'safra',       label: 'Safra',           domain: 'safra.com.br',         match: /safra/i,                                      grad: 'from-[#0a2240] to-[#1c4d8c]' },
    { id: 'banrisul',    label: 'Banrisul',        domain: 'banrisul.com.br',      match: /banrisul/i,                                   grad: 'from-[#005bab] to-[#0a3b6e]' },
    { id: 'ame',         label: 'Ame',             domain: 'amedigital.com',       match: /\bame\b/i,                                    grad: 'from-[#ff2b6d] to-[#a40040]' },
    { id: 'pagbank',     label: 'PagBank',         domain: 'pagbank.com.br',       match: /pag\s?bank|pag\s?seguro/i,                    grad: 'from-[#2fb457] to-[#0d7a35]' },
];

// Reconhece o banco a partir do nome do cartão e/ou do banco digitado.
export const detectBank = (...texts) => {
    const t = texts.filter(Boolean).join(' ');
    if (!t.trim()) return null;
    return BANKS.find(b => b.match.test(t)) || null;
};

const googleFavicon = (domain, size = 128) => `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
const duckFavicon = (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Logo do banco como "ícone de app" (o favicon já vem quadrado e colorido).
// `bank` é um item de BANKS; sem banco ou sem imagem → ícone neutro num tile branco.
export default function BankLogo({ bank, className = 'w-9 h-9', rounded = 'rounded-xl' }) {
    const [step, setStep] = useState(0); // 0 google · 1 duckduckgo · 2 fallback
    const src = !bank ? null : step === 0 ? googleFavicon(bank.domain) : step === 1 ? duckFavicon(bank.domain) : null;
    return (
        <span className={`inline-flex items-center justify-center shrink-0 overflow-hidden shadow-sm ring-1 ring-black/10 ${src ? 'bg-white/90' : 'bg-white'} ${rounded} ${className}`} title={bank?.label}>
            {src
                ? <img src={src} alt={bank.label} loading="lazy" draggable={false} className="w-full h-full object-cover" onError={() => setStep(s => s + 1)} />
                : <Landmark className="w-1/2 h-1/2 text-slate-400" />}
        </span>
    );
}
