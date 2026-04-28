import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, setDoc, query, getDoc, collectionGroup, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { ArrowLeft, UserCheck, UserMinus, Shield, Search, RefreshCw, TrendingUp, Zap, Trash2, Filter } from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
            // Chamada para a nossa Vercel Function (API)
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
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] -z-10" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors group w-fit">
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-bold uppercase tracking-tight">Voltar ao Dashboard</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-slate-900/50 shadow-xl rounded-2xl border border-white/5">
                            <Shield className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white">Painel Admin</h1>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por e-mail ou UID..."
                            className="w-full bg-slate-900/50 border border-white/5 shadow-xl rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-base md:text-lg text-slate-100 placeholder:text-slate-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-slate-900/50 border border-white/5 p-1 rounded-2xl shadow-xl">
                        <button
                            onClick={() => setShowDeleted(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${!showDeleted ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            Ativos
                        </button>
                        <button
                            onClick={() => setShowDeleted(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${showDeleted ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 hover:bg-white/5'}`}
                        >
                            Excluídos
                        </button>
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center justify-center gap-2 bg-slate-900/50 hover:bg-slate-800 text-slate-300 border border-white/5 shadow-xl rounded-2xl py-4 md:py-0 transition-all active:scale-95"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''} text-emerald-400`} />
                        <span className="font-bold">Atualizar Lista</span>
                    </button>
                </div>

                <div className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-800/50 border-b border-white/5">
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider">E-mail / UID</th>
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider">Plano</th>
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider">Pagamento</th>
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider">Cadastro</th>
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider">Vencimento</th>
                                    <th className="p-6 text-slate-500 font-medium uppercase text-xs tracking-wider text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-48"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                            <td className="p-6"><div className="h-8 bg-slate-800 rounded w-32 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map(user => (
                                        <tr key={user.uid} className="hover:bg-white/5 transition-colors group border-b border-white/5">
                                            <td className="p-6 text-sm">
                                                <div className={`font-bold mb-1 transition-colors ${user.email === 'N/A' ? 'text-slate-600 italic font-medium' : 'text-slate-100 group-hover:text-emerald-400'}`}>
                                                    {user.email === 'N/A' ? 'Sem e-mail (Legacy)' : user.email}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono select-all opacity-50">{user.uid}</div>
                                                {user.stripeEmail && user.stripeEmail !== 'N/A' && user.stripeEmail !== user.email && (
                                                    <div className="text-[10px] text-emerald-500/70 font-medium mt-1 select-all">Pagamento: {user.stripeEmail}</div>
                                                )}
                                            </td>
                                            <td className="p-6">
                                                {user.isLifetime ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase"><TrendingUp className="w-3 h-3" />VITALÍCIO</span>
                                                ) : user.isTrial ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase"><Zap className="w-3 h-3" />7 DIAS GRÁTIS</span>
                                                ) : user.isPremium ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase ${user.isTolerance ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                        <UserCheck className="w-3 h-3" />{user.isTolerance ? 'Tolerância' : user.subType === 'annual' ? 'ANUAL' : 'MENSAL'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase"><UserMinus className="w-3 h-3" />EXPIRADO</span>
                                                )}
                                            </td>
                                            <td className="p-6 text-sm text-slate-400">{user.isLifetime ? 'N/A' : user.subDate}</td>
                                            <td className="p-6 text-sm text-slate-400">{user.createdAt}</td>
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${user.isBlocked ? 'text-rose-600' : user.isLifetime ? 'text-purple-400' : user.daysLeft <= 0 ? 'text-rose-400' : 'text-blue-400'}`}>{user.isBlocked ? 'BLOQUEADO' : user.isLifetime ? '∞' : `${user.daysLeft} dias`}</span>
                                                    <span className="text-[10px] text-slate-500">{user.isBlocked ? 'Acesso Revogado' : user.isLifetime ? 'Duração Infinta' : 'restantes'}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!user.isDeleted ? (
                                                        <>
                                                            {!user.isLifetime && (
                                                                <button onClick={() => setLifetime(user.uid)} className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-purple-500/20 bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white">Vitalício</button>
                                                            )}
                                                            <button onClick={() => simulateDate(user.uid, '2026-03-01')} className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-600 hover:text-white">Simular 01/Mar</button>
                                                            <button onClick={() => renewTrial(user.uid)} className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-600 hover:text-white">Renovar Trial</button>
                                                            <button onClick={() => resetUser(user.uid)} className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200">Resetar</button>
                                                            <button onClick={() => togglePremium(user.uid, user.isPremium)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${user.isPremium ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white'}`}>
                                                                {user.isPremium ? 'Bloquear' : 'Ativar'}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Excluído em</span>
                                                                <span className="text-xs text-slate-500 font-medium">{user.deletedAt ? user.deletedAt.toLocaleDateString('pt-BR') : 'Registro Legado'}</span>
                                                            </div>
                                                            <button onClick={() => adminDeleteUser(user.uid, user.email)} disabled={isDeleting} className="p-2 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 bg-rose-500/5 group" title="Apagar Registro Definitivamente">
                                                                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="6" className="p-12 text-center text-slate-500">Nenhum usuário encontrado</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden divide-y divide-slate-100">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => <div key={i} className="p-6 animate-pulse"><div className="h-4 bg-slate-100 rounded w-48 mb-4"></div><div className="h-4 bg-slate-100 rounded w-full"></div></div>)
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <div key={user.uid} className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="font-bold text-slate-800 truncate mb-0.5">{user.email === 'N/A' ? 'Sem e-mail' : user.email}</div>
                                            <div className="text-[10px] text-slate-600 font-mono truncate">{user.uid}</div>
                                        </div>
                                        <div className="shrink-0">
                                            {user.isLifetime ? (
                                                <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold">VITALÍCIO</span>
                                            ) : user.isPremium ? (
                                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${user.isTolerance ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>{user.subType === 'annual' ? 'ANUAL' : 'MENSAL'}</span>
                                            ) : (
                                                <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold">EXPIRADO</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Pagamento</p>
                                            <p className="text-xs text-slate-400">{user.isLifetime ? 'N/A' : user.subDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Vencimento</p>
                                            <p className={`text-xs font-bold ${user.isBlocked ? 'text-rose-500' : user.daysLeft <= 0 ? 'text-rose-500' : 'text-blue-400'}`}>{user.isBlocked ? 'BLOQUEADO' : user.isLifetime ? '∞' : `${user.daysLeft} dias`}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {!user.isDeleted ? (
                                            <>
                                                {!user.isLifetime && (
                                                    <button onClick={() => setLifetime(user.uid)} className="flex-1 px-3 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[10px] font-bold">Vitalício</button>
                                                )}
                                                <button onClick={() => resetUser(user.uid)} className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold hover:bg-slate-200">Resetar</button>
                                                <button onClick={() => togglePremium(user.uid, user.isPremium)} className={`w-full py-3 rounded-xl font-bold text-xs border transition-all ${user.isPremium ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'}`}>
                                                    {user.isPremium ? 'Bloquear Acesso' : 'Ativar Premium'}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="w-full flex flex-col gap-2">
                                                <div className="w-full p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-center">
                                                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Conta Excluída</p>
                                                    <p className="text-xs text-slate-500">Em {user.deletedAt ? user.deletedAt.toLocaleDateString('pt-BR') : 'Registro Legado'}</p>
                                                </div>
                                                <button onClick={() => adminDeleteUser(user.uid, user.email)} className="w-full py-3 rounded-xl font-bold text-xs border border-rose-500/20 bg-rose-500/5 text-rose-400 flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white transition-all">
                                                    <Trash2 className="w-4 h-4" />Apagar Registro Definitivamente
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-slate-500">Nenhum usuário encontrado</div>
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
