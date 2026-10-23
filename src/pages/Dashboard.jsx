import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import { getUsdRate } from '../utils/marketRates';
import UserAvatar from '../components/UserAvatar';
import WhatsAppStatusButton from '../components/WhatsAppStatusButton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import CeilingAlerts from '../components/CeilingAlerts';
import BankLogo, { detectBank } from '../components/ui/BankLogo';
import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { useI18n } from '../contexts/LanguageContext';
import RedirectOverlay, { DESTINO, useRedirect } from '../components/ui/RedirectOverlay';
import WhatsAppStatusModal from '../components/WhatsAppStatusModal';
import CadastrosModal from '../components/CadastrosModal';
import { useDashCfg } from '../contexts/DashCfgContext';
import {
    LayoutDashboard, Settings, TrendingUp, TrendingDown, Wallet,
    Repeat, PieChart as PieIcon, PiggyBank, Landmark, HeartPulse, ChevronRight, X, Check, ListChecks, CreditCard, CheckCircle2, ExternalLink,
} from 'lucide-react';

// Telefone só dígitos → "+55 (21) 99999-9999".

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

export default function Dashboard({ onNavigate }) {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const { t, fmtMoney: money, fmtMonth, fmtDate } = useI18n();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [tx, setTx] = useState([]);
    const [subs, setSubs] = useState([]);
    const [cards, setCards] = useState([]);
    const [jars, setJars] = useState([]);
    const [invs, setInvs] = useState([]);
    const [fixExp, setFixExp] = useState([]);
    // A configuração vive no contexto: quem edita é a janela de Cadastros.
    const { cfg } = useDashCfg();
    // Período dos indicadores. Vale para Ganhos, Gastos e a composição —
    // NÃO para fatura, patrimônio e custo mensal, que são retratos de agora
    // e de um mês, não acumulados.
    const [periodo, setPeriodo] = useState('mes');   // 'mes' | '3m' | '6m'
    const [configOpen, setConfigOpen] = useState(false);
    const [gastosOpen, setGastosOpen] = useState(false); // lista de gastos do mês
    const [waOpen, setWaOpen] = useState(false);        // janela de status do WhatsApp
    const wa = useWhatsAppStatus();
    // Navegação com a janela rápida "Você será direcionado para…" (~0,8s e vai).
    const { redirect, goTo: goWith } = useRedirect();
    const DEST_KEY = { cartoes: 'nav.card', reservas: 'nav.reserves', patrimonio: 'nav.patrimony', analises: 'nav.analysis', whatsapp: 'settings.tabWhatsApp', configuracoes: 'nav.settings' };
    const goTo = (id) => goWith(DEST_KEY[id] ? t(DEST_KEY[id]) : (DESTINO[id] || id), () => onNavigate?.(id));
    const [usdRate, setUsdRate] = useState(5.4);
    const [patCur, setPatCur] = useState(() => { try { return localStorage.getItem('aliviaDashPatCur') || 'BRL'; } catch { return 'BRL'; } });
    useEffect(() => { getUsdRate().then(r => { if (r) setUsdRate(r); }).catch(() => { }); }, []);
    const togglePatCur = () => { const n = patCur === 'BRL' ? 'USD' : 'BRL'; setPatCur(n); try { localStorage.setItem('aliviaDashPatCur', n); } catch { } };

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

    // O que escrever embaixo do número: dizer "neste mês" com o filtro em
    // 6 meses seria mentira, e é o tipo de rótulo que ninguém relê.
    const rotuloPeriodo = periodo === '6m' ? t('dash.per6m') : periodo === '3m' ? t('dash.per3m') : t('common.thisMonth');

    // Os meses que o período cobre, do mais antigo ao atual.
    const mesesPeriodo = useMemo(() => {
        const n = periodo === '6m' ? 6 : periodo === '3m' ? 3 : 1;
        const hoje = new Date();
        return Array.from({ length: n }, (_, i) => {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        });
    }, [periodo]);

    // `monthTx` continua sendo o MÊS corrente: quem depende de "agora" (saldo,
    // fatura) não pode seguir o filtro. `periodoTx` é o recorte do filtro.
    const monthTx = useMemo(() => tx.filter(t => txMonthKey(t) === mk && t.paymentMethod !== 'credito'), [tx, mk]);
    const periodoTx = useMemo(() => {
        const set = new Set(mesesPeriodo);
        return tx.filter(t => set.has(txMonthKey(t)) && t.paymentMethod !== 'credito');
    }, [tx, mesesPeriodo]);
    // Transferências de reserva (cofre) e ajustes não são ganho/gasto reais.
    const isTransferOrAdj = (t) => t.isTransfer || ['vault', 'vault_redemption', 'initial_balance', 'carryover'].includes(t.category);
    const ganhos = periodoTx.filter(t => t.type === 'income' && !isTransferOrAdj(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

    // Fatura em aberto POR CARTÃO (avulsas no crédito + assinaturas/parcelas) e o total de todos.
    const faturaPorCartao = useMemo(() => cards.map(c => {
        const avulsa = tx.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' && t.selectedCardId === c.id).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
        const rec = subs.filter(s => s.cardId === c.id).reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
        return { card: c, total: avulsa + rec };
    }).sort((a, b) => b.total - a.total), [cards, tx, subs]);
    const faturaTotal = faturaPorCartao.reduce((a, f) => a + f.total, 0);

    // Próximo vencimento da fatura (o mais próximo entre os cartões cadastrados).
    const faturaDue = useMemo(() => {
        const comDia = cards.filter(c => c.dueDay);
        if (!comDia.length) return null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let best = null;
        for (const c of comDia) {
            let due = new Date(now.getFullYear(), now.getMonth(), c.dueDay);
            if (due < today) due = new Date(now.getFullYear(), now.getMonth() + 1, c.dueDay);
            if (!best || due < best.due) best = { due, day: c.dueDay };
        }
        best.days = Math.round((best.due - today) / 86400000);
        return best;
    }, [cards]);

    // Despesas consideradas (com ou sem a fatura, conforme config)
    const isBill = (t) => t.category === 'credit_card_bill';
    const expenseTx = useMemo(() => {
        // Sem incluir a fatura: mostra só os gastos DA CONTA (fora do cartão) — nem as
        // compras no crédito, nem o pagamento da fatura entram. Assim a diferença entre
        // ligado/desligado é exatamente a fatura do cartão.
        if (!cfg.incluirFatura) return periodoTx.filter(t => t.type === 'expense' && !isTransferOrAdj(t) && !isBill(t));

        // Incluindo a fatura: conta as compras do cartão diretamente e
        // IGNORA o pagamento da fatura (credit_card_bill), senão o mesmo gasto entraria
        // duas vezes (a compra + a quitação). Assim, pagar a fatura não altera o total.
        const acct = periodoTx.filter(t => t.type === 'expense' && !isTransferOrAdj(t) && !isBill(t));
        // Compras no crédito contam no MÊS EM QUE FORAM FEITAS, pagas ou não. Pagar a
        // fatura só quita o saldo — não move nem apaga o gasto do mês original (e como
        // o pagamento credit_card_bill é ignorado acima, também não conta em dobro).
        const mesesSet = new Set(mesesPeriodo);
        const credito = tx.filter(t => t.type === 'expense' && t.paymentMethod === 'credito'
            && mesesSet.has(txMonthKey(t)));
        // …+ assinaturas e parcelamentos do cartão (coleção subscriptions), que
        // também compõem a fatura mas não são "transactions".
        const cardSubs = subs.filter(s => s.cardId).map(s => ({
            id: `sub_${s.id}`, description: s.name || 'Cartão', amount: parseFloat(s.value) || 0,
            category: s.category || 'other', priority: s.priority || 'comfort',
            paymentMethod: 'credito', type: 'expense', date: null,
        }));
        // Assinatura é cobrança MENSAL: num período de 3 ou 6 meses ela pesa
        // uma vez por mês. Contar uma só faria o gasto encolher conforme o
        // período cresce, que é o oposto do que a pessoa espera ver.
        const porMes = mesesPeriodo.flatMap(m => cardSubs.map(c => ({ ...c, id: `${c.id}_${m}`, month: m })));
        return [...acct, ...credito, ...porMes];
    }, [periodoTx, tx, subs, cfg.incluirFatura, mesesPeriodo]);
    const gastos = expenseTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const sobra = ganhos - gastos;
    const superfluo = expenseTx.filter(t => t.priority === 'superfluous').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const superfluoPct = gastos > 0 ? superfluo / gastos * 100 : 0;

    // ── Evolução da renda vs. despesas ──────────────────────────────
    // Sempre seis meses, independente do filtro. O filtro recorta OS
    // NÚMEROS; este gráfico é sobre a linha do tempo, e com um mês só ele
    // vira uma barra sozinha, que não mostra evolução nenhuma.
    const evolucao = useMemo(() => {
        const hoje = new Date();
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
            const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const doMes = tx.filter(t => txMonthKey(t) === m);
            const renda = doMes.filter(t => t.type === 'income' && !isTransferOrAdj(t))
                .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            const despesa = doMes.filter(t => t.type === 'expense' && !isTransferOrAdj(t) && !isBill(t))
                .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            return { mk: m, mes: fmtMonth(m, { month: 'short' }), renda, despesa };
        });
    }, [tx, fmtMonth]);

    // ── Composição dos gastos, por categoria ────────────────────────
    // Sai de `expenseTx`, o mesmo conjunto do KPI de Gastos: os dois têm de
    // somar igual, senão a rosquinha contradiz o número ao lado dela.
    const composicao = useMemo(() => {
        const porCat = new Map();
        for (const t of expenseTx) {
            const id = t.category || 'other';
            porCat.set(id, (porCat.get(id) || 0) + (parseFloat(t.amount) || 0));
        }
        return [...porCat.entries()]
            .map(([id, value]) => {
                const meta = catMeta(id);
                return { id, value, label: meta.label, color: categoryHex(meta) };
            })
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [expenseTx]);

    // ── Atividade recente ───────────────────────────────────────────
    // As últimas lançadas, do período escolhido. Sem data não dá para
    // ordenar no tempo, então essas ficam por último.
    const recentes = useMemo(() => [...periodoTx]
        .filter(t => !isTransferOrAdj(t))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 4), [periodoTx]);

    const reservaTotal = jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0);
    // Custo fixo mensal (igual Análises): contas fixas + assinaturas + parcelas.
    const custoFixo = useMemo(() =>
        fixExp.reduce((a, f) => a + (parseFloat(f.value) || 0), 0)
        + subs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0),
        [fixExp, subs]);
    // Cobertura da reserva medida contra o CUSTO FIXO; meta = meses da reserva de
    // emergência (se houver), senão a configuração do dashboard.
    const emergJar = useMemo(() => jars.find(j => j.reserveType === 'emergencia'), [jars]);
    const mesesCobertura = custoFixo > 0 ? reservaTotal / custoFixo : (reservaTotal > 0 ? 99 : 0);
    const metaMeses = Math.max(1, (emergJar && parseInt(emergJar.months)) || cfg.metaReservaMeses || 6);
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

    const scoreInfo = score >= 80 ? { label: t('health.excellent'), color: '#10b981' }
        : score >= 60 ? { label: t('health.good'), color: '#3b82f6' }
            : score >= 40 ? { label: t('health.attention'), color: '#f59e0b' }
                : { label: temDados ? t('health.critical') : t('health.noData'), color: temDados ? '#f43f5e' : '#64748b' };

    const nome = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'você';
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const cardCls = `rounded-2xl border p-4 flex flex-col ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <UserAvatar className="w-12 h-12 rounded-2xl shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]"
                        fallback={
                            <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                                <LayoutDashboard className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.2} />
                            </span>
                        } />
                    <div className="min-w-0">
                        <h1 className={`text-[19px] sm:text-2xl font-black tracking-tight leading-tight line-clamp-2 sm:truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('dash.hello', { name: nome })} 👋</h1>
                        {/* Subtítulo: análise rápida da Alívia sobre tetos (quando houver) ou a frase padrão */}
                        <div className={`text-[13px] sm:text-sm mt-0.5 ${muted}`}>
                            <CeilingAlerts transactions={tx} mk={mk} isDark={isDark} fallback={t('dash.subtitle')} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Período dos indicadores. Um controle só: dois filtros
                        competindo (um aqui, outro dentro do gráfico) fazem a pessoa
                        perguntar qual manda em quê.

                        No desktop fica no cabeçalho; no celular desce para uma
                        fileira própria logo abaixo — espremido aqui ele não cabe,
                        e escondê-lo tirava do celular um controle que o desktop
                        tem, o que é um recurso pela metade. */}
                    <div className="hidden sm:block"><FiltroPeriodo periodo={periodo} setPeriodo={setPeriodo} isDark={isDark} muted={muted} t={t} /></div>
                    {/* O atalho do WhatsApp subiu para a barra superior: aparece em
                        todas as abas, não só aqui. No mobile, onde a barra não existe,
                        ele continua neste cabeçalho. */}
                    <span className="lg:hidden">
                        <WhatsAppStatusButton isDark={isDark} compact onOpen={() => (wa.connected ? setWaOpen(true) : goTo('whatsapp'))} />
                    </span>
                    <button onClick={() => setConfigOpen(true)} title={t('dash.configure')} className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <Settings className="w-4 h-4" /> {t('dash.configure')}
                    </button>
                </div>
            </div>

            {/* No celular o filtro ganha a largura inteira, logo abaixo do
                cabeçalho — é onde cabe sem apertar nada. */}
            <div className="sm:hidden mb-3">
                <FiltroPeriodo periodo={periodo} setPeriodo={setPeriodo} isDark={isDark} muted={muted} t={t} largura />
            </div>

            {/* KPIs. Cinco numa fileira: os três do período (ganhos, gastos,
                custo) e os dois retratos de agora (fatura e patrimônio), que
                antes ocupavam cards grandes numa segunda fileira.

                A reserva saiu daqui: ela já aparece nos pilares da saúde
                financeira logo abaixo, e tinha card próprio só por herança. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Kpi isDark={isDark} icon={TrendingUp} label={t('dash.gains')} value={<AnimatedNumber value={ganhos} format={(v) => `R$ ${money(v)}`} />} sub={rotuloPeriodo} tone="emerald" />
                <Kpi isDark={isDark} icon={TrendingDown} label={t('dash.spent')} value={<AnimatedNumber value={gastos} format={(v) => `R$ ${money(v)}`} />} sub={cfg.incluirFatura ? t('dash.spentWithInvoice') : t('dash.spentAccountOnly')} tone="rose"
                    action={<button onClick={() => setGastosOpen(true)} title={t('dash.seeExpenses')} className={`p-1 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-600'}`}><ListChecks className="w-4 h-4" /></button>} />
                <Kpi isDark={isDark} icon={Repeat} label={t('dash.fixedCost')} value={<AnimatedNumber value={custoFixo} format={(v) => `R$ ${money(v)}`} />} sub={t('dash.fixedCostSub')} tone="blue" />

                {/* Fatura: o detalhe por cartão virou um clique. A lista inteira
                    dentro de um card do dashboard competia com o número, que é o
                    que se quer ver de relance. */}
                <Kpi isDark={isDark} icon={CreditCard} label={t('dash.invoice')} tone="amber"
                    value={<AnimatedNumber value={faturaTotal} format={(v) => `R$ ${money(v)}`} />}
                    sub={faturaDue
                        ? `${t('dash.invoiceDue', { day: faturaDue.day, days: faturaDue.days, daysWord: faturaDue.days === 1 ? t('common.day') : t('common.days') })}${cards.length > 1 ? ` \u00b7 ${cards.length} ${t('dash.cardsWord')}` : ''}`
                        : t('dash.noInvoice')}
                    action={<button onClick={() => goTo('cartoes')} title={t('dash.seeCards')} className={`p-1 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-600'}`}><ChevronRight className="w-4 h-4" /></button>} />

                <Kpi isDark={isDark} icon={Landmark} label={t('dash.patrimony')} tone="violet" className="col-span-2 sm:col-span-1"
                    value={<AnimatedNumber value={patCur === 'USD' ? patrimonioLiquido / (usdRate || 5.4) : patrimonioLiquido} format={(v) => `${patCur === 'USD' ? 'US$' : 'R$'} ${money(v)}`} />}
                    sub={t('dash.patrimonySub')}
                    action={
                        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                            {['BRL', 'USD'].map(c => (
                                <button key={c} onClick={() => { setPatCur(c); try { localStorage.setItem('aliviaDashPatCur', c); } catch { /* modo privado */ } }}
                                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-black transition ${patCur === c ? 'bg-emerald-500 text-white' : muted}`}>
                                    {c === 'BRL' ? 'R$' : 'US$'}
                                </button>
                            ))}
                        </div>} />
            </div>

            {redirect && <RedirectOverlay isDark={isDark} label={redirect} />}
            {waOpen && <WhatsAppStatusModal isDark={isDark} phones={wa.linked.map(l => l.phone)} onClose={() => setWaOpen(false)} onManage={() => { setWaOpen(false); goTo('whatsapp'); }} />}

            {/* Evolução · Composição — duas colunas da MESMA altura. É o
                `items-stretch` do grid com `h-full` nos cards que faz isso;
                sem ele uma coluna fica mais curta e a tela parece torta. */}
            <div className="grid lg:grid-cols-2 gap-3 mt-3 items-stretch">
                <div className={`${cardCls} h-full`}>
                    <div className="flex items-baseline justify-between gap-3 mb-4">
                        <h2 className={`text-[13px] font-black uppercase tracking-widest ${muted}`}>{t('dash.evolution')}</h2>
                        <span className={`text-[11px] font-bold ${muted}`}>{t('dash.last6')}</span>
                    </div>
                    <EvolucaoChart dados={evolucao} isDark={isDark} money={money} t={t} />
                </div>

                <div className={`${cardCls} h-full`}>
                    <h2 className={`text-[13px] font-black uppercase tracking-widest mb-4 ${muted}`}>{t('dash.composition')}</h2>
                    {composicao.length === 0 ? (
                        <p className={`text-[13px] py-10 text-center ${muted}`}>{t('dash.noExpenses')}</p>
                    ) : (
                        <div className="flex items-center gap-5 flex-1">
                            <Donut data={composicao} total={gastos} isDark={isDark} label={`R$ ${money(gastos)}`} />
                            <ul className="min-w-0 flex-1 space-y-1.5">
                                {composicao.slice(0, 6).map(c => (
                                    <li key={c.id} className="flex items-center gap-2 text-[12.5px]">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                                        <span className={`truncate ${cell}`}>{c.label}</span>
                                        <span className={`ml-auto font-bold tabular-nums shrink-0 ${muted}`}>
                                            {gastos > 0 ? Math.round(c.value / gastos * 100) : 0}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Atividade recente · Saúde financeira — mesma regra de altura. */}
            <div className="grid lg:grid-cols-2 gap-3 mt-3 items-stretch">
                <div className={`${cardCls} h-full`}>
                    <h2 className={`text-[13px] font-black uppercase tracking-widest mb-3 ${muted}`}>{t('dash.recent')}</h2>
                    {recentes.length === 0 ? (
                        <p className={`text-[13px] py-10 text-center ${muted}`}>{t('dash.noRecent')}</p>
                    ) : (
                        <ul className="flex-1 flex flex-col">
                            {recentes.map((r, i) => {
                                const meta = catMeta(r.category);
                                const entrada = r.type === 'income';
                                return (
                                    <li key={r.id} className={`flex items-center gap-3 py-2 sm:py-[7px] ${i ? `border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}` : ''}`}>
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryHex(meta) }} />
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.description || meta.label}</span>
                                            <span className={`block text-[11px] ${muted}`}>{meta.label}{r.date ? ` \u00b7 ${fmtDate(r.date)}` : ''}</span>
                                        </span>
                                        <span className={`text-[13px] font-black tabular-nums shrink-0 ${entrada ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {entrada ? '+' : '\u2212'} R$ {money(Math.abs(parseFloat(r.amount) || 0))}
                                        </span>
                                    </li>
                                );
                            })}
                            <li className="mt-auto pt-2.5">
                                <button onClick={() => goTo('extrato')} className="flex items-center gap-0.5 text-[12px] font-bold text-emerald-500 hover:text-emerald-400 transition">
                                    {t('dash.seeStatement')} <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </li>
                        </ul>
                    )}
                </div>

                <div className={`${cardCls} h-full !p-0 overflow-hidden`}>
                    <div className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                            {temDados ? (
                                <>
                                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: scoreInfo.color }}>{scoreInfo.label}</p>
                                    <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('dash.yourHealth')}</p>
                                    <p className={`text-[12px] ${muted}`}>{t('health.basedOn')}{cfg.considerarSuperfluo ? t('health.andSuperfluous') : ''}</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">{t('health.setIncome')}</p>
                                    <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('health.letsStart')}</p>
                                    <p className={`text-[12px] ${muted}`}>{t('health.letsStartDesc')}</p>
                                </>
                            )}
                        </div>
                        <ScoreRing score={score} color={scoreInfo.color} isDark={isDark} />
                    </div>

                    <div className={`grid grid-cols-1 ${cfg.considerarSuperfluo ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <Pilar isDark={isDark} border label={t('health.debts')} value={temDivida ? `R$ ${money(dividaMensal)}${t('common.perMonthShort')}` : t('health.noDebts')} meta={t('health.metaDebts')} pct={dividaPct} ok={!temDivida} />
                        <Pilar isDark={isDark} border={cfg.considerarSuperfluo} label={t('dash.emergency')} value={`R$ ${money(reservaTotal)}`} meta={t('health.metaMonths', { n: mesesCobertura.toFixed(1), meta: metaMeses })} pct={reservaPct} ok={mesesCobertura >= metaMeses} />
                        {cfg.considerarSuperfluo && <Pilar isDark={isDark} label={t('health.superSpend')} value={t('health.superPct', { pct: superfluoPct.toFixed(0) })} meta={t('health.metaSuper')} pct={clamp(100 - superfluoPct * 2, 0, 100)} ok={superfluoPct <= 20} />}
                    </div>

                    <div className={`mt-auto flex items-center justify-between gap-3 px-4 py-2.5 border-t text-[12px] flex-wrap ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                        <span className="min-w-0 sm:truncate">{t('health.updatedAt', { time: agora, value: money(ganhos) })}</span>
                        <button onClick={() => goTo('analises')} className="flex items-center gap-0.5 font-bold text-emerald-500 hover:text-emerald-400 transition shrink-0">
                            {t('health.seeFull')} <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>


            {/* "Configurar" abre a MESMA janela de Cadastros, já na aba Dashboard —
                não existe mais uma segunda tela de configuração escondida aqui. */}
            {configOpen && <CadastrosModal abaInicial="dashboard" onClose={() => setConfigOpen(false)} />}
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
            <div className={`relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl border shadow-2xl ${isDark ? 'bg-[#0e1210] border-white/10' : 'bg-white border-slate-100'}`}>
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

// ── Evolução da renda vs. despesas ──────────────────────────────────
// Barras lado a lado, seis meses. Sem eixo Y e sem grade pesada: o que
// importa aqui é a COMPARAÇÃO entre as duas barras de cada mês e a forma
// da série, não ler o valor exato — para isso existe o tooltip.
function EvolucaoChart({ dados, isDark, money, t }) {
    const vazio = dados.every(d => d.renda === 0 && d.despesa === 0);
    if (vazio) {
        return (
            <div className="flex-1 flex items-center justify-center py-10">
                <p className={`text-[13px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dash.noEvolution')}</p>
            </div>
        );
    }
    return (
        <div className="flex-1 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                <BarChart data={dados} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1c2a24' : '#f1f5f9'} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: isDark ? '#7f9c95' : '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} width={54}
                        tick={{ fontSize: 10, fill: isDark ? '#7f9c95' : '#64748b' }}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                    <Tooltip
                        contentStyle={{ backgroundColor: isDark ? '#0e1613' : '#fff', borderColor: isDark ? '#1c2a24' : '#cfeae6', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ color: isDark ? '#7f9c95' : '#64748b', marginBottom: 4, textTransform: 'capitalize' }}
                        itemStyle={{ color: isDark ? '#cbe3de' : '#1b4139' }}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                        formatter={(v, n) => [`R$ ${money(v)}`, n === 'renda' ? t('dash.income') : t('dash.expenses')]} />
                    <Bar dataKey="renda" name="renda" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="despesa" name="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Filtro de período. Mesmo componente nos dois lugares: no cabeçalho do
// desktop e numa fileira própria no celular, onde `largura` faz os três
// botões dividirem a tela em vez de ficarem espremidos num canto.
function FiltroPeriodo({ periodo, setPeriodo, isDark, muted, t, largura = false }) {
    const opcoes = [['mes', t('dash.perMonth')], ['3m', t('dash.per3m')], ['6m', t('dash.per6m')]];
    return (
        <div className={`${largura ? 'flex w-full' : 'flex'} items-center gap-0.5 p-0.5 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
            {opcoes.map(([id, rot]) => (
                <button key={id} onClick={() => setPeriodo(id)}
                    className={`${largura ? 'flex-1' : ''} px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition ${periodo === id
                        ? 'bg-emerald-500 text-white'
                        : `${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-700'}`}`}>
                    {rot}
                </button>
            ))}
        </div>
    );
}

function Kpi({ isDark, icon: Icon, label, value, sub, tone, action, className = '' }) {
    const TONS = {
        emerald: { text: 'text-emerald-500', bg: 'bg-emerald-500/12 text-emerald-500', line: 'from-emerald-500' },
        rose: { text: 'text-rose-500', bg: 'bg-rose-500/12 text-rose-500', line: 'from-rose-500' },
        blue: { text: 'text-blue-400', bg: 'bg-blue-500/12 text-blue-400', line: 'from-blue-500' },
        amber: { text: 'text-amber-500', bg: 'bg-amber-500/12 text-amber-500', line: 'from-amber-500' },
        violet: { text: 'text-violet-400', bg: 'bg-violet-500/12 text-violet-400', line: 'from-violet-500' },
    };
    // Tom desconhecido cai no neutro em vez de derrubar a tela inteira. Foi
    // o que aconteceu: dois KPIs novos pediram `amber` e `violet`, que não
    // existiam no mapa, e `map.bg` num undefined apagou o dashboard todo.
    const map = TONS[tone] || { text: 'text-slate-400', bg: 'bg-slate-500/12 text-slate-400', line: 'from-slate-500' };
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'} ${className}`}>
            <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${map.bg}`}><Icon className="w-4 h-4" /></span>
                    {/* Duas linhas em vez de "Fatura do …". Como os cards da
                        fileira esticam juntos, a altura continua igual. */}
                    <span className={`text-[12px] font-bold leading-tight line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                </span>
                {action}
            </div>
            <p className={`text-[19px] xl:text-[22px] font-black tabular-nums whitespace-nowrap mt-1.5 ${map.text}`}>{value}</p>
            <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
            <div className={`h-0.5 rounded-full mt-2.5 bg-gradient-to-r ${map.line} to-transparent`} />
        </div>
    );
}

function Action({ isDark, onClick, children }) {
    return (
        <button onClick={onClick} className={`w-full mt-auto py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1 transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {children} →
        </button>
    );
}

function Pilar({ isDark, label, value, meta, pct, ok, border }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div className={`p-4 sm:p-3 ${border ? `border-b sm:border-b-0 sm:border-r ${isDark ? 'border-white/10' : 'border-slate-100'}` : ''}`}>
            <div className="flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
                <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>
            <p className={`text-lg font-black tabular-nums mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
            <p className={`text-[11px] ${muted}`}>{meta}</p>
            <div className={`mt-2 sm:mt-1.5 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
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

// ── Modal de configurações do Dashboard ─────────────────────────────

