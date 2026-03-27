import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-4 flex justify-center animate-in fade-in slide-in-from-top duration-500">
      <div className="bg-white/90 backdrop-blur-xl border border-[#5CCEEA]/30 shadow-2xl rounded-3xl p-4 max-w-md w-full flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-[#5CCEEA] to-[#69C8B9] rounded-2xl shadow-lg shadow-[#5CCEEA]/20">
          <RefreshCw className="w-6 h-6 text-white animate-spin-slow" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-slate-900 font-bold text-sm">
            {needRefresh ? 'Nova versão disponível!' : 'App pronto para offline'}
          </h3>
          <p className="text-slate-500 text-[10px] leading-tight">
            {needRefresh 
              ? 'Temos novidades e melhorias na Alívia. Clique para atualizar agora.' 
              : 'Você já pode usar a Alívia sem internet!'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 bg-[#5CCEEA] hover:bg-[#4AB8D4] text-white font-bold text-[10px] rounded-xl transition-all shadow-md shadow-[#5CCEEA]/20 active:scale-95"
            >
              ATUALIZAR
            </button>
          )}
          <button
            onClick={close}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReloadPrompt
