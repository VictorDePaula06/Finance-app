import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

// Gera /version.json no build com a versão atual — usado pelo app para mostrar
// qual versão nova está pendente quando há atualização do PWA.
function versionJsonPlugin() {
  return {
    name: 'write-version-json',
    closeBundle() {
      try {
        const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
        writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify({ version: pkg.version }))
      } catch { /* noop */ }
    },
  }
}

// CSP endurecida (F-06): script-src SEM 'unsafe-inline'/'unsafe-eval'.
// Espelha a CSP do vercel.json — usada no `vite preview` para validar o build
// de produção localmente antes de aplicar em produção.
const HARDENED_CSP = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com https://*.firebaseapp.com https://apis.google.com https://*.googleapis.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://*.googleapis.com https://*.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://api.stripe.com https://api.bcb.gov.br https://economia.awesomeapi.com.br https://api.binance.com https://query1.finance.yahoo.com https://corsproxy.io https://api.allorigins.win https://brapi.dev https://www.tesourodireto.com.br https://www.tesourotransparente.gov.br https://generativelanguage.googleapis.com wss://*.firebaseio.com",
  "frame-src 'self' https://js.stripe.com https://*.firebaseapp.com https://billing.stripe.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://billing.stripe.com",
  "upgrade-insecure-requests",
].join('; ');

// https://vite.dev/config/
export default defineConfig({
  preview: {
    headers: { 'Content-Security-Policy': HARDENED_CSP },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // 'prompt': o SW novo fica em espera e mostramos um toast "Atualizar"
      // (sem reload automatico — evita o loop). O registro/checagem e feito
      // pelo componente ReloadPrompt via virtual:pwa-register/react.
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5000000 // 5MB
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Alívia',
        short_name: 'Alívia',
        description: 'Domine suas finanças com a Alívia',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
})
