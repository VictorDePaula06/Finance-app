import React, { useEffect, useState, useMemo } from 'react';
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

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const customersSnap = await getDocs(collection(db, 'customers'));
            const allUids = new Set();
            usersSnap.docs.forEach(d => allUids.add(d.id));
            customersSnap.docs.forEach(d => allUids.add(d.id));
            const userList = [];

            for (const uid of Array.from(allUids)) {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                const settingsRef = doc(db, 'users', uid, 'settings', 'general');
                const settingsSnap = await getDoc(settingsRef);
                const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
                const customerRef = doc(db, 'customers', uid);
                const customerSnap = await getDoc(customerRef);
                const customerData = customerSnap.exists() ? customerSnap.data() : {};
                const subsRef = collection(db, 'customers', uid, 'subscriptions');
                const subsSnap = await getDocs(subsRef);
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
                    if (d.toDate) return d.toDate().getTime();
                    if (d instanceof Date) return d.getTime();
                    if (typeof d === 'number' && d < 10000000000) return d * 1000;
                    return new Date(d).getTime();
                };

                const subDateRaw = datesToCompare.length > 0
                    ? new Date(Math.max(...datesToCompare.map(getTimestamp)))
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

                let finalIsPremium = false, finalIsStandard = false, finalIsFree = false;
                if (!isBlocked) {
                    if (subStatus === 'active' || subStatus === 'lifetime') finalIsPremium = true;
                    else if (subStatus === 'standard') finalIsStandard = true;
                    else finalIsFree = true;
                } else {
                    finalIsFree = true;
                }

                const userEmail = settingsData.email || userData.email || customerData.email || 'N/A';

                userList.push({
                    uid, email: userEmail,
                    isPremium: finalIsPremium, isStandard: finalIsStandard, isFree: finalIsFree,
                    subType, subStatus, isTrial,
                    subDate: subDate ? subDate.toLocaleDateString('pt-BR') : 'N/A',
                    daysLeft, isExpired, isLifetime, isBlocked,
                    isAdmin: userData.isAdmin === true || ADMIN_EMAILS.includes(userEmail),
                    pushSubscriptions: userData.pushSubscriptions || [],
                    createdAt: baseDate ? baseDate.toLocaleDateString('pt-BR') : 'N/A',
                    lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate?.().toLocaleDateString() || 'N/A',
                    isDeleted: userData.status === 'deleted' || !userSnap.exists(),
                    deletedAt: userData.deletedAt ? (userData.deletedAt.toDate ? userData.deletedAt.toDate().toLocaleDateString('pt-BR') : new Date(userData.deletedAt).toLocaleDateString('pt-BR')) : null,
                    hasAcceptedTerms: settingsData.hasAcceptedTerms || false
                });
            }
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const filteredUsers = useMemo(() => {
        let list = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
        if (userSubTab === 'admins') return list.filter(u => u.isAdmin);
        if (userSubTab === 'premium_monthly') return list.filter(u => u.isPremium && u.subType === 'monthly' && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'premium_annual') return list.filter(u => (u.isPremium && u.subType === 'annual' || u.isLifetime) && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'standard_monthly') return list.filter(u => u.isStandard && u.subType === 'monthly' && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'standard_annual') return list.filter(u => u.isStandard && u.subType === 'annual' && !u.isAdmin && !u.isDeleted);
        if (userSubTab === 'gratuito') return list.filter(u => u.isFree && !u.isAdmin && !u.isDeleted);
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
                    let finalStatus = 'free', finalType = 'monthly';
                    if (pendingUser.isLifetime) { finalStatus = 'lifetime'; finalType = 'lifetime'; }
                    else if (pendingUser.isPremium) { finalStatus = 'active'; finalType = 'monthly'; }
                    else if (pendingUser.isStandard) { finalStatus = 'standard'; finalType = 'monthly'; }
                    batch.update(userRef, { isAdmin: pendingUser.isAdmin, isBlocked: pendingUser.isBlocked || false });
                    batch.set(settingsRef, {
                        subscription: {
                            status: pendingUser.isBlocked ? 'blocked' : finalStatus,
                            type: finalType, updatedAt: new Date(), date: new Date(),
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
        setPendingUser(prev => ({
            ...prev,
            isPremium:  planId === 'isPremium',
            isLifetime: planId === 'isLifetime',
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
            const subs = users.flatMap(u => u.pushSubscriptions || []);
            const res = await fetch('https://alivia-push.vercel.app/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptions: subs, title: pushMessage.title, body: pushMessage.body })
            });
            if (res.ok) { showToast("Notificação enviada!"); setPushMessage({ title: '', body: '' }); }
        } catch (error) {
            console.error("Push error:", error);
            showToast("Erro ao enviar push", "error");
        } finally { setIsSendingPush(false); }
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
                    const qT = await getDocs(collection(db, 'transactions'));
                    const qG = await getDocs(collection(db, 'goals'));
                    const batch = writeBatch(db);
                    qT.docs.forEach(d => batch.delete(d.ref));
                    qG.docs.forEach(d => batch.delete(d.ref));
                    const usersSnap = await getDocs(collection(db, 'users'));
                    for (const userDoc of usersSnap.docs) {
                        const settingsRef = doc(db, 'users', userDoc.id, 'settings', 'general');
                        batch.set(settingsRef, {
                            manualConfig: { income: 0, fixedExpenses: 0, variableEstimate: 0, invested: 0, categoryBudgets: {}, recurringSubs: [] },
                            hasSeenWelcome: false, hasSeenPatrimonyWelcome: false
                        }, { merge: true });
                    }
                    await batch.commit();
                    showToast("Dados resetados globalmente!");
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
                    const batch = writeBatch(db);
                    const qT = query(collection(db, 'transactions'), where('userId', '==', user.uid));
                    const snapT = await getDocs(qT);
                    snapT.docs.forEach(d => batch.delete(d.ref));
                    const qG = query(collection(db, 'goals'), where('userId', '==', user.uid));
                    const snapG = await getDocs(qG);
                    snapG.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
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
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-[#5CCEEA]/30 flex flex-col">

            {/* ── Toast ── */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
                        toast.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                        {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="text-xs font-black uppercase tracking-[0.15em]">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* ── Confirm Dialog ── */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-[#5CCEEA]/10 shrink-0">
                                <Info className="w-5 h-5 text-[#5CCEEA]" />
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.15em]">{confirmDialog.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className="flex-1 py-2.5 rounded-xl bg-[#5CCEEA] text-slate-950 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#69C8B9] transition-all"
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
                            <div className="p-2 rounded-xl bg-[#5CCEEA]/10 shrink-0">
                                <Settings className="w-5 h-5 text-[#5CCEEA]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-[0.15em]">Editar Permissões</h3>
                                <p className="text-[10px] text-slate-500 truncate font-black uppercase tracking-[0.1em] mt-0.5">{editingUser.email}</p>
                            </div>
                        </div>

                        {/* PLANO — Radio Buttons */}
                        <div className="mb-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-2">
                                <CreditCard className="w-3 h-3" /> Plano de Acesso
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'isPremium',  label: 'Premium',  desc: 'Acesso completo',       color: 'emerald' },
                                    { id: 'isLifetime', label: 'Vitalício', desc: 'Permanente ilimitado',  color: 'purple'  },
                                    { id: 'isStandard', label: 'Standard', desc: 'Versão intermediária',   color: 'amber'   },
                                    { id: 'isFree',     label: 'Gratuito', desc: 'Teste ou sem plano',     color: 'rose'    },
                                ].map(plan => {
                                    const active = pendingUser[plan.id];
                                    const colorMap = {
                                        emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
                                        purple:  { border: 'border-purple-500',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  dot: 'bg-purple-500'  },
                                        amber:   { border: 'border-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
                                        rose:    { border: 'border-rose-500',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-500'    },
                                    }[plan.color];
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            disabled={isSaving}
                                            onClick={() => handlePlanSelect(plan.id)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                active ? `${colorMap.border} ${colorMap.bg}` : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs font-black ${active ? colorMap.text : 'text-white'}`}>{plan.label}</span>
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                                    active ? `${colorMap.dot} border-transparent` : 'border-white/20'
                                                }`}>
                                                    {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-500 font-medium">{plan.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* TOGGLES INDEPENDENTES */}
                        <div className="space-y-2 mb-5">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1 flex items-center gap-2">
                                <Shield className="w-3 h-3" /> Permissões Especiais
                            </p>
                            {[
                                { id: 'isAdmin',   label: 'Administrador',   desc: 'Acesso ao Painel Admin',      border: 'border-purple-500', bg: 'bg-purple-500/10', check: 'bg-purple-500' },
                                { id: 'isBlocked', label: 'Bloquear Usuário', desc: 'Suspende acesso imediatamente', border: 'border-rose-600',   bg: 'bg-rose-600/10',   check: 'bg-rose-600'   },
                            ].map(flag => (
                                <button
                                    key={flag.id}
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleToggle(flag.id)}
                                    className={`w-full px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-3 text-left ${
                                        pendingUser[flag.id] ? `${flag.border} ${flag.bg}` : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        pendingUser[flag.id] ? `${flag.check} border-transparent` : 'border-white/20'
                                    }`}>
                                        {pendingUser[flag.id] && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white">{flag.label}</p>
                                        <p className="text-[9px] text-slate-500 font-medium">{flag.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={saveUserChanges}
                                disabled={isSaving}
                                className="w-full py-3 rounded-xl bg-[#5CCEEA] text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#69C8B9] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleResetTrial}
                                    disabled={isSaving}
                                    className="py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.15em] border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                >
                                    Resetar Teste
                                </button>
                                <button
                                    onClick={handleExpireTrial}
                                    disabled={isSaving}
                                    className="py-2.5 rounded-xl bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-[0.15em] border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                                >
                                    Expirar Teste
                                </button>
                                <button
                                    onClick={() => adminDeleteUser(editingUser)}
                                    className="py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-[0.15em] border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                                >
                                    Excluir Conta
                                </button>
                                <button
                                    onClick={() => { setEditingUser(null); setPendingUser(null); }}
                                    className="py-2.5 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-white/10 transition-all"
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
                    <div className="p-2 rounded-xl bg-[#5CCEEA]/10 shrink-0">
                        <Shield className="w-4 h-4 text-[#5CCEEA]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white leading-tight">Painel de Controle</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Administração Alívia</p>
                    </div>
                </div>
                <div className="ml-auto">
                    <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-[0.15em] ${
                        loading
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                        {loading ? 'Sincronizando...' : `${stats.total} usuários`}
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
                                            ? 'bg-[#5CCEEA]/10 text-[#5CCEEA]'
                                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-4 h-4 shrink-0" />
                                        {item.label}
                                    </div>
                                    {item.badge !== null && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                            isActive ? 'bg-[#5CCEEA]/20 text-[#5CCEEA]' : 'bg-white/5 text-slate-600'
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
                                <div className="space-y-1">
                                    {[
                                        { label: 'Premium',  val: stats.premium,  color: 'text-emerald-400' },
                                        { label: 'Standard', val: stats.standard, color: 'text-slate-400'   },
                                        { label: 'Gratuito', val: stats.free,     color: 'text-rose-400'    },
                                        { label: 'Admins',   val: stats.admins,   color: 'text-purple-400'  },
                                        { label: 'Excluídos',val: stats.deleted,  color: 'text-slate-600'   },
                                    ].map(s => (
                                        <div key={s.label} className="flex items-center justify-between px-3 py-1">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em]">{s.label}</span>
                                            <span className={`text-xs font-black ${s.color}`}>{s.val}</span>
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Total',    val: stats.total,   icon: Users,      color: 'text-[#5CCEEA]',  bg: 'bg-[#5CCEEA]/10'  },
                                        { label: 'Premium',  val: stats.premium, icon: Zap,        color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                                        { label: 'Standard', val: stats.standard,icon: CreditCard, color: 'text-slate-400',   bg: 'bg-slate-400/10'   },
                                        { label: 'Gratuito', val: stats.free,    icon: Gift,       color: 'text-rose-400',    bg: 'bg-rose-400/10'    },
                                        { label: 'Admins',   val: stats.admins,  icon: Shield,     color: 'text-purple-400',  bg: 'bg-purple-400/10'  },
                                        { label: 'Excluídos',val: stats.deleted, icon: Trash2,     color: 'text-slate-500',   bg: 'bg-slate-500/10'   },
                                    ].map(item => (
                                        <div key={item.label} className="p-5 rounded-2xl border border-white/[0.06] bg-slate-900/50 hover:border-white/10 transition-all group">
                                            <div className={`p-2 rounded-xl ${item.bg} ${item.color} w-fit mb-4 transition-transform group-hover:scale-110`}>
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
                                        { label: 'Prem. Mensal', val: stats.premiumMonthly,  color: 'text-emerald-400' },
                                        { label: 'Prem. Anual',  val: stats.premiumAnnual,   color: 'text-emerald-300' },
                                        { label: 'Std. Mensal',  val: stats.standardMonthly, color: 'text-slate-400'   },
                                        { label: 'Std. Anual',   val: stats.standardAnnual,  color: 'text-slate-300'   },
                                    ].map(item => (
                                        <div key={item.label} className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{item.label}</span>
                                            <span className={`text-sm font-black ${item.color}`}>{item.val}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Quick Tools */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Push Notification */}
                                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-[#5CCEEA]/10 shrink-0">
                                                <Zap className="w-4 h-4 text-[#5CCEEA]" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-black text-white">Notificação Push</h2>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">Enviar para todos os usuários</p>
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
                                                className="w-full py-3 rounded-xl bg-[#5CCEEA] text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#69C8B9] active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {isSendingPush ? 'Enviando...' : 'Disparar Notificação'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Global Reset */}
                                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-rose-500/10 shrink-0">
                                                <Trash2 className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <div>
                                                <h2 className="text-sm font-black text-white">Manutenção Global</h2>
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em]">Zona de perigo</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed flex-1 mb-5">
                                            Reseta transações, metas e configurações de todos os usuários. Operação <span className="text-rose-400 font-black">irreversível</span> — use somente em manutenções planejadas.
                                        </p>
                                        <button
                                            onClick={resetGlobalData}
                                            disabled={isResettingGlobal}
                                            className="w-full py-3 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500 active:scale-95 transition-all disabled:opacity-50"
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
                                        <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Gestão de Usuários</h2>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.15em] mt-0.5">{filteredUsers.length} encontrados</p>
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
                                <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                                    {[
                                        { id: 'admins',          label: 'Admins',      count: stats.admins          },
                                        { id: 'premium_monthly', label: 'Prem Mensal', count: stats.premiumMonthly  },
                                        { id: 'premium_annual',  label: 'Prem Anual',  count: stats.premiumAnnual   },
                                        { id: 'standard_monthly',label: 'Std Mensal',  count: stats.standardMonthly },
                                        { id: 'standard_annual', label: 'Std Anual',   count: stats.standardAnnual  },
                                        { id: 'gratuito',        label: 'Gratuito',    count: stats.free            },
                                        { id: 'excluidos',       label: 'Excluídos',   count: stats.deleted         },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setUserSubTab(tab.id)}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all ${
                                                userSubTab === tab.id
                                                    ? 'bg-[#5CCEEA] text-slate-950'
                                                    : 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300 border border-white/[0.06]'
                                            }`}
                                        >
                                            {tab.label} <span className="opacity-70">({tab.count})</span>
                                        </button>
                                    ))}
                                </div>

                                {/* User List */}
                                <div className="space-y-2">
                                    {/* List Header */}
                                    <div className="hidden sm:grid grid-cols-[1fr_120px_100px_48px] gap-4 px-4 py-2">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Identidade</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Plano</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Status</p>
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-right">Ação</p>
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
                                                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_100px_48px] gap-3 items-center">
                                                    {/* Identity */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`p-2 rounded-xl shrink-0 ${user.isAdmin ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {user.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-white truncate leading-tight">{user.email}</p>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                                                    <Fingerprint className="w-2.5 h-2.5" /> {user.uid.slice(0, 8)}...
                                                                </span>
                                                                <span className="text-[9px] text-slate-600">•</span>
                                                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{user.createdAt}</span>
                                                                {user.hasAcceptedTerms
                                                                    ? <span className="text-[9px] font-black text-emerald-500">✓ Termos</span>
                                                                    : <span className="text-[9px] font-black text-amber-500">! Termos</span>
                                                                }
                                                                {user.daysLeft > 0 && user.daysLeft < 365 && !user.isDeleted && (
                                                                    <span className="text-[9px] font-black text-slate-500">· {user.daysLeft}d restantes</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Plan Badge */}
                                                    <div className="hidden sm:block">
                                                        {user.isLifetime ? (
                                                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-widest border border-purple-500/20">Vitalício</span>
                                                        ) : user.isPremium ? (
                                                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Premium</span>
                                                        ) : user.isStandard ? (
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-500/20">Standard</span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">Gratuito</span>
                                                        )}
                                                    </div>

                                                    {/* Status */}
                                                    <div className="hidden sm:block">
                                                        {user.isDeleted ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-400 text-[9px] font-black border border-slate-500/20">
                                                                <Trash2 className="w-3 h-3" /> Excluído
                                                            </div>
                                                        ) : user.isBlocked ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[9px] font-black border border-rose-500/20">
                                                                <Ban className="w-3 h-3" /> Bloqueado
                                                            </div>
                                                        ) : user.isExpired ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-black border border-amber-500/20">
                                                                <Clock className="w-3 h-3" /> Expirado
                                                            </div>
                                                        ) : user.isTrial ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-[9px] font-black border border-sky-500/20">
                                                                <Zap className="w-3 h-3" /> Teste
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-black border border-emerald-500/20">
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
