import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/LanguageContext';
import { useDashCfg } from '../contexts/DashCfgContext';
import { LayoutDashboard } from 'lucide-react';

// ── Como o Dashboard apura o mês ────────────────────────────────────
// Era uma janelinha solta atrás do botão "Configurar", no canto do
// Dashboard. Virou aba de Cadastros: é configuração, e configuração mora
// toda no mesmo lugar.
//
// A fatura em aberto é consultada aqui só para a dica dizer um número de
// verdade ("somam R$ 1.234") em vez de uma frase genérica — é a mesma
// consulta que o Dashboard e Meu cartão já mantêm aberta.

export default function DashboardConfigTab({ isDark }) {
    const { t, fmtMoney: money } = useI18n();
    const { cfg, salvar } = useDashCfg();
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;

    const [dados, setDados] = useState({ uid: null, tx: [], subs: [] });

    useEffect(() => {
        if (!uid) return undefined;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const paradas = [
            onSnapshot(q('transactions'), (s) => setDados(d => ({ ...d, uid, tx: s.docs.map(x => x.data()) })), () => {}),
            onSnapshot(q('subscriptions'), (s) => setDados(d => ({ ...d, uid, subs: s.docs.map(x => x.data()) })), () => {}),
        ];
        return () => paradas.forEach(p => p());
    }, [uid]);

    // Fatura em aberto: compras no crédito ainda não quitadas + assinaturas
    // e parcelas do cartão. Mesmo critério do Dashboard.
    const faturaTotal = (dados.uid === uid ? dados.tx : [])
        .filter(x => x.paymentMethod === 'credito' && x.invoiceStatus === 'unpaid')
        .reduce((a, x) => a + (parseFloat(x.amount) || 0), 0)
        + (dados.uid === uid ? dados.subs : [])
            .filter(s => s.cardId)
            .reduce((a, s) => a + (parseFloat(s.value) || 0), 0);

    const set = (patch) => salvar({ ...cfg, ...patch });
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            <div className={`px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><LayoutDashboard className="w-4 h-4" /></span>
                    {t('dashcfg.title')}
                </h2>
                <p className={`text-[12px] mt-1 ${muted}`}>{t('dashcfg.desc')}</p>
            </div>

            <div className="px-4 sm:px-5 pb-4">
                <Secao isDark={isDark} title={t('dashcfg.monthTitle')}>
                    <Flag isDark={isDark} on={cfg.incluirFatura} onToggle={v => set({ incluirFatura: v })}
                        label={t('dashcfg.includeInvoice')}
                        hint={cfg.incluirFatura
                            ? t('dashcfg.includeInvoiceOn', { value: money(faturaTotal) })
                            : t('dashcfg.includeInvoiceOff', { value: money(faturaTotal) })} />
                    <Flag isDark={isDark} on={cfg.ocultarSaldo} onToggle={v => set({ ocultarSaldo: v })}
                        label={t('dashcfg.hideByDefault')} hint={t('dashcfg.hideByDefaultHint')} />
                </Secao>

                <Secao isDark={isDark} title={t('dashcfg.netWorthTitle')}>
                    <Flag isDark={isDark} on={cfg.somarReservas} onToggle={v => set({ somarReservas: v })}
                        label={t('dashcfg.addReserves')} hint={t('dashcfg.addReservesHint')} />
                    <Flag isDark={isDark} on={cfg.somarInvest} onToggle={v => set({ somarInvest: v })}
                        label={t('dashcfg.addInvest')} hint={t('dashcfg.addInvestHint')} />
                </Secao>

                <Secao isDark={isDark} title={t('dashcfg.healthTitle')}>
                    <div className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 pr-3">
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('dashcfg.reserveGoal')}</p>
                            <p className={`text-[11px] ${muted}`}>{t('dashcfg.reserveGoalHint')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <input inputMode="numeric" value={cfg.metaReservaMeses}
                                aria-label={t('dashcfg.reserveGoal')}
                                onChange={e => set({ metaReservaMeses: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1) })}
                                className={`w-14 text-center px-2 py-1.5 rounded-lg border text-sm font-black outline-none focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
                            <span className={`text-[12px] font-bold ${muted}`}>{t('dashcfg.months')}</span>
                        </div>
                    </div>
                    <Flag isDark={isDark} on={cfg.considerarSuperfluo} onToggle={v => set({ considerarSuperfluo: v })}
                        label={t('dashcfg.penalizeSuperfluous')} hint={t('dashcfg.penalizeSuperfluousHint')} />
                </Secao>
            </div>
        </div>
    );
}

function Secao({ isDark, title, children }) {
    return (
        <div className={`py-1 border-t first:border-t-0 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
            <p className={`text-[11px] font-black uppercase tracking-widest mt-3 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
            {children}
        </div>
    );
}

function Flag({ isDark, on, onToggle, label, hint }) {
    return (
        <button type="button" onClick={() => onToggle(!on)} aria-pressed={on}
            className="w-full flex items-center justify-between gap-3 py-2.5 text-left">
            <span className="min-w-0">
                <span className={`block text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</span>
                <span className={`block text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition ${on ? 'bg-emerald-500' : (isDark ? 'bg-white/10' : 'bg-slate-200')}`}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
            </span>
        </button>
    );
}
