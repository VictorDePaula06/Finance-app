import React from 'react';
import { Wallet, X, Info, Lightbulb } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Modal de aviso de saldo — tom amigável (atenção, não alarme).
 *
 * Aparece quando o usuário tenta lançar uma despesa/pagamento que supera o
 * saldo em carteira atual. Não bloqueia — apenas informa com calma e pede
 * confirmação. Usa paleta âmbar (atenção) em vez de vermelho (erro/perigo).
 *
 * IMPORTANTE: não é disparado para compras no crédito/parcelamento —
 * essas só impactam o saldo ao pagar a fatura.
 *
 * Props:
 *   isOpen         — controla a visibilidade
 *   onConfirm      — chamado se o usuário decidir prosseguir
 *   onCancel       — chamado ao cancelar
 *   amount         — valor da operação (R$)
 *   balance        — saldo atual em carteira (R$, pode ser negativo)
 *   itemName       — descrição curta do que está sendo pago
 *   isProcessing   — desabilita os botões enquanto está salvando
 */
export default function OverdraftWarningModal({
    isOpen,
    onConfirm,
    onCancel,
    amount = 0,
    balance = 0,
    itemName = 'Esta despesa',
    isProcessing = false,
}) {
    const { theme } = useTheme();
    if (!isOpen) return null;

    const isDark = theme !== 'light';
    const fmt = (v) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const remainingAfter = balance - amount;

    return (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`relative w-full max-w-md rounded-3xl p-6 border shadow-2xl animate-in zoom-in-95 duration-300 ${
                isDark ? 'bg-slate-900 border-amber-500/20' : 'bg-white border-amber-200'
            }`}>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'
                    }`}
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className={`p-2.5 rounded-2xl shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                        <Wallet className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Atenção ao seu saldo
                        </h3>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.18em]">
                            Confira antes de continuar
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="space-y-4">
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <strong>{itemName}</strong> custa <strong className={isDark ? 'text-white' : 'text-slate-800'}>R$ {fmt(amount)}</strong>,
                        um pouco acima do que você tem em carteira no momento
                        (<strong className={isDark ? 'text-white' : 'text-slate-800'}>{balance < 0 ? '-' : ''}R$ {fmt(balance)}</strong>).
                    </p>

                    {/* Breakdown visual */}
                    <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Saldo atual</span>
                            <span className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>
                                {balance < 0 ? '- ' : ''}R$ {fmt(balance)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valor desta despesa</span>
                            <span className={`text-sm font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>- R$ {fmt(amount)}</span>
                        </div>
                        <div className={`pt-2 mt-2 border-t flex items-center justify-between ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Saldo depois</span>
                            <span className="text-base font-black tabular-nums text-amber-500">
                                {remainingAfter < 0 ? '- ' : ''}R$ {fmt(remainingAfter)}
                            </span>
                        </div>
                    </div>

                    {/* Nota informativa — calma, sem alarmismo */}
                    <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${isDark ? 'bg-amber-500/[0.06] border-amber-500/15' : 'bg-amber-50/60 border-amber-100'}`}>
                        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Tudo bem registrar mesmo assim — só fique de olho: seu saldo ficará negativo,
                            o que com o tempo pode levar a endividamento.
                        </p>
                    </div>

                    <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${isDark ? 'bg-blue-500/[0.05] border-blue-500/15' : 'bg-blue-50/60 border-blue-100'}`}>
                        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Se preferir, você pode adiar este lançamento, resgatar de uma reserva ou aguardar uma entrada.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Voltar e revisar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`w-full py-2.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                            isDark
                                ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {isProcessing ? 'Processando...' : 'Registrar mesmo assim'}
                    </button>
                </div>
            </div>
        </div>
    );
}
