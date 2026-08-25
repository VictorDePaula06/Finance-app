import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import { getUsdRate } from '../utils/marketRates';
import UserAvatar from '../components/UserAvatar';
import {
    LayoutDashboard, Settings, TrendingUp, TrendingDown, Wallet, Eye, EyeOff,
    PieChart as PieIcon, PiggyBank, Landmark, HeartPulse, ChevronRight, X, Check, ListChecks, CreditCard,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const txMonthKey = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');
const catMeta = (id) => CATEGORIES.expense.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };
// Valores em BRL. Ativos dolarizados (isUSD) são convertidos pelo câmbio `rate`.
const invValue = (a, rate = 1) => {
    const m = a.isUSD ? (rate || 5.4) : 1;
    if (a.type === 'renda_fixa') return (parseFloat(a.manualCurrentPrice || a.totalApplied || a.purchasePrice || 0) || 0) * m;
    const q = parseFloat(a.quantity || 1) || 1; return q * (parseFloat(a.manualCurrentPrice || a.purchasePrice || 0) || 0) * m;
};
const invCost = (a, rate = 1) => {
    const m = a.isUSD ? (rate || 5.4) : 1;
    if (a.type === 'renda_fixa') return (parseFloat(a.totalApplied || a.purchasePrice || 0) || 0) * m;
    const q = parseFloat(a.quantity || 1) || 1; return q * (parseFloat(a.purchasePrice || 0) || 0) * m;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CFG_KEY = 'aliviaDashCfg';
const DEFAULT_CFG = { incluirFatura: false, ocultarSaldo: false, somarReservas: true, somarInvest: true, metaReservaMeses: 6, considerarSuperfluo: true };

export default function Dashboard({ onNavigate }) {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [tx, setTx] = useState([]);
    const [subs, setSubs] = useState([]);
    const [cards, setCards] = useState([]);
    const [jars, setJars] = useState([]);
    const [invs, setInvs] = useState([]);
    const [fixExp, setFixExp] = useState([]);
    const [cfg, setCfg] = useState(() => { try { return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || '{}') }; } catch { return DEFAULT_CFG; } });
    const [configOpen, setConfigOpen] = useState(false);
    const [gastosOpen, setGastosOpen] = useState(false); // lista de gastos do mês
    const [hideSaldo, setHideSaldo] = useState(cfg.ocultarSaldo);
    const [usdRate, setUsdRate] = useState(5.4);
    const [patCur, setPatCur] = useState(() => { try { return localStorage.getItem('aliviaDashPatCur') || 'BRL'; } catch { return 'BRL'; } });
    useEffect(() => { getUsdRate().then(r => { if (r) setUsdRate(r); }).catch(() => { }); }, []);
    const togglePatCur = () => { const n = patCur === 'BRL' ? 'USD' : 'BRL'; setPatCur(n); try { localStorage.setItem('aliviaDashPatCur', n); } catch { } };

    const saveCfg = (next) => { setCfg(next); try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { } };

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const list = [
            onSnapshot(q('transactions'), s => setTx(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('subscriptions'), s => setSubs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('cards'), s => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('savings_jars'), s => setJars(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('investments'), s => setInvs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('fixed_expenses'), s => setFixExp(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
        ];
        return () => list.forEach(u => u());
    }, [uid]);

    const saldo = useMemo(() => buildWalletLedger(tx, mk).finalBalance, [tx, mk]);
    const monthTx = useMemo(() => tx.filter(t => txMonthKey(t) === mk && t.paymentMethod !== 'credito'), [tx, mk]);
    // Transferências de reserva (cofre) e ajustes não são ganho/gasto reais.
    const isTransferOrAdj = (t) => t.isTransfer || ['vault', 'vault_redemption', 'initial_balance', 'carryover'].includes(t.category);
    const ganhos = monthTx.filter(t => t.type === 'income' && !isTransferOrAdj(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

    // Fatura do cartão em aberto (avulsas crédito + assinaturas/parcelas)
    const faturaAvulsa = tx.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const faturaSubs = subs.filter(s => s.cardId).reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    const faturaTotal = faturaAvulsa + faturaSubs;

    // Despesas consideradas (com ou sem a fatura, conforme config)
    const expenseTx = useMemo(() => {
        const acct = monthTx.filter(t => t.type === 'expense' && !isTransferOrAdj(t));
        if (!cfg.incluirFatura) return acct;
        // Fatura em aberto = compras avulsas no crédito (coleção transactions)…
        const credito = tx.filter(t => t.type === 'expense' && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid');
        // …+ assinaturas e parcelamentos do cartão (coleção subscriptions), que
        // também compõem a fatura mas não são "transactions". Sem isso, o total
        // ficava bem menor que a fatura real do cartão.
        const cardSubs = subs.filter(s => s.cardId).map(s => ({
            id: `sub_${s.id}`, description: s.name || 'Cartão', amount: parseFloat(s.value) || 0,
            category: s.category || 'other', priority: s.priority || 'comfort',
            paymentMethod: 'credito', type: 'expense', date: null,
        }));
        return [...acct, ...credito, ...cardSubs];
    }, [monthTx, tx, subs, cfg.incluirFatura]);
    const gastos = expenseTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const sobra = ganhos - gastos;
    const superfluo = expenseTx.filter(t => t.priority === 'superfluous').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const superfluoPct = gastos > 0 ? superfluo / gastos * 100 : 0;

    const categorias = useMemo(() => {
        const m = {};
        expenseTx.forEach(t => { m[t.category || 'other'] = (m[t.category || 'other'] || 0) + (parseFloat(t.amount) || 0); });
        return Object.entries(m).map(([id, value]) => { const c = catMeta(id); return { id, label: c.label, color: categoryHex(c), value }; }).sort((a, b) => b.value - a.value);
    }, [expenseTx]);

    const reservaTotal = jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0);
    const mesesCobertura = gastos > 0 ? reservaTotal / gastos : (reservaTotal > 0 ? 99 : 0);
    const metaMeses = Math.max(1, cfg.metaReservaMeses || 6);
    const reservaPct = clamp(mesesCobertura / metaMeses * 100, 0, 100);

    const patrAtual = invs.reduce((a, x) => a + invValue(x, usdRate), 0);
    const patrCusto = invs.reduce((a, x) => a + invCost(x, usdRate), 0);
    const patrRentab = patrCusto > 0 ? (patrAtual - patrCusto) / patrCusto * 100 : 0;
    const patrimonioLiquido = saldo + (cfg.somarReservas ? reservaTotal : 0) + (cfg.somarInvest ? patrAtual : 0);

    // Exibição do patrimônio na moeda escolhida (R$ ou US$).
    const curDiv = patCur === 'USD' ? (usdRate || 5.4) : 1;
    const curSym = patCur === 'USD' ? 'US$' : 'R$';
    const patrAtualDisp = patrAtual / curDiv;
    const patrLiquidoDisp = patrimonioLiquido / curDiv;
    const patrLucroDisp = (patrAtual - patrCusto) / curDiv; // lucro/prejuízo dos investimentos

    // Dívidas mensais: SÓ contas recorrentes marcadas explicitamente como "dívida".
    // Parcelas de cartão NÃO são dívida — são itens da fatura futura (ainda não venceu),
    // então não entram aqui nem derrubam o índice de saúde.
    const dividaMensal = useMemo(() =>
        fixExp.filter(f => f.category === 'divida').reduce((a, f) => a + (parseFloat(f.value) || 0), 0),
        [fixExp]);
    const temDivida = dividaMensal > 0.005;
    const dividaRatio = ganhos > 0 ? dividaMensal / ganhos : (temDivida ? 1 : 0);
    const dividaPct = temDivida ? clamp((1 - clamp(dividaRatio / 0.30, 0, 1)) * 100, 0, 100) : 100;

    // Índice de saúde (pesos normalizados). Dívida é o 1º pilar — quem deve não
    // tem saúde financeira plena, então ela pesa e derruba o score.
    // Calcula quando há QUALQUER dado relevante (renda, dívida, gastos ou reserva) —
    // sem renda, os pilares de reserva/supérfluo ainda fazem sentido.
    const temDados = ganhos > 0 || temDivida || gastos > 0 || reservaTotal > 0;
    const score = useMemo(() => {
        if (!temDados) return 0;
        const wD = 40, wR = 35, wSup = cfg.considerarSuperfluo ? 25 : 0;
        const totalW = wD + wR + wSup;
        const pD = (temDivida ? clamp(1 - clamp(dividaRatio / 0.30, 0, 1), 0, 1) : 1) * wD;
        const pR = clamp(mesesCobertura / metaMeses, 0, 1) * wR;
        const pSup = cfg.considerarSuperfluo ? (1 - clamp(superfluoPct / 100 / 0.2, 0, 1)) * wSup : 0;
        return Math.round((pD + pR + pSup) / totalW * 100);
    }, [temDados, temDivida, dividaRatio, mesesCobertura, metaMeses, superfluoPct, cfg.considerarSuperfluo]);

    const scoreInfo = score >= 80 ? { label: 'Excelente', color: '#10b981' }
        : score >= 60 ? { label: 'Bom', color: '#3b82f6' }
            : score >= 40 ? { label: 'Atenção', color: '#f59e0b' }
                : { label: temDados ? 'Crítico' : 'Sem dados', color: temDados ? '#f43f5e' : '#64748b' };

    const nome = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'você';
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div className="flex items-center gap-4">
                    <UserAvatar className="w-14 h-14 rounded-2xl shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]"
                        fallback={
                            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                                <LayoutDashboard className="w-7 h-7" strokeWidth={2.2} />
                            </span>
                        } />
                    <div>
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Olá, {nome} 👋</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Seu controle financeiro do mês.</p>
                    </div>
                </div>
                <button onClick={() => setConfigOpen(true)} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Settings className="w-4 h-4" /> Configurar
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Kpi isDark={isDark} icon={TrendingUp} label="Ganhos no mês" value={`R$ ${money(ganhos)}`} sub="este mês" tone="emerald" />
                <Kpi isDark={isDark} icon={TrendingDown} label="Gastos no mês" value={`R$ ${money(gastos)}`} sub={cfg.incluirFatura ? 'inclui fatura em aberto' : 'este mês'} tone="rose"
                    action={<button onClick={() => setGastosOpen(true)} title="Ver lista de gastos" className={`p-1 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-600'}`}><ListChecks className="w-4 h-4" /></button>} />

                <Kpi isDark={isDark} icon={Wallet} label="Saldo disponível" value={hideSaldo ? 'R$ ••••' : `R$ ${money(saldo)}`} sub="disponível em conta" tone="blue"
                    action={<button onClick={() => setHideSaldo(h => !h)} className={muted}>{hideSaldo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
            </div>

            {/* Gastos por categoria · Reserva · Patrimônio */}
            <div className="grid lg:grid-cols-3 gap-4 mt-4">
                {/* Gastos por categoria */}
                <div className={cardCls}>
                    <h2 className={`text-[13px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-3 ${muted}`}><PieIcon className="w-3.5 h-3.5 text-emerald-500" /> Gastos por categoria</h2>
                    {categorias.length === 0 ? (
                        <p className={`text-center text-[13px] py-8 ${muted}`}>Você não teve gastos este mês. 🎉</p>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Donut data={categorias} total={gastos} isDark={isDark} label={`R$ ${money(gastos)}`} />
                            <div className="flex-1 min-w-0 space-y-1.5 max-h-[132px] overflow-y-auto no-scrollbar">
                                {categorias.map(c => (
                                    <div key={c.id} className="flex items-center justify-between gap-2 text-[12px]">
                                        <span className="flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} /><span className={`truncate ${cell}`}>{c.label}</span></span>
                                        <span className="font-black tabular-nums shrink-0" style={{ color: c.color }}>{gastos ? Math.round(c.value / gastos * 100) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Reserva de emergência (sem barra) */}
                <div className={cardCls}>
                    <h2 className={`text-[13px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-3 ${muted}`}><PiggyBank className="w-3.5 h-3.5 text-emerald-500" /> Reserva de emergência</h2>
                    <p className="text-3xl font-black tabular-nums text-emerald-500">R$ {money(reservaTotal)}</p>
                    <p className={`text-[12px] mt-0.5 ${muted}`}>{mesesCobertura >= 99 ? '—' : mesesCobertura.toFixed(1).replace('.', ',')} meses de cobertura</p>
                    <div className={`mt-3 flex items-center gap-1.5 text-[12px] ${mesesCobertura >= metaMeses ? 'text-emerald-500 font-bold' : muted}`}>
                        {mesesCobertura >= metaMeses ? <>Meta de {metaMeses} meses atingida 🎉</> : <>Meta: {metaMeses} meses de gastos</>}
                    </div>
                    <Action isDark={isDark} onClick={() => onNavigate?.('reservas')}>Ver detalhes</Action>
                </div>

                {/* Patrimônio */}
                <div className={cardCls}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className={`text-[13px] font-black uppercase tracking-widest flex items-center gap-1.5 ${muted}`}><Landmark className="w-3.5 h-3.5 text-emerald-500" /> Patrimônio</h2>
                        {/* Filtro de moeda R$ / US$ */}
                        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                            {['BRL', 'USD'].map(c => (
                                <button key={c} onClick={() => patCur !== c && togglePatCur()}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-black transition ${patCur === c ? 'bg-emerald-500 text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                    {c === 'BRL' ? 'R$' : 'US$'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-3xl font-black tabular-nums text-emerald-500">{curSym} {money(patrAtualDisp)}</p>
                    <p className={`text-[12px] mt-0.5 ${muted}`}>investido em ativos{patCur === 'USD' ? ` · câmbio R$ ${money(usdRate)}` : ''}</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Rentab.</p>
                            <p className={`text-[15px] font-black tabular-nums ${patrRentab >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{patrRentab >= 0 ? '+' : ''}{patrRentab.toFixed(2)}%</p>
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Lucro</p>
                            <p className={`text-[15px] font-black tabular-nums ${patrLucroDisp >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{patrLucroDisp >= 0 ? '+' : ''}{curSym} {money(patrLucroDisp)}</p>
                        </div>
                    </div>
                    <Action isDark={isDark} onClick={() => onNavigate?.('patrimonio')}>Ver patrimônio</Action>
                </div>
            </div>

            {/* Índice de saúde financeira */}
            <div className="mt-6">
                <p className={`text-center text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${muted}`}>Índice de saúde financeira</p>
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-4 p-5">
                        <div className="flex items-center gap-4 min-w-0">
                            <span className="w-14 h-14 rounded-2xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><HeartPulse className="w-7 h-7" /></span>
                            <div className="min-w-0">
                                {temDados ? (
                                    <>
                                        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: scoreInfo.color }}>{scoreInfo.label}</p>
                                        <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Sua saúde financeira</p>
                                        <p className={`text-[12px] ${muted}`}>Baseado em sobra, reserva{cfg.considerarSuperfluo ? ' e gastos supérfluos' : ''}.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Configure sua renda base</p>
                                        <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Vamos começar? 👋</p>
                                        <p className={`text-[12px] ${muted}`}>Lance seus recebimentos para calcular sua saúde financeira.</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <ScoreRing score={score} color={scoreInfo.color} isDark={isDark} />
                    </div>

                    <div className={`grid ${cfg.considerarSuperfluo ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <Pilar isDark={isDark} border label="Dívidas" value={temDivida ? `R$ ${money(dividaMensal)}/mês` : 'Sem dívidas 🎉'} meta="Meta: zerar dívidas" pct={dividaPct} ok={!temDivida} />
                        <Pilar isDark={isDark} border={cfg.considerarSuperfluo} label="Reserva de emergência" value={`R$ ${money(reservaTotal)}`} meta={`${mesesCobertura >= 99 ? '—' : mesesCobertura.toFixed(1).replace('.', ',')} meses · Meta: ${metaMeses}`} pct={reservaPct} ok={mesesCobertura >= metaMeses} />
                        {cfg.considerarSuperfluo && <Pilar isDark={isDark} label="Gastos supérfluos" value={`${superfluoPct.toFixed(0)}% supérfluo`} meta="Meta: controlar supérfluos" pct={clamp(100 - superfluoPct, 0, 100)} ok={superfluoPct <= 20} />}
                    </div>

                    <div className={`flex items-center justify-between gap-3 px-5 py-3 border-t text-[12px] flex-wrap ${isDark ? 'border-white/10' : 'border-slate-100'} ${muted}`}>
                        <span>Atualizado hoje às {agora} · Renda base: R$ {money(ganhos)}</span>
                        <button onClick={() => onNavigate?.('analises')} className="flex items-center gap-0.5 font-bold text-emerald-500 hover:text-emerald-400 transition">Ver análise completa <ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                </div>

                <div className={`flex items-center justify-center gap-x-5 gap-y-1 flex-wrap mt-3 text-[11px] font-bold ${muted}`}>
                    <Leg color="#10b981" text="Excelente (80-100)" />
                    <Leg color="#3b82f6" text="Bom (60-79)" />
                    <Leg color="#f59e0b" text="Atenção (40-59)" />
                    <Leg color="#f43f5e" text="Crítico (0-39)" />
                </div>
            </div>

            {configOpen && <ConfigModal isDark={isDark} cfg={cfg} onChange={saveCfg} onClose={() => setConfigOpen(false)} faturaTotal={faturaTotal} />}
            {gastosOpen && <GastosModal isDark={isDark} itens={expenseTx} total={gastos} incluiFatura={cfg.incluirFatura} onClose={() => setGastosOpen(false)} />}
        </div>
    );
}

// Modal: lista dos gastos que compõem o "Gastos no mês" (conta + fatura em aberto).
function GastosModal({ isDark, itens, total, incluiFatura, onClose }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const conta = itens.filter(t => t.paymentMethod !== 'credito');
    const fatura = itens.filter(t => t.paymentMethod === 'credito');
    const sum = (arr) => arr.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const ordena = (arr) => [...arr].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0));

    const Linha = ({ t }) => {
        const c = catMeta(t.category);
        const hex = categoryHex(c);
        const Icon = c.icon;
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '';
        return (
            <div className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-4 h-4" />}</span>
                <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description || c.label}</p>
                    <p className={`text-[11px] ${muted}`}>{[dateStr, c.label].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums text-rose-500 whitespace-nowrap">− R$ {money(parseFloat(t.amount) || 0)}</span>
            </div>
        );
    };

    const Bloco = ({ titulo, lista, icone: Ic, cor }) => lista.length === 0 ? null : (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${cor}`}><Ic className="w-3.5 h-3.5" /> {titulo}</span>
                <span className={`text-[12px] font-black tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>R$ {money(sum(lista))}</span>
            </div>
            <div className={`rounded-xl border divide-y overflow-hidden ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
                {ordena(lista).map((t, i) => <Linha key={t.id || i} t={t} />)}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between p-6 pb-4">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-rose-500/12 text-rose-500 flex items-center justify-center shrink-0"><TrendingDown className="w-5 h-5" strokeWidth={2.4} /></span>
                        <div>
                            <h2 className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Gastos no mês</h2>
                            <p className={`text-[12px] ${muted}`}>{itens.length} lançamento{itens.length === 1 ? '' : 's'} · total R$ {money(total)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                <div className="px-6 overflow-y-auto space-y-4 pb-2">
                    {itens.length === 0 ? (
                        <p className={`text-center text-sm py-8 ${muted}`}>Sem gastos neste mês. 🎉</p>
                    ) : (
                        <>
                            <Bloco titulo="Pagos pela conta" lista={conta} icone={Wallet} cor="text-blue-400" />
                            {incluiFatura && <Bloco titulo="Fatura do cartão (em aberto)" lista={fatura} icone={CreditCard} cor="text-amber-400" />}
                        </>
                    )}
                </div>
                <div className={`p-6 pt-4 mt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-black uppercase tracking-widest ${muted}`}>Total dos gastos</span>
                        <span className="text-xl font-black tabular-nums text-rose-500">R$ {money(total)}</span>
                    </div>
                    <p className={`text-[11px] mt-2 ${muted}`}>
                        {incluiFatura
                            ? 'Soma o que saiu da conta + toda a fatura do cartão em aberto: compras avulsas, assinaturas e a parcela do mês de cada parcelamento.'
                            : 'Soma só o que saiu da conta neste mês. A fatura do cartão não está incluída (ajuste em Configurar).'}
                    </p>
                </div>
            </div>
        </div>
    );
}

function Kpi({ isDark, icon: Icon, label, value, sub, tone, action }) {
    const map = {
        emerald: { text: 'text-emerald-500', bg: 'bg-emerald-500/12 text-emerald-500', line: 'from-emerald-500' },
        rose: { text: 'text-rose-500', bg: 'bg-rose-500/12 text-rose-500', line: 'from-rose-500' },
        blue: { text: 'text-blue-400', bg: 'bg-blue-500/12 text-blue-400', line: 'from-blue-500' },
    }[tone];
    return (
        <div className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${map.bg}`}><Icon className="w-4 h-4" /></span>
                    <span className={`text-[12px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                </span>
                {action}
            </div>
            <p className={`text-3xl font-black tabular-nums mt-2 ${map.text}`}>{value}</p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
            <div className={`h-0.5 rounded-full mt-3 bg-gradient-to-r ${map.line} to-transparent`} />
        </div>
    );
}

function Action({ isDark, onClick, children }) {
    return (
        <button onClick={onClick} className={`w-full mt-4 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1 transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {children} →
        </button>
    );
}

function Pilar({ isDark, label, value, meta, pct, ok, border }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div className={`p-4 ${border ? (isDark ? 'sm:border-r border-white/10' : 'sm:border-r border-slate-100') : ''}`}>
            <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
                <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>
            <p className={`text-lg font-black tabular-nums mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
            <p className={`text-[11px] ${muted}`}>{meta}</p>
            <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                <div className={`h-full rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function ScoreRing({ score, color, isDark }) {
    const size = 76, sw = 7, r = (size - sw) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const dash = clamp(score, 0, 100) / 100 * C;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} strokeWidth={sw} />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash} ${C - dash}`} transform={`rotate(-90 ${cx} ${cy})`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{score}</span>
            </div>
        </div>
    );
}

function Donut({ data, total, isDark, label }) {
    const size = 116, sw = 19, r = (size - sw) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    let offset = 0;
    const sum = total || data.reduce((a, d) => a + d.value, 0) || 1;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
                <g transform={`rotate(-90 ${cx} ${cy})`}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} strokeWidth={sw} />
                    {data.map(d => {
                        const dash = (d.value / sum) * C;
                        const el = <circle key={d.id} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />;
                        offset += dash; return el;
                    })}
                </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</span>
                <span className={`text-[12px] font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</span>
            </div>
        </div>
    );
}

function Leg({ color, text }) {
    return <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: color }} /> {text}</span>;
}

// ── Modal de configurações do Dashboard ─────────────────────────────
function ConfigModal({ isDark, cfg, onChange, onClose, faturaTotal }) {
    const set = (patch) => onChange({ ...cfg, ...patch });
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center"><Settings className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Configurações</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>

                <Section isDark={isDark} title="Apuração do mês">
                    <Flag isDark={isDark} on={cfg.incluirFatura} onToggle={v => set({ incluirFatura: v })}
                        label="Incluir fatura em aberto nas despesas"
                        hint={`Soma a fatura do cartão (R$ ${money(faturaTotal)}) aos gastos do mês.`} />
                    <Flag isDark={isDark} on={cfg.ocultarSaldo} onToggle={v => set({ ocultarSaldo: v })}
                        label="Ocultar saldo por padrão" hint="O saldo começa escondido (👁 pra revelar)." />
                </Section>

                <Section isDark={isDark} title="Patrimônio líquido">
                    <Flag isDark={isDark} on={cfg.somarReservas} onToggle={v => set({ somarReservas: v })} label="Somar reservas" hint="Inclui o guardado nas reservas." />
                    <Flag isDark={isDark} on={cfg.somarInvest} onToggle={v => set({ somarInvest: v })} label="Somar investimentos" hint="Inclui o patrimônio investido." />
                </Section>

                <Section isDark={isDark} title="Índice de saúde financeira">
                    <div className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 pr-3">
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Meta de reserva</p>
                            <p className={`text-[11px] ${muted}`}>Meses de cobertura considerados ideais.</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <input inputMode="numeric" value={cfg.metaReservaMeses}
                                onChange={e => set({ metaReservaMeses: Math.max(1, parseInt(e.target.value.replace(/\D/g, '')) || 1) })}
                                className={`w-14 text-center px-2 py-1.5 rounded-lg border text-sm font-black outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
                            <span className={`text-[12px] font-bold ${muted}`}>meses</span>
                        </div>
                    </div>
                    <Flag isDark={isDark} on={cfg.considerarSuperfluo} onToggle={v => set({ considerarSuperfluo: v })}
                        label="Penalizar gastos supérfluos" hint="Considera os gastos supérfluos no índice." />
                </Section>

                <button onClick={onClose} className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                    <Check className="w-4 h-4" /> Concluído
                </button>
            </div>
        </div>
    );
}

function Section({ isDark, title, children }) {
    return (
        <div className={`py-1 border-t first:border-t-0 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest mt-3 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
            {children}
        </div>
    );
}

function Flag({ isDark, on, onToggle, label, hint }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <button type="button" onClick={() => onToggle(!on)} className="w-full flex items-center justify-between gap-3 py-2.5 text-left">
            <div className="min-w-0">
                <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                {hint && <p className={`text-[11px] ${muted}`}>{hint}</p>}
            </div>
            <span className={`w-10 h-6 rounded-full shrink-0 relative transition ${on ? 'bg-emerald-500' : (isDark ? 'bg-white/10' : 'bg-slate-200')}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
        </button>
    );
}
