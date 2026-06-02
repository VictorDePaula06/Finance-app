import React from 'react'
import ReactDOM from 'react-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

function ReloadPrompt() {
  const {
    offlineReady: [, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Checa atualização ao registrar, a cada 60s e ao focar a aba — assim
      // até abas já abertas detectam um novo deploy e mostram o botão.
      if (!r) return
      r.update().catch(() => {})
      setInterval(() => r.update().catch(() => {}), 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          r.update().catch(() => {})
        }
      })
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  // Só mostramos o aviso quando há uma versão nova esperando.
  if (!needRefresh) return null

  // Toast flutuante renderizado via portal no body — assim a posição `fixed`
  // não é afetada por nenhum container com transform (ex.: o header tem scale).
  return ReactDOM.createPortal(
    <div
      className="fixed z-[2000] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm w-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="alert"
    >
      <div className="rounded-2xl border border-emerald-400/30 bg-slate-900 text-white shadow-2xl shadow-black/40 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight">Nova versão disponível</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            Atualize para ter as últimas melhorias e correções.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
            >
              Atualizar agora
            </button>
            <button
              onClick={close}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-[11px] font-bold transition-colors"
            >
              Depois
            </button>
          </div>
        </div>

        <button
          onClick={close}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          aria-label="Fechar aviso de atualização"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  )
}

export default ReloadPrompt
