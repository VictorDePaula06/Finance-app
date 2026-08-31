import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Sistema de toasts leve, sem dependências externas e theme-aware (usa as CSS
 * vars da Alívia). Não usa Context — qualquer código pode chamar `toast.success(...)`.
 *
 *   import { toast } from './ui/Toaster';
 *   toast.success('Lançamento salvo!');
 *   toast.error('Não foi possível salvar.');
 *
 * O <Toaster /> é montado uma única vez na raiz do app.
 */

let counter = 0;
const subscribers = new Set();
let queue = [];

function emit() { subscribers.forEach((fn) => fn(queue)); }

function push(type, message, opts = {}) {
  const id = ++counter;
  queue = [...queue, { id, type, message, duration: opts.duration ?? 3500 }];
  emit();
  return id;
}

function dismiss(id) { queue = queue.filter((t) => t.id !== id); emit(); }

export const toast = {
  success: (m, o) => push('success', m, o),
  error: (m, o) => push('error', m, o),
  warning: (m, o) => push('warning', m, o),
  info: (m, o) => push('info', m, o),
  dismiss,
};

const CFG = {
  success: { Icon: CheckCircle2, color: '#10b981' },
  error: { Icon: AlertTriangle, color: '#f43f5e' },
  warning: { Icon: AlertTriangle, color: '#f59e0b' },
  info: { Icon: Info, color: '#3b82f6' },
};

function ToastCard({ t }) {
  const { Icon, color } = CFG[t.type] || CFG.info;
  useEffect(() => {
    if (!t.duration) return undefined;
    const id = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(id);
  }, [t.id, t.duration]);

  return (
    <div
      className="alv-fade-in"
      role="status"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 13px',
        borderRadius: 14,
        background: 'var(--modal-bg)',
        border: '1px solid var(--card-border)',
        borderLeft: `3px solid ${color}`,
        boxShadow: '0 14px 34px -14px rgba(0,0,0,.45)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Icon size={18} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {t.message}
      </span>
      <button
        onClick={() => dismiss(t.id)}
        aria-label="Fechar"
        style={{ marginLeft: 4, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex' }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function Toaster() {
  const [list, setList] = useState(queue);
  useEffect(() => {
    const fn = (q) => setList([...q]);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 'min(92vw, 360px)',
      }}
    >
      {list.map((t) => <ToastCard key={t.id} t={t} />)}
    </div>
  );
}

export default Toaster;
