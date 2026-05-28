/**
 * Exportação de dados do titular — LGPD art. 18, V (portabilidade).
 *
 * Reúne TODOS os dados do usuário em um JSON estruturado e dispara o
 * download como arquivo. Cobertura completa:
 *
 *   - Perfil (users/{uid})
 *   - Configurações (users/{uid}/settings/general)
 *   - Histórico de aceite de termos (users/{uid}/terms_log)
 *   - Histórico de chat com IA (users/{uid}/chat/history)
 *   - Transações (transactions where userId)
 *   - Metas (goals where userId)
 *   - Cartões (cards where userId)
 *   - Assinaturas/parcelamentos (subscriptions where userId)
 *   - Contas fixas (fixed_expenses where userId)
 *   - Reservas/cofrinhos (savings_jars where userId)
 *   - Investimentos (investments where userId)
 *   - Stripe customer info (customers/{uid})
 *
 * NÃO inclui:
 *   - Dados de cartão de crédito (nunca armazenados — ficam só no Stripe)
 *   - Chave de API do Gemini (fica só no localStorage do navegador)
 */

import { db } from '../services/firebase';
import {
    doc, getDoc, collection, query, where, getDocs,
} from 'firebase/firestore';

const safeGetDoc = async (ref) => {
    try {
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch { return null; }
};

const safeGetDocs = async (q) => {
    try {
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
};

const safeGetSubcollection = async (parentRef, subName) => {
    try {
        const subRef = collection(parentRef, subName);
        const snap = await getDocs(subRef);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
};

export async function exportUserData(currentUser) {
    if (!currentUser?.uid) throw new Error('Usuário não autenticado');

    const uid = currentUser.uid;
    const now = new Date().toISOString();

    // Coletas em paralelo
    const userRef = doc(db, 'users', uid);
    const customerRef = doc(db, 'customers', uid);

    const [
        userDoc,
        settingsDoc,
        chatDoc,
        termsLog,
        customerDoc,
        subscriptions,
        transactions,
        goals,
        cards,
        appSubs,
        fixedExpenses,
        savingsJars,
        investments,
    ] = await Promise.all([
        safeGetDoc(userRef),
        safeGetDoc(doc(userRef, 'settings', 'general')),
        safeGetDoc(doc(userRef, 'chat', 'history')),
        safeGetSubcollection(userRef, 'terms_log'),
        safeGetDoc(customerRef),
        safeGetSubcollection(customerRef, 'subscriptions'),
        safeGetDocs(query(collection(db, 'transactions'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'goals'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'cards'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'subscriptions'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'fixed_expenses'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'savings_jars'), where('userId', '==', uid))),
        safeGetDocs(query(collection(db, 'investments'), where('userId', '==', uid))),
    ]);

    const payload = {
        _meta: {
            exportedAt: now,
            format: 'Alivia User Data Export',
            version: '1.0',
            lgpdReference: 'Lei 13.709/2018, art. 18, V — portabilidade',
        },
        identity: {
            uid,
            email: currentUser.email || null,
            displayName: currentUser.displayName || null,
            photoURL: currentUser.photoURL || null,
            emailVerified: currentUser.emailVerified ?? null,
            providerData: (currentUser.providerData || []).map(p => ({
                providerId: p.providerId,
                uid: p.uid,
                email: p.email,
            })),
            metadata: currentUser.metadata ? {
                creationTime: currentUser.metadata.creationTime,
                lastSignInTime: currentUser.metadata.lastSignInTime,
            } : null,
        },
        profile: userDoc,
        settings: settingsDoc,
        chatHistory: chatDoc,
        termsAcceptanceLog: termsLog,
        stripe: {
            customer: customerDoc,
            subscriptions,
        },
        financialData: {
            transactions,
            goals,
            cards,
            cardSubscriptionsAndInstallments: appSubs,
            fixedExpenses,
            savingsJars,
            investments,
        },
        notes: {
            notIncluded: [
                'Dados de cartão de crédito (processados pela Stripe, nunca armazenados pela Alívia)',
                'Chave da API Gemini (fica apenas no localStorage do navegador, sob seu controle)',
            ],
            rights: 'Você pode solicitar correção ou eliminação destes dados a qualquer momento em Ajustes ou pelo e-mail dpo.alivia@gmail.com',
        },
    };

    return payload;
}

export function triggerJsonDownload(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `alivia-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadUserData(currentUser) {
    const payload = await exportUserData(currentUser);
    triggerJsonDownload(payload);
    return payload;
}
