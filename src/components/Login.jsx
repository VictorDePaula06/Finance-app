import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import {
    Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, User,
    ShieldCheck, Heart, Sun, Moon, Loader2, CheckCircle2, Check,
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

// Força da senha (0–4) — só orientação visual; o backend exige min. 6 (Firebase).
function passwordScore(pw) {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
}
const STRENGTH = [
    { label: 'Muito fraca', color: '#f43f5e' },
    { label: 'Fraca', color: '#f97316' },
    { label: 'Média', color: '#f59e0b' },
    { label: 'Boa', color: '#10b981' },
    { label: 'Forte', color: '#059669' },
];

export default function Login({ onBack }) {
    const { login, signup, loginWithGoogle } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const isSignup = mode === 'signup';

    const resetMsgs = () => { setError(''); setInfo(''); };
    const switchMode = (m) => { resetMsgs(); setShowPass(false); setMode(m); };

    // Validação em tempo real (só para exibir estados; não bloqueia além do backend).
    const score = useMemo(() => passwordScore(password), [password]);
    const reqs = useMemo(() => ([
        { ok: password.length >= 6, label: 'Ao menos 6 caracteres' },
        { ok: /[A-Za-z]/.test(password), label: 'Uma letra' },
        { ok: /\d/.test(password), label: 'Um número' },
    ]), [password]);
    const confirmState = !confirm ? 'idle' : (confirm === password ? 'match' : 'mismatch');

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
        catch (err) { console.error('[login/email]', err?.code, err); setError(friendlyError(err?.code)); setLoading(false); }
    }

    async function handleSignup(e) {
        e.preventDefault();
        resetMsgs();
        const mail = email.trim();
        if (!name.trim()) { setError('Como podemos te chamar?'); return; }
        if (!mail || !password) { setError('Preencha e-mail e senha.'); return; }
        if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
        if (password !== confirm) { setError('As senhas não conferem.'); return; }
        setLoading(true);
        try {
            await signup(mail, password);
            // Nome de exibição — usa o SDK de auth já existente (mesmo do app), sem novo backend.
            try { if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name.trim() }); } catch (e2) { console.error('[signup/name]', e2); }
            // Sucesso → o estado de auth muda e a tela troca sozinha (não desliga o loading).
        } catch (err) { console.error('[signup]', err?.code, err); setError(friendlyError(err?.code)); setLoading(false); }
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

    const inputBase = `w-full pl-11 py-3.5 rounded-2xl border text-sm font-semibold outline-none transition-all ${
        isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
               : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.14)]'}`;
    const labelCls = `block text-[11px] font-black uppercase tracking-widest mb-1.5 ${muted}`;

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-5 sm:p-6 relative overflow-hidden font-sans transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className="absolute top-[-12%] left-[-10%] w-[46%] h-[46%] bg-emerald-400/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-[-12%] right-[-10%] w-[46%] h-[46%] bg-blue-500/10 rounded-full blur-[120px] -z-10" />

            {/* Tema */}
            <button onClick={toggleTheme} aria-label="Alternar tema"
                className={`absolute top-5 right-5 w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 border ${
                    isDark ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="w-full max-w-md relative z-10">
                {/* Marca — "Alívia Finanças" (igual pós-login) */}
                <div className="flex flex-col items-center mb-7">
                    <div className="w-[120px] h-[70px] overflow-hidden flex justify-center mb-1.5">
                        <img src={logo} alt="Alívia" className="w-[120px] h-[120px] object-cover object-top drop-shadow-[0_0_24px_rgba(16,185,129,0.25)]" />
                    </div>
                    <span className="text-[26px] font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500">Alívia</span>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.42em] mt-1.5 ml-[0.42em] ${muted}`}>Finanças</span>
                </div>

                {/* Título (muda com o modo, transição suave) */}
                <div key={`h-${mode}`} className="text-center mb-5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {isSignup ? 'Crie sua conta' : 'Acesse sua conta'}
                    </h1>
                    <p className={`text-[13px] mt-1 ${muted}`}>
                        {isSignup ? 'Comece a organizar suas finanças em minutos.' : 'Suas finanças, com clareza e segurança.'}
                    </p>
                </div>

                {/* Card */}
                <div className={`rounded-[1.75rem] p-6 sm:p-7 border shadow-xl ${isDark ? 'bg-slate-900/80 border-white/10 backdrop-blur' : 'bg-white/90 border-slate-100 backdrop-blur'}`}>
                    {error && <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold animate-shake">{error}</div>}
                    {info && <div role="status" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl mb-4 text-[13px] text-center font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

                    <div key={`v-${mode}`} className="animate-in fade-in duration-300">
                        {isSignup ? (
                            /* ───────── CRIAR CONTA ───────── */
                            <form onSubmit={handleSignup} className="space-y-3.5">
                                <div>
                                    <label htmlFor="su-name" className={labelCls}>Nome</label>
                                    <div className="relative">
                                        <User className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="su-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado(a)" className={`${inputBase} pr-4`} maxLength={40} autoFocus />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="su-email" className={labelCls}>E-mail</label>
                                    <div className="relative">
                                        <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="su-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={`${inputBase} pr-4`} />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="su-pass" className={labelCls}>Senha</label>
                                    <div className="relative">
                                        <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="su-pass" type={showPass ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha" className={`${inputBase} pr-11`} />
                                        <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {/* Força + requisitos (aparecem ao digitar) */}
                                    {password && (
                                        <div className="mt-2.5 animate-in fade-in duration-200">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 flex gap-1">
                                                    {[0, 1, 2, 3].map(i => (
                                                        <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                                                            style={{ background: i < score ? STRENGTH[score].color : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0') }} />
                                                    ))}
                                                </div>
                                                <span className="text-[11px] font-black" style={{ color: STRENGTH[score].color }}>{STRENGTH[score].label}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                                {reqs.map((r, i) => (
                                                    <span key={i} className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${r.ok ? 'text-emerald-500' : muted}`}>
                                                        <Check className={`w-3 h-3 ${r.ok ? 'opacity-100' : 'opacity-40'}`} strokeWidth={3} /> {r.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="su-confirm" className={labelCls}>Confirmar senha</label>
                                    <div className="relative">
                                        <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="su-confirm" type={showPass ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha"
                                            className={`${inputBase} pr-10 ${confirmState === 'mismatch' ? '!border-rose-500/60 focus:!shadow-[0_0_0_3px_rgba(244,63,94,0.16)]' : confirmState === 'match' ? '!border-emerald-500/60' : ''}`} />
                                        {confirmState === 'match' && <CheckCircle2 className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                                    </div>
                                    {confirmState === 'mismatch' && <p className="text-[11px] font-bold text-rose-500 mt-1.5">As senhas não conferem.</p>}
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Criando conta…</> : <>Criar conta <ArrowRight className="w-4 h-4" /></>}
                                </button>
                                <p className={`text-[11px] text-center ${muted}`}>Ao criar a conta, você concorda com os Termos e a Política de Privacidade.</p>
                            </form>
                        ) : (
                            /* ───────── LOGIN ───────── */
                            <form onSubmit={handleLogin} className="space-y-3.5">
                                <div>
                                    <label htmlFor="li-email" className={labelCls}>E-mail</label>
                                    <div className="relative">
                                        <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="li-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={`${inputBase} pr-4`} autoFocus />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="li-pass" className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>Senha</label>
                                        <button type="button" onClick={handleReset} disabled={loading} className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50">Esqueci a senha</button>
                                    </div>
                                    <div className="relative">
                                        <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                                        <input id="li-pass" type={showPass ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className={`${inputBase} pr-11`} />
                                        <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Entrando…</> : <>Entrar <ArrowRight className="w-4 h-4" /></>}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Separador */}
                    <div className="flex items-center gap-3 my-5">
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${muted}`}>ou continuar com</span>
                        <div className={`h-px flex-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                    </div>

                    {/* Google */}
                    <button onClick={handleGoogle} disabled={googleLoading}
                        className={`w-full py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] border ${
                            isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'} disabled:opacity-70`}>
                        {googleLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Conectando…</> : <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </>}
                    </button>

                    {/* Alternância Login ↔ Criar conta */}
                    <p className={`text-center text-[13px] mt-5 ${muted}`}>
                        {isSignup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
                        <button type="button" onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                            className="font-extrabold text-emerald-500 hover:text-emerald-400 transition-colors">
                            {isSignup ? 'Entrar' : 'Criar conta'}
                        </button>
                    </p>

                    {onBack && !isSignup && (
                        <button type="button" onClick={onBack} className={`w-full mt-3 py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                            <ArrowLeft className="w-4 h-4" /> Voltar para o início
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-center gap-8 pt-6">
                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${muted}`}><ShieldCheck className="w-3.5 h-3.5" /> Seguro</div>
                    <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${muted}`}><Heart className="w-3.5 h-3.5" /> Privado</div>
                </div>
            </div>

            <footer className={`absolute bottom-6 text-xs font-bold uppercase tracking-widest pointer-events-none opacity-50 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>© {new Date().getFullYear()} ALÍVIA</footer>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            `}} />
        </div>
    );
}
