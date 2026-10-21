// A chave que assina o APK está registrada no Firebase?
//
// Se não estiver, o login com Google falha dentro do app e em nenhum
// outro lugar: o Google Play Services recusa o pedido com
// DEVELOPER_ERROR (código 10) quando o certificado que assinou o app não
// está na lista daquele cliente OAuth. A tela do Google abre e não
// conclui, ou nem abre — e nada no código está errado.
//
// Foi exatamente o que aconteceu: o app assinado com o keystore de debug
// desta máquina (fdb456…) contra três impressões digitais registradas que
// eram de outras máquinas. O login funcionava na web e só quebrava no
// APK, o que manda procurar no lugar errado.
//
// Vai acontecer de novo em duas situações previsíveis:
//   · trocar de máquina (cada uma tem seu debug.keystore);
//   · publicar na Play Store, onde o Google REASSINA o app com a chave
//     dele — a impressão digital que vale lá é a do Play Console, não
//     esta. Esse é um erro que custa meio dia a quem não sabe.
//
// Rodar: node scripts/checa-assinatura-android.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG = 'mobile/android/app/google-services.json';
const APK = 'mobile/android/app/build/outputs/apk/debug/app-debug.apk';

if (!existsSync(CONFIG)) {
    console.log(`pulando — ${CONFIG} não existe (projeto Android não configurado)`);
    process.exit(0);
}

// ── O que o Firebase conhece ────────────────────────────────────────
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const registradas = new Map();      // sha1 -> pacote
let temClienteWeb = false;
for (const c of cfg.client || []) {
    const pacote = c.client_info?.android_client_info?.package_name;
    for (const o of c.oauth_client || []) {
        if (o.android_info?.certificate_hash) {
            registradas.set(o.android_info.certificate_hash.toLowerCase(), pacote);
        }
        if (o.client_type === 3) temClienteWeb = true;
    }
}

let falhas = 0;
console.log(`projeto ${cfg.project_info?.project_id} — ${registradas.size} impressão(ões) digital(is) registrada(s)`);

// O login nativo do Google precisa do cliente WEB (client_type 3): é dele
// que sai o `default_web_client_id` que o plugin usa como serverClientId.
if (!temClienteWeb) {
    falhas++;
    console.log('FALHA  não há cliente OAuth do tipo WEB no google-services.json');
    console.log('       sem ele o plugin não tem serverClientId e o login nativo não sobe');
} else {
    console.log('ok     cliente OAuth WEB presente (serverClientId)');
}

// ── Qual chave assina de verdade ────────────────────────────────────
function doApk() {
    if (!existsSync(APK)) return null;
    const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
        || join(homedir(), 'AppData', 'Local', 'Android', 'Sdk');
    const bt = join(sdk, 'build-tools');
    if (!existsSync(bt)) return null;
    // A mais recente serve; o apksigner não muda de comportamento aqui.
    const versao = readdirSync(bt).sort().pop();
    for (const nome of ['apksigner.bat', 'apksigner']) {
        const exe = join(bt, versao, nome);
        if (!existsSync(exe)) continue;
        try {
            const saida = execFileSync(exe, ['verify', '--print-certs', APK], { encoding: 'utf8' });
            const m = saida.match(/SHA-1 digest:\s*([0-9a-f]{40})/i);
            if (m) return { sha1: m[1].toLowerCase(), de: 'o APK já construído' };
        } catch { /* tenta o próximo */ }
    }
    return null;
}

function doKeystore() {
    const ks = join(homedir(), '.android', 'debug.keystore');
    if (!existsSync(ks)) return null;
    for (const exe of ['keytool', join(process.env.JAVA_HOME || '', 'bin', 'keytool')]) {
        try {
            const saida = execFileSync(exe, ['-list', '-v', '-keystore', ks,
                '-alias', 'androiddebugkey', '-storepass', 'android', '-keypass', 'android'],
                { encoding: 'utf8' });
            const m = saida.match(/SHA1:\s*((?:[0-9A-F]{2}:){19}[0-9A-F]{2})/i);
            if (m) return { sha1: m[1].replace(/:/g, '').toLowerCase(), de: 'o keystore de debug desta máquina' };
        } catch { /* tenta o próximo */ }
    }
    return null;
}

const assina = doApk() || doKeystore();

if (!assina) {
    console.log('aviso  não consegui ler a chave de assinatura (sem apksigner nem keytool)');
    console.log('       o resto foi conferido; esta parte ficou sem verificar');
} else {
    const ok = registradas.has(assina.sha1);
    if (!ok) falhas++;
    const bonito = assina.sha1.match(/.{2}/g).join(':').toUpperCase();
    console.log(`${ok ? 'ok   ' : 'FALHA'}  a chave que assina (${assina.de})`);
    console.log(`       ${bonito}`);
    if (!ok) {
        console.log('       NÃO está registrada — o login com Google vai falhar DENTRO do app');
        console.log('       (na web continua funcionando, o que engana)');
        console.log('       Registre essa SHA-1 no Firebase, baixe o google-services.json');
        console.log('       novo e substitua. O APK não precisa ser refeito: a impressão');
        console.log('       digital é validada pelo servidor do Google, não vai no pacote.');
    }
}

console.log('');
console.log(falhas ? `${falhas} problema(s) — o login com Google quebraria no app` : 'tudo certo — o app pode fazer login com Google');
process.exit(falhas ? 1 : 0);
