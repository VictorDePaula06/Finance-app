import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Configuração do Firebase Admin (usando variáveis de ambiente)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, body, url } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: 'Missing title or body' });
    }

    // Configura o Web Push com as chaves VAPID
    webpush.setVapidDetails(
        'mailto:suporte@soualivia.com.br',
        process.env.VITE_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    try {
        // Busca todos os usuários que têm assinaturas
        const usersSnap = await db.collection('users').get();
        let totalSent = 0;
        let totalFailed = 0;

        const pushPromises = [];

        usersSnap.forEach(userDoc => {
            const userData = userDoc.data();
            const subs = userData.pushSubscriptions || [];

            subs.forEach(subJson => {
                const subscription = JSON.parse(subJson);
                
                const promise = webpush.sendNotification(subscription, JSON.stringify({
                    title,
                    body,
                    url: url || 'https://soualivia.com.br'
                })).then(() => {
                    totalSent++;
                }).catch(err => {
                    console.error(`Falha ao enviar para ${userDoc.id}:`, err);
                    totalFailed++;
                    // Opcional: remover a assinatura inválida do banco aqui
                });
                
                pushPromises.push(promise);
            });
        });

        await Promise.all(pushPromises);

        return res.status(200).json({ 
            success: true, 
            message: `Processado: ${totalSent} enviados, ${totalFailed} falhas.`,
            stats: { totalSent, totalFailed }
        });

    } catch (error) {
        console.error('Erro global na Vercel Function:', error);
        return res.status(500).json({ error: error.message });
    }
}
