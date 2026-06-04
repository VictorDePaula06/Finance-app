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

// https://vite.dev/config/
export default defineConfig({
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
