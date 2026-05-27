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
    Save
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

                const STANDARD_PRICES = ['price_1TSMc3KAwb86obAG4jW02DAq', 'price_1TSMctKAwb86obAGj4BZqYtl'];
                const PREMIUM_PRICES = ['price_1T89UOKAwb86obAGotiiOngV', 'price_1T89UMKAwb86obAGbk0dSm4Z'];
                const stripePriceId = stripeSubData?.items?.[0]?.plan?.id;

                let subStatus = 'free';
                if (manualStatus === 'blocked') subStatus = 'blocked';
                else if (manualStatus === 'lifetime') subStatus = 'lifetime';
                else if (manualStatus === 'standard') subStatus = 'standard';
                else if (manualStatus === 'active') subStatus = 'active';
                else if (manualStatus === 'free') subStatus = 'free';
                else if (stripeActive) {
                    if (STANDARD_PRICES.includes(stripePriceId)) subStatus = 'standard';
                    else if (PREMIUM_PRICES.includes(stripePriceId)) subStatus = 'active';
                    else subStatus = 'active';
                } else if (stripeSubData?.status) {
                    subStatus = stripeSubData.status;
                }

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

                let daysLeft = 0;
                let isBlocked = subStatus === 'blocked';
                let isExpired = subStatus === 'expired';
                let isTrial = false;

                if ((subStatus === 'active' || subStatus === 'standard') && subDate) {
                    const now = new Date();
                    const cycle = subType === 'annual' ? 365 : 30;
                    const diff = Math.floor((now - subDate) / (1000 * 60 * 60 * 24));
                    if (diff <= cycle) { daysLeft = cycle - diff; }
                    else { isExpired = true; subStatus = 'expired'; }
                } else if (isLifetime) {
                    daysLeft = 9999;
                } else if (baseDate) {
                    const now = new Date();
                    const diffDays = Math.ceil((now - baseDate) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) { isTrial = true; daysLeft = 7 - diffDays; }
                    else { isExpired = true; }
                } else {
                    isExpired = true;
                }

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
                    daysLeft, isExpired, isLifetime, isBlocked,
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
            deleted: users.filter(u => u.isDeleted).length
        };
    }, [users]);

    const saveUserChanges = async () => {
        if (!pendingUser) return;
        setConfirmDialog({
            title: "Confirmar Alterações",
            message: `Deseja salvar as permissões para o usuário ${pendingUser.email}?`,
            confirmText: "Salvar Agora",
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

    const handleResetTrial = () => {
        setConfirmDialog({
            title: "Resetar Período de Teste",
            message: `Dar +7 dias de período de teste para a conta ${editingUser?.email}?`,
            confirmText: "Resetar Agora",
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsSaving(true);
                try {
                    const userRef = doc(db, 'users', editingUser.uid);
                    await updateDoc(userRef, { trialStartDate: new Date() });
                    showToast('Teste resetado com sucesso!');
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch (e) {
                    showToast('Erro ao resetar teste', 'error');
                } finally { setIsSaving(false); }
            }
        });
    };

    const handleExpireTrial = () => {
        setConfirmDialog({
            title: "Expirar Período de Teste",
            message: `Expirar o período de teste da conta ${editingUser?.email}?`,
            confirmText: "Expirar Agora",
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsSaving(true);
                try {
                    const tenDaysAgo = new Date();
                    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                    const userRef = doc(db, 'users', editingUser.uid);
                    await updateDoc(userRef, { trialStartDate: tenDaysAgo });
                    showToast('Teste expirado com sucesso!');
                    setEditingUser(null); setPendingUser(null);
                    fetchUsers();
                } catch (e) {
                    showToast('Erro ao expirar teste', 'error');
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
                            <div className="p-2 rounded-xl bg-white/5 shrink-0">
                                <Info className="w-4 h-4 text-slate-400" />
                            </div>
                            <h3 className="text-sm font-black text-white">{confirmDialog.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all"
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
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleResetTrial}
                                    disabled={isSaving}
                                    className="py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold border border-white/[0.08] hover:bg-white/10 hover:text-slate-200 transition-all"
                                >
                                    Resetar Teste
                                </button>
                                <button
                                    onClick={handleExpireTrial}
                                    disabled={isSaving}
                                    className="py-2.5 rounded-xl bg-white/5 text-slate-400 text-xs font-bold border border-white/[0.08] hover:bg-white/10 hover:text-slate-200 transition-all"
                                >
                                    Expirar Teste
                                </button>
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

            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-[100] bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center gap-4 shrink-0">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 shrink-0">
                        <Shield className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-white leading-tight">Painel de Controle</h1>
                        <p className="text-xs text-slate-500">Administração do sistema</p>
                    </div>
                </div>
                <div className="ml-auto">
                    <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                        loading
                            ? 'bg-white/5 border-white/10 text-slate-500'
                            : 'bg-white/5 border-white/10 text-slate-400'
                    }`}>
                        {loading ? 'Carregando...' : `${stats.total} usuários`}
                    </div>
                </div>
            </header>

            {/* ── Body: Sidebar + Main ── */}
            <div className="flex flex-1 min-h-0">

                {/* Left Sidebar */}
                <aside className="w-56 shrink-0 border-r border-white/[0.06] bg-slate-950 flex flex-col">
                    <nav className="flex-1 p-3 pt-5 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-3">Módulos</p>

                        {/* Tab Buttons */}
                        {[
                            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
                            { id: 'users',     label: 'Usuários',  icon: Users,           badge: stats.total },
                        ].map(item => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold text-left mb-1 ${
                                        isActive
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-4 h-4 shrink-0" />
                                        {item.label}
                                    </div>
                                    {item.badge !== null && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                            isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-600'
                                        }`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Quick Stats */}
                        <div className="mt-4 pt-4 border-t border-white/[0.06]">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-3">Resumo</p>
                            {loading ? (
                                <div className="space-y-2 px-3">
                                    {[1,2,3,4].map(i => (
                                        <div key={i} className="flex justify-between animate-pulse">
                                            <div className="h-3 bg-slate-800 rounded w-16" />
                                            <div className="h-3 bg-slate-800 rounded w-6" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {[
                                        { label: 'Premium',   val: stats.premium  },
                                        { label: 'Standard',  val: stats.standard },
                                        { label: 'Gratuito',  val: stats.free     },
                                        { label: 'Admins',    val: stats.admins   },
                                        { label: 'Excluídos', val: stats.deleted  },
                                    ].map(s => (
                                        <div key={s.label} className="flex items-center justify-between px-3 py-1.5">
                                            <span className="text-xs text-slate-500">{s.label}</span>
                                            <span className="text-xs font-bold text-slate-300">{s.val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </nav>

                    {/* Version */}
                    <div className="p-4 border-t border-white/[0.06]">
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em] text-center">
                            Alívia v{version}
                        </p>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 max-w-5xl animate-in fade-in duration-500">

                        {/* ── Dashboard Tab ── */}
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* Stat Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { label: 'Total de Usuários', val: stats.total,   icon: Users      },
                                        { label: 'Premium',           val: stats.premium, icon: Zap        },
                                        { label: 'Standard',          val: stats.standard,icon: CreditCard },
                                        { label: 'Gratuito',          val: stats.free,    icon: Gift       },
                                        { label: 'Admins',            val: stats.admins,  icon: Shield     },
                                        { label: 'Excluídos',         val: stats.deleted, icon: Trash2     },
                                    ].map(item => (
                                        <div key={item.label} className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50 hover:border-white/10 transition-all">
                                            <div className="p-2 rounded-xl bg-white/5 text-slate-400 w-fit mb-4">
                                                <item.icon className="w-4 h-4" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{item.label}</p>
                                            <p className="text-2xl font-black text-white">{item.val}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Breakdown Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Prem. Mensal', val: stats.premiumMonthly  },
                                        { label: 'Prem. Anual',  val: stats.premiumAnnual   },
                                        { label: 'Std. Mensal',  val: stats.standardMonthly },
                                        { label: 'Std. Anual',   val: stats.standardAnnual  },
                                    ].map(item => (
                                        <div key={item.label} className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                                            <span className="text-xs text-slate-500">{item.label}</span>
                                            <span className="text-sm font-bold text-white">{item.val}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Quick Tools */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Push Notification */}
                                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-white/5 shrink-0">
                                                <Zap className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-black text-white">Notificação Push</h2>
                                                <p className="text-xs text-slate-500">Enviar para todos os usuários</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Título</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Nova funcionalidade!"
                                                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5CCEEA]/50 text-white placeholder-slate-600 transition-colors"
                                                    value={pushMessage.title}
                                                    onChange={e => setPushMessage({ ...pushMessage, title: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Mensagem</label>
                                                <textarea
                                                    placeholder="Corpo da notificação..."
                                                    rows={3}
                                                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#5CCEEA]/50 text-white placeholder-slate-600 transition-colors resize-none"
                                                    value={pushMessage.body}
                                                    onChange={e => setPushMessage({ ...pushMessage, body: e.target.value })}
                                                />
                                            </div>
                                            <button
                                                onClick={sendPushToAll}
                                                disabled={isSendingPush}
                                                className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {isSendingPush ? 'Enviando...' : 'Disparar Notificação'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Global Reset */}
                                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-5 flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-white/5 shrink-0">
                                                <Trash2 className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-black text-white">Manutenção Global</h2>
                                                <p className="text-xs text-slate-500">Zona de perigo — use com cautela</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed flex-1 mb-5">
                                            Reseta transações, metas e configurações de todos os usuários. Esta operação é <span className="text-rose-400 font-bold">irreversível</span> e deve ser usada apenas em manutenções planejadas.
                                        </p>
                                        <button
                                            onClick={resetGlobalData}
                                            disabled={isResettingGlobal}
                                            className="w-full py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-500 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {isResettingGlobal ? 'Executando...' : 'Executar Reset Global'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Users Tab ── */}
                        {activeTab === 'users' && (
                            <div className="space-y-5">
                                {/* Header row: title + search */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-black text-white">Gestão de Usuários</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">{filteredUsers.length} encontrados</p>
                                    </div>
                                    <div className="relative w-full sm:w-72">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por e-mail..."
                                            className="w-full bg-slate-900 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#5CCEEA]/50 text-white placeholder-slate-600 transition-colors"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Sub-tabs */}
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {[
                                        { id: 'admins',    label: 'Admins',         count: stats.admins          },
                                        { id: 'premium',   label: 'Plano Premium',  count: stats.premium         },
                                        { id: 'standard',  label: 'Plano Standard', count: stats.standard        },
                                        { id: 'sem_plano', label: 'Plano Gratuito',   count: stats.free          },
                                        { id: 'excluidos', label: 'Excluídos',      count: stats.deleted         },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setUserSubTab(tab.id)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                                userSubTab === tab.id
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300 border border-white/[0.06]'
                                            }`}
                                        >
                                            {tab.label} <span className="opacity-60 font-normal">({tab.count})</span>
                                        </button>
                                    ))}
                                </div>

                                {/* User List */}
                                <div className="space-y-2">
                                    {/* List Header */}
                                    <div className="hidden sm:grid grid-cols-[1fr_160px_100px_48px] gap-4 px-4 py-2">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Usuário</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Plano</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Status</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-right">Ed.</p>
                                    </div>

                                    {loading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <div key={i} className="bg-slate-900/50 border border-white/[0.06] rounded-xl p-4 animate-pulse">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-slate-800 rounded-xl shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="h-3 bg-slate-800 rounded w-48" />
                                                        <div className="h-2.5 bg-slate-800 rounded w-32 opacity-50" />
                                                    </div>
                                                    <div className="h-6 bg-slate-800 rounded-lg w-20" />
                                                    <div className="h-6 bg-slate-800 rounded-lg w-16" />
                                                    <div className="h-8 w-8 bg-slate-800 rounded-xl" />
                                                </div>
                                            </div>
                                        ))
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <div
                                                key={user.uid}
                                                className="bg-slate-900/50 border border-white/[0.06] rounded-xl px-4 py-3.5 hover:border-white/10 transition-all"
                                            >
                                                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_100px_48px] gap-3 items-center">
                                                    {/* Identity */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="p-2 rounded-xl bg-white/5 text-slate-400 shrink-0">
                                                            {user.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-white truncate leading-tight">{user.email}</p>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                                                    <Fingerprint className="w-2.5 h-2.5" /> {user.uid.slice(0, 8)}...
                                                                </span>
                                                                <span className="text-[10px] text-slate-600">· {user.createdAt}</span>
                                                                {user.hasAcceptedTerms
                                                                    ? <span className="text-[10px] text-emerald-500">✓ Termos</span>
                                                                    : <span className="text-[10px] text-amber-500">! Termos</span>
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Plan Badge */}
                                                    <div className="hidden sm:flex flex-col gap-1 justify-center">
                                                        {/* Nome do plano */}
                                                        {user.isLifetime ? (
                                                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20 w-fit">Vitalício</span>
                                                        ) : user.isPremium ? (
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 w-fit">Plano Premium</span>
                                                        ) : user.isStandard ? (
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 w-fit">Plano Standard</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-500 text-[10px] font-bold border border-white/10 w-fit">Gratuito</span>
                                                        )}

                                                        {/* Ciclo + dias restantes */}
                                                        {!user.isLifetime && !user.isDeleted && (user.isPremium || user.isStandard) && (() => {
                                                            const cycle = user.subType === 'annual' ? 365 : 30;
                                                            const pct   = user.daysLeft / cycle;
                                                            const daysCls = pct < 0.17
                                                                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                                                : pct < 0.40
                                                                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                                                            return (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] text-slate-500 font-medium">
                                                                        {user.subType === 'annual' ? 'Anual' : 'Mensal'}
                                                                    </span>
                                                                    {user.daysLeft > 0 ? (
                                                                        <span className={`text-[9px] font-black px-1.5 py-px rounded-md border ${daysCls}`}>
                                                                            {user.daysLeft}d restantes
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] font-bold text-rose-400">Expirado</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Status */}
                                                    <div className="hidden sm:block">
                                                        {user.isDeleted ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-slate-500 text-[10px] font-bold border border-white/10">
                                                                <Trash2 className="w-3 h-3" /> Excluído
                                                            </div>
                                                        ) : user.isBlocked ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20">
                                                                <Ban className="w-3 h-3" /> Bloqueado
                                                            </div>
                                                        ) : user.isExpired ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 text-[10px] font-bold border border-white/10">
                                                                <Clock className="w-3 h-3" /> Expirado
                                                            </div>
                                                        ) : user.isTrial ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 text-[10px] font-bold border border-white/10">
                                                                <Zap className="w-3 h-3" /> Teste
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                                                <Check className="w-3 h-3" /> Ativo
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Edit button */}
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => { setEditingUser(user); setPendingUser({ ...user }); }}
                                                            className="p-2 rounded-xl bg-white/5 hover:bg-[#5CCEEA]/10 hover:text-[#5CCEEA] text-slate-500 transition-all"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-16 text-center">
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Nenhum usuário encontrado</p>
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
