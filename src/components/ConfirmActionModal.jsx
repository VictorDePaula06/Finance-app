import React, { useState } from 'react';
import { Trash2, Pencil, Loader2 } from 'lucide-react';
import { toast } from './ui/Toaster';

// Modal de confirmação de Editar / Excluir. Ao confirmar, mostra "Editando…" /
// "Excluindo…" enquanto processa. `onConfirm` pode ser assíncrono.
// Reutilizado na fatura do cartão, em Recorrentes e em Lançamentos.
export default function ConfirmActionModal({ isDark, type, name, noun = 'lançamento', onClose, onConfirm }) {
    const [busy, setBusy] = useState(false);
    const isDelete = type === 'delete';
    const Icon = isDelete ? Trash2 : Pencil;
    const cardBg = isDark ? 'border-white/10 bg-[#141518]' : 'border-slate-200 bg-white';

    const confirm = async () => {
        setBusy(true);
        try { await onConfirm(); onClose(); }
        catch (e) { console.error(e); toast.error('Não foi possível concluir. Tente de novo.'); setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onMouseDown={busy ? undefined : onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div onMouseDown={e => e.stopPropagation()} className={`relative w-full max-w-sm rounded-2xl border shadow-2xl ${cardBg} p-5`}>
                <div className="flex items-center gap-3 mb-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDelete ? 'bg-rose-500/12 text-rose-500' : 'bg-emerald-500/12 text-emerald-500'}`}><Icon className="w-5 h-5" strokeWidth={2.3} /></span>
                    <div className="min-w-0">
                        <h3 className={`text-[15px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{isDelete ? `Excluir ${noun}?` : `Editar ${noun}?`}</h3>
                        <p className="text-[12px] text-slate-500 truncate">{name || noun}</p>
                    </div>
                </div>
                <p className={`text-[13px] leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {isDelete
                        ? `Tem certeza que deseja excluir este ${noun}? Esta ação não pode ser desfeita.`
                        : `Deseja abrir este ${noun} para edição?`}
                </p>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onClose} disabled={busy} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                    <button type="button" onClick={confirm} disabled={busy}
                        className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-80 ${isDelete ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/25' : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'}`}>
                        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {isDelete ? 'Excluindo…' : 'Editando…'}</> : <><Icon className="w-4 h-4" /> {isDelete ? 'Excluir' : 'Editar'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
