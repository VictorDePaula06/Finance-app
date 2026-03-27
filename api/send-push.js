import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
    // Forçar cabeçalho JSON
    res.setHeader('Content-Type', 'application/json');

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        // 1. Validação de Ambiente
        const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

        if (!saKey || !vapidPublic || !vapidPrivate) {
            return res.status(500).json({ 
                success: false, 
                error: 'Faltam variáveis de ambiente (SERVICE_ACCOUNT ou VAPID) no Vercel.' 
            });
        }

        // 2. Inicialização Firebase Admin
        if (!getApps().length) {
            try {
                const serviceAccount = JSON.parse(saKey);
                initializeApp({
                    credential: cert(serviceAccount)
                });
            } catch (e) {
                return res.status(500).json({ success: false, error: 'Erro ao processar JSON da FIREBASE_SERVICE_ACCOUNT_KEY: ' + e.message });
            }
        }

        const db = getFirestore();
        const { title, body, url } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'Título e Mensagem são obrigatórios.' });
        }

        // 3. Configuração Web Push
        webpush.setVapidDetails(
            'mailto:suporte@soualivia.com.br',
            vapidPublic,
            vapidPrivate
        );

        // 4. Busca de Assinaturas e Envio
        const usersSnap = await db.collection('users').get();
        let totalSent = 0;
        let totalFailed = 0;
        const pushPromises = [];

        usersSnap.forEach(userDoc => {
            const userData = userDoc.data();
            const subs = userData.pushSubscriptions || [];

            subs.forEach(subJson => {
                try {
                    const subscription = JSON.parse(subJson);
                    const promise = webpush.sendNotification(subscription, JSON.stringify({
                        title,
                        body,
                        url: url || 'https://soualivia.com.br'
                    })).then(() => {
                        totalSent++;
                    }).catch(err => {
                        console.error(`Falha no envio para ${userDoc.id}:`, err.message);
                        totalFailed++;
                    });
                    pushPromises.push(promise);
                } catch (e) {
                    console.error('Erro de parse na subscrição:', e.message);
                }
            });
        });

        await Promise.all(pushPromises);

        return res.status(200).json({ 
            success: true, 
            message: `Processado com sucesso. Enviados: ${totalSent}, Falhas: ${totalFailed}.`,
            stats: { totalSent, totalFailed }
        });

    } catch (fatalError) {
        console.error('Erro Fatal na API de Push:', fatalError);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro interno no servidor: ' + fatalError.message 
        });
    }
}
