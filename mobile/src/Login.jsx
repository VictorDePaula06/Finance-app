import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sun, Moon, Loader2, CheckCircle2, Play, AlertTriangle } from 'lucide-react';
import { useStore } from './store.jsx';
import { useTheme } from './theme.jsx';
import Sheet from './components/Sheet.jsx';
import logo from './assets/logo.png';

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
    default: return 'Não foi possível continuar. Tente novamente.';
  }
}

const inputCls =
  'w-full pl-11 pr-4 py-3.5 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] text-[14px] font-semibold ' +
  'text-fg placeholder:text-fg/30 outline-none focus:border-fg/25 transition';

export default function Login() {
  const { login, loginEmail, signupEmail, resetPassword, enterDemo, firebaseReady, authError, authBusy } = useStore();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  const clearMsgs = () => { setError(''); setInfo(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMsgs();
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    setLoading(true);
    try { await loginEmail(email, password); }
    catch (err) { console.error('[login/email]', err?.code, err); setError(friendlyError(err?.code)); }
    setLoading(false);
  };

  const handleReset = async () => {
    clearMsgs();
    if (!email.trim()) { setError('Digite seu e-mail acima para redefinir a senha.'); return; }
    setLoading(true);
    try { await resetPassword(email); setInfo('Enviamos um link de redefinição para o seu e-mail. ✉️'); }
    catch (err) { console.error('[login/reset]', err?.code, err); setError(friendlyError(err?.code)); }
    setLoading(false);
  };

  return (
    <div className="min-h-full flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
      {/* Tema */}
      <button onClick={toggleTheme} aria-label="Alternar tema"
        className="absolute top-4 right-5 w-11 h-11 rounded-2xl bg-fg/[0.06] border border-fg/[0.08] flex items-center justify-center text-fg/70 active:scale-90 transition">
        {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-300" />}
      </button>

      <div className="w-full max-w-[380px]">
        {/* Marca */}
        <div className="flex flex-col items-center mb-7">
          <img src={logo} alt="Alívia" className="w-20 h-20 object-contain mb-2 drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]" />
          <h1 className="text-[20px] font-extrabold tracking-tight">Acesse sua conta</h1>
          <p className="text-[12px] text-fg/45 mt-1">Suas finanças, com clareza e segurança.</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-5 bg-card border border-fg/[0.06] shadow-xl shadow-black/20">
          {(error || authError) && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl mb-4 text-[12px] text-center font-bold">
              {error || authError}
            </div>
          )}
          {info && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-4 py-3 rounded-2xl mb-4 text-[12px] text-center font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {info}
            </div>
          )}

          {firebaseReady ? (
            <>
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                  <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
                  <input type={showPass ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShowPass(v => !v)} aria-label="Mostrar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/35 active:text-fg/70">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={handleReset} disabled={loading} className="text-[12px] font-bold text-pos active:opacity-70 disabled:opacity-50">Esqueci a senha</button>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25 disabled:opacity-70">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Entrar <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-fg/10" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-fg/40">ou</span>
                <div className="h-px flex-1 bg-fg/10" />
              </div>

              <button onClick={login} disabled={authBusy}
                className="w-full py-3.5 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] font-bold text-[14px] flex items-center justify-center gap-3 active:scale-[0.98] transition disabled:opacity-70">
                {authBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Acessar com Google
                </>}
              </button>

              <p className="text-center text-[13px] text-fg/50 mt-5">
                Ainda não tem uma conta?{' '}
                <button type="button" onClick={() => { clearMsgs(); setSignupOpen(true); }} className="font-extrabold text-pos active:opacity-70">
                  Criar conta
                </button>
              </p>
            </>
          ) : (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-2.5 text-left">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-200/90 leading-relaxed">Firebase não configurado. Crie o <span className="font-bold">mobile/.env.local</span> (veja .env.example) para entrar com dados reais.</p>
            </div>
          )}
        </div>

        {/* Selos */}
        <p className="text-center text-[10px] text-fg/35 mt-5">🔒 Seguro · Firebase Auth (Google)</p>

        {/* Demo — só em desenvolvimento */}
        {import.meta.env.DEV && (
          <button onClick={enterDemo} className="mt-3 w-full py-3 rounded-2xl bg-fg/[0.06] text-fg/70 font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition">
            <Play className="w-4 h-4" /> Ver em modo demonstração (dev)
          </button>
        )}
      </div>

      {signupOpen && (
        <Sheet title="Criar sua conta" subtitle="É rápido — comece a organizar suas finanças" onClose={() => setSignupOpen(false)}>
          <SignupForm signupEmail={signupEmail} />
        </Sheet>
      )}
    </div>
  );
}

// Formulário de cadastro (dentro do bottom-sheet).
function SignupForm({ signupEmail }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    if (password.length < 6) { setError('A senha precisa ter ao menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    setLoading(true);
    try { await signupEmail(email, password); /* sucesso → auth muda → tela troca */ }
    catch (err) { console.error('[signup]', err?.code, err); setError(friendlyError(err?.code)); setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl text-[12px] text-center font-bold">{error}</div>}
      <div className="relative">
        <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} autoFocus />
      </div>
      <div className="relative">
        <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie uma senha (mín. 6)" className={`${inputCls} pr-11`} />
        <button type="button" onClick={() => setShow(v => !v)} aria-label="Mostrar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/35 active:text-fg/70">
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      <div className="relative">
        <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar senha" className={inputCls} />
      </div>
      <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25 disabled:opacity-70">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Criar conta <ArrowRight className="w-4 h-4" /></>}
      </button>
      <p className="text-[11px] text-center text-fg/40">Ao criar a conta, você concorda com os Termos e a Política de Privacidade.</p>
    </form>
  );
}
