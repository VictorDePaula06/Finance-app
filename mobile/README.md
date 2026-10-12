# Alívia — App Mobile (Android)

App mobile dedicado da Alívia. **Projeto isolado** do site (nada aqui altera o web).
Usa o **mesmo Firebase** do site → mesmo banco, login Google, dados sincronizados:
o que você mexe no celular aparece no PC e vice-versa.

## 1) Configurar o Firebase (uma vez)

Copie o `.env.example` para `.env.local` e preencha com os **valores reais** do seu
Firebase (Console → Configurações do projeto → Seus apps → app **Web**). São os
**mesmos** que o site usa na Vercel. Esses dados do Firebase Web são públicos por
natureza (não são segredo).

```bash
cd mobile
cp .env.example .env.local   # depois edite .env.local com os valores reais
```

> O `.env.local` é ignorado pelo git (não vai pro repositório).

## 2) Rodar e visualizar no PC

```bash
npm install      # só na primeira vez
npm run dev
```

Abra `http://localhost:5174`, aperte **F12** no Chrome e clique no ícone de
**dispositivo** (modo celular). Clique em **Entrar com Google** (a mesma conta do
site) — e você verá **seus dados reais**.

> Se o login Google reclamar de domínio, adicione `localhost` em
> Firebase Console → Authentication → Settings → Authorized domains.

## Status

- **Funcional (atual):** login Google + dados reais do Firestore (mesmo banco do
  site) nas abas Geral, Recebimentos, Lançamentos, Cartão, Análises e Ajustes.
  Saldo, ganhos/gastos, fatura, categorias e saúde financeira calculados com a
  mesma lógica do site.
- **Próximos:** ligar o chat/áudio da Alívia (Gemini), ações de criar/editar
  lançamentos no próprio app, e empacotar com Capacitor para gerar o `.aab` do
  Android (Google Play).

## Gerar o APK

O `android/` é gerado pelo Capacitor e **não entra no git** — por isso tudo que
ele precisa de especial mora em `scripts/configura-android.mjs`, que o
`android:sync` chama sozinho.

```bash
npm run android:sync                 # build do site + copia pro Android + configura
cd android && ./gradlew assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`.

Antes de gerar, suba `versionCode` e `versionName` em `android/app/build.gradle`.

> **Atenção:** o `webDir` do `capacitor.config.json` aponta para `../dist`, ou
> seja, o APK empacota **o site**, não a UI de `mobile/src`. Se o site não for
> rebuildado, o app sai com uma cópia velha.

### Se o app abrir e fechar na hora

Quase sempre é dependência nativa faltando. Pegue o motivo:

```bash
adb logcat -c && adb shell am start -n br.com.soualivia.app/.MainActivity && adb logcat -d -b crash
```

Foi assim que apareceu o `NoClassDefFoundError: ...GoogleSignIn` — o
`play-services-auth` compilava mas não ia para o APK. A correção está no
`configura-android.mjs`; se o `android/` for regerado sem rodar esse script, o
crash volta.

### Assinatura

`android/keystore.properties` aponta para o `.jks` e guarda as senhas. Fica
fora do git de propósito — sem ele, o `assembleRelease` sai sem assinatura.
