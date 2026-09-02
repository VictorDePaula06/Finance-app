import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { createCheckoutSession, createAnnualCheckout, upgradeSubscription, createPortalSession } from '../services/stripe';
import {
    Sparkles, Check, X, Loader2, Crown, Zap, ShieldCheck, Infinity as InfinityIcon,
    CreditCard, MessageCircle, BarChart3, Landmark, FileText, Star, Lock,
} from 'lucide-react';

// Preço "Pro" (Live):
//  • mensal = assinatura recorrente R$ 14,99/mês
//  • anual  = compra ÚNICA R$ 119,88 (parcelável em até 12x). NÃO usamos aqui o
//    VITE_STRIPE_PRICE_ID_YEARLY (esse é o recorrente) — o anual é o preço avulso.
const PRICE_IDS = {
    monthly: import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_1U8JiDKAwb86obAGNbe9Env1',
    annual: import.meta.env.VITE_STRIPE_PRICE_ID_ANNUAL_ONETIME || 'price_1U8IWWKAwb86obAGMUt1Jn4Q',
};

// Preços (definidos pelo produto): anual R$ 9,99/mês (R$ 119,88/ano);
// mensal 25% mais caro = R$ 12,49/mês.
const PRICING = {
    annual: { perMes: '9,99', total: '119,88', label: 'por ano' },
    monthly: { perMes: '14,99', total: '14,99', label: 'por mês' },
};
const ECONOMIA_ANO = '60,00';   // 179,88 (mensal/ano) - 119,88 (anual)
const ECONOMIA_PCT = '33';      // (14,99 - 9,99) / 14,99 ≈ 33%
const FREE_LIMIT = 15;        // lançamentos/mês no plano gratuito
const FREE_WA_LIMIT = 10;     // conversas/mês com a Alívia no WhatsApp (Gratuito)

const PRO_FEATURES = [
    { icon: InfinityIcon, title: 'Lançamentos ilimitados', desc: 'Registre quantas entradas e despesas quiser, sem trava.' },
    { icon: CreditCard, title: 'Cartões e faturas sem limite', desc: 'Vários cartões, parcelamentos, assinaturas e pagamento de fatura.' },
    { icon: Sparkles, title: 'Consultoria Alívia completa', desc: 'IA generativa, leitura de PDF/foto do extrato e lançamento por conversa.' },
    { icon: BarChart3, title: 'Análises e relatórios avançados', desc: 'Todos os relatórios, filtros e exportação em PDF.' },
    { icon: Landmark, title: 'Patrimônio, reservas e metas', desc: 'Investimentos com cotação, reserva de emergência e objetivos.' },
    { icon: MessageCircle, title: 'Alívia no WhatsApp ilimitada', desc: 'Converse, registre gastos, dê baixa, peça relatórios e importe extratos — sem limite.' },
    { icon: ShieldCheck, title: 'Suporte prioritário', desc: 'Atendimento mais rápido quando você precisar.' },
];

const FREE_FEATURES = [
    { ok: true, text: `Até ${FREE_LIMIT} lançamentos por mês` },
    { ok: true, text: 'Dashboard e índice de saúde financeira' },
    { ok: true, text: '1 cartão de crédito' },
    { ok: true, text: `Alívia no WhatsApp — ${FREE_WA_LIMIT} conversas/mês` },
    { ok: false, text: 'Lançamentos e cartões ilimitados' },
    { ok: false, text: 'WhatsApp ilimitado + leitura de extratos (PDF/CSV)' },
    { ok: false, text: 'Patrimônio, análises e relatórios avançados' },
];

