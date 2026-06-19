# Login Google nativo (Android) — passo a passo

O **código** já está pronto: no app empacotado o login usa o plugin nativo do
Google e conclui a sessão no Firebase JS (mesma sessão do resto do app); no
navegador continua usando o popup. Falta só a configuração que depende dos
**seus** consoles e do **keystore** (que tem sua senha).

## O que já foi feito (no código, versionado)
- `@capacitor-firebase/authentication` instalado + `capacitor.config.json`
  (`skipNativeAuth: true`, provider `google.com`).
- `src/services/auth.js`: `signInWithGoogle()` ciente de plataforma (nativo x web).
- `store.jsx`: `login`/`logout` usam o novo helper.

## O que já foi aplicado no projeto Android local (pasta `android/`, NÃO versionada)
> Se um dia rodar `cap add android` de novo, reaplique estes dois:
- `android/variables.gradle`: `rgcfaIncludeGoogle = true` (ativa o Google no plugin).
- `android/app/src/main/AndroidManifest.xml`: permissões `RECORD_AUDIO` e
  `MODIFY_AUDIO_SETTINGS` (áudio da Alívia).

---

## O que VOCÊ precisa fazer

### 1. Gerar o keystore de assinatura (guarde com a vida — perdeu, não atualiza mais o app)
Rode fora do repositório (ex.: numa pasta segura). Escolha **suas** senhas:
```
keytool -genkey -v -keystore alivia-release.jks -alias alivia -keyalg RSA -keysize 2048 -validity 10000
```
⚠️ NÃO comite o `.jks` nem as senhas.

### 2. Pegar os fingerprints SHA-1
- Do **release** (o de cima):
```
keytool -list -v -keystore alivia-release.jks -alias alivia
```
- Do **debug** (pra testar no emulador antes do release) — no PowerShell:
```
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
Copie o valor **SHA1**.

### 3. Firebase Console → adicionar o app Android
1. Configurações do projeto → Seus apps → **Adicionar app** → Android.
2. Nome do pacote: `br.com.soualivia.app`
3. Cole o **SHA-1 do debug** agora (e depois adicione o do release).
4. Registrar → **baixar `google-services.json`**.
5. Coloque o arquivo em: `mobile/android/app/google-services.json`
   (ele NÃO vai pro git — é gitignored.)
6. Em **Authentication → Sign-in method**, confirme que **Google** está ativo
   (já está, pelo site).

### 4. Build e teste no emulador
```
cd mobile
npm run android:sync
npm run android:open
```
No Android Studio, clique ▶ Run, e teste **"Entrar com Google"** com a sua conta.

### 5. (Depois, para publicar) Build de release assinado
No Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**,
usando o `alivia-release.jks`. Adicione também o **SHA-1 do release** (e o do
"Play App Signing", que o Google mostra no Console) no Firebase.
