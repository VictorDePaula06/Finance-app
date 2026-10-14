// Ajustes no projeto Android que o Capacitor não faz sozinho.
//
// `mobile/android/` é gerado por `cap add android` e fica fora do git, então
// toda configuração manual ali se perde na próxima geração. Este script é o
// lugar onde elas ficam registradas — rode depois de `cap add` / `cap sync`
// (o `npm run android:sync` já chama).
//
// ── Por que existe ───────────────────────────────────────────────────
// O APK 2.0 abria e fechava na hora. O logcat:
//
//   java.lang.NoClassDefFoundError:
//     com.google.android.gms.auth.api.signin.GoogleSignIn
//     at GoogleAuthProviderHandler.buildGoogleSignInClient
//     at FirebaseAuthenticationPlugin.load
//
// O @capacitor-firebase/authentication declara o play-services-auth como
// `compileOnly` quando `rgcfaIncludeGoogle` é falso — o padrão. Compila
// bonito e a classe NÃO entra no APK. Como o capacitor.config.json pede
// `providers: ['google.com']`, o plugin monta o cliente de login no
// onCreate, não acha a classe e derruba o app antes da primeira tela.
//
// O build nunca avisa: para o compilador está tudo resolvido.
//
// ── E a câmera ───────────────────────────────────────────────────────
// A leitura do QR Code da nota mostrava "Sem acesso à câmera", e o diálogo
// de autorização nunca aparecia.
//
// O Capacitor TEM o código que pede a permissão: BridgeWebChromeClient
// .onPermissionRequest chama permissionLauncher.launch(CAMERA) quando o
// getUserMedia dispara. Só que o launcher não mostra diálogo nenhum para uma
// permissão que não está declarada no manifesto — o Android nega na hora.
//
// Capacitor gera o AndroidManifest com INTERNET e mais nada. Sem a linha da
// CAMERA, o pedido morre antes de virar pergunta na tela.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

let mudou = false;

// ── 1. variables.gradle ─────────────────────────────────────────────
const GRADLE = 'android/variables.gradle';
if (!existsSync(GRADLE)) {
    console.log(`${GRADLE} não existe — rode \`npx cap add android\` antes.`);
    process.exit(1);
}

let s = readFileSync(GRADLE, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

const garantir = (chave, linha) => {
    if (new RegExp(`^\\s*${chave}\\s*=`, 'm').test(s)) return;
    s = s.replace(/\n\}/, `${nl}${linha}${nl}}`);
    console.log(`+ ${chave}`);
    mudou = true;
};

garantir('rgcfaIncludeGoogle',
    '    // Sem isto o play-services-auth entra como compileOnly: compila e some' + nl +
    '    // do APK, e o app fecha ao abrir procurando GoogleSignIn.' + nl +
    '    rgcfaIncludeGoogle = true');
garantir('playServicesAuthVersion', "    playServicesAuthVersion = '21.0.0'");

if (mudou) {
    writeFileSync(GRADLE, s);
    console.log(`${GRADLE} atualizado.`);
}

// ── 2. AndroidManifest.xml ──────────────────────────────────────────
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
if (existsSync(MANIFEST)) {
    let m = readFileSync(MANIFEST, 'utf8');
    const mnl = m.includes('\r\n') ? '\r\n' : '\n';
    const antes = m;

    // `required="false"` de propósito: sem isso a Play Store esconde o app de
    // quem não tem câmera, e o resto do app funciona perfeitamente sem ela.
    const LINHAS = [
        ['android.permission.CAMERA', '    <uses-permission android:name="android.permission.CAMERA" />'],
        ['android.hardware.camera', '    <uses-feature android:name="android.hardware.camera" android:required="false" />'],
        ['android.hardware.camera.autofocus', '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'],
    ];

    const ancora = '    <uses-permission android:name="android.permission.INTERNET" />';
    if (!m.includes(ancora)) {
        console.log(`! não achei a linha do INTERNET em ${MANIFEST} — confira à mão.`);
    } else {
        const novas = LINHAS.filter(([chave]) => !m.includes(chave)).map(([, linha]) => linha);
        if (novas.length) {
            m = m.replace(ancora, ancora + mnl + novas.join(mnl));
            novas.forEach(l => console.log('+ ' + l.trim()));
        }
    }

    if (m !== antes) {
        writeFileSync(MANIFEST, m);
        console.log(`${MANIFEST} atualizado.`);
        mudou = true;
    }
}

// ── 3. Ícone do launcher ────────────────────────────────────────────
// O template do Capacitor vem com o boneco branco padrão. Os ícones da
// Alívia ficam em `resources/android/` (versionados, gerados a partir do
// public/icon-512.png) e são copiados por cima a cada sync — o `android/`
// é regerado e levaria o ícone bom junto.
const ORIGEM_ICONES = 'resources/android';
if (existsSync(ORIGEM_ICONES)) {
    let copiados = 0;
    for (const dpi of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
        const de = `${ORIGEM_ICONES}/mipmap-${dpi}`;
        const para = `android/app/src/main/res/mipmap-${dpi}`;
        if (!existsSync(de) || !existsSync(para)) continue;
        for (const nome of readdirSync(de)) {
            const origem = readFileSync(`${de}/${nome}`);
            const destino = `${para}/${nome}`;
            // Só escreve se mudou: senão o Gradle reconstrói tudo à toa.
            if (existsSync(destino) && Buffer.compare(origem, readFileSync(destino)) === 0) continue;
            writeFileSync(destino, origem);
            copiados++;
        }
    }
    if (copiados) { console.log(`+ ${copiados} arquivo(s) de ícone`); mudou = true; }

    // A cor por trás do ícone adaptativo: a mesma amostrada do icon-512.
    const COR = 'android/app/src/main/res/values/ic_launcher_background.xml';
    const arqCor = `${ORIGEM_ICONES}/cor-de-fundo.txt`;
    if (existsSync(COR) && existsSync(arqCor)) {
        const cor = readFileSync(arqCor, 'utf8').trim();
        const atual = readFileSync(COR, 'utf8');
        const novo = atual.replace(/(<color name="ic_launcher_background">)[^<]*(<\/color>)/, `$1${cor}$2`);
        if (novo !== atual) {
            writeFileSync(COR, novo);
            console.log(`+ fundo do ícone adaptativo ${cor}`);
            mudou = true;
        }
    }
}

if (!mudou) console.log('nada a fazer — o projeto Android já está configurado.');
