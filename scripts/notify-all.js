import webpush from 'web-push';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
    console.error("ERRO: VAPID keys não encontradas no .env");
    process.exit(1);
}

webpush.setVapidDetails(
  'mailto:j.17jvictor@gmail.com',
  publicKey,
  privateKey
);

async function run() {
    console.log("=== INICIANDO PROCESSAMENTO DE NOTIFICAÇÕES PUSH ===");
    
    try {
        const qN = query(collection(db, 'notifications'), where('status', '==', 'pending'));
        const snapN = await getDocs(qN);
        
        if (snapN.empty) {
            console.log("Nenhuma notificação pendente encontrada.");
            return;
        }

        const usersSnap = await getDocs(collection(db, 'users'));
        const allSubscriptions = [];
        usersSnap.docs.forEach(u => {
            const subs = u.data().pushSubscriptions || [];
            subs.forEach(s => allSubscriptions.push(JSON.parse(s)));
        });

        console.log(`Encontradas ${allSubscriptions.length} assinaturas de usuários.`);

        for (const notifDoc of snapN.docs) {
            const data = notifDoc.data();
            console.log(`Enviando: "${data.title}" para ${allSubscriptions.length} destinos...`);

            const payload = JSON.stringify({
                title: data.title,
                body: data.body,
                url: '/'
            });

            const results = await Promise.allSettled(allSubscriptions.map(sub => 
                webpush.sendNotification(sub, payload)
            ));

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.filter(r => r.status === 'rejected').length;

            console.log(`Resultado: ${successCount} sucessos, ${failCount} falhas.`);

            await updateDoc(notifDoc.ref, {
                status: 'sent',
                finalRecipientCount: successCount,
                completedAt: new Date()
            });
        }
    } catch (error) {
        console.error("ERRO CRÍTICO NO SCRIPT:", error);
    }
    
    console.log("=== FIM DO PROCESSAMENTO ===");
    process.exit(0);
}

run();
