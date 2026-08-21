import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import {
    BarChart3, PieChart as PieIcon, Repeat, Scale, Wallet, TrendingUp, TrendingDown,
    ArrowLeft, ChevronRight, Download, Loader2, CreditCard, Gauge, Layers, AlertTriangle,
    SlidersHorizontal, X, Check, Sparkles,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const txMonthKey = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mLabel = (mk) => { const [, m] = mk.split('-'); return MESES_ABREV[(parseInt(m) || 1) - 1]; };
const catMeta = (id) => CATEGORIES.expense.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };
const isConsumo = (t) => t.type === 'expense' && !['credit_card_bill', 'vault', 'investment'].includes(t.category);
const isRealIncome = (t) => t.type === 'income' && !['vault_redemption', 'initial_balance', 'carryover'].includes(t.category);
// Compra no crédito que ainda está na fatura em aberto (não paga).
const isOpenCredit = (t) => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid';
// Passa no filtro de fatura em aberto: se o toggle estiver ligado, entra tudo;
// se desligado, exclui as compras no crédito ainda não pagas.
const passOpenInvoice = (t, include) => include || !isOpenCredit(t);

const PRIORIDADES = {
    essential: { label: 'Essencial', color: '#10b981' },
    comfort: { label: 'Conforto', color: '#f59e0b' },
    superfluous: { label: 'Supérfluo', color: '#f43f5e' },
};
const PAGAMENTOS = { pix: 'PIX', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto' };
const PAG_COLOR = { pix: '#10b981', debito: '#3b82f6', credito: '#8b5cf6', dinheiro: '#f59e0b', boleto: '#06b6d4' };

const ANALISES = [
    { id: 'categorias', label: 'Gastos por categoria', desc: 'Para onde seu dinheiro vai no mês', icon: PieIcon, color: '#10b981' },
    { id: 'evolucao', label: 'Evolução mensal', desc: 'Entradas × saídas nos últimos meses', icon: BarChart3, color: '#3b82f6' },
    { id: 'custo_fixo', label: 'Custo fixo mensal', desc: 'Recorrentes, assinaturas e parcelas', icon: Repeat, color: '#f59e0b' },
    { id: 'prioridade', label: 'Essencial × Supérfluo', desc: 'Quanto é necessidade vs desejo', icon: Scale, color: '#8b5cf6' },
    { id: 'pagamento', label: 'Formas de pagamento', desc: 'PIX, débito, crédito, dinheiro', icon: Wallet, color: '#06b6d4' },
    { id: 'comparativo', label: 'Comparativo de meses', desc: 'Este mês vs o anterior', icon: TrendingUp, color: '#ec4899' },
    { id: 'cartao_categoria', label: 'Fatura por categoria', desc: 'Onde vai o dinheiro do cartão', icon: CreditCard, color: '#a855f7', grupo: 'Cartão de crédito' },
    { id: 'cartao_limite', label: 'Uso do limite', desc: 'Quanto de cada cartão já usou', icon: Gauge, color: '#f59e0b', grupo: 'Cartão de crédito' },
    { id: 'cartao_parcelas', label: 'Parcelas & comprometimento', desc: 'Quanto por mês está em parcelas', icon: Layers, color: '#3b82f6', grupo: 'Cartão de crédito' },
];

// Quais filtros cada relatório mostra antes de gerar.
const REPORT_FILTERS = {
    categorias: ['month', 'openInvoice'],
    evolucao: ['months', 'openInvoice'],
    custo_fixo: ['fixedTypes'],
    prioridade: ['month', 'openInvoice'],
    pagamento: ['month', 'includeCredit'],
    comparativo: ['month', 'openInvoice'],
    cartao_categoria: ['cardSources'],
    cartao_limite: ['cardPick'],
    cartao_parcelas: ['cardPick'],
};

const defaultFilters = () => ({
    month: monthKeyNow(),
    months: 6,
    fixedTypes: { recorrentes: true, assinaturas: true, parcelas: true },
    includeCredit: true,
    includeOpenInvoice: true,
    cardSources: { avulsas: true, assinaturas: true, parcelas: true },
    cardId: 'all',
});

const prevMonthKey = (mk) => {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, (m - 1) - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthKeyLabel = (mk) => { const [y, m] = mk.split('-'); return `${MESES_ABREV[(parseInt(m) || 1) - 1]}/${y}`; };

export default function Analises() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [tx, setTx] = useState([]);
    const [fixExp, setFixExp] = useState([]);
    const [subs, setSubs] = useState([]);
    const [cards, setCards] = useState([]);
    const [view, setView] = useState(null);
    const [exporting, setExporting] = useState(false);

    // Fluxo: escolher relatório → filtros → "gerando..." → análise.
    const [pendingReport, setPendingReport] = useState(null);   // relatório aguardando filtros
    const [generatingReport, setGeneratingReport] = useState(null); // relatório sendo gerado
    const [filters, setFilters] = useState(defaultFilters());

    // Mês de referência para os relatórios que usam mês (vem dos filtros).
    const mk = filters.month || monthKeyNow();

    // Abre a janela de filtros para o relatório escolhido (com filtros zerados).
    const openFilters = (id) => { setFilters(defaultFilters()); setPendingReport(id); };

    // Confirma os filtros → mostra "gerando" brevemente → abre a análise.
    const runReport = () => {
        const id = pendingReport;
        setPendingReport(null);
        setGeneratingReport(id);
        setTimeout(() => { setGeneratingReport(null); setView(id); }, 900);
    };

    const exportarPDF = async () => {
        const el = document.getElementById('analise-print');
        if (!el) return;
        setExporting(true);
        try {
            const [{ default: html2canvas }, jspdfMod] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
            const JsPDF = jspdfMod.jsPDF || jspdfMod.default;
            const canvas = await html2canvas(el, { backgroundColor: isDark ? '#0e0f12' : '#ffffff', scale: 2 });
            const img = canvas.toDataURL('image/png');
            const pdf = new JsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
            const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), margin = 24;
            let w = pw - margin * 2, h = canvas.height * (w / canvas.width);
            if (h > ph - margin * 2) { h = ph - margin * 2; w = canvas.width * (h / canvas.height); }
            pdf.setFillColor(isDark ? 14 : 255, isDark ? 15 : 255, isDark ? 18 : 255);
            pdf.rect(0, 0, pw, ph, 'F');
            pdf.addImage(img, 'PNG', (pw - w) / 2, margin, w, h);
            pdf.save(`analise-${view || 'alivia'}.pdf`);
        } catch (e) { console.error('[pdf]', e); }
        setExporting(false);
    };

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const list = [
            onSnapshot(q('transactions'), s => setTx(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('fixed_expenses'), s => setFixExp(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('subscriptions'), s => setSubs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('cards'), s => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
        ];
        return () => list.forEach(u => u());
    }, [uid]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    const monthTx = useMemo(() => tx.filter(t => txMonthKey(t) === mk), [tx, mk]);

    // dados prontos por análise
    const categorias = useMemo(() => {
        const m = {};
        monthTx.filter(isConsumo).filter(t => passOpenInvoice(t, filters.includeOpenInvoice)).forEach(t => { m[t.category || 'other'] = (m[t.category || 'other'] || 0) + (parseFloat(t.amount) || 0); });
        const total = Object.values(m).reduce((a, b) => a + b, 0);
        return { total, list: Object.entries(m).map(([id, value]) => { const c = catMeta(id); return { id, label: c.label, color: categoryHex(c), value, pct: total ? value / total * 100 : 0 }; }).sort((a, b) => b.value - a.value) };
    }, [monthTx, filters.includeOpenInvoice]);

    const evolucao = useMemo(() => {
        const now = new Date();
        const arr = [];
        const nMonths = filters.months || 6;
        for (let i = nMonths - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const inc = tx.filter(t => txMonthKey(t) === key && isRealIncome(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            const exp = tx.filter(t => txMonthKey(t) === key && isConsumo(t) && passOpenInvoice(t, filters.includeOpenInvoice)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            arr.push({ key, label: mLabel(key), inc, exp });
        }
        return arr;
    }, [tx, filters.months, filters.includeOpenInvoice]);

    const custoFixo = useMemo(() => {
        const ft = filters.fixedTypes || { recorrentes: true, assinaturas: true, parcelas: true };
        const recorrentes = ft.recorrentes ? fixExp.map(f => ({ name: f.name || 'Conta', value: parseFloat(f.value) || 0 })) : [];
        const assinaturas = ft.assinaturas ? subs.filter(s => !(s.type === 'installment' || s.isInstallment)).map(s => ({ name: s.name || 'Assinatura', value: parseFloat(s.value) || 0 })) : [];
        const parcelas = ft.parcelas ? subs.filter(s => s.type === 'installment' || s.isInstallment).map(s => ({ name: `${s.name || 'Parcela'} (${s.currentInstallment || 1}/${s.totalInstallments || 1})`, value: parseFloat(s.value) || 0 })) : [];
        const sum = (a) => a.reduce((x, y) => x + y.value, 0);
        return { recorrentes, assinaturas, parcelas, tRec: sum(recorrentes), tAss: sum(assinaturas), tParc: sum(parcelas), total: sum(recorrentes) + sum(assinaturas) + sum(parcelas) };
    }, [fixExp, subs, filters.fixedTypes]);

    const prioridade = useMemo(() => {
        const m = { essential: 0, comfort: 0, superfluous: 0 };
        monthTx.filter(isConsumo).filter(t => passOpenInvoice(t, filters.includeOpenInvoice)).forEach(t => { const p = t.priority || 'comfort'; m[p] = (m[p] || 0) + (parseFloat(t.amount) || 0); });
        const total = m.essential + m.comfort + m.superfluous;
        return { total, list: Object.keys(m).map(id => ({ id, label: PRIORIDADES[id].label, color: PRIORIDADES[id].color, value: m[id], pct: total ? m[id] / total * 100 : 0 })) };
    }, [monthTx, filters.includeOpenInvoice]);

    const pagamento = useMemo(() => {
        const m = {};
        monthTx
            .filter(t => t.type === 'expense' && t.category !== 'credit_card_bill')
            .filter(t => filters.includeCredit || t.paymentMethod !== 'credito')
            .forEach(t => { const p = t.paymentMethod || 'pix'; m[p] = (m[p] || 0) + (parseFloat(t.amount) || 0); });
        const total = Object.values(m).reduce((a, b) => a + b, 0);
        return { total, list: Object.entries(m).map(([id, value]) => ({ id, label: PAGAMENTOS[id] || id, color: PAG_COLOR[id] || '#64748b', value, pct: total ? value / total * 100 : 0 })).sort((a, b) => b.value - a.value) };
    }, [monthTx, filters.includeCredit]);

    const comparativo = useMemo(() => {
        const prevKey = prevMonthKey(mk);
        const calc = (key) => ({
            inc: tx.filter(t => txMonthKey(t) === key && isRealIncome(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0),
            exp: tx.filter(t => txMonthKey(t) === key && isConsumo(t) && passOpenInvoice(t, filters.includeOpenInvoice)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0),
        });
        const cur = calc(mk), prev = calc(prevKey);
        return { curLabel: mLabel(mk), prevLabel: mLabel(prevKey), cur, prev };
    }, [tx, mk, filters.includeOpenInvoice]);

    // ── Cartão de crédito ──
    const creditoAberto = useMemo(() => tx.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid'), [tx]);
    const subsCartao = useMemo(() => subs.filter(s => s.cardId), [subs]);

    const cartaoCategoria = useMemo(() => {
        const cs = filters.cardSources || { avulsas: true, assinaturas: true, parcelas: true };
        const m = {};
        if (cs.avulsas) creditoAberto.forEach(t => { m[t.category || 'other'] = (m[t.category || 'other'] || 0) + (parseFloat(t.amount) || 0); });
        subsCartao.forEach(s => {
            const isInst = s.isInstallment || s.type === 'installment';
            if (isInst ? !cs.parcelas : !cs.assinaturas) return;
            const c = s.category || (isInst ? 'shopping' : 'subscriptions');
            m[c] = (m[c] || 0) + (parseFloat(s.value) || 0);
        });
        const total = Object.values(m).reduce((a, b) => a + b, 0);
        return { total, list: Object.entries(m).map(([id, value]) => { const c = catMeta(id); return { id, label: c.label, color: categoryHex(c), value, pct: total ? value / total * 100 : 0 }; }).sort((a, b) => b.value - a.value) };
    }, [creditoAberto, subsCartao, filters.cardSources]);

    const cartaoLimite = useMemo(() => cards
        .filter(c => filters.cardId === 'all' || c.id === filters.cardId)
        .map(c => {
            const usadoTx = creditoAberto.filter(t => t.selectedCardId === c.id).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            const usadoSub = subsCartao.filter(s => s.cardId === c.id).reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
            const usado = usadoTx + usadoSub;
            const limite = parseFloat(c.limit) || 0;
            const pct = limite ? Math.min(100, usado / limite * 100) : 0;
            return { id: c.id, name: c.name || c.bank || 'Cartão', limite, usado, disponivel: Math.max(0, limite - usado), pct };
        }).sort((a, b) => b.pct - a.pct), [cards, creditoAberto, subsCartao, filters.cardId]);

    const cartaoParcelas = useMemo(() => {
        const list = subs.filter(s => (s.type === 'installment' || s.isInstallment) && s.cardId && (filters.cardId === 'all' || s.cardId === filters.cardId)).map(s => {
            const total = s.totalInstallments || 1;
            const paga = Math.max(0, (s.currentInstallment || 1) - 1);
            const restam = Math.max(0, total - paga);
            const parcela = parseFloat(s.value) || 0;
            const card = cards.find(c => c.id === s.cardId);
            return { id: s.id, name: s.name || 'Parcelamento', parcela, total, paga, restam, restanteValor: parcela * restam, cardName: card?.name || card?.bank || 'Cartão' };
        }).sort((a, b) => b.restanteValor - a.restanteValor);
        const mensal = list.reduce((a, p) => a + p.parcela, 0);
        const dividaTotal = list.reduce((a, p) => a + p.restanteValor, 0);
        return { list, mensal, dividaTotal };
    }, [subs, cards, filters.cardId]);

    // ── HUB ──
    if (!view) {
        return (
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-6">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <BarChart3 className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div>
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Análises</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Escolha uma análise para entender suas finanças.</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ANALISES.map(a => {
                        const Icon = a.icon;
                        return (
                            <button key={a.id} onClick={() => openFilters(a.id)}
                                className={`text-left rounded-2xl border p-5 transition-all active:scale-[0.98] ${isDark ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${a.color}1f`, color: a.color }}><Icon className="w-5 h-5" /></span>
                                    <ChevronRight className={`w-4 h-4 ${muted}`} />
                                </div>
                                <p className={`font-black mt-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>{a.label}</p>
                                <p className={`text-[12px] mt-0.5 ${muted}`}>{a.desc}</p>
                            </button>
                        );
                    })}
                </div>

                {pendingReport && (
                    <FiltersModal isDark={isDark} reportId={pendingReport} filters={filters} setFilters={setFilters}
                        cards={cards} onClose={() => setPendingReport(null)} onGenerate={runReport} />
                )}
                {generatingReport && <GeneratingOverlay isDark={isDark} report={ANALISES.find(a => a.id === generatingReport)} />}
            </div>
        );
    }

    const meta = ANALISES.find(a => a.id === view);
    const Icon = meta.icon;

    return (
        <div className="max-w-4xl mx-auto w-full">
            {/* Barra de ações (não entra no PDF) */}
            <div className="flex items-center justify-between gap-3 mb-4">
                <button onClick={() => setView(null)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><ArrowLeft className="w-4 h-4" /> Voltar</button>
                <button onClick={exportarPDF} disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white text-[13px] font-bold transition active:scale-95 shadow-md shadow-rose-500/30 disabled:opacity-60">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar PDF
                </button>
            </div>

            {/* Área capturável no PDF */}
            <div id="analise-print" className="rounded-2xl">
            <div className="flex items-center gap-3 mb-5">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}><Icon className="w-5 h-5" /></span>
                <div>
                    <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{meta.label}</h1>
                    <p className={`text-[12px] ${muted}`}>{meta.desc}</p>
                </div>
            </div>

            {view === 'categorias' && <BreakdownView isDark={isDark} title={`Gastos por categoria — ${monthKeyLabel(mk)}`} total={categorias.total} list={categorias.list} emptyText="Sem gastos neste mês." note={filters.includeOpenInvoice ? undefined : 'Fatura em aberto do cartão não incluída (visão de caixa).'} />}
            {view === 'prioridade' && <BreakdownView isDark={isDark} title={`Consumo por prioridade — ${monthKeyLabel(mk)}`} total={prioridade.total} list={prioridade.list} emptyText="Sem gastos neste mês." note={filters.includeOpenInvoice ? 'Ideal: manter os supérfluos baixos e priorizar o essencial.' : 'Fatura em aberto do cartão não incluída (visão de caixa).'} />}
            {view === 'pagamento' && <BreakdownView isDark={isDark} title={`Formas de pagamento — ${monthKeyLabel(mk)}`} total={pagamento.total} list={pagamento.list} emptyText="Sem gastos neste mês." />}

            {view === 'evolucao' && (
                <div className={cardCls}>
                    <BarsMonths isDark={isDark} data={evolucao} />
                    <div className={`mt-4 flex items-center justify-center gap-5 text-[12px] ${muted}`}>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Entradas</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Saídas</span>
                    </div>
                </div>
            )}

            {view === 'custo_fixo' && (
                <div className="space-y-4">
                    <div className={`${cardCls} flex items-center justify-between`}>
                        <div><p className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>Custo fixo total / mês</p><p className="text-3xl font-black tabular-nums text-amber-500 mt-0.5">R$ {money(custoFixo.total)}</p></div>
                        <div className="text-right text-[12px] space-y-0.5">
                            <p className={muted}>Recorrentes <span className={`font-bold ${cell}`}>R$ {money(custoFixo.tRec)}</span></p>
                            <p className={muted}>Assinaturas <span className={`font-bold ${cell}`}>R$ {money(custoFixo.tAss)}</span></p>
                            <p className={muted}>Parcelas <span className={`font-bold ${cell}`}>R$ {money(custoFixo.tParc)}</span></p>
                        </div>
                    </div>
                    {custoFixo.total > 0 && (
                        <BreakdownView isDark={isDark} title="Composição do custo fixo" total={custoFixo.total} emptyText=""
                            list={[
                                { id: 'rec', label: 'Recorrentes', color: '#f59e0b', value: custoFixo.tRec, pct: custoFixo.total ? custoFixo.tRec / custoFixo.total * 100 : 0 },
                                { id: 'ass', label: 'Assinaturas', color: '#8b5cf6', value: custoFixo.tAss, pct: custoFixo.total ? custoFixo.tAss / custoFixo.total * 100 : 0 },
                                { id: 'parc', label: 'Parcelas', color: '#3b82f6', value: custoFixo.tParc, pct: custoFixo.total ? custoFixo.tParc / custoFixo.total * 100 : 0 },
                            ]} />
                    )}
                    <FixedList isDark={isDark} title="Recorrentes" items={custoFixo.recorrentes} color="#f59e0b" />
                    <FixedList isDark={isDark} title="Assinaturas" items={custoFixo.assinaturas} color="#8b5cf6" />
                    <FixedList isDark={isDark} title="Parcelas ativas" items={custoFixo.parcelas} color="#3b82f6" />
                    {custoFixo.total === 0 && <p className={`text-center text-sm py-6 ${muted}`}>Nada cadastrado ainda em Recorrentes/Cartão.</p>}
                </div>
            )}

            {view === 'comparativo' && (
                <div className={cardCls}>
                    <div className="grid grid-cols-2 gap-4">
                        <CompareCol isDark={isDark} label={comparativo.prevLabel} data={comparativo.prev} muted />
                        <CompareCol isDark={isDark} label={comparativo.curLabel} data={comparativo.cur} />
                    </div>
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        {[['Entradas', comparativo.cur.inc - comparativo.prev.inc, true], ['Saídas', comparativo.cur.exp - comparativo.prev.exp, false], ['Sobra', (comparativo.cur.inc - comparativo.cur.exp) - (comparativo.prev.inc - comparativo.prev.exp), true]].map(([lbl, delta, up]) => (
                            <div key={lbl} className="flex items-center justify-between py-1 text-[13px]">
                                <span className={cell}>{lbl}</span>
                                <span className={`font-black tabular-nums ${(delta >= 0) === up ? 'text-emerald-500' : 'text-rose-500'}`}>{delta >= 0 ? '+' : '−'} R$ {money(Math.abs(delta))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'cartao_categoria' && (
                cartaoCategoria.total === 0
                    ? <div className={cardCls}><p className={`text-center text-sm py-8 ${muted}`}>Nenhuma compra em aberto no cartão.</p></div>
                    : <BreakdownView isDark={isDark} title="Fatura em aberto — por categoria" total={cartaoCategoria.total} list={cartaoCategoria.list} emptyText="" note="Inclui compras avulsas, assinaturas e parcelas do mês no cartão." />
            )}

            {view === 'cartao_limite' && (
                <div className={cardCls}>
                    {cartaoLimite.length === 0 ? <p className={`text-center text-sm py-8 ${muted}`}>Nenhum cartão cadastrado.</p> : (
                        <div className="space-y-4">
                            {cartaoLimite.map(c => {
                                const cor = c.pct >= 80 ? '#f43f5e' : c.pct >= 50 ? '#f59e0b' : '#10b981';
                                return (
                                    <div key={c.id}>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.name}</span>
                                            <span className="text-[13px] font-black tabular-nums" style={{ color: cor }}>{c.limite ? `${c.pct.toFixed(0)}%` : 'sem limite'}</span>
                                        </div>
                                        <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: cor }} />
                                        </div>
                                        <div className={`flex items-center justify-between mt-1 text-[11px] ${muted}`}>
                                            <span>Usado <span className="font-bold" style={{ color: cor }}>R$ {money(c.usado)}</span>{c.limite ? ` de R$ ${money(c.limite)}` : ''}</span>
                                            {c.limite > 0 && <span>Disponível <span className="font-bold text-emerald-500">R$ {money(c.disponivel)}</span></span>}
                                        </div>
                                        {c.pct >= 80 && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-rose-500"><AlertTriangle className="w-3.5 h-3.5" /> Limite quase no teto</p>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {view === 'cartao_parcelas' && (
                <div className="space-y-4">
                    <div className={`${cardCls} grid grid-cols-3 gap-3`}>
                        <div><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Por mês</p><p className="text-xl font-black tabular-nums text-blue-400 mt-0.5">R$ {money(cartaoParcelas.mensal)}</p></div>
                        <div><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Dívida restante</p><p className="text-xl font-black tabular-nums text-rose-500 mt-0.5">R$ {money(cartaoParcelas.dividaTotal)}</p></div>
                        <div><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Ativos</p><p className={`text-xl font-black tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{cartaoParcelas.list.length}</p></div>
                    </div>
                    {cartaoParcelas.list.length === 0 ? (
                        <div className={cardCls}><p className={`text-center text-sm py-6 ${muted}`}>Nenhum parcelamento ativo. 🎉</p></div>
                    ) : (
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                            {cartaoParcelas.list.map((p, i) => (
                                <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''}`}>
                                    <div className="min-w-0">
                                        <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{p.name}</p>
                                        <p className={`text-[11px] ${muted}`}>{p.paga}/{p.total} pagas · faltam {p.restam} · {p.cardName}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[13px] font-black tabular-nums text-blue-400">R$ {money(p.parcela)}<span className={`text-[11px] font-normal ${muted}`}>/mês</span></p>
                                        <p className={`text-[11px] tabular-nums ${muted}`}>resta R$ {money(p.restanteValor)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            </div>
        </div>
    );
}

// ── Componentes ─────────────────────────────────────────────────────
function BreakdownView({ isDark, title, total, list, emptyText, note }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;
    const filtered = list.filter(c => c.value > 0);
    if (filtered.length === 0) return <div className={cardCls}><p className={`text-center text-sm py-8 ${muted}`}>{emptyText}</p></div>;
    return (
        <div className={cardCls}>
            <p className={`text-[13px] font-black uppercase tracking-widest mb-4 ${muted}`}>{title}</p>
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <Donut data={filtered} total={total} isDark={isDark} />
                <div className="flex-1 w-full space-y-2.5">
                    {filtered.map(c => (
                        <div key={c.id}>
                            <div className="flex items-center justify-between gap-2 text-[13px]">
                                <span className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: c.color }} /><span className={`truncate ${cell}`}>{c.label}</span></span>
                                <span className="flex items-baseline gap-2 shrink-0"><span className="font-black tabular-nums" style={{ color: c.color }}>{c.pct.toFixed(1)}%</span><span className={`text-[12px] tabular-nums ${muted}`}>R$ {money(c.value)}</span></span>
                            </div>
                            <div className={`mt-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} /></div>
                        </div>
                    ))}
                </div>
            </div>
            {note && <p className={`text-[12px] mt-4 pt-3 border-t ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-100 text-slate-400'}`}>💡 {note}</p>}
        </div>
    );
}

function Donut({ data, total, isDark }) {
    const size = 172, sw = 26, r = (size - sw) / 2 - 3, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const multi = data.length > 1;
    const gap = multi ? 0.022 * C : 0; // folga entre fatias
    let offset = 0;
    const sum = total || data.reduce((a, d) => a + d.value, 0) || 1;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.28))' }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} strokeWidth={sw} />
                {data.map(d => {
                    const frac = (d.value / sum);
                    const len = Math.max(0, frac * C - gap);
                    const el = <circle key={d.id} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw}
                        strokeLinecap={multi ? 'round' : 'butt'} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
                    offset += frac * C;
                    return el;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</span>
                <span className={`text-base font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {money(total)}</span>
            </div>
        </div>
    );
}

function BarsMonths({ isDark, data }) {
    const max = Math.max(1, ...data.map(d => Math.max(d.inc, d.exp)));
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div className="flex items-end justify-between gap-2 h-52">
            {data.map(d => (
                <div key={d.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                        <div className="w-3 sm:w-4 rounded-t bg-emerald-500 transition-all" style={{ height: `${d.inc / max * 100}%` }} title={`Entradas R$ ${money(d.inc)}`} />
                        <div className="w-3 sm:w-4 rounded-t bg-rose-500 transition-all" style={{ height: `${d.exp / max * 100}%` }} title={`Saídas R$ ${money(d.exp)}`} />
                    </div>
                    <span className={`text-[11px] font-bold uppercase ${muted}`}>{d.label}</span>
                </div>
            ))}
        </div>
    );
}

function FixedList({ isDark, title, items, color }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-200' : 'text-slate-700';
    if (!items.length) return null;
    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <span className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest" style={{ color }}><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {title}</span>
                <span className={`text-[12px] font-black tabular-nums ${cell}`}>R$ {money(items.reduce((a, b) => a + b.value, 0))}</span>
            </div>
            {items.map((it, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2 text-[13px] ${i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''}`}>
                    <span className={`truncate ${cell}`}>{it.name}</span>
                    <span className={`font-bold tabular-nums ${muted}`}>R$ {money(it.value)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Janela de filtros (antes de gerar o relatório) ──────────────────
function FiltersModal({ isDark, reportId, filters, setFilters, cards, onClose, onGenerate }) {
    const meta = ANALISES.find(a => a.id === reportId);
    const Icon = meta?.icon || SlidersHorizontal;
    const fields = REPORT_FILTERS[reportId] || [];
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const label = isDark ? 'text-slate-300' : 'text-slate-600';

    // últimos 12 meses para o seletor de período
    const monthOptions = useMemo(() => {
        const now = new Date();
        const arr = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return arr;
    }, []);

    const set = (patch) => setFilters(f => ({ ...f, ...patch }));
    const toggleGroup = (key, sub) => setFilters(f => ({ ...f, [key]: { ...f[key], [sub]: !f[key][sub] } }));

    const inputCls = `w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const Chip = ({ on, onClick, children }) => (
        <button type="button" onClick={onClick}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold border transition active:scale-95 ${on ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800')}`}>
            {children}
        </button>
    );
    const Toggle = ({ on, onClick, children }) => (
        <button type="button" onClick={onClick}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition text-left ${on ? 'bg-emerald-500/10 border-emerald-500/30' : (isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200')}`}>
            <span className={`text-[13px] font-bold ${on ? 'text-emerald-500' : label}`}>{children}</span>
            <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition ${on ? 'bg-emerald-500 justify-end' : (isDark ? 'bg-white/15 justify-start' : 'bg-slate-300 justify-start')}`}>
                <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
        </button>
    );
    const FieldLabel = ({ children }) => <span className={`text-[11px] font-black uppercase tracking-widest ${muted} block mb-1.5`}>{children}</span>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta?.color || '#10b981'}1f`, color: meta?.color || '#10b981' }}><Icon className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{meta?.label || 'Relatório'}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                <p className={`text-[12px] mb-5 ${muted}`}>Ajuste os filtros e gere o relatório.</p>

                <div className="space-y-4">
                    {fields.includes('month') && (
                        <div>
                            <FieldLabel>Período (mês)</FieldLabel>
                            <select value={filters.month} onChange={e => set({ month: e.target.value })} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                {monthOptions.map(mkOpt => <option key={mkOpt} value={mkOpt} style={optStyle}>{monthKeyLabel(mkOpt)}</option>)}
                            </select>
                            {reportId === 'comparativo' && <p className={`text-[11px] mt-1.5 ${muted}`}>Compara com o mês anterior ({monthKeyLabel(prevMonthKey(filters.month))}).</p>}
                        </div>
                    )}

                    {fields.includes('months') && (
                        <div>
                            <FieldLabel>Quantos meses</FieldLabel>
                            <div className="flex gap-2">
                                {[3, 6, 12].map(n => <Chip key={n} on={filters.months === n} onClick={() => set({ months: n })}>{n} meses</Chip>)}
                            </div>
                        </div>
                    )}

                    {fields.includes('includeCredit') && (
                        <Toggle on={filters.includeCredit} onClick={() => set({ includeCredit: !filters.includeCredit })}>Incluir gastos no crédito</Toggle>
                    )}

                    {fields.includes('openInvoice') && (
                        <div>
                            <Toggle on={filters.includeOpenInvoice} onClick={() => set({ includeOpenInvoice: !filters.includeOpenInvoice })}>Incluir fatura em aberto do cartão</Toggle>
                            <p className={`text-[11px] mt-1.5 ${muted}`}>
                                {filters.includeOpenInvoice
                                    ? 'Compras no crédito ainda não pagas entram no total do mês (regime de competência).'
                                    : 'Só conta o que já saiu por débito, pix e faturas pagas (visão de caixa).'}
                            </p>
                        </div>
                    )}

                    {fields.includes('fixedTypes') && (
                        <div>
                            <FieldLabel>O que incluir</FieldLabel>
                            <div className="space-y-2">
                                <Toggle on={filters.fixedTypes.recorrentes} onClick={() => toggleGroup('fixedTypes', 'recorrentes')}>Contas recorrentes</Toggle>
                                <Toggle on={filters.fixedTypes.assinaturas} onClick={() => toggleGroup('fixedTypes', 'assinaturas')}>Assinaturas</Toggle>
                                <Toggle on={filters.fixedTypes.parcelas} onClick={() => toggleGroup('fixedTypes', 'parcelas')}>Parcelas ativas</Toggle>
                            </div>
                        </div>
                    )}

                    {fields.includes('cardSources') && (
                        <div>
                            <FieldLabel>Fontes da fatura</FieldLabel>
                            <div className="space-y-2">
                                <Toggle on={filters.cardSources.avulsas} onClick={() => toggleGroup('cardSources', 'avulsas')}>Fatura em aberto (compras avulsas)</Toggle>
                                <Toggle on={filters.cardSources.assinaturas} onClick={() => toggleGroup('cardSources', 'assinaturas')}>Assinaturas no cartão</Toggle>
                                <Toggle on={filters.cardSources.parcelas} onClick={() => toggleGroup('cardSources', 'parcelas')}>Parcelas do mês</Toggle>
                            </div>
                        </div>
                    )}

                    {fields.includes('cardPick') && (
                        <div>
                            <FieldLabel>Cartão</FieldLabel>
                            <div className="flex flex-wrap gap-2">
                                <Chip on={filters.cardId === 'all'} onClick={() => set({ cardId: 'all' })}>Todos</Chip>
                                {cards.map(c => <Chip key={c.id} on={filters.cardId === c.id} onClick={() => set({ cardId: c.id })}>{c.name || c.bank || 'Cartão'}</Chip>)}
                            </div>
                        </div>
                    )}

                    {fields.length === 0 && <p className={`text-[13px] ${muted}`}>Este relatório não precisa de filtros.</p>}
                </div>

                <button onClick={onGenerate}
                    className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-emerald-500/30">
                    <Sparkles className="w-4 h-4" /> Gerar relatório
                </button>
            </div>
        </div>
    );
}

// ── Janela "gerando relatório..." (breve) ───────────────────────────
function GeneratingOverlay({ isDark, report }) {
    const Icon = report?.icon || Loader2;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className={`relative w-full max-w-xs rounded-3xl border shadow-2xl p-8 flex flex-col items-center text-center ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <span className="relative w-16 h-16 flex items-center justify-center mb-4">
                    <span className="absolute inset-0 rounded-2xl animate-ping" style={{ background: `${report?.color || '#10b981'}22` }} />
                    <span className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${report?.color || '#10b981'}1f`, color: report?.color || '#10b981' }}>
                        <Icon className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                </span>
                <p className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gerando relatório…</p>
                <p className={`text-[12px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{report?.label || ''}</p>
                <Loader2 className="w-5 h-5 animate-spin mt-4" style={{ color: report?.color || '#10b981' }} />
            </div>
        </div>
    );
}

function CompareCol({ isDark, label, data, muted: isMuted }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const sobra = data.inc - data.exp;
    return (
        <div className={`rounded-xl p-4 ${isMuted ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50') : (isDark ? 'bg-emerald-500/[0.06]' : 'bg-emerald-50')}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
            <div className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className={muted}>Entradas</span><span className="font-bold tabular-nums text-emerald-500">R$ {money(data.inc)}</span></div>
                <div className="flex justify-between"><span className={muted}>Saídas</span><span className="font-bold tabular-nums text-rose-500">R$ {money(data.exp)}</span></div>
                <div className="flex justify-between pt-1 border-t border-white/5"><span className={muted}>Sobra</span><span className={`font-black tabular-nums ${sobra >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {money(sobra)}</span></div>
            </div>
        </div>
    );
}
