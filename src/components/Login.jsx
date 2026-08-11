import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import {
    Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, X,
    ShieldCheck, Heart, Sun, Moon, Loader2, CheckCircle2, UserPlus,
} from 'lucide-react';
import logo from '../assets/logo.png';

// Traduz os códigos de erro do Firebase Auth para mensagens amigáveis.
function friendlyError(code) {
    switch (code) {
        case 'auth/invalid-email': return 'E-mail inválido.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
        case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado. Tente entrar.';
        case 'auth/weak-password': return 'A senha precisa ter ao menos 6 caracteres.';
        case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
        case 'auth/network-request-failed': return 'Sem conexão. Verifique sua internet.';
        case 'auth/operation-not-allowed': return 'Cadastro por e-mail/senha ainda não está ativado. Fale com o suporte.';
        case 'auth/popup-closed-by-user': return '';
        default: return 'Não foi possível continuar. Tente novamente.';
    }
}

export default function Login({ onBack }) {
    const { login, signup, loginWithGoogle } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    // Login
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Modal "Criar conta"
    const [signupOpen, setSignupOpen] = useState(false);

    const resetMsgs = () => { setError(''); setInfo(''); };

    async function handleGoogle() {
        resetMsgs();
        setGoogleLoading(true);
        try { await loginWithGoogle(); }
        catch (e) { console.error('[login/google]', e?.code, e); const m = friendlyError(e?.code); if (m) setError(m); }
        setGoogleLoading(false);
    }

    async function handleLogin(e) {
        e.preventDefault();
        resetMsgs();
        if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
        setLoading(true);
        try { await login(email.trim(), password); }
        catch (err) { console.error('[login/email]', err?.code, err); setError(friendlyError(err?.code)); }
        setLoading(false);
    }

    async function handleReset() {
        resetMsgs();
        const mail = email.trim();
        if (!mail) { setError('Digite seu e-mail acima para redefinir a senha.'); return; }
        setLoading(true);
        try { await sendPasswordResetEmail(auth, mail); setInfo('Enviamos um link de redefinição para o seu e-mail. ✉️'); }
        catch (err) { console.error('[login/reset]', err?.code, err); setError(friendlyError(err?.code)); }
        setLoading(false);
    }

    const inputCls = `w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-semibold outline-none transition-colors ${
        isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
               : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-400/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-500/10 rounded-full blur-[120px] -z-10" />

            {/* Tema */}
            <button onClick={toggleTheme} aria-label="Alternar tema"
                className={`absolute top-5 right-5 w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 border ${
                    isDark ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
                {/* Marca */}
                <div className="flex flex-col items-center mb-8">
                    <img src={logo} alt="Alívia" className="w-40 h-auto object-contain mb-3 drop-shadow-sm" />
                    <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Acesse sua conta</h1>
                    <p className={`text-[13px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Suas finanças, com clareza e segurança.</p>
                </div>

                {/* Card de login */}
                <div className={`rounded-[1.75rem] p-6 sm:p-7 border shadow-xl ${isDark ? 'bg-slate-900/80 border-white/10 backdrop-blur' : 'bg-white/90 border-slate-100 backdrop-blur'}`}>
                    {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold animate-shake">{error}</div>}
                    {info && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

                    <form onSubmit={handleLogin} className="space-y-3.5">
                        <div className="relative">
                            <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
                        </div>
                        <div className="relative">
                            <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input type={showPass ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className={`${inputCls} pr-11`} />
                            <button type="button" onClick={() => setShowPass(v => !v)} aria-label="Mostrar senha" className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="flex justify-end">
                            <button type="button" onClick={handleReset} disabled={loading} className="text-[12px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50">Esqueci a senha</button>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-70">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-5">
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ou</span>
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                    </div>

                    <button onClick={handleGoogle} disabled={googleLoading}
                        className={`w-full py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] border ${
                            isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'} disabled:opacity-70`}>
                        {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Acessar com Google
                        </>}
                    </button>

                    {/* Criar conta → abre modal */}
                    <button type="button" onClick={() => { resetMsgs(); setSignupOpen(true); }}
                        className={`w-full mt-3 py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border-2 border-dashed ${
                            isDark ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-50'}`}>
                        <UserPlus className="w-4 h-4" /> Criar uma conta
                    </button>

                    {onBack && (
                        <button type="button" onClick={onBack} className={`w-full mt-3 py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <ArrowLeft className="w-4 h-4" /> Voltar para o início
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-center gap-8 pt-6">
                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><ShieldCheck className="w-3.5 h-3.5" /> Seguro</div>
                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Heart className="w-3.5 h-3.5" /> Privado</div>
                </div>
            </div>

            <footer className={`absolute bottom-6 text-xs font-bold uppercase tracking-widest pointer-events-none opacity-50 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>© {new Date().getFullYear()} ALÍVIA</footer>

            {signupOpen && <SignupModal isDark={isDark} signup={signup} onClose={() => setSignupOpen(false)} />}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            `}} />
        </div>
    );
}

// Janela separada (modal) de criação de conta.
function SignupModal({ isDark, signup, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const inputCls = `w-full pl-11 pr-4 py-3.5 rounded-2xl border text-sm font-semibold outline-none transition-colors ${
        isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
               : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    async function handleSignup(e) {
        e.preventDefault();
        setError('');
        const mail = email.trim();
        if (!mail || !password) { setError('Preencha e-mail e senha.'); return; }
        if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
        if (password !== confirm) { setError('As senhas não conferem.'); return; }
        setLoading(true);
        try { await signup(mail, password); /* sucesso → auth muda → tela troca sozinha */ }
        catch (err) { console.error('[signup]', err?.code, err); setError(friendlyError(err?.code)); setLoading(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={`relative w-full max-w-md rounded-[1.75rem] border shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                <button onClick={onClose} aria-label="Fechar" className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    <X className="w-4 h-4" />
                </button>

                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 flex items-center justify-center mx-auto mb-3"><UserPlus className="w-6 h-6 text-emerald-500" /></div>
                    <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Criar sua conta</h2>
                    <p className={`text-[12px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>É rápido — comece a organizar suas finanças.</p>
                </div>

                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold animate-shake">{error}</div>}

                <form onSubmit={handleSignup} className="space-y-3.5">
                    <div className="relative">
                        <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} autoFocus />
                    </div>
                    <div className="relative">
                        <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha (mín. 6)" className={`${inputCls} pr-11`} />
                        <button type="button" onClick={() => setShow(v => !v)} aria-label="Mostrar senha" className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="relative">
                        <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar senha" className={inputCls} />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-70">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Criar conta <ArrowRight className="w-4 h-4" /></>}
                    </button>
                </form>

                <p className={`text-[11px] text-center mt-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ao criar a conta, você concorda com os Termos e a Política de Privacidade.</p>
            </div>
        </div>
    );
}
