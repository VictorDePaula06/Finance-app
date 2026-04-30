import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/firebase';
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
    UserPlus,
    UserMinus,
    Mail,
    Fingerprint,
    Calendar,
    Ban,
    Edit3,
    Info
} from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'users'
    const [userSubTab, setUserSubTab] = useState('admins'); // 'admins', 'premium', 'standard'
    const [editingUser, setEditingUser] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingGlobal, setIsResettingGlobal] = useState(false);
    
    // UI State for custom notifications and confirmations
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Notification state
    const [pushMessage, setPushMessage] = useState({ title: '', body: '' });
    const [isSendingPush, setIsSendingPush] = useState(false);

    // Helper to show toast
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const customersSnap = await getDocs(collection(db, 'customers'));
            const settingsSnap = await getDocs(collectionGroup(db, 'settings'));

            const allUids = new Set();
            usersSnap.docs.forEach(d => allUids.add(d.id));
            customersSnap.docs.forEach(d => allUids.add(d.id));
            settingsSnap.docs.forEach(d => {
                const pathParts = d.ref.path.split('/');
                if (pathParts[1]) allUids.add(pathParts[1]);
            });

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
                const stripeSubData = subsSnap.docs[0]?.data();

                const hasActiveSubscription = subsSnap.docs.some(d =>
                    ['active', 'trialing'].includes(d.data().status)
                );

                const manualStatus = settingsData.subscription?.status || userData.subscription?.status;
                const stripeActive = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing');

                let subStatus = 'free';
                if (manualStatus === 'blocked') {
                    subStatus = 'blocked';
                } else if (manualStatus === 'lifetime') {
                    subStatus = 'lifetime';
                } else if (stripeActive) {
                    subStatus = 'active';
                } else if (manualStatus) {
                    subStatus = manualStatus;
                } else if (stripeSubData?.status) {
                    subStatus = stripeSubData.status;
                }

                const isPremium = (subStatus === 'active' || subStatus === 'lifetime') || hasActiveSubscription;

                const datesToCompare = [
                    stripeSubData?.current_period_start,
                    settingsData.subscription?.date,
                    userData.subscription?.date,
                    stripeSubData?.trial_start
                ].filter(Boolean);

                const getTimestamp = (d) => {
                    if (d.toDate) return d.toDate().getTime();
                    if (d instanceof Date) return d.getTime();
                    return new Date(d).getTime();
                };

                const subDateRaw = datesToCompare.length > 0 
                    ? new Date(Math.max(...datesToCompare.map(getTimestamp)))
                    : (userData.createdAt || null);

                const subDate = subDateRaw?.toDate ? subDateRaw.toDate() : (subDateRaw ? new Date(subDateRaw) : null);

                const isAnnual = settingsData.subscription?.type === 'annual' || stripeSubData?.items?.[0]?.plan?.interval === 'year';

                let daysLeft = 0;
                let isBlocked = settingsData.subscription?.status === 'blocked';
                let isExpired = subStatus === 'expired' || isBlocked;
                let isLifetime = subStatus === 'lifetime';
                let isTrial = false;

                const subType = isAnnual ? 'annual' : 'monthly';
                const createdAt = userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : null;
                const trialStartDate = userData.trialStartDate ? (userData.trialStartDate.toDate ? userData.trialStartDate.toDate() : new Date(userData.trialStartDate)) : null;
                const baseDate = trialStartDate || createdAt;

                if (subStatus === 'active' && subDate) {
                    const now = new Date();
                    const cycle = subType === 'annual' ? 365 : 30;
                    const diff = Math.floor((now - subDate) / (1000 * 60 * 60 * 24));
                    if (diff <= cycle) daysLeft = cycle - diff;
                    else isExpired = true;
                } else if (isLifetime) daysLeft = 9999;
                else if (baseDate) {
                    const now = new Date();
                    const diffDays = Math.ceil((now - baseDate) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) {
                        isTrial = true;
                        daysLeft = 7 - diffDays;
                    } else isExpired = true;
                } else isExpired = true;

                userList.push({
                    uid,
                    email: settingsData.email || userData.email || customerData.email || 'N/A',
                    isPremium: (isPremium || isLifetime || isTrial) && !isExpired,
                    subType,
                    subStatus,
                    isTrial,
                    subDate: subDate ? subDate.toLocaleDateString('pt-BR') : 'N/A',
                    daysLeft,
                    isExpired: isExpired && !isLifetime && !isTrial,
                    isLifetime,
                    isBlocked,
                    isStandard: subStatus === 'free' || subStatus === 'expired',
                    isAdmin: userData.isAdmin || false,
                    pushSubscriptions: userData.pushSubscriptions || [],
                    createdAt: baseDate ? baseDate.toLocaleDateString('pt-BR') : 'N/A',
                    lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate?.().toLocaleDateString() || 'N/A',
                    isDeleted: userData.status === 'deleted' || !userSnap.exists()
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

    // Filter Logic
    const filteredUsers = useMemo(() => {
        let list = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
        if (userSubTab === 'admins') return list.filter(u => u.isAdmin);
        if (userSubTab === 'premium') return list.filter(u => u.isPremium && !u.isAdmin);
        if (userSubTab === 'standard') return list.filter(u => !u.isPremium && !u.isAdmin);
        return list;
    }, [users, searchTerm, userSubTab]);

    const stats = useMemo(() => ({
        total: users.length,
        premium: users.filter(u => u.isPremium && !u.isAdmin).length,
        admins: users.filter(u => u.isAdmin).length,
        standard: users.filter(u => !u.isPremium && !u.isAdmin).length
    }), [users]);

    // Handle Edit Actions
    const saveUserChanges = async (user, changes) => {
        setIsSaving(true);
        const uid = user.uid;
        try {
            const userRef = doc(db, 'users', uid);
            const settingsRef = doc(db, 'users', uid, 'settings', 'general');
            const batch = writeBatch(db);

            const newState = {
                isAdmin: changes.hasOwnProperty('isAdmin') ? changes.isAdmin : user.isAdmin,
                isPremium: changes.hasOwnProperty('isPremium') ? (changes.isPremium && !changes.isStandard) : user.isPremium,
                isLifetime: changes.hasOwnProperty('isLifetime') ? (changes.isLifetime && !changes.isStandard) : user.isLifetime,
                isBlocked: changes.hasOwnProperty('isBlocked') ? changes.isBlocked : user.isBlocked,
                isStandard: changes.hasOwnProperty('isStandard') ? changes.isStandard : user.isStandard
            };

            // Se marcar Standard como true, desmarca Premium e Vitalício
            if (changes.isStandard) {
                newState.isPremium = false;
                newState.isLifetime = false;
            }

            batch.update(userRef, { isAdmin: newState.isAdmin });

            let finalStatus = 'free';
            let finalType = 'monthly';

            if (newState.isBlocked) {
                finalStatus = 'blocked';
            } else if (newState.isLifetime) {
                finalStatus = 'lifetime';
                finalType = 'lifetime';
            } else if (newState.isPremium) {
                finalStatus = 'active';
                finalType = 'monthly';
            }

            batch.set(settingsRef, {
                subscription: {
                    status: finalStatus,
                    type: finalType,
                    updatedAt: new Date(),
                    date: newState.isPremium || newState.isLifetime ? new Date() : null
                }
            }, { merge: true });

            await batch.commit();
            showToast("Alterações salvas!");
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error("Error saving changes:", error);
            showToast("Erro ao salvar alterações", "error");
        } finally {
            setIsSaving(false);
        }
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
            if (res.ok) {
                showToast("Notificação enviada!");
                setPushMessage({ title: '', body: '' });
            }
        } catch (error) {
            console.error("Push error:", error);
            showToast("Erro ao enviar push", "error");
        } finally {
            setIsSendingPush(false);
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
                    const qT = await getDocs(collection(db, 'transactions'));
                    const qG = await getDocs(collection(db, 'goals'));
                    const batch = writeBatch(db);
                    qT.docs.forEach(d => batch.delete(d.ref));
                    qG.docs.forEach(d => batch.delete(d.ref));
                    
                    const usersSnap = await getDocs(collection(db, 'users'));
                    for (const userDoc of usersSnap.docs) {
                        const settingsRef = doc(db, 'users', userDoc.id, 'settings', 'general');
                        batch.set(settingsRef, {
                            manualConfig: {
                                income: 0,
                                fixedExpenses: 0,
                                variableEstimate: 0,
                                invested: 0,
                                categoryBudgets: {},
                                recurringSubs: []
                            },
                            hasSeenWelcome: false,
                            hasSeenPatrimonyWelcome: false
                        }, { merge: true });
                    }
                    
                    await batch.commit();
                    showToast("Dados resetados globalmente!");
                    fetchUsers();
                } catch (error) {
                    console.error("Error resetting global data:", error);
                    showToast("Erro no reset global", "error");
                } finally {
                    setIsResettingGlobal(false);
                }
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
                    setEditingUser(null);
                    fetchUsers();
                } catch (error) {
                    console.error("Error deleting user:", error);
                    showToast("Erro ao deletar usuário", "error");
                }
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-[#5CCEEA]/30">
            {/* Toast System */}
            {toast && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} backdrop-blur-2xl`}>
                        {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Info className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-4 uppercase tracking-tight">{confirmDialog.title}</h3>
                        <p className="text-sm text-slate-400 text-center mb-10 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setConfirmDialog(null)}
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDialog.onConfirm}
                                className="flex-1 py-4 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-900/20 hover:bg-rose-500 transition-all"
                            >
                                {confirmDialog.confirmText || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Sticky */}
            <header className="sticky top-0 z-[100] backdrop-blur-2xl bg-slate-950/80 border-b border-white/5 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-widest text-[#5CCEEA]">Painel de Controle</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Administração Alívia v7.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-[#5CCEEA] text-slate-950 shadow-lg shadow-[#5CCEEA]/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <LayoutDashboard className="w-3 h-3" /> Dashboard
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-[#5CCEEA] text-slate-950 shadow-lg shadow-[#5CCEEA]/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Users className="w-3 h-3" /> Usuários
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Usuários', val: stats.total, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                                { label: 'Premium Ativos', val: stats.premium, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                                { label: 'Admins', val: stats.admins, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                                { label: 'Standard', val: stats.standard, icon: CreditCard, color: 'text-slate-400', bg: 'bg-slate-400/10' }
                            ].map(item => (
                                <div key={item.label} className="p-8 rounded-[2.5rem] border border-white/5 bg-slate-900/50 backdrop-blur-xl hover:border-[#5CCEEA]/30 transition-all group">
                                    <div className={`p-3 rounded-2xl ${item.bg} ${item.color} w-fit mb-6 transition-transform group-hover:scale-110`}>
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</p>
                                    <p className="text-4xl font-black text-white">{item.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Quick Tools */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8">
                                <h2 className="text-xl font-black mb-6 flex items-center gap-3"><Zap className="w-6 h-6 text-[#5CCEEA]" /> Notificação Push Global</h2>
                                <div className="space-y-4">
                                    <input 
                                        type="text" placeholder="Título da Notificação" 
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5CCEEA]/50"
                                        value={pushMessage.title} onChange={e => setPushMessage({...pushMessage, title: e.target.value})}
                                    />
                                    <textarea 
                                        placeholder="Mensagem da Notificação" 
                                        className="w-full bg-slate-950 border border-white/5 rounded-2xl p-5 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-[#5CCEEA]/50"
                                        value={pushMessage.body} onChange={e => setPushMessage({...pushMessage, body: e.target.value})}
                                    />
                                    <button 
                                        onClick={sendPushToAll} disabled={isSendingPush}
                                        className="w-full py-5 bg-gradient-to-r from-[#5CCEEA] to-[#69C8B9] text-slate-950 font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {isSendingPush ? 'Enviando...' : 'DISPARAR AGORA'}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-rose-500/5 border border-rose-500/10 rounded-[2.5rem] p-8 flex flex-col justify-center items-center text-center">
                                <div className="p-4 bg-rose-500/10 rounded-full mb-6">
                                    <Trash2 className="w-10 h-10 text-rose-500" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2">Manutenção Global</h3>
                                <p className="text-sm text-slate-400 max-w-sm mb-8">Resetar o sistema para todos os e-mails logados para evitar conflitos de dados.</p>
                                <button 
                                    onClick={resetGlobalData}
                                    disabled={isResettingGlobal}
                                    className="px-10 py-5 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-500 transition-all active:scale-95 shadow-xl shadow-rose-900/20"
                                >
                                    {isResettingGlobal ? 'EXECUTANDO...' : 'EXECUTAR RESET GLOBAL'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-8">
                        {/* Sub Tabs */}
                        <div className="flex flex-wrap items-center justify-between gap-6">
                            <div className="flex items-center gap-2 p-1.5 bg-slate-900/50 rounded-2xl border border-white/5">
                                {[
                                    { id: 'admins', label: 'Administradores', count: stats.admins },
                                    { id: 'premium', label: 'Premium', count: stats.premium },
                                    { id: 'standard', label: 'Standard', count: stats.standard }
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => setUserSubTab(tab.id)}
                                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${userSubTab === tab.id ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {tab.label} ({tab.count})
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text" placeholder="Buscar por e-mail..." 
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-[#5CCEEA]/30"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* User List Table */}
                        <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 overflow-hidden backdrop-blur-xl shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/50 border-b border-white/5">
                                    <tr>
                                        <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Identidade / Cadastro</th>
                                        <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Plano Atual</th>
                                        <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                        <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Configurações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="p-8"><div className="h-4 bg-slate-800 rounded w-48 mb-2"></div><div className="h-3 bg-slate-800 rounded w-32 opacity-50"></div></td>
                                                <td className="p-8"><div className="h-6 bg-slate-800 rounded w-24"></div></td>
                                                <td className="p-8"><div className="h-6 bg-slate-800 rounded w-32"></div></td>
                                                <td className="p-8 text-right"><div className="h-10 bg-slate-800 rounded-xl w-10 ml-auto"></div></td>
                                            </tr>
                                        ))
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${user.isAdmin ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {user.isAdmin ? <ShieldAlert className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-white truncate text-base mb-1">{user.email}</p>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                <Fingerprint className="w-3 h-3" /> {user.uid.slice(0, 8)}... • Criado em {user.createdAt}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    {user.isLifetime ? (
                                                        <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-500/20">VITALÍCIO</span>
                                                    ) : user.isPremium ? (
                                                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">PREMIUM</span>
                                                    ) : (
                                                        <span className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-500/20">STANDARD</span>
                                                    )}
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex items-center gap-3">
                                                        {user.isBlocked ? (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black border border-rose-500/20">
                                                                <Ban className="w-3 h-3" /> BLOQUEADO
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                                                                <Check className="w-3 h-3" /> ATIVO
                                                            </div>
                                                        )}
                                                        {user.daysLeft > 0 && user.daysLeft < 365 && (
                                                            <span className="text-[10px] font-bold text-slate-500">EXPIRA EM {user.daysLeft} DIAS</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-8 text-right">
                                                    <button 
                                                        onClick={() => setEditingUser(user)}
                                                        className="p-3 rounded-2xl bg-white/5 hover:bg-[#5CCEEA] hover:text-slate-950 text-slate-400 transition-all transform hover:scale-110"
                                                    >
                                                        <Edit3 className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest opacity-30 italic">Nenhum usuário encontrado</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 p-3 rounded-2xl hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-[#5CCEEA]/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                <Settings className="w-10 h-10 text-[#5CCEEA]" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Editar Usuário</h3>
                            <p className="text-xs font-bold text-slate-500 truncate px-4">{editingUser.email}</p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { id: 'isAdmin', label: 'Este usuário é um administrador', desc: 'Permite acesso total ao Painel Admin', color: 'bg-purple-500' },
                                { id: 'isPremium', label: 'Plano Premium Ativo', desc: 'Acesso completo a todas as ferramentas', color: 'bg-emerald-500' },
                                { id: 'isLifetime', label: 'Plano Vitalício', desc: 'Acesso permanente e ilimitado ao sistema', color: 'bg-blue-500' },
                                { id: 'isStandard', label: 'Plano Standard', desc: 'Versão limitada do sistema', color: 'bg-slate-500' },
                                { id: 'isBlocked', label: 'Bloquear Usuário', desc: 'Impedir acesso imediato ao sistema', color: 'bg-rose-500' }
                            ].map(flag => (
                                <button 
                                    key={flag.id}
                                    disabled={flag.disabled || isSaving}
                                    onClick={() => {
                                        const newVal = !editingUser[flag.id];
                                        saveUserChanges(editingUser, { [flag.id]: newVal });
                                    }}
                                    className={`w-full p-5 rounded-2xl border transition-all flex items-center gap-4 text-left relative overflow-hidden group ${editingUser[flag.id] ? 'bg-white/5 border-[#5CCEEA]/50' : 'bg-transparent border-white/5 hover:border-white/10'} ${flag.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingUser[flag.id] ? `${flag.color} border-transparent` : 'border-white/20'}`}>
                                        {editingUser[flag.id] && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-white">{flag.label}</p>
                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">{flag.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-10 flex gap-4">
                            <button 
                                onClick={() => adminDeleteUser(editingUser)}
                                className="flex-1 py-4 rounded-2xl bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                            >
                                Excluir Conta
                            </button>
                            <button 
                                onClick={() => setEditingUser(null)}
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