export default function Assinatura() {
    const { currentUser, planLevel, isAdmin, stripeSubId, subType } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const [billing, setBilling] = useState('annual');
    const [loading, setLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [error, setError] = useState('');

    const isPro = isAdmin || planLevel === 'premium' || planLevel === 'standard' || planLevel === 'lifetime';
    const isLifetime = planLevel === 'lifetime';
    const p = PRICING[billing];
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const assinar = async () => {
        if (loading) return;
        setLoading(true); setError('');
        const priceId = PRICE_IDS[billing];
        try {
            // Anual = compra ÚNICA (12x): sempre um checkout novo — não é assinatura,
            // então não dá pra "trocar preço" (upgradeSubscription). Só o mensal
            // recorrente aproveita o upgrade quando já existe assinatura ativa.
            if (billing === 'annual') {
                // Compra única parcelável em 12x — endpoint próprio (redireciona).
                await createAnnualCheckout();
            } else if (stripeSubId) {
                await upgradeSubscription(priceId); setLoading(false);
            } else {
                await createCheckoutSession(currentUser.uid, priceId, () => setLoading(false));
            }
        } catch (e) { console.error(e); setError(e?.message || 'Não foi possível iniciar o pagamento. Tente de novo.'); setLoading(false); }
    };
    const gerenciar = async () => {
        if (portalLoading) return;
        setPortalLoading(true);
        try { await createPortalSession({ subscriptionId: stripeSubId, cancel: false, onFinish: () => setPortalLoading(false) }); }
        catch (e) { console.error(e); setPortalLoading(false); }
    };

    const cardCls = `rounded-3xl border p-6 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    return (
        <div className="max-w-5xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="text-center mb-8">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-500/12 text-emerald-500 mb-3">
                    <Crown className="w-3.5 h-3.5" /> Planos Alívia
                </span>
                <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    Sua vida financeira, sem limites.
                </h1>
                <p className={`text-sm sm:text-base mt-2 max-w-xl mx-auto ${muted}`}>
                    Comece de graça. Quando quiser destravar tudo — IA completa, cartões e relatórios — o <b className="text-emerald-500">Pro</b> custa menos que um lanche por mês.
                </p>
                {isPro && (
                    <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-full bg-emerald-500/12 text-emerald-500">
                        <Check className="w-4 h-4" /> Você já é {isLifetime ? 'Pro (Vitalício)' : 'Pro'} 🎉
                    </div>
                )}
            </div>

            {/* Toggle de ciclo */}
            {!isPro && (
                <div className="flex justify-center mb-6">
                    <div className={`relative flex items-center gap-1 p-1 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <button onClick={() => setBilling('monthly')}
                            className={`px-5 py-2 rounded-xl text-[13px] font-black transition ${billing === 'monthly' ? (isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-800 shadow-sm') : muted}`}>
                            Mensal
                        </button>
                        <button onClick={() => setBilling('annual')}
                            className={`px-5 py-2 rounded-xl text-[13px] font-black transition flex items-center gap-2 ${billing === 'annual' ? (isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-800 shadow-sm') : muted}`}>
                            Anual
                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">-{ECONOMIA_PCT}%</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Planos */}
            <div className="grid md:grid-cols-2 gap-5 items-stretch">
                {/* Gratuito */}
                <div className={cardCls}>
                    <div className="flex items-center gap-2.5 mb-1">
                        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Zap className="w-5 h-5" /></span>
                        <div>
                            <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gratuito</p>
                            <p className={`text-[12px] ${muted}`}>Pra começar a se organizar</p>
                        </div>
                    </div>
                    <p className={`text-3xl font-black mt-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ 0<span className={`text-sm font-bold ${muted}`}>/sempre</span></p>

                    <div className="space-y-2.5 mt-5">
                        {FREE_FEATURES.map((f, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${f.ok ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-600' : 'bg-slate-100 text-slate-400')}`}>
                                    {f.ok ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
                                </span>
                                <span className={`text-[13px] ${f.ok ? (isDark ? 'text-slate-300' : 'text-slate-700') : muted} ${!f.ok ? 'line-through' : ''}`}>{f.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className={`mt-5 py-3 rounded-xl text-center text-[13px] font-bold border ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                        {isPro ? 'Seu plano anterior' : 'Seu plano atual'}
                    </div>
                </div>

                {/* Pro (destaque) */}
                <div className={`relative rounded-3xl p-6 border-2 overflow-hidden ${isDark ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.08] to-transparent' : 'border-emerald-400 bg-gradient-to-b from-emerald-50 to-white'}`}>
                    <div className="absolute top-0 right-0">
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> Recomendado
                        </span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <span className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30"><Crown className="w-5 h-5" /></span>
                        <div>
                            <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Pro</p>
                            <p className={`text-[12px] ${muted}`}>A Alívia sem nenhuma trava</p>
                        </div>
                    </div>

                    <div className="mt-3 flex items-end gap-1.5">
                        <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {p.perMes}</span>
                        <span className={`text-sm font-bold mb-1 ${muted}`}>/mês</span>
                    </div>
                    <p className={`text-[12px] mt-1 ${muted}`}>
                        {billing === 'annual'
                            ? <>Cobrado <b className={isDark ? 'text-slate-300' : 'text-slate-700'}>R$ {p.total}/ano</b> · até <b className="text-emerald-500">12x no cartão</b> · economize R$ {ECONOMIA_ANO} ({ECONOMIA_PCT}%)</>
                            : <>No plano mensal · <button onClick={() => setBilling('annual')} className="text-emerald-500 font-bold underline">no anual sai R$ 9,99 (-{ECONOMIA_PCT}%)</button></>}
                    </p>

                    <div className="space-y-2.5 mt-5">
                        {PRO_FEATURES.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div key={i} className="flex items-start gap-2.5">
                                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500"><Icon className="w-3.5 h-3.5" /></span>
                                    <div className="min-w-0">
                                        <p className={`text-[13px] font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{f.title}</p>
                                        <p className={`text-[11px] ${muted}`}>{f.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {error && <p className="text-[12px] font-bold text-rose-500 mt-4 text-center">{error}</p>}

                    <div className="mt-5">
                        {isPro ? (
                            isLifetime ? (
                                <div className="w-full py-3.5 rounded-2xl text-center text-[14px] font-black bg-emerald-500/15 text-emerald-500">Acesso vitalício ativo 💚</div>
                            ) : (
                                <button onClick={gerenciar} disabled={portalLoading}
                                    className={`w-full py-3.5 rounded-2xl text-[14px] font-black flex items-center justify-center gap-2 transition ${isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-800 text-white hover:bg-slate-700'} disabled:opacity-60`}>
                                    {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Gerenciar assinatura
                                </button>
                            )
                        ) : (
                            <button onClick={assinar} disabled={loading}
                                className="w-full py-3.5 rounded-2xl text-[14px] font-black text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition active:scale-[0.98] shadow-lg shadow-emerald-500/30 disabled:opacity-60">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Assinar o Pro
                            </button>
                        )}
                        <p className={`text-[11px] text-center mt-2.5 flex items-center justify-center gap-1.5 ${muted}`}>
                            <Lock className="w-3 h-3" /> Pagamento seguro via Stripe · cancele quando quiser
                        </p>
                    </div>
                </div>
            </div>

            {/* Faixa de marketing / confiança */}
            <div className={`mt-8 grid sm:grid-cols-3 gap-4`}>
                {[
                    { icon: ShieldCheck, t: 'Cancele quando quiser', d: 'Sem multa, sem burocracia. Você controla.' },
                    { icon: Sparkles, t: 'IA que trabalha por você', d: 'Lança gastos, lê extratos e te orienta de verdade.' },
                    { icon: InfinityIcon, t: 'Tudo em um só lugar', d: 'Gastos, cartões, reservas e patrimônio integrados.' },
                ].map((b, i) => {
                    const Icon = b.icon;
                    return (
                        <div key={i} className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                            <Icon className="w-5 h-5 text-emerald-500 mb-2" />
                            <p className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{b.t}</p>
                            <p className={`text-[12px] mt-0.5 ${muted}`}>{b.d}</p>
                        </div>
                    );
                })}
            </div>

            <p className={`text-[11px] text-center mt-6 ${muted}`}>
                Preços em reais (BRL). O plano anual é cobrado de uma vez (R$ {PRICING.annual.total}). Você pode mudar de plano ou cancelar a qualquer momento em “Gerenciar assinatura”.
            </p>
        </div>
    );
}
