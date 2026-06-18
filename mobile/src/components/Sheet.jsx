import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Painel deslizante inferior (bottom-sheet) para formulários.
export default function Sheet({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 anim-fade" onClick={onClose} />
      <div className="relative w-full max-w-[440px] max-h-[92vh] overflow-y-auto no-scrollbar bg-card rounded-t-3xl border-t border-fg/10 shadow-2xl shadow-black/40 anim-sheet">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur px-5 pt-4 pb-3 flex items-center justify-between border-b border-fg/[0.06]">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-[11px] text-fg/45 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-full bg-fg/[0.06] flex items-center justify-center active:scale-90 transition shrink-0">
            <X className="w-4 h-4 text-fg/70" />
          </button>
        </div>
        <div className="px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">{children}</div>
      </div>
    </div>
  );
}
