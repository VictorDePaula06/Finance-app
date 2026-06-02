import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// ─── Service Worker: auto-update ("Ctrl+F5 automatico" ao sair versao nova) ───
// Quando um novo deploy gera um sw.js diferente, o browser instala o novo SW,
// ele faz skipWaiting()+clients.claim() e assume a aba. Isso dispara o evento
// 'controllerchange', e recarregamos a pagina UMA vez para puxar os assets
// novos. Tambem checamos atualizacao periodicamente e ao focar a aba, para que
// mesmo abas ja abertas atualizem sozinhas, sem precisar de Ctrl+F5 manual.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { type: 'module' })
      .then((registration) => {
        // Checa assim que carrega e a cada 60s.
        registration.update().catch(() => {})
        setInterval(() => registration.update().catch(() => {}), 60 * 1000)
        // Checa tambem quando o usuario volta para a aba.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {})
          }
        })
      })
      .catch((err) => console.error('Falha ao registrar o Service Worker:', err))
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
