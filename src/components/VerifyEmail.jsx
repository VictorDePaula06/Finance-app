import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../services/firebase';
import { MailCheck, RefreshCw, LogOut, Sun, Moon, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import logo from '../assets/logo.png';

// Tela que segura o acesso até o e-mail ser verificado (fluxo por LINK do Firebase).
export default function VerifyEmail({ email }) {
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const [checking, setChecking] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    async function handleCheck() {
        setError(''); setInfo(''); setChecking(true);
        try {
            await auth.currentUser?.reload();
            if (auth.currentUser?.emailVerified) {
                // Recarrega o app para reentrar já com o e-mail verificado.
                window.location.reload();
                return;
            }
            setError('Ainda não confirmamos. Clique no link do e-mail e tente de novo.');
        } catch (e) {
            console.error('reload', e);
            setError('Não foi possível verificar agora. Tente novamente.');
        }
        setChecking(false);
    }

    async function handleResend() {
        setError(''); setInfo(''); setResending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            setInfo('Reenviamos o link de verificação. ✉️');
        } catch (e) {
            console.error('resend', e);
            setError(e?.code === 'auth/too-many-requests' ? 'Muitos envios. Aguarde alguns minutos.' : 'Não foi possível reenviar agora.');
        }
        setResending(false);
    }

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-400/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-500/10 rounded-full blur-[120px] -z-10" />

            <button onClick={toggleTheme} aria-label="Alternar tema"
                className={`absolute top-5 right-5 w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 border ${
                    isDark ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center mb-6">
                    <img src={logo} alt="Alívia" className="w-32 h-auto object-contain mb-4 drop-shadow-sm" />
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/12 flex items-center justify-center mb-4">
                        <MailCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className={`text-xl font-black tracking-tight text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>Confirme seu e-mail</h1>
                    <p className={`text-[13px] mt-2 text-center leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Enviamos um link de verificação para<br />
                        <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{email}</span>.<br />
                        Abra o e-mail, clique no link e volte aqui.
                    </p>
                </div>

                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
                {info && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

                <div className="space-y-3">
                    <button onClick={handleCheck} disabled={checking}
                        className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-70">
                        {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Já confirmei</>}
                    </button>
                    <button onClick={handleResend} disabled={resending}
                        className={`w-full py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border ${
                            isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'} disabled:opacity-70`}>
                        {resending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Reenviar e-mail</>}
                    </button>
                    <button onClick={logout}
                        className={`w-full py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>

                <p className={`text-center text-[11px] mt-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Não recebeu? Confira a caixa de spam ou reenvie o link.
                </p>
            </div>
        </div>
    );
}
