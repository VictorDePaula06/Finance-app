# Auditoria de Segurança — Alívia Finanças (Web + Android)

**Data:** 2026-09-11 · **Branch:** `feature/novo-layout` · **Escopo:** Web (React/Vite na Vercel) + Mobile (Capacitor WebView) + Firebase + Stripe.

> Relatório consolidado com o estado **antes → depois** de cada achado. Todas as correções de código estão commitadas e no ar; os itens marcados "ação do usuário" dependem de configuração externa (Firebase Console / Vercel / build do APK).

---

## Resumo executivo

| # | Achado | Severidade | Status |
|---|--------|-----------|--------|
| 1 | `wa_links` legível/listável por qualquer autenticado → account takeover WhatsApp | **Alta** | ✅ Corrigido |
| 2 | Código de vínculo WhatsApp com `Math.random()` (previsível) | Média | ✅ Corrigido (CSPRNG + TTL) |
| 3 | Webhook WhatsApp *fail-open* sem `WHATSAPP_APP_SECRET` | Média/Alta | ✅ Corrigido (fail-closed) |
| 4 | `upgrade-subscription`: allowlist de preço *fail-open* | Média | ✅ Corrigido (fail-closed) |
| 5 | Entitlement/plano validado só no cliente | Média | ⚠️ Aceito/parcial (dados protegidos por regras) |
| 6 | Android `allowBackup="true"` | Média | ✅ Corrigido (`false`) |
| 7 | Android sem ofuscação (`minifyEnabled false`) | Baixa | ✅ Corrigido (R8) — testar APK |
| 8 | APIs vazando `e.message` ao cliente | Baixa | ✅ Corrigido |
| 9 | Sem rate limiting nos endpoints | Baixa | ✅ Scaffold pronto (ativar com Upstash) |
| 10 | **App Check ausente** | Média | ✅ Implementado (monitoramento) — falta enforcement |

**Nenhum achado Crítico.** A base estava acima da média para um app desenvolvido com apoio de IA: regras de Firestore com guards anti-escalação, preço do Stripe resolvido no servidor, sem segredos no bundle nem no histórico do Git, mock-auth inerte em produção, e cabeçalhos de segurança fortes.

---

## Achados — antes → depois

### 1. `wa_links` legível por qualquer autenticado (Alta)
- **Antes:** `allow read: if isSignedIn();` permitia a qualquer usuário logado **listar toda a coleção** `wa_links`, obtendo `{code, uid}` de todos e sequestrando o vínculo de WhatsApp de outra conta.
- **Depois:** `allow read: if isSignedIn() && resource.data.uid == request.auth.uid;` — só o dono. O cliente nunca lê essa coleção (só cria/deleta).
- **Arquivo:** `firestore.rules` · **CWE-639/284 · OWASP A01:2025**

### 2. Código de vínculo previsível (Média)
- **Antes:** `genCode()` usava `Math.random()` (PRNG não-criptográfico), 6 chars.
- **Depois:** `crypto.getRandomValues` (CSPRNG) + **TTL de 15 min** no consumo do webhook (código expirado é apagado e o usuário gera outro).
- **Arquivos:** `src/pages/Configuracoes.jsx`, `api/whatsapp.js`

### 3. Webhook WhatsApp *fail-open* (Média/Alta)
- **Antes:** `if (!secret) return true;` — sem `WHATSAPP_APP_SECRET`, aceitava POSTs forjados (o webhook usa Admin SDK e ignora as regras).
- **Depois:** `if (!secret) return false;` (fail-closed) + `.trim()` no segredo + log de diagnóstico. **Ação do usuário concluída:** `WHATSAPP_APP_SECRET` configurado na Vercel e webhook validando assinatura.
- **Arquivo:** `api/whatsapp.js` · **CWE-345**

### 4. Allowlist de preço *fail-open* (Média)
- **Antes:** a checagem da allowlist era pulada quando as env vars de preço estavam vazias → qualquer `priceId` do cliente era aceito.
- **Depois:** fail-closed — sem allowlist configurada, retorna erro; só aceita preços conhecidos. **Confirmado:** `VITE_STRIPE_PRICE_ID_MONTHLY/_YEARLY` presentes na Vercel. (A função já só alterava a assinatura do próprio `uid` — sem IDOR.)
- **Arquivo:** `api/upgrade-subscription.js` · **OWASP API3:2023**

### 5. Entitlement client-side (Média — aceito)
- **Situação:** `AuthContext` calcula `isPremium/isLifetime` no cliente e cacheia em `localStorage`. Um usuário pode desbloquear **features** premium localmente.
- **Mitigação existente:** os **dados** de cada usuário seguem protegidos por *ownership* nas regras, e `subscription.status`/`isAdmin` não podem ser auto-elevados (guards `subStatusSafe`/`adminFlagSafe`). O risco é **comercial** (bypass de paywall de features locais), não de confidencialidade.
- **Recomendação futura:** validar entitlement no servidor para features pagas que rodem no backend. Não urgente para time solo.

