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
// Executa as funções de api/ no servidor de desenvolvimento.
// Na Vercel elas rodam sozinhas; no `vite dev` não existia nada servindo /api,
// então cotações, histórico e busca só funcionavam em produção. Este plugin
// carrega o handler correspondente e adapta req/res ao formato que ele espera.
// Só GET e OPTIONS: os endpoints de POST (Stripe, webhook) exigem corpo e
// segredos que não têm por que rodar em desenvolvimento.
function devApiPlugin() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) return next()

        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.slice('/api/'.length).replace(/\.js$/, '')
        // Arquivos com "_" são utilitários, não rotas — mesma regra da Vercel.
        if (!name || name.startsWith('_') || name.includes('/')) return next()

        let mod
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`)
        } catch {
          return next()                       // rota inexistente: segue o fluxo
        }
        if (typeof mod.default !== 'function') return next()

        req.query = Object.fromEntries(url.searchParams)

        // Corpo do POST: a Vercel entrega `req.body` já parseado, o Vite não.
        // Sem isto, toda rota de POST (foto do cupom, por exemplo) só dava
        // para testar em produção.
        if (req.method === 'POST') {
          const pedacos = []
          for await (const p of req) pedacos.push(p)
          const bruto = Buffer.concat(pedacos).toString('utf8')
          try { req.body = bruto ? JSON.parse(bruto) : {} } catch { req.body = bruto }
        }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
          return res
        }
        try {
          await mod.default(req, res)
        } catch (err) {
          server.config.logger.error(`[dev-api] ${name}: ${err?.message || err}`)
          if (!res.writableEnded) { res.statusCode = 500; res.end('{"error":"dev-api"}') }
        }
      })
    },
  }
}

export default defineConfig({
  preview: {
    headers: { 'Content-Security-Policy': HARDENED_CSP },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    devApiPlugin(),
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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        // 'name' aparece na tela de instalacao; 'short_name' e o rotulo curto
        // que o sistema escreve embaixo do icone na tela inicial.
        name: 'Alívia Finanças',
        short_name: 'Alívia',
        description: 'Domine suas finanças com a Alívia',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        // Dois conjuntos separados de proposito:
        // - 'any': o icone e exibido inteiro (aba, lista de apps, splash);
        // - 'maskable': o sistema recorta em circulo/squircle, entao o simbolo
        //   e menor e fica dentro da safe zone central de 80%.
        // Usar o mesmo arquivo para os dois (como era antes) fazia o Android
        // cortar as bordas e preencher o fundo transparente com cinza.
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
