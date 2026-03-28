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
  if (offlineReady && !needRefresh) return null // Don't show "ready for offline" card anymore

  return (
    <button
      onClick={() => updateServiceWorker(true)}
      title="Atualização disponível! Clique para recarregar."
      className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 animate-pulse flex items-center gap-2 hover:bg-amber-600 transition-colors"
    >
      <RefreshCw className="w-5 h-5" />
      <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline-block">Atualizar App</span>
    </button>
  )
}

export default ReloadPrompt
