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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQ = 'android/variables.gradle';

if (!existsSync(ARQ)) {
    console.log(`${ARQ} não existe — rode \`npx cap add android\` antes.`);
    process.exit(1);
}

let s = readFileSync(ARQ, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
let mudou = false;

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
    writeFileSync(ARQ, s);
    console.log(`${ARQ} atualizado.`);
} else {
    console.log('nada a fazer — o projeto Android já está configurado.');
}