### 6. Android `allowBackup` (Média)
- **Antes:** `android:allowBackup="true"` → dados do WebView (localStorage, sessão) extraíveis via `adb backup`.
- **Depois:** `android:allowBackup="false"` + `fullBackupContent="false"`.
- **Arquivo:** `mobile/android/app/src/main/AndroidManifest.xml` (local — vale no próximo APK) · **MASVS-STORAGE-2**

### 7. Ofuscação Android (Baixa)
- **Antes:** `minifyEnabled false` (R8/ProGuard desligado).
- **Depois:** `minifyEnabled true` + `shrinkResources true` + regras `-keep` do Capacitor/ponte JS.
- **Ação do usuário:** **testar o APK release** antes de publicar. · **MASVS-RESILIENCE-2**

### 8. Vazamento de erros nas APIs (Baixa)
- **Antes:** `create-annual-checkout`, `upgrade-subscription`, `fipe` retornavam `e.message`/`detail` ao cliente.
- **Depois:** mensagens genéricas ao cliente; detalhe só em `console.error` no servidor.
- **CWE-209**

### 9. Rate limiting (Baixa)
- **Antes:** nenhum limite nos endpoints (Vercel não tem nativo).
- **Depois:** helper `api/_rateLimit.js` (janela fixa via Upstash REST, sem dependência nova) ligado em `create-annual-checkout` e `upgrade-subscription` (8 req/min por uid). **Inerte** sem `UPSTASH_REDIS_REST_URL/TOKEN`; **fail-open** em erro de infra.
- **Ação do usuário:** criar Redis (Upstash/Vercel KV) e setar as 2 env vars.

### 10. Firebase App Check (Média)
- **Antes:** ausente — config pública permitia acesso direto ao backend fora do app.
- **Depois:** implementado no frontend (reCAPTCHA Enterprise via `VITE_APPCHECK_PROVIDER=enterprise`), CSP liberada para `www.google.com`, chave registrada no Firebase e na Vercel. **Emitindo tokens em modo monitoramento.**
- **Ação do usuário:** monitorar métricas 2–3 dias e então **aplicar enforcement** no Firestore (testar o mobile antes).
- **Arquivos:** `src/services/firebase.js`, `vercel.json`

---

## Itens verificados SEM achado (registro positivo)
- Preço do checkout anual resolvido 100% no servidor; funções Stripe autenticam ID token (jose/Admin SDK).
- **Nenhum segredo no histórico do Git** (`sk_live/sk_test/BEGIN PRIVATE KEY` = 0); `.env*` e `serviceAccount.json` gitignored e nunca commitados.
- Nenhum segredo no bundle do frontend (só `VITE_*` públicas por design).
- Mock-auth triplo-protegido (`import.meta.env.DEV` = false em produção) → inerte em prod.
- XSS mitigado no chat da Alívia (escapa `<`/`&` antes de injetar markup próprio).
- `send-push` admin-only + valida URL `https://`.
- Proxies de mercado com validação de ticker e **sem SSRF** (host fixo).
- Cabeçalhos fortes na `vercel.json` (CSP sem `unsafe-inline` em `script-src`, HSTS preload, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP).
- Permissões Android mínimas (INTERNET, RECORD_AUDIO); FileProvider não-exportado; Capacitor sem `server.url` remoto.

## Não verificável com o contexto fornecido
- Proteção contra enumeração de e-mail no Firebase (Email/Senha está habilitado por design).
- Regras de Storage (ausentes em `firebase.json`; Storage não é usado pelo cliente web).
- Assinatura dos webhooks da extensão Stripe (gerenciada pela extensão oficial).
- Preview Deployments da Vercel e escopo de env vars.
- Propagação de exclusão LGPD ao Stripe (Firestore é limpo; revogação do customer no Stripe não confirmada).

## Pendências do usuário (checklist)
- [ ] Monitorar App Check e **aplicar enforcement** no Firestore (testar mobile antes).
- [ ] **Ativar rate limiting** (Upstash/Vercel KV + 2 env vars).
- [ ] **Testar o APK release** com R8 antes de publicar.
- [ ] (Opcional) Rotacionar as chaves reCAPTCHA que apareceram em captura de tela.
- [ ] (Opcional) Apagar `serviceAccount.json` do disco quando não estiver usando scripts.

## Ferramentas complementares recomendadas
- Segredos no Git: `gitleaks`/`trufflehog`.
- Regras Firestore: testes com Firebase Emulator (`@firebase/rules-unit-testing`).
- SAST: `Semgrep` + `npm audit`/Dependabot.
- Mobile: `MobSF` (análise estática do APK).
