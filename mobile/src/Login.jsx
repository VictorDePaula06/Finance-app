import React from 'react';
import { Sparkles, AlertTriangle, Play } from 'lucide-react';
import { useStore } from './store.jsx';

export default function Login() {
  const { login, enterDemo, firebaseReady } = useStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-5">
        <Sparkles className="w-8 h-8 text-emerald-400" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">Alívia</h1>
      <p className="text-[13px] text-white/45 mt-2 leading-relaxed max-w-[260px]">
        Entre com a sua conta Google — os mesmos dados do site, sincronizados.
      </p>

      {firebaseReady ? (
        <button
          onClick={login}
          className="mt-7 w-full max-w-[300px] py-3.5 rounded-2xl bg-white text-black font-bold text-[14px] flex items-center justify-center gap-2.5 active:scale-95 transition"
        >
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 inline-block" />
          Entrar com Google
        </button>
      ) : (
        <div className="mt-6 w-full max-w-[320px] rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-2.5 text-left">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-200/90 leading-relaxed">
            Firebase ainda não configurado. Use o <span className="font-bold">modo demonstração</span> abaixo,
            ou crie o <span className="font-bold">mobile/.env.local</span> (veja .env.example) para entrar com dados reais.
          </p>
        </div>
      )}

      {/* Modo demonstração — funciona sem Firebase (ideal para testar no emulador) */}
      <button
        onClick={enterDemo}
        className="mt-3 w-full max-w-[300px] py-3 rounded-2xl bg-white/[0.06] text-white/80 font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition"
      >
        <Play className="w-4 h-4" /> Ver em modo demonstração
      </button>
    </div>
  );
}
