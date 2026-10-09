import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { PwaUpdateProvider } from './contexts/PwaUpdateContext.jsx'
import { PrivacyProvider } from './contexts/PrivacyContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PwaUpdateProvider>
      <PrivacyProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PrivacyProvider>
    </PwaUpdateProvider>
  </StrictMode>,
)
