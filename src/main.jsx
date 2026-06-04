import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { PwaUpdateProvider } from './contexts/PwaUpdateContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PwaUpdateProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PwaUpdateProvider>
  </StrictMode>,
)
