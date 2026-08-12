import React, { useState } from 'react';
import { MailCheck, RefreshCw, LogOut, Sun, Moon, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from './store.jsx';
import { useTheme } from './theme.jsx';
import logo from './assets/logo.png';

// Segura o acesso até o e-mail ser verificado (fluxo por LINK do Firebase).
export default function VerifyEmail() {
  const { user, logout, resendVerification, reloadUser } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleCheck = async () => {
    setError(''); setInfo(''); setChecking(true);
    try {
      const verified = await reloadUser();
      if (!verified) setError('Ainda não confirmamos. Clique no link do e-mail e tente de novo.');
    } catch (e) { console.error(e); setError('Não foi possível verificar agora. Tente de novo.'); }
    setChecking(false);
  };

  const handleResend = async () => {
    setError(''); setInfo(''); setResending(true);
    try { await resendVerification(); setInfo('Reenviamos o link de verificação. ✉️'); }
    catch (e) { setError(e?.code === 'auth/too-many-requests' ? 'Muitos envios. Aguarde alguns minutos.' : 'Não foi possível reenviar agora.'); }
    setResending(false);
  };

  return (
    <div className="min-h-full flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
      <button onClick={toggleTheme} aria-label="Alternar tema"
        className="absolute top-4 right-5 w-11 h-11 rounded-2xl bg-fg/[0.06] border border-fg/[0.08] flex items-center justify-center text-fg/70 active:scale-90 transition">
        {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-300" />}
      </button>

      <div className="w-full max-w-[380px] text-center">
        <img src={logo} alt="Alívia" className="w-20 h-20 object-contain mx-auto mb-3" />
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/12 flex items-center justify-center mx-auto mb-4">
          <MailCheck className="w-8 h-8 text-pos" />
        </div>
        <h1 className="text-[20px] font-extrabold tracking-tight">Confirme seu e-mail</h1>
        <p className="text-[13px] text-fg/50 mt-2 leading-relaxed">
          Enviamos um link de verificação para<br />
          <span className="font-bold text-fg/80">{user?.email}</span>.<br />
          Abra o e-mail, clique no link e volte aqui.
        </p>

        <div className="mt-6 space-y-3 text-left">
          {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl text-[12px] text-center font-bold flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
          {info && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl text-[12px] text-center font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

          <button onClick={handleCheck} disabled={checking}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25 disabled:opacity-70">
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Já confirmei</>}
          </button>
          <button onClick={handleResend} disabled={resending}
            className="w-full py-3.5 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-70">
            {resending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Reenviar e-mail</>}
          </button>
          <button onClick={logout} className="w-full py-3 rounded-2xl text-fg/50 font-bold text-[13px] flex items-center justify-center gap-2 active:opacity-70">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>

        <p className="text-[11px] text-fg/35 mt-6">Não recebeu? Confira o spam ou reenvie o link.</p>
      </div>
    </div>
  );
}
