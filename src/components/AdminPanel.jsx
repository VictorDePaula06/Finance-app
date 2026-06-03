import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/firebase';
import { version } from '../../package.json';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    query,
    getDoc,
    collectionGroup,
    deleteDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import {
    ArrowLeft,
    Shield,
    Search,
    Zap,
    Trash2,
    ShieldAlert,
    Users,
    CreditCard,
    Clock,
    Settings,
    X,
    Check,
    AlertCircle,
    LayoutDashboard,
    Mail,
    Fingerprint,
    Ban,
    Edit3,
    Info,
    Gift,
    Save,
    Sparkles
} from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [userSubTab, setUserSubTab] = useState('admins');

    const ADMIN_EMAILS = [
        'financealivia@gmail.com',
        'suporte.soualivia@gmail.com',
        'matheusphp.carvalho@gmail.com',
        'finance.alivia@gmail.com'
    ];

    const [editingUser, setEditingUser] = useState(null);
    const [pendingUser, setPendingUser] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingGlobal, setIsResettingGlobal] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [pushMessage, setPushMessage] = useState({ title: '', body: '' });
    const [isSendingPush, setIsSendingPush] = useState(false);

    const toastTimeoutRef = useRef(null);
    const showToast = (message, type = 'success') => {
        // Limpa timeout anterior — antes, toast novo era apagado prematuramente
        // pelo timeout do toast anterior se chamados em sequência.
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast({ message, type });
        toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const customersSnap = await getDocs(collection(db, 'customers'));
            const allUids = new Set();
            usersSnap.docs.forEach(d => allUids.add(d.id));
            customersSnap.docs.forEach(d => allUids.add(d.id));

            // PARALELIZADO: antes eram 4 chamadas sequenciais POR usuário (N+1).
            // Agora as 4 chamadas de cada usuário rodam em paralelo via Promise.all,
            // e processamos todos os usuários em paralelo. Reduz tempo de carga
            // de O(n) sequencial para O(1) em rede (limitado pela conexão).
            const userList = await Promise.all(Array.from(allUids).map(async (uid) => {
                const [userSnap, settingsSnap, customerSnap, subsSnap] = await Promise.all([
                    getDoc(doc(db, 'users', uid)),
                    getDoc(doc(db, 'users', uid, 'settings', 'general')),
                    getDoc(doc(db, 'customers', uid)),
                    getDocs(collection(db, 'customers', uid, 'subscriptions')),
                ]);

                const userData = userSnap.exists() ? userSnap.data() : {};
                const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
                const customerData = customerSnap.exists() ? customerSnap.data() : {};
                const activeSubDoc = subsSnap.docs.find(d => ['active', 'trialing'].includes(d.data().status));
                const stripeSubData = activeSubDoc ? activeSubDoc.data() : subsSnap.docs[0]?.data();
                const manualStatus = settingsData.subscription?.status || userData.subscription?.status;
                const stripeActive = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing');
                // Cancelada no Stripe para o fim do período: continua ativa (paga) até
                // o fim, depois cai para Gratuito automaticamente.
                const cancelAtPeriodEnd = stripeActive && stripeSubData?.cancel_at_period_end === true;

                const STANDARD_PRICES = ['price_1TdDzSKAwb86obAGI0gTmdWL', 'price_1TdE0LKAwb86obAGcpMPLgWw'];
                const PREMIUM_PRICES = ['price_1TdDwDKAwb86obAGnRhLwlIa', 'price_1TdE1VKAwb86obAGh2h7m4o6'];
                const stripePriceId = stripeSubData?.items?.[0]?.plan?.id;

                // Regra de billing (igual ao AuthContext): standard/premium SÓ com
                // Stripe ativo. Vitalício/bloqueio são permissões manuais. Status
                // manual 'active/standard/premium' NÃO conta mais como pago.
                let subStatus = 'free';
                if (manualStatus === 'blocked') subStatus = 'blocked';
                else if (manualStatus === 'lifetime') subStatus = 'lifetime';
                else if (stripeActive) {
                    if (STANDARD_PRICES.includes(stripePriceId)) subStatus = 'standard';
                    else if (PREMIUM_PRICES.includes(stripePriceId)) subStatus = 'active';
                    else subStatus = 'active';
                }
                // Qualquer outro caso permanece 'free' (Gratuito, sem expiração).

                const isLifetime = (subStatus === 'lifetime');

                const datesToCompare = [
                    stripeSubData?.current_period_start,
                    settingsData.subscription?.date,
                    userData.subscription?.date,
                    stripeSubData?.trial_start
                ].filter(Boolean);

                const getTimestamp = (d) => {
                    try {
                        if (!d) return NaN;
                        if (d.toDate) return d.toDate().getTime();
                        if (d instanceof Date) return d.getTime();
                        if (typeof d === 'number' && d < 10000000000) return d * 1000;
                        const t = new Date(d).getTime();
                        return isFinite(t) ? t : NaN;
                    } catch { return NaN; }
                };

                // Filtra NaN antes do Math.max — antes uma única data inválida
                // contaminava o resultado inteiro (subDate virava Invalid Date,
                // status do usuário ficava errado).
                const validTimestamps = datesToCompare.map(getTimestamp).filter(t => isFinite(t));
                const subDateRaw = validTimestamps.length > 0
                    ? new Date(Math.max(...validTimestamps))
                    : (userData.createdAt || null);

                const subDate = subDateRaw?.toDate ? subDateRaw.toDate() : (subDateRaw ? new Date(subDateRaw) : null);
                const isAnnual = settingsData.subscription?.type === 'annual' || stripeSubData?.items?.[0]?.plan?.interval === 'year';
                const subType = isAnnual ? 'annual' : 'monthly';
                const createdAt = userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : null;
                const trialStartDate = userData.trialStartDate ? (userData.trialStartDate.toDate ? userData.trialStartDate.toDate() : new Date(userData.trialStartDate)) : null;
                const baseDate = trialStartDate || createdAt;

                const MS_DAY = 1000 * 60 * 60 * 24;
                let daysLeft = 0;
                let isBlocked = subStatus === 'blocked';
                let isExpired = false;   // Gratuito NUNCA expira; pago vale enquanto ativo no Stripe.
                // "Teste" só existe via Stripe (status 'trialing') — não há mais trial de app.
                let isTrial = stripeSubData?.status === 'trialing';
                let isInactive = false;  // Gratuito sem login há >= 60 dias (2 meses).

                if (isLifetime) {
                    daysLeft = 9999;
                } else if ((subStatus === 'active' || subStatus === 'standard')) {
                    // Assinatura paga ativa no Stripe. Usa a data REAL da próxima
                    // cobrança (current_period_end). O Stripe é a fonte da verdade:
                    // se está 'active', vale — mesmo que o ciclo local pareça vencido.
                    const periodEndTs = getTimestamp(stripeSubData?.current_period_end);
                    if (Number.isFinite(periodEndTs)) {
                        daysLeft = Math.max(0, Math.ceil((periodEndTs - Date.now()) / MS_DAY));
                    } else if (subDate) {
                        const cycle = subType === 'annual' ? 365 : 30;
                        const diff = Math.floor((Date.now() - subDate.getTime()) / MS_DAY);
                        daysLeft = diff <= cycle ? cycle - diff : 0;
                    }
                } else if (!isBlocked) {
                    // Plano Gratuito — acesso permanente (com limites). Verifica apenas
                    // inatividade: 2 meses sem login pode ser inativado.
                    const lastLoginRaw = userData.lastLogin;
                    const lastLoginDate = lastLoginRaw?.toDate ? lastLoginRaw.toDate()
                        : (lastLoginRaw ? new Date(lastLoginRaw) : baseDate);
                    if (lastLoginDate) {
                        const daysSinceLogin = Math.floor((Date.now() - lastLoginDate.getTime()) / MS_DAY);
                        if (daysSinceLogin >= 60) isInactive = true;
                    }
                }

                // Inativação manual (flag no doc) — sempre marca como inativo.
                const manualInactive = userData.inactive === true;
                if (manualInactive) isInactive = true;

                // isPremium = assinante 'active'. isLifetime é permissão especial separada —
                // não seta isPremium para evitar dupla seleção no modal de edição.
                let finalIsPremium = false, finalIsStandard = false, finalIsFree = false;
                if (!isBlocked) {
                    if (subStatus === 'active') finalIsPremium = true;
                    else if (subStatus === 'standard') finalIsStandard = true;
                    else if (subStatus !== 'lifetime') finalIsFree = true;
                    // lifetime: isLifetime=true, os três acima ficam false
                } else {
                    finalIsFree = true;
                }

                const userEmail = settingsData.email || userData.email || customerData.email || 'N/A';
                // isEmailAdmin: email fixo nos security rules — não pode ser removido via UI
                const isEmailAdmin = ADMIN_EMAILS.includes(userEmail);

                return {
                    uid, email: userEmail,
                    isPremium: finalIsPremium, isStandard: finalIsStandard, isFree: finalIsFree,
                    subType, subStatus, isTrial,
                    subDate: subDate ? subDate.toLocaleDateString('pt-BR') : 'N/A',
                    daysLeft, isExpired, isInactive, manualInactive, isLifetime, isBlocked,
                    hasActiveStripeSub: stripeActive,
                    stripeStatus: stripeSubData?.status || null,
                    cancelAtPeriodEnd,
                    isAdmin: userData.isAdmin === true || isEmailAdmin,
                    isEmailAdmin,
                    pushSubscriptions: userData.pushSubscriptions || [],
                    createdAt: baseDate ? baseDate.toLocaleDateString('pt-BR') : 'N/A',
                    lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate?.().toLocaleDateString() || 'N/A',
                    isDeleted: userData.status === 'deleted' || !userSnap.exists(),
                    deletedAt: userData.deletedAt ? (userData.deletedAt.toDate ? userData.deletedAt.toDate().toLocaleDateString('pt-BR') : new Date(userData.deletedAt).toLocaleDateString('pt-BR')) : null,
                    hasAcceptedTerms: settingsData.hasAcceptedTerms || false
                };
            }));

            if (mountedRef.current) setUsers(userList);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        fetchUsers();
        return () => { mountedRef.current = false; };
    }, []);

    const filteredUsers = useMemo(() => {
        let list = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
        if (userSubTab === 'admins')    return list.filter(u => u.isAdmin);
        if (userSubTab === 'premium')   return list.filter(u => (u.isPremium || u.isLifetime) && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'standard')  return list.filter(u => u.isStandard && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'sem_plano') return list.filter(u => u.isFree && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'inativos')  return list.filter(u => u.isInactive && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'excluidos') return list.filter(u => u.isDeleted);
        return list;
    }, [users, searchTerm, userSubTab]);

    const stats = useMemo(() => {
        const pM = users.filter(u => u.isPremium && u.subType === 'monthly' && !u.isAdmin && !u.isDeleted).length;
        const pA = users.filter(u => (u.isPremium && u.subType === 'annual' || u.isLifetime) && !u.isAdmin && !u.isDeleted).length;
        const sM = users.filter(u => u.isStandard && u.subType === 'monthly' && !u.isAdmin && !u.isDeleted).length;
        const sA = users.filter(u => u.isStandard && u.subType === 'annual' && !u.isAdmin && !u.isDeleted).length;
        return {
            total: users.length,
            admins: users.filter(u => u.isAdmin && !u.isDeleted).length,
            premiumMonthly: pM, premiumAnnual: pA,
            standardMonthly: sM, standardAnnual: sA,
            premium: pM + pA, standard: sM + sA,
            free: users.filter(u => u.isFree && !u.isAdmin && !u.isDeleted).length,
            inactive: users.filter(u => u.isInactive && !u.isAdmin && !u.isDeleted).length,
            deleted: users.filter(u => u.isDeleted).length
        };
    }, [users]);

    const saveUserChanges = async () => {
        if (!pendingUser) return;
        // Aviso: remover plano pago de quem tem assinatura ATIVA no Stripe não
        // cancela a cobrança — e a sincronização reverte para Premium.
        const hadPaidStripe = !!editingUser?.hasActiveStripeSub;
        const nowPaidPlan = pendingUser.isPremium || pendingUser.isStandard || pendingUser.isLifetime;
        const removingPaid = hadPaidStripe && !nowPaidPlan;
        const message = removingPaid
            ? `⚠️ ATENÇÃO\n\nO usuário ${pendingUser.email} tem uma assinatura ATIVA no Stripe (foi pago).\n\nRemover o plano aqui NÃO cancela a cobrança no Stripe, e a sincronização automática vai reverter este usuário para Premium na próxima atualização.\n\nPara encerrar de verdade, cancele a assinatura no painel do Stripe (ou peça ao cliente para cancelar pelo portal).\n\nDeseja salvar mesmo assim?`
            : `Deseja salvar as permissões para o usuário ${pendingUser.email}?`;
        setConfirmDialog({
            title: removingPaid ? "Remover plano de assinante pago?" : "Confirmar Alterações",
            message,
            danger: removingPaid,
            confirmText: removingPaid ? "Salvar mesmo assim" : "Salvar Agora",
            onConfirm: async () => {
                setIsSaving(true);
                setConfirmDialog(null);
                try {
                    const uid = pendingUser.uid;
                    const userRef = doc(db, 'users', uid);
                    const settingsRef = doc(db, 'users', uid, 'settings', 'general');
                    const batch = writeBatch(db);

                    // Determina status e tipo finais
                    let finalStatus = 'free';
                    let finalType = pendingUser.subType || 'monthly'; // preserva anual/mensal existente

                    if (pendingUser.isLifetime) {
                        finalStatus = 'lifetime';
                        finalType = 'lifetime';
                    } else if (pendingUser.isPremium) {
                        finalStatus = 'active';
                    } else if (pendingUser.isStandard) {
                        finalStatus = 'standard';
                    } else {
                        finalStatus = 'free';
                        finalType = 'monthly';
                    }

                    // isBlocked sobrepõe tudo — usa set+merge para criar o doc se não existir
                    const effectiveStatus = pendingUser.isBlocked ? 'blocked' : finalStatus;

                    batch.set(userRef, {
                        isAdmin: pendingUser.isAdmin,
                        isBlocked: pendingUser.isBlocked || false
                    }, { merge: true });

                    batch.set(settingsRef, {
                        subscription: {
                            status: effectiveStatus,
                            type: finalType,
                            updatedAt: new Date(),
                            date: new Date(),
                            isBlocked: pendingUser.isBlocked || false
                        }
                    }, { merge: true });
                    await batch.commit();
                    showToast("Alterações aplicadas com sucesso!");
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch (error) {
                    console.error("Error saving changes:", error);
                    showToast("Erro ao salvar alterações", "error");
                } finally { setIsSaving(false); }
            }
        });
    };

    const handlePlanSelect = (planId) => {
        if (!pendingUser) return;
        // isLifetime é permissão especial — não é tocado aqui
        setPendingUser(prev => ({
            ...prev,
            isPremium:  planId === 'isPremium',
            isStandard: planId === 'isStandard',
            isFree:     planId === 'isFree',
        }));
    };

    const handleToggle = (flagId) => {
        if (!pendingUser) return;
        setPendingUser(prev => ({ ...prev, [flagId]: !prev[flagId] }));
    };

    const sendPushToAll = async () => {
        if (!pushMessage.title || !pushMessage.body) return showToast("Preencha título e mensagem", "error");
        setIsSendingPush(true);
        try {
            // Não envia push para excluídos ou bloqueados
            const activeUsers = users.filter(u => !u.isDeleted && !u.isBlocked);
            const subs = activeUsers.flatMap(u => u.pushSubscriptions || []);
            if (subs.length === 0) {
                showToast("Nenhum dispositivo ativo para enviar", "error");
                return;
            }
            const res = await fetch('https://alivia-push.vercel.app/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptions: subs, title: pushMessage.title, body: pushMessage.body })
            });
            if (res.ok) { showToast(`Notificação enviada para ${subs.length} dispositivos!`); setPushMessage({ title: '', body: '' }); }
            else { showToast("Erro no servidor de push", "error"); }
        } catch (error) {
            console.error("Push error:", error);
            showToast("Erro ao enviar push", "error");
        } finally { setIsSendingPush(false); }
    };

    // Firestore writeBatch tem hard limit de 500 ops. Helper que divide
    // automaticamente em chunks e commita um por vez.
    const FIRESTORE_BATCH_LIMIT = 450; // margem de segurança
    const commitInBatches = async (refs) => {
        for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
            const chunk = refs.slice(i, i + FIRESTORE_BATCH_LIMIT);
            const batch = writeBatch(db);
            chunk.forEach(({ op, ref, data }) => {
                if (op === 'delete') batch.delete(ref);
                else if (op === 'set') batch.set(ref, data, { merge: true });
            });
            await batch.commit();
        }
    };

    const resetGlobalData = async () => {
        setConfirmDialog({
            title: "Reset Global de Dados",
            message: "ATENÇÃO: Isso irá resetar o banco de dados (transações e metas) para todos os usuários logados. Esta ação é irreversível. Deseja prosseguir?",
            confirmText: "Sim, Resetar Tudo",
            onConfirm: async () => {
                setIsResettingGlobal(true);
                setConfirmDialog(null);
                try {
                    // Coleta todas as ops em uma lista única e commita em chunks
                    // de 450 — antes batch único podia estourar 500 e falhar.
                    const [qT, qG, usersSnap] = await Promise.all([
                        getDocs(collection(db, 'transactions')),
                        getDocs(collection(db, 'goals')),
                        getDocs(collection(db, 'users')),
                    ]);

                    const ops = [];
                    qT.docs.forEach(d => ops.push({ op: 'delete', ref: d.ref }));
                    qG.docs.forEach(d => ops.push({ op: 'delete', ref: d.ref }));
                    usersSnap.docs.forEach(userDoc => {
                        const settingsRef = doc(db, 'users', userDoc.id, 'settings', 'general');
                        ops.push({
                            op: 'set',
                            ref: settingsRef,
                            data: {
                                manualConfig: { income: 0, fixedExpenses: 0, variableEstimate: 0, invested: 0, categoryBudgets: {}, recurringSubs: [] },
                                hasSeenWelcome: false, hasSeenPatrimonyWelcome: false
                            }
                        });
                    });

                    await commitInBatches(ops);
                    showToast(`Reset global concluído (${ops.length} ops).`);
                    fetchUsers();
                } catch (error) {
                    console.error("Error resetting global data:", error);
                    showToast("Erro no reset global", "error");
                } finally { setIsResettingGlobal(false); }
            }
        });
    };

    const adminDeleteUser = async (user) => {
        setConfirmDialog({
            title: "Excluir Usuário",
            message: `Você tem certeza que deseja excluir permanentemente a conta de ${user.email}? Todos os dados financeiros serão apagados.`,
            confirmText: "Excluir Agora",
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    // Queries em paralelo + commit em chunks de 450 (limite Firestore).
                    // Antes: batch único podia falhar se usuário tivesse >500 transações.
                    const [snapT, snapG] = await Promise.all([
                        getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid))),
                        getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid))),
                    ]);
                    const ops = [
                        ...snapT.docs.map(d => ({ op: 'delete', ref: d.ref })),
                        ...snapG.docs.map(d => ({ op: 'delete', ref: d.ref })),
                    ];
                    await commitInBatches(ops);
                    await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
                    await deleteDoc(doc(db, 'customers', user.uid)).catch(() => {});
                    showToast("Usuário excluído!");
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch (error) {
                    console.error("Error deleting user:", error);
                    showToast("Erro ao deletar usuário", "error");
                }
            }
        });
    };

    const handleForceFree = () => {
        if (!editingUser) return;
        setConfirmDialog({
            title: 'Forçar Gratuito (limpar assinatura)',
            danger: true,
            message: `Isto REMOVE qualquer assinatura/elevação local do usuário ${editingUser.email} e o rebaixa para Gratuito.\n\nUse SOMENTE se NÃO houver assinatura ativa no Stripe para esta conta (ex.: assinatura "fantasma" que sobrou). Se houver assinatura ativa no Stripe, a sincronização vai recriá-la — cancele no Stripe primeiro.\n\nOs dados financeiros do usuário são preservados.`,
            confirmText: 'Forçar Gratuito',
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsSaving(true);
                try {
                    const uid = editingUser.uid;
                    // 1. Remove documentos de assinatura do Stripe (inclui fantasmas).
                    const subsSnap = await getDocs(collection(db, 'customers', uid, 'subscriptions'));
                    await Promise.all(subsSnap.docs.map(d => deleteDoc(d.ref)));
                    // 2. Zera qualquer elevação manual no doc do usuário e nas settings.
                    await setDoc(doc(db, 'users', uid), {
                        isPremium: false,
                        subscription: { status: 'free', type: 'free', updatedAt: new Date() }
                    }, { merge: true });
                    await setDoc(doc(db, 'users', uid, 'settings', 'general'), {
                        subscription: { status: 'free', type: 'free', updatedAt: new Date() }
                    }, { merge: true });
                    showToast('Usuário rebaixado para Gratuito.');
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch (err) {
                    console.error(err);
                    showToast('Erro ao forçar Gratuito', 'error');
                } finally { setIsSaving(false); }
            }
        });
    };

    const handleToggleInactive = () => {
        if (!editingUser) return;
        const willInactivate = !editingUser.manualInactive;
        setConfirmDialog({
            title: willInactivate ? 'Inativar Conta' : 'Reativar Conta',
            message: willInactivate
                ? `Marcar a conta ${editingUser.email} como INATIVA? Os dados são preservados; ela some das contagens ativas e pode ser reativada quando voltar.`
                : `Reativar a conta ${editingUser.email}?`,
            confirmText: willInactivate ? 'Inativar Agora' : 'Reativar Agora',
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsSaving(true);
                try {
                    const userRef = doc(db, 'users', editingUser.uid);
                    await updateDoc(userRef, {
                        inactive: willInactivate,
                        inactivatedAt: willInactivate ? new Date() : null,
                    });
                    showToast(willInactivate ? 'Conta inativada.' : 'Conta reativada.');
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch {
                    showToast('Erro ao atualizar a conta', 'error');
                } finally { setIsSaving(false); }
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">

            {/* ── Toast ── */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
                        toast.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                        {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="text-xs font-bold">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* ── Confirm Dialog ── */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-xl shrink-0 ${confirmDialog.danger ? 'bg-rose-500/10' : 'bg-white/5'}`}>
                                <Info className={`w-4 h-4 ${confirmDialog.danger ? 'text-rose-400' : 'text-slate-400'}`} />
                            </div>
                            <h3 className="text-sm font-black text-white">{confirmDialog.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all ${
                                    confirmDialog.danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
                                }`}
                            >
                                {confirmDialog.confirmText || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit User Modal ── */}
            {editingUser && pendingUser && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => { setEditingUser(null); setPendingUser(null); }}
                            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Modal Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-white/5 shrink-0">
                                <Settings className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white">Editar Permissões</h3>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{editingUser.email}</p>
                            </div>
                        </div>

                        {/* Aviso: assinante ativo no Stripe (pago) */}
                        {editingUser.hasActiveStripeSub && (
                            <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                                <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5" />
                                    {editingUser.stripeStatus === 'trialing' ? 'Em período de teste no Stripe' : 'Assinante ativo no Stripe (pago)'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                    Este plano vem da assinatura paga no Stripe. Alterar o plano aqui não cancela
                                    a cobrança — para encerrar, cancele no painel do Stripe.
                                </p>
                            </div>
                        )}

                        {/* PLANO — Radio (3 opções, Vitalício não está aqui) */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                Plano de Assinatura
                            </p>
                            {pendingUser.isLifetime && (
                                <p className="text-[10px] text-slate-500 bg-white/5 border border-white/10 rounded-lg px-3 py-2 mb-3">
                                    ⚡ Vitalício ativo — o plano abaixo fica inativo enquanto vigente.
                                </p>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'isPremium',  label: 'Premium',  desc: 'Completo'       },
                                    { id: 'isStandard', label: 'Standard', desc: 'Intermediário'   },
                                    { id: 'isFree',     label: 'Gratuito', desc: 'Sem plano'       },
                                ].map(plan => {
                                    // Mostra estado real apenas quando não é lifetime
                                    const active = pendingUser[plan.id] && !pendingUser.isLifetime;
                                    const disabled = isSaving || pendingUser.isLifetime;
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => handlePlanSelect(plan.id)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                active
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : disabled
                                                        ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                                                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs font-bold ${active ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {plan.label}
                                                </span>
                                                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                                                    active ? 'bg-emerald-500 border-transparent' : 'border-white/20'
                                                }`}>
                                                    {active && <div className="w-1 h-1 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-600">{plan.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ── Ciclo de cobrança: Mensal / Anual ── */}
                            {(pendingUser.isPremium || pendingUser.isStandard) && !pendingUser.isLifetime && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                                        Ciclo de Cobrança
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'monthly', label: 'Mensal',  days: 30  },
                                            { id: 'annual',  label: 'Anual',   days: 365 },
                                        ].map(cycle => {
                                            const isSelected = (pendingUser.subType || 'monthly') === cycle.id;
                                            return (
                                                <button
                                                    key={cycle.id}
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => setPendingUser(prev => ({ ...prev, subType: cycle.id }))}
                                                    className={`px-3 py-2.5 rounded-xl border-2 flex items-center justify-between transition-all ${
                                                        isSelected
                                                            ? 'border-emerald-500 bg-emerald-500/10'
                                                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                                    }`}
                                                >
                                                    <div className="text-left">
                                                        <p className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                            {cycle.label}
                                                        </p>
                                                        <p className="text-[10px] text-slate-600">{cycle.days} dias</p>
                                                    </div>
                                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                                        isSelected ? 'bg-emerald-500 border-transparent' : 'border-white/20'
                                                    }`}>
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <p className="text-[10px] text-slate-500">
                                            Ao salvar, o acesso expirará em{' '}
                                            <span className="text-emerald-400 font-bold">
                                                {(pendingUser.subType || 'monthly') === 'annual' ? '365' : '30'} dias
                                            </span>{' '}
                                            a partir de hoje.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PERMISSÕES ESPECIAIS — inclui Vitalício */}
                        <div className="space-y-2 mb-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                                Permissões Especiais
                            </p>
                            {[
                                {
                                    id: 'isLifetime',
                                    label: 'Acesso Vitalício',
                                    desc: 'Sobrepõe o plano — acesso premium permanente sem assinatura',
                                    activeClass: 'border-emerald-500/40 bg-emerald-500/10',
                                    checkBg: 'bg-emerald-500',
                                    canEdit: true,
                                },
                                {
                                    id: 'isAdmin',
                                    label: 'Administrador',
                                    desc: editingUser?.isEmailAdmin
                                        ? 'E-mail fixo nas regras de segurança — não pode ser removido aqui'
                                        : 'Concede acesso ao Painel de Controle',
                                    activeClass: 'border-white/30 bg-white/5',
                                    checkBg: 'bg-emerald-500',
                                    canEdit: !editingUser?.isEmailAdmin,
                                },
                                {
                                    id: 'isBlocked',
                                    label: 'Bloquear Conta',
                                    desc: 'Suspende o acesso imediatamente, independente do plano',
                                    activeClass: 'border-rose-500/50 bg-rose-500/10',
                                    checkBg: 'bg-rose-500',
                                    canEdit: true,
                                },
                            ].map(flag => (
                                <button
                                    key={flag.id}
                                    type="button"
                                    disabled={isSaving || !flag.canEdit}
                                    onClick={() => flag.canEdit && handleToggle(flag.id)}
                                    className={`w-full px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-3 text-left ${
                                        pendingUser[flag.id]
                                            ? flag.activeClass
                                            : !flag.canEdit
                                                ? 'border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed'
                                                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        pendingUser[flag.id] ? `${flag.checkBg} border-transparent` : 'border-white/20'
                                    }`}>
                                        {pendingUser[flag.id] && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white">{flag.label}</p>
                                        <p className="text-[10px] text-slate-500 leading-snug">{flag.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={saveUserChanges}
                                disabled={isSaving}
                                className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                            <button
                                onClick={handleToggleInactive}
                                disabled={isSaving}
                                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                    editingUser?.manualInactive
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-white/5 text-slate-400 border-white/[0.08] hover:bg-white/10 hover:text-slate-200'
                                }`}
                            >
                                {editingUser?.manualInactive ? 'Reativar Conta' : 'Inativar Conta (sem apagar dados)'}
                            </button>
                            {(editingUser?.isPremium || editingUser?.isStandard) && !editingUser?.isLifetime && (
                                <button
                                    onClick={handleForceFree}
                                    disabled={isSaving}
                                    className="w-full py-2.5 rounded-xl text-xs font-bold border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                                >
                                    Forçar Gratuito (limpar assinatura fantasma)
                                </button>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => adminDeleteUser(editingUser)}
                                    className="py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                                >
                                    Excluir Conta
                                </button>
                                <button
                                    onClick={() => { setEditingUser(null); setPendingUser(null); }}
                                    className="py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                HEADER STICKY
                ════════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-[100] bg-slate-950/95 backdrop-blur-xl border-b border-white/[0.06] shrink-0">
                <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center gap-5">
                    <button
                        onClick={onBack}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0 border border-white/[0.06]"
                        title="Voltar para o app"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 border border-emerald-500/20 shrink-0">
                            <Shield className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                                Painel Administrativo
                            </h1>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Gestão e operação da Alívia
                            </p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {!loading && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[11px] font-semibold text-slate-300 tabular-nums">{stats.total} usuários</span>
                            </div>
                        )}
                        {loading && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                <div className="w-3 h-3 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                                <span className="text-[11px] font-semibold text-slate-500">Carregando</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ════════════════════════════════════════════════════════════
                BODY: SIDEBAR + MAIN
                ════════════════════════════════════════════════════════════ */}
            <div className="flex flex-1 min-h-0">

                {/* ─── SIDEBAR ─── */}
                <aside className="hidden md:flex w-60 shrink-0 border-r border-white/[0.06] bg-slate-950/60 flex-col">
                    <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">
                            Navegação
                        </p>

                        {[
                            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Visão geral' },
                            { id: 'users',     label: 'Usuários',  icon: Users,           desc: `${stats.total} cadastrados` },
                        ].map(item => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-1 group ${
                                        isActive
                                            ? 'bg-emerald-500/[0.08] text-emerald-400'
                                            : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-lg shrink-0 transition-all ${
                                        isActive ? 'bg-emerald-500/15' : 'bg-white/[0.03] group-hover:bg-white/[0.06]'
                                    }`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-tight">{item.label}</p>
                                        <p className={`text-[10px] mt-0.5 ${isActive ? 'text-emerald-500/70' : 'text-slate-600'}`}>
                                            {item.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Resumo rápido */}
                        <div className="mt-6 pt-6 border-t border-white/[0.05]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-3 px-2">
                                Distribuição
                            </p>
                            {loading ? (
                                <div className="space-y-2 px-2">
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} className="flex justify-between animate-pulse">
                                            <div className="h-2.5 bg-slate-800 rounded w-16" />
                                            <div className="h-2.5 bg-slate-800 rounded w-5" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {[
                                        { label: 'Premium',  val: stats.premium,  dot: 'bg-emerald-400' },
                                        { label: 'Standard', val: stats.standard, dot: 'bg-blue-400'    },
                                        { label: 'Gratuito', val: stats.free,     dot: 'bg-slate-500'   },
                                        { label: 'Admins',   val: stats.admins,   dot: 'bg-amber-400'   },
                                        { label: 'Excluídos',val: stats.deleted,  dot: 'bg-rose-500'    },
                                    ].map(s => (
                                        <div key={s.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.02]">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                                <span className="text-xs text-slate-400 font-medium">{s.label}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-300 tabular-nums">{s.val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </nav>

                    <div className="p-4 border-t border-white/[0.05]">
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-[0.3em] text-center">
                            Alívia · v{version}
                        </p>
                    </div>
                </aside>

                {/* Sub-tabs mobile (já que sidebar fica oculta no mobile) */}
                <div className="md:hidden sticky top-[73px] z-[90] bg-slate-950/95 backdrop-blur-xl border-b border-white/[0.06] flex">
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'users',     label: 'Usuários',  icon: Users },
                    ].map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
                                    isActive
                                        ? 'text-emerald-400 border-emerald-500'
                                        : 'text-slate-500 border-transparent'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                {/* ─── MAIN ─── */}
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-5xl mx-auto p-6 md:p-10 animate-in fade-in duration-500">

                        {/* ════════════════════════════════════════════════
                            DASHBOARD TAB
                            ════════════════════════════════════════════════ */}
                        {activeTab === 'dashboard' && (
                            <div className="space-y-10">
                                {/* Section heading */}
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Visão Geral</h2>
                                    <p className="text-sm text-slate-500 mt-1">Métricas operacionais em tempo real.</p>
                                </div>

                                {/* MÉTRICAS PRIMÁRIAS */}
                                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Total',     val: stats.total,    icon: Users,      color: 'text-slate-300', accent: 'bg-slate-500/10' },
                                        { label: 'Premium',   val: stats.premium,  icon: Sparkles,   color: 'text-emerald-400', accent: 'bg-emerald-500/10' },
                                        { label: 'Standard',  val: stats.standard, icon: CreditCard, color: 'text-blue-400',    accent: 'bg-blue-500/10' },
                                        { label: 'Gratuito',  val: stats.free,     icon: Gift,       color: 'text-slate-400',   accent: 'bg-slate-500/10' },
                                    ].map(item => (
                                        <div key={item.label} className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className={`p-2 rounded-lg ${item.accent}`}>
                                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                                </div>
                                            </div>
                                            <p className={`text-3xl font-bold tabular-nums ${item.color}`}>{item.val}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                                        </div>
                                    ))}
                                </section>

                                {/* MÉTRICAS SECUNDÁRIAS */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Detalhamento por Ciclo</h3>
                                        <span className="text-[10px] text-slate-600">{stats.admins} admins · {stats.deleted} excluídos</span>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                                        {[
                                            { label: 'Premium · Mensal', val: stats.premiumMonthly,  dot: 'bg-emerald-400' },
                                            { label: 'Premium · Anual',  val: stats.premiumAnnual,   dot: 'bg-emerald-300' },
                                            { label: 'Standard · Mensal',val: stats.standardMonthly, dot: 'bg-blue-400' },
                                            { label: 'Standard · Anual', val: stats.standardAnnual,  dot: 'bg-blue-300' },
                                        ].map(item => (
                                            <div key={item.label} className="px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${item.dot} shrink-0`} />
                                                    <span className="text-[11px] text-slate-400 truncate">{item.label}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-white tabular-nums">{item.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* NOTIFICAÇÃO PUSH */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Comunicação</h3>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 shrink-0">
                                                <Zap className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-semibold text-white">Notificação Push</h2>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Enviada para todos os dispositivos ativos.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-1.5 block">Título</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: Nova funcionalidade disponível"
                                                        className="w-full bg-slate-950/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/40 focus:bg-slate-950 text-white placeholder-slate-600 transition-colors"
                                                        value={pushMessage.title}
                                                        onChange={e => setPushMessage({ ...pushMessage, title: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-1.5 block">Mensagem</label>
                                                    <textarea
                                                        placeholder="Corpo da notificação"
                                                        rows={2}
                                                        className="w-full bg-slate-950/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/40 focus:bg-slate-950 text-white placeholder-slate-600 transition-colors resize-none"
                                                        value={pushMessage.body}
                                                        onChange={e => setPushMessage({ ...pushMessage, body: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={sendPushToAll}
                                                disabled={isSendingPush || !pushMessage.title || !pushMessage.body}
                                                className="lg:w-auto w-full px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                            >
                                                {isSendingPush ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Enviando
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap className="w-4 h-4" />
                                                        Disparar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* ════════════════════════════════════════════════
                            USERS TAB
                            ════════════════════════════════════════════════ */}
                        {activeTab === 'users' && (
                            <div className="space-y-6">
                                {/* Section header */}
                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white tracking-tight">Gestão de Usuários</h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {filteredUsers.length === 1
                                                ? '1 usuário encontrado'
                                                : `${filteredUsers.length} usuários encontrados`}
                                        </p>
                                    </div>
                                    <div className="relative w-full sm:w-80">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por e-mail..."
                                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/40 focus:bg-slate-950 text-white placeholder-slate-600 transition-colors"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Filter chips */}
                                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                    {[
                                        { id: 'admins',    label: 'Admins',         count: stats.admins   },
                                        { id: 'premium',   label: 'Plano Premium',  count: stats.premium  },
                                        { id: 'standard',  label: 'Plano Standard', count: stats.standard },
                                        { id: 'sem_plano', label: 'Plano Gratuito', count: stats.free     },
                                        { id: 'inativos',  label: 'Inativos',       count: stats.inactive },
                                        { id: 'excluidos', label: 'Excluídos',      count: stats.deleted  },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setUserSubTab(tab.id)}
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                                                userSubTab === tab.id
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 border-white/[0.06]'
                                            }`}
                                        >
                                            {tab.label}
                                            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
                                                userSubTab === tab.id ? 'bg-emerald-500/20' : 'bg-white/[0.05]'
                                            }`}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Users list */}
                                <div className="space-y-2">
                                    {loading ? (
                                        Array(6).fill(0).map((_, i) => (
                                            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 animate-pulse">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-800 rounded-xl shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="h-3 bg-slate-800 rounded w-48" />
                                                        <div className="h-2.5 bg-slate-800 rounded w-32 opacity-50" />
                                                    </div>
                                                    <div className="h-6 bg-slate-800 rounded-lg w-24" />
                                                </div>
                                            </div>
                                        ))
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <div
                                                key={user.uid}
                                                className="bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04] rounded-xl px-5 py-4 transition-all group"
                                            >
                                                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">

                                                    {/* Avatar + identidade */}
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                            user.isAdmin
                                                                ? 'bg-amber-500/10 text-amber-400'
                                                                : user.isDeleted
                                                                    ? 'bg-rose-500/10 text-rose-400'
                                                                    : 'bg-white/[0.04] text-slate-400'
                                                        }`}>
                                                            {user.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate leading-tight">{user.email}</p>
                                                            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                                                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                                                    <Fingerprint className="w-2.5 h-2.5" /> {user.uid.slice(0, 8)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">·</span>
                                                                <span className="text-[10px] text-slate-500">desde {user.createdAt}</span>
                                                                {user.hasAcceptedTerms ? (
                                                                    <span className="text-[10px] text-emerald-500/80 flex items-center gap-0.5">
                                                                        <Check className="w-2.5 h-2.5" /> Termos
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5">
                                                                        <AlertCircle className="w-2.5 h-2.5" /> Termos pendentes
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Plano (compacto) */}
                                                    <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                                                        {user.isLifetime ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-semibold border border-purple-500/20">Vitalício</span>
                                                        ) : user.isPremium ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold border border-emerald-500/20">Premium</span>
                                                        ) : user.isStandard ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-semibold border border-blue-500/20">Standard</span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-400 text-[10px] font-semibold border border-white/[0.08]">Gratuito</span>
                                                        )}

                                                        {!user.isLifetime && !user.isDeleted && (user.isPremium || user.isStandard) && (() => {
                                                            const cycle = user.subType === 'annual' ? 365 : 30;
                                                            const pct = user.daysLeft / cycle;
                                                            const daysCls = pct < 0.17
                                                                ? 'text-rose-400'
                                                                : pct < 0.40
                                                                    ? 'text-amber-400'
                                                                    : 'text-slate-500';
                                                            return (
                                                                <span className={`text-[9px] font-medium ${user.cancelAtPeriodEnd ? 'text-rose-400' : daysCls}`}>
                                                                    {user.subType === 'annual' ? 'Anual' : 'Mensal'}
                                                                    {user.cancelAtPeriodEnd
                                                                        ? (user.daysLeft > 0 ? ` · cancelando, termina em ${user.daysLeft}d` : ' · cancelando')
                                                                        : user.stripeStatus === 'trialing'
                                                                            ? ' · teste Stripe'
                                                                            : user.daysLeft > 0 ? ` · renova em ${user.daysLeft}d` : ' · ativo'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Status pill */}
                                                    <div className="hidden lg:block shrink-0">
                                                        {user.isDeleted ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-400 text-[10px] font-semibold border border-white/[0.06]">
                                                                <Trash2 className="w-2.5 h-2.5" /> Excluído
                                                            </div>
                                                        ) : user.isBlocked ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20">
                                                                <Ban className="w-2.5 h-2.5" /> Bloqueado
                                                            </div>
                                                        ) : user.isInactive ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-semibold border border-slate-500/20">
                                                                <Clock className="w-2.5 h-2.5" /> Inativo
                                                            </div>
                                                        ) : user.isTrial ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-semibold border border-blue-500/20">
                                                                <Zap className="w-2.5 h-2.5" /> Teste
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                                                                <Check className="w-2.5 h-2.5" /> Ativo
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => { setEditingUser(user); setPendingUser({ ...user }); }}
                                                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-emerald-500/10 hover:text-emerald-400 text-slate-400 transition-all border border-white/[0.06] hover:border-emerald-500/30 shrink-0"
                                                        title="Editar permissões"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center">
                                            <div className="inline-flex p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4">
                                                <Search className="w-6 h-6 text-slate-600" />
                                            </div>
                                            <p className="text-sm font-semibold text-slate-400">Nenhum usuário encontrado</p>
                                            <p className="text-xs text-slate-600 mt-1">
                                                Tente outro filtro ou ajuste a busca.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
