import React from 'react';
import { AlertTriangle, Play, Loader2 } from 'lucide-react';
import { useStore } from './store.jsx';
import logo from './assets/logo.png';

export default function Login() {
  const { login, enterDemo, firebaseReady, authError, authBusy } = useStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <img src={logo} alt="Alívia" className="w-24 h-24 object-contain mb-3 drop-shadow-[0_0_30px_rgba(16,185,129,0.25)]" />
      <h1 className="text-2xl font-extrabold tracking-tight">Alívia</h1>
      <p className="text-[13px] text-fg/45 mt-2 leading-relaxed max-w-[260px]">
        Entre com a sua conta Google — os mesmos dados do site, sincronizados.
      </p>

      {firebaseReady ? (
        <button
          onClick={login}
          disabled={authBusy}
          className="mt-7 w-full max-w-[300px] py-3.5 rounded-2xl bg-white text-black font-bold text-[14px] flex items-center justify-center gap-2.5 active:scale-95 transition border border-black/5 disabled:opacity-60"
        >
          {authBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 inline-block" />}
          {authBusy ? 'Entrando…' : 'Entrar com Google'}
        </button>
      ) : (
        <div className="mt-6 w-full max-w-[320px] rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-2.5 text-left">
          <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-200/90 leading-relaxed">
            Firebase ainda não configurado. Use o <span className="font-bold">modo demonstração</span> abaixo,
            ou crie o <span className="font-bold">mobile/.env.local</span> (veja .env.example) para entrar com dados reais.
          </p>
        </div>
      )}

      {/* Modo demonstração — funciona sem Firebase (ideal para testar no emulador) */}
      <button
        onClick={enterDemo}
        className="mt-3 w-full max-w-[300px] py-3 rounded-2xl bg-fg/[0.06] text-fg/80 font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition"
      >
        <Play className="w-4 h-4" /> Ver em modo demonstração
      </button>

      {authError && (
        <div className="mt-5 w-full max-w-[320px] rounded-2xl bg-rose-500/10 border border-rose-500/25 p-3.5 text-left">
          <p className="text-[12px] font-bold text-neg flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Não consegui entrar</p>
          <p className="text-[11px] text-fg/60 mt-1.5 break-words leading-relaxed">{authError}</p>
        </div>
      )}
    </div>
  );
}
