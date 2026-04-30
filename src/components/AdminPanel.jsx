import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, query, getDoc, collectionGroup, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { ArrowLeft, UserCheck, UserMinus, Shield, Search, RefreshCw, TrendingUp, Zap, Trash2, Filter, ShieldAlert, Users, CreditCard, Clock } from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isResettingGlobal, setIsResettingGlobal] = useState(false);

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

                const subStatus = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing')
                    ? 'active'
                    : (settingsData.subscription?.status || userData.subscription?.status || (stripeSubData?.status || 'free'));

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

                const annualPriceId = import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY;
                const stripePriceId = stripeSubData?.items?.[0]?.price?.id;
                const stripeInterval = stripeSubData?.items?.[0]?.plan?.interval;

                const isAnnual = stripePriceId === annualPriceId ||
                    stripeInterval === 'year' ||
                    stripeSubData?.items?.[0]?.plan?.nickname?.toLowerCase().includes('anual') ||
                    settingsData.subscription?.type === 'annual';

                let daysLeft = 0;
                let isBlocked = settingsData.subscription?.status === 'blocked';
                let isExpired = subStatus === 'expired' || isBlocked;
                let tolerance = false;
                let isLifetime = subStatus === 'lifetime';
                let isTrial = false;

                const subType = isAnnual ? 'annual' : 'monthly';
                const createdAt = userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : null;

                const trialStartDate = userData.trialStartDate ? (userData.trialStartDate.toDate ? userData.trialStartDate.toDate() : new Date(userData.trialStartDate)) : null;
                const baseDate = trialStartDate || createdAt;

                // Lógica de cálculo de dias e segurança de expiração
                if (subStatus === 'active' && subDate) {
                    const now = new Date();
                    const cycle = subType === 'annual' ? 365 : 30;
                    const diff = Math.floor((now - subDate) / (1000 * 60 * 60 * 24));

                    // Se a data for no futuro (erro de sistema), resetamos
                    if (diff < 0) {
                        daysLeft = 0;
                        isExpired = true;
                    } else if (diff <= cycle) {
                        daysLeft = cycle - diff;
                    } else if (diff <= cycle + 5) {
                        daysLeft = (cycle + 5) - diff;
                        tolerance = true;
                    } else {
                        // Trava de segurança: Se passou de 35 dias (30 + 5 tol), vira expirado
                        daysLeft = 0;
                        isExpired = true;
                    }
                } else if (isLifetime) {
                    daysLeft = 9999;
                } else {
                    if (baseDate) {
                        const now = new Date();
                        const diffDays = Math.ceil((now - baseDate) / (1000 * 60 * 60 * 24));
                        if (diffDays <= 7) {
                            isTrial = true;
                            daysLeft = 7 - diffDays;
                        } else {
                            isExpired = true;
                        }
                    } else {
                        isExpired = true;
                    }
                }

                const userObj = {
                    uid,
                    email: settingsData.email || userData.email || customerData.email || 'N/A',
                    stripeEmail: customerData.email || 'N/A',
                    isPremium: (isPremium || isLifetime || isTrial) && !isExpired,
                    subType,
                    subStatus,
                    isTrial,
                    subDate: subDate ? subDate.toLocaleDateString('pt-BR') : 'N/A',
                    daysLeft,
                    isExpired: isExpired && !isLifetime && !isTrial,
                    isTolerance: tolerance,
                    isLifetime,
                    isBlocked,
                    isDeleted: userData.status === 'deleted' || !userSnap.exists(),
                    isAdmin: userData.isAdmin || false,
                    pushSubscriptions: userData.pushSubscriptions || [],
                    deletedAt: userData.deletedAt ? (userData.deletedAt.toDate ? userData.deletedAt.toDate() : new Date(userData.deletedAt)) : null,
                    createdAt: baseDate ? baseDate.toLocaleDateString('pt-BR') : 'N/A',
                    lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate?.().toLocaleDateString() || 'N/A'
                };
                userList.push(userObj);
            }
            setUsers(userList.sort((a, b) => (a.isPremium === b.isPremium) ? 0 : a.isPremium ? -1 : 1));
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const togglePremium = async (uid, currentStatus) => {
        try {
            const userRef = doc(db, 'users', uid, 'settings', 'general');
            await setDoc(userRef, {
                subscription: {
                    status: currentStatus ? 'blocked' : 'active',
                    type: 'monthly',
                    date: new Date(),
                    updatedAt: new Date()
                }
            }, { merge: true });
            fetchUsers();
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Erro ao atualizar status do usuário: " + error.message);
        }
    };

    const toggleAdmin = async (uid, currentIsAdmin) => {
        if (!window.confirm(`Deseja ${currentIsAdmin ? 'REMOVER' : 'TORNAR'} este usuário um administrador?`)) return;
        try {
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                isAdmin: !currentIsAdmin
            }, { merge: true });
            alert("Status de administrador atualizado!");
            fetchUsers();
        } catch (error) {
            console.error("Error toggling admin:", error);
            alert("Erro ao atualizar status de administrador.");
        }
    };

    const setLifetime = async (uid) => {
        try {
            const userRef = doc(db, 'users', uid, 'settings', 'general');
            await setDoc(userRef, {
                subscription: {
                    status: 'lifetime',
                    type: 'lifetime',
                    updatedAt: new Date()
                }
            }, { merge: true });
            fetchUsers();
        } catch (error) {
            console.error("Error setting lifetime:", error);
            alert("Erro ao definir acesso vitalício.");
        }
    };

    const simulateDate = async (uid, dateStr) => {
        try {
            const userRef = doc(db, 'users', uid, 'settings', 'general');
            const targetDate = new Date(dateStr);

            await setDoc(userRef, {
                subscription: {
                    date: targetDate,
                    status: 'active',
                    updatedAt: new Date(),
                    type: 'monthly'
                }
            }, { merge: true });
            alert(`Simulando pagamento em: ${targetDate.toLocaleDateString('pt-BR')}`);
            fetchUsers();
        } catch (error) {
            console.error("Error simulating date:", error);
        }
    };

    const renewTrial = async (uid) => {
        if (!window.confirm("Isso irá resetar o período de teste de 7 dias para este usuário a partir de HOJE. Confirmar?")) return;
        try {
            const userRef = doc(db, 'users', uid);
            const settingsRef = doc(db, 'users', uid, 'settings', 'general');
            
            await Promise.all([
                setDoc(userRef, { trialStartDate: new Date() }, { merge: true }),
                // Remove any manual block or expiration status
                setDoc(settingsRef, { 
                    subscription: { status: 'free', date: null } 
                }, { merge: true })
            ]);
            
            alert("Período de teste renovado com sucesso!");
            fetchUsers();
        } catch (error) {
            console.error("Error renewing trial:", error);
            alert("Erro ao renovar teste.");
        }
    };

    const resetUser = async (uid) => {
        if (!window.confirm("Isso irá remover qualquer acesso manual. Se o usuário tiver um pagamento ativo no Stripe, ele continuará Premium. Confirmar?")) return;
        try {
            const settingsRef = doc(db, 'users', uid, 'settings', 'general');
            const userRef = doc(db, 'users', uid);
            const resetData = {
                'subscription.status': 'free',
                'subscription.type': 'monthly',
                'subscription.date': null,
                'subscription.updatedAt': new Date()
            };
            await Promise.all([
                setDoc(settingsRef, resetData, { merge: true }),
                setDoc(userRef, resetData, { merge: true }).catch(() => { })
            ]);
            alert("Status manual resetado com sucesso!");
            fetchUsers();
        } catch (error) {
            console.error("Error resetting user:", error);
            alert("Erro ao resetar: " + error.message);
        }
    };

    const adminDeleteUser = async (uid, email) => {
        if (!window.confirm(`ATENÇÃO: Deseja realmente DELETAR todos os dados de ${email}? Esta ação irá apagar transações, metas e configurações. O usuário será removido definitivamente.`)) return;
        setIsDeleting(true);
        try {
            const qT = query(collection(db, 'transactions'), where('userId', '==', uid));
            const snapT = await getDocs(qT);
            const batch = writeBatch(db);
            snapT.docs.forEach(d => batch.delete(d.ref));
            
            const qG = query(collection(db, 'goals'), where('userId', '==', uid));
            const snapG = await getDocs(qG);
            snapG.docs.forEach(d => batch.delete(d.ref));
            
            await batch.commit();

            await deleteDoc(doc(db, 'users', uid, 'settings', 'general')).catch(() => {});
            await deleteDoc(doc(db, 'users', uid, 'chat', 'history')).catch(() => {});
            await deleteDoc(doc(db, 'users', uid)).catch(() => {});
            await deleteDoc(doc(db, 'customers', uid)).catch(() => {});
            alert("Usuário e seus dados foram excluídos definitivamente do Firebase!");
            fetchUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Erro ao excluir definitivamente: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };
    
    const resetGlobalData = async () => {
        const password = window.prompt("ATENÇÃO CRÍTICA: Isso irá apagar TODAS as transações e dados de patrimônio de TODOS os usuários do sistema. Digite 'RESET_GLOBAL' para confirmar:");
        
        if (password !== 'RESET_GLOBAL') {
            alert("Operação cancelada.");
            return;
        }

        setIsResettingGlobal(true);
        try {
            const collectionsToClear = ['transactions', 'savings_jars', 'goals', 'cards'];
            let totalDeleted = 0;

            for (const collName of collectionsToClear) {
                console.log(`[Admin] Limpando coleção: ${collName}`);
                const snap = await getDocs(collection(db, collName));
                
                let batch = writeBatch(db);
                let count = 0;

                for (const d of snap.docs) {
                    batch.delete(d.ref);
                    count++;
                    totalDeleted++;

                    if (count === 499) {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    }
                }
                if (count > 0) {
                    await batch.commit();
                }
            }

            const usersSnap = await getDocs(collection(db, 'users'));
            for (const userDoc of usersSnap.docs) {
                const settingsRef = doc(db, 'users', userDoc.id, 'settings', 'general');
                await setDoc(settingsRef, {
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

            alert(`Sucesso! ${totalDeleted} registros foram removidos e as configurações de todos os usuários foram resetadas.`);
            fetchUsers();
        } catch (error) {
            console.error("Erro no reset global:", error);
            alert("Erro ao realizar reset global: " + error.message);
        } finally {
            setIsResettingGlobal(false);
        }
    };

    const [pushMessage, setPushMessage] = useState({ title: '', body: '' });
    const [isSendingPush, setIsSendingPush] = useState(false);

    const sendPushToAll = async () => {
        const subscribedUsers = users.filter(u => u.pushSubscriptions && u.pushSubscriptions.length > 0);
        if (subscribedUsers.length === 0) {
            alert("Nenhum usuário inscrito para notificações ainda.");
            return;
        }

        if (!pushMessage.title || !pushMessage.body) {
            alert("Preencha título e mensagem.");
            return;
        }

        setIsSendingPush(true);
        try {
            const response = await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: pushMessage.title,
                    body: pushMessage.body,
                    url: 'https://soualivia.com.br'
                })
            });

            const result = await response.json();

            if (result.success) {
                alert(`Sucesso! Notificação enviada para os dispositivos ativos.\nDetalhamento: ${result.message}`);
                setPushMessage({ title: '', body: '' });
            } else {
                throw new Error(result.error || 'Erro desconhecido na API');
            }
        } catch (error) {
            console.error("Error sending push:", error);
            alert("Erro ao enviar notificação: " + error.message);
        } finally {
            setIsSendingPush(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             u.uid.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = showDeleted ? u.isDeleted : !u.isDeleted;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-12 font-sans relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px] -z-10" />

            <div className="max-w-7xl mx-auto relative z-10">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                    <div>
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors group mb-4">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Painel Operacional</span>
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-emerald-500/10 shadow-2xl rounded-3xl border border-emerald-500/20">
                                <Shield className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white">Administração</h1>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Gestão de Usuários e Sistema</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-[2rem] border border-white/5 backdrop-blur-md">
                        <div className="px-6 text-center border-r border-white/10">
                            <p className="text-[9px] font-black text-slate-500 uppercase">Total</p>
                            <p className="text-xl font-black text-white">{users.length}</p>
                        </div>
                        <div className="px-6 text-center border-r border-white/10">
                            <p className="text-[9px] font-black text-emerald-500 uppercase">Premium</p>
                            <p className="text-xl font-black text-emerald-500">{users.filter(u => u.isPremium).length}</p>
                        </div>
                        <div className="px-6 text-center">
                            <p className="text-[9px] font-black text-blue-500 uppercase">Trial</p>
                            <p className="text-xl font-black text-blue-500">{users.filter(u => u.isTrial).length}</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
                    <div className="md:col-span-6 relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por e-mail ou UID..."
                            className="w-full bg-slate-900/50 border border-white/10 shadow-xl rounded-[2rem] py-5 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-lg text-slate-100 placeholder:text-slate-600 backdrop-blur-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="md:col-span-3 flex bg-slate-900/50 border border-white/10 p-2 rounded-[2rem] shadow-xl backdrop-blur-xl">
                        <button
                            onClick={() => setShowDeleted(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${!showDeleted ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            <Users className="w-4 h-4" /> Ativos
                        </button>
                        <button
                            onClick={() => setShowDeleted(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${showDeleted ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            <Trash2 className="w-4 h-4" /> Excluídos
                        </button>
                    </div>

                    <div className="md:col-span-3 flex gap-3">
                        <button
                            onClick={fetchUsers}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-900/50 hover:bg-slate-800 text-slate-300 border border-white/10 shadow-xl rounded-[2rem] transition-all active:scale-95 group backdrop-blur-xl"
                            disabled={loading}
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500 text-emerald-400`} />
                        </button>
                        <button
                            onClick={resetGlobalData}
                            disabled={isResettingGlobal}
                            className="flex-1 flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 shadow-xl rounded-[2rem] transition-all active:scale-95 backdrop-blur-xl"
                        >
                            <Trash2 className={`w-5 h-5 ${isResettingGlobal ? 'animate-pulse' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-white/10 rounded-[3rem] overflow-hidden backdrop-blur-2xl shadow-2xl relative">
                    <div className="hidden lg:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/80 border-b border-white/10">
                                    <th className="p-8 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em]">Usuário / ID</th>
                                    <th className="p-8 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em]">Status de Acesso</th>
                                    <th className="p-8 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em]">Detalhes</th>
                                    <th className="p-8 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] text-right">Ações Gerenciais</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-8"><div className="h-4 bg-slate-800 rounded-full w-48 mb-2"></div><div className="h-3 bg-slate-800 rounded-full w-32 opacity-50"></div></td>
                                            <td className="p-8"><div className="h-6 bg-slate-800 rounded-full w-24"></div></td>
                                            <td className="p-8"><div className="h-4 bg-slate-800 rounded-full w-32"></div></td>
                                            <td className="p-8"><div className="h-10 bg-slate-800 rounded-2xl w-40 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map(user => (
                                        <tr key={user.uid} className="hover:bg-white/[0.03] transition-colors group border-b border-white/10">
                                            <td className="p-8">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${user.isAdmin ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
                                                        {user.isAdmin ? <ShieldAlert className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className={`font-black text-base truncate mb-0.5 transition-colors ${user.email === 'N/A' ? 'text-slate-600 italic font-medium' : 'text-slate-100 group-hover:text-emerald-400'}`}>
                                                            {user.email === 'N/A' ? 'Sem e-mail (Legacy)' : user.email}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono select-all opacity-40">{user.uid}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                <div className="flex flex-col gap-2">
                                                    {user.isAdmin && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-black uppercase tracking-widest w-fit">ADMINISTRADOR</span>
                                                    )}
                                                    <div className="flex gap-2">
                                                        {user.isLifetime ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-400 text-[9px] font-black uppercase tracking-widest"><TrendingUp className="w-3 h-3" />VITALÍCIO</span>
                                                        ) : user.isTrial ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[9px] font-black uppercase tracking-widest"><Zap className="w-3 h-3" />TRIAL 7D</span>
                                                        ) : user.isPremium ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${user.isTolerance ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}>
                                                                <UserCheck className="w-3 h-3" />{user.isTolerance ? 'Tolerância' : user.subType === 'annual' ? 'ANUAL' : 'MENSAL'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase tracking-widest"><UserMinus className="w-3 h-3" />EXPIRADO</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><CreditCard className="w-2.5 h-2.5" /> Pagamento</p>
                                                        <p className="text-xs font-bold text-slate-300">{user.isLifetime ? 'N/A' : user.subDate}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Vencimento</p>
                                                        <p className={`text-xs font-bold ${user.isBlocked ? 'text-rose-500' : user.daysLeft <= 0 ? 'text-rose-400' : 'text-blue-400'}`}>{user.isBlocked ? 'BLOQUEADO' : user.isLifetime ? '∞' : `${user.daysLeft} dias`}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Membro desde</p>
                                                        <p className="text-xs font-bold text-slate-400">{user.createdAt}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8 text-right">
                                                <div className="flex items-center justify-end gap-3 flex-wrap max-w-[400px] ml-auto">
                                                    {!user.isDeleted ? (
                                                        <>
                                                            <button 
                                                                onClick={() => toggleAdmin(user.uid, user.isAdmin)} 
                                                                className={`px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${user.isAdmin ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-600 hover:text-white' : 'bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                                                            >
                                                                {user.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                                                            </button>
                                                            
                                                            {!user.isLifetime && (
                                                                <button onClick={() => setLifetime(user.uid)} className="px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white shadow-lg shadow-purple-500/10">Vitalício</button>
                                                            )}
                                                            
                                                            <button onClick={() => renewTrial(user.uid)} className="px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white shadow-lg shadow-emerald-500/10">Renovar Trial</button>
                                                            
                                                            <button onClick={() => togglePremium(user.uid, user.isPremium)} className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-tighter transition-all border ${user.isPremium ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white'}`}>
                                                                {user.isPremium ? 'Bloquear' : 'Ativar Acesso'}
                                                            </button>
                                                            
                                                            <div className="flex gap-2">
                                                                <button onClick={() => simulateDate(user.uid, '2026-03-01')} className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-500 hover:text-amber-400 hover:border-amber-400/30 transition-all" title="Simular 01/Mar">
                                                                    <Clock className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => resetUser(user.uid)} className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-500 hover:text-rose-400 hover:border-rose-400/30 transition-all" title="Resetar Status">
                                                                    <RefreshCw className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-6">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Excluído em</span>
                                                                <span className="text-xs text-slate-500 font-bold">{user.deletedAt ? user.deletedAt.toLocaleDateString('pt-BR') : 'Registro Legado'}</span>
                                                            </div>
                                                            <button onClick={() => adminDeleteUser(user.uid, user.email)} disabled={isDeleting} className="p-4 rounded-2xl text-rose-400 hover:bg-rose-600 hover:text-white transition-all border border-rose-500/30 bg-rose-500/10 group shadow-lg shadow-rose-500/20" title="Apagar Registro Definitivamente">
                                                                <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" className="p-20 text-center">
                                        <div className="flex flex-col items-center opacity-30">
                                            <Users className="w-16 h-16 mb-4" />
                                            <p className="font-black uppercase tracking-widest text-sm">Nenhum usuário encontrado</p>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="lg:hidden divide-y divide-white/5">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => <div key={i} className="p-8 animate-pulse"><div className="h-4 bg-slate-800 rounded-full w-48 mb-4"></div><div className="h-20 bg-slate-800 rounded-3xl w-full"></div></div>)
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <div key={user.uid} className="p-8 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${user.isAdmin ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
                                            {user.isAdmin ? <ShieldAlert className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-slate-100 truncate">{user.email === 'N/A' ? 'Sem e-mail' : user.email}</div>
                                            <div className="text-[10px] text-slate-500 font-mono truncate">{user.uid}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-6 rounded-3xl border border-white/5 shadow-inner">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                                            {user.isLifetime ? (
                                                <span className="text-purple-400 text-[10px] font-black">VITALÍCIO</span>
                                            ) : user.isPremium ? (
                                                <span className="text-emerald-500 text-[10px] font-black">PREMIUM</span>
                                            ) : (
                                                <span className="text-rose-500 text-[10px] font-black">EXPIRADO</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Vencimento</p>
                                            <p className={`text-xs font-bold ${user.isBlocked ? 'text-rose-500' : user.daysLeft <= 0 ? 'text-rose-500' : 'text-blue-400'}`}>{user.isBlocked ? 'BLOQUEADO' : user.isLifetime ? '∞' : `${user.daysLeft} dias`}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {!user.isDeleted ? (
                                            <>
                                                <button onClick={() => toggleAdmin(user.uid, user.isAdmin)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-[10px] uppercase">{user.isAdmin ? 'Remover Admin' : 'Tornar Admin'}</button>
                                                <button onClick={() => togglePremium(user.uid, user.isPremium)} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase ${user.isPremium ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>{user.isPremium ? 'Bloquear' : 'Ativar'}</button>
                                            </>
                                        ) : (
                                            <button onClick={() => adminDeleteUser(user.uid, user.email)} className="w-full py-3 rounded-xl bg-rose-600 text-white font-bold text-[10px] uppercase">Apagar Definitivamente</button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-20 text-center opacity-30">Nenhum usuário</div>
                        )}
                    </div>
                </div>

                <div className="mt-8 bg-[#0f172a] text-white p-8 rounded-3xl shadow-xl border border-slate-800">
                    <h2 className="text-xl font-black mb-6 flex items-center gap-3">
                        <Zap className="w-6 h-6 text-[#5CCEEA]" /> 
                        Notificação Push Global
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Título da Notificação (ex: Novidade na Alívia!)" 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5CCEEA]/50"
                                value={pushMessage.title}
                                onChange={(e) => setPushMessage({...pushMessage, title: e.target.value})}
                            />
                            <textarea 
                                placeholder="Mensagem (ex: Acabamos de liberar os novos relatórios realistas. Confira!)" 
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-[#5CCEEA]/50"
                                value={pushMessage.body}
                                onChange={(e) => setPushMessage({...pushMessage, body: e.target.value})}
                            />
                        </div>
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-between">
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Status da Audiência</p>
                                <div className="text-3xl font-black text-[#5CCEEA]">
                                    {users.filter(u => u.pushSubscriptions?.length > 0).length}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Usuários com notificações ativas no celular</p>
                            </div>
                            <button 
                                onClick={sendPushToAll}
                                disabled={isSendingPush}
                                className="w-full py-4 bg-gradient-to-r from-[#5CCEEA] to-[#69C8B9] text-white font-black rounded-xl shadow-lg shadow-[#5CCEEA]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSendingPush ? 'Enviando...' : 'ENVIAR NOTIFICAÇÃO AGORA'}
                            </button>
                        </div>
                    </div>
                </div>

                <footer className="mt-8 text-center">
                    <p className="text-slate-600 text-[10px]">Gestão de usuários direta integrada com o Firebase Firestore</p>
                </footer>
            </div>
        </div>
    );
}
