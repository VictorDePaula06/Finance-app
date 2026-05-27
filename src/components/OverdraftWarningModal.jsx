import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Modal reutilizável de aviso de endividamento.
 *
 * Aparece quando o usuário tenta lançar uma despesa/pagamento que supera o
 * saldo em carteira atual. Não bloqueia — apenas avisa e pede confirmação.
 *
 * Props:
 *   isOpen         — controla a visibilidade
 *   onConfirm      — chamado se o usuário decidir prosseguir mesmo assim
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
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`relative w-full max-w-md rounded-2xl p-6 border shadow-2xl animate-in zoom-in-95 duration-300 ${
                isDark ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-200'
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
                    <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-rose-500/15' : 'bg-rose-50'}`}>
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Saldo insuficiente
                        </h3>
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">
                            Risco de endividamento
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="space-y-4">
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <strong>{itemName}</strong> custa <strong className="text-rose-500">R$ {fmt(amount)}</strong>,
                        mas seu saldo em carteira é de apenas <strong className={balance < 0 ? 'text-rose-500' : (isDark ? 'text-white' : 'text-slate-800')}>
                        {balance < 0 ? '-' : ''}R$ {fmt(balance)}</strong>.
                    </p>

                    {/* Breakdown visual */}
                    <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50/50 border-rose-100'}`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Saldo atual</span>
                            <span className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-rose-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>
                                {balance < 0 ? '- ' : ''}R$ {fmt(balance)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valor desta despesa</span>
                            <span className="text-sm font-bold tabular-nums text-rose-500">- R$ {fmt(amount)}</span>
                        </div>
                        <div className={`pt-2 mt-2 border-t flex items-center justify-between ${isDark ? 'border-rose-500/20' : 'border-rose-200'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Saldo depois</span>
                            <span className="text-base font-black tabular-nums text-rose-500">
                                {remainingAfter < 0 ? '- ' : ''}R$ {fmt(remainingAfter)}
                            </span>
                        </div>
                    </div>

                    <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Se confirmar, sua carteira vai ficar <strong className="text-rose-500">negativa em R$ {fmt(Math.abs(remainingAfter))}</strong>.
                        Isso significa que você vai gastar dinheiro que ainda não tem — pode gerar endividamento, juros de cheque especial ou cartão.
                    </p>

                    <div className={`p-3 rounded-xl border flex items-start gap-2 ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-100'}`}>
                        <div className="text-[10px] leading-relaxed text-blue-500 dark:text-blue-400 font-medium">
                            💡 Sugestões: adiar este pagamento, resgatar de uma reserva, ou aguardar uma entrada.
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Cancelar (recomendado)
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`w-full py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border ${
                            isDark
                                ? 'bg-transparent border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                                : 'bg-transparent border-rose-200 text-rose-600 hover:bg-rose-50'
                        }`}
                    >
                        {isProcessing ? 'Processando...' : 'Pagar mesmo assim, vou me endividar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
