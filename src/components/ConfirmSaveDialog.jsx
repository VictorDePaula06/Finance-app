import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Diálogo de confirmação usado nas telas de CADASTRO.
 *
 * Padroniza o fluxo "salvar" em todo o módulo:
 *   1. o formulário chama onde antes salvava → abre este diálogo;
 *   2. o usuário CONFIRMA;
 *   3. o `onConfirm` roda a gravação — se der erro, a mensagem aparece AQUI
 *      (em vez de falhar em silêncio e deixar a janela aberta);
 *   4. em caso de sucesso, quem chamou fecha o formulário.
 *
 * Props:
 *   open, title, message, details[] (linhas "label: valor" de revisão),
 *   confirmLabel, busy, error, onConfirm, onCancel
 */
export default function ConfirmSaveDialog({
  open,
  title = 'Confirmar cadastro',
  message = 'Revise os dados antes de salvar.',
  details = [],
  confirmLabel = 'Confirmar e salvar',
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const { theme } = useTheme();
  if (!open) return null;
  const isDark = theme !== 'light';

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => !busy && onCancel?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-[2rem] border p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'
        }`}
      >
        {!busy && (
          <button
            onClick={onCancel}
            className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{message}</p>
        </div>

        {/* Revisão dos dados */}
        {details.length > 0 && (
          <div className={`mt-4 rounded-2xl border divide-y ${isDark ? 'border-white/[0.06] divide-white/[0.06] bg-white/[0.02]' : 'border-slate-100 divide-slate-100 bg-slate-50'}`}>
            {details.filter(d => d && d.value !== '' && d.value != null).map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">{d.label}</span>
                <span className={`text-[11px] font-bold text-right truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Erro da gravação — o que antes falhava em silêncio */}
        {error && (
          <div className={`mt-4 flex items-start gap-2 p-3 rounded-xl border ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50 border-rose-200'}`}>
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-rose-500">Não foi possível salvar</p>
              <p className="text-[10px] text-rose-400 leading-relaxed break-words">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
              isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
