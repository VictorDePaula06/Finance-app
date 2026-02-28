import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, query, getDoc, collectionGroup } from 'firebase/firestore';
import { ArrowLeft, UserCheck, UserMinus, Shield, Search, RefreshCw, TrendingUp } from 'lucide-react';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collectionGroup(db, 'settings'));
            const userList = [];

            for (const document of querySnapshot.docs) {
                if (document.id === 'general') {
                    const settingsData = document.data();
                    const pathParts = document.ref.path.split('/');
                    const uid = pathParts[1];

                    // Check top-level user doc (synced by extension)
                    const userRef = doc(db, 'users', uid);
                    const userSnap = await getDoc(userRef);
                    const userData = userSnap.exists() ? userSnap.data() : {};

                    // Check Stripe Customer Doc
                    const customerRef = doc(db, 'customers', uid);
                    const customerSnap = await getDoc(customerRef);
                    const customerData = customerSnap.exists() ? customerSnap.data() : {};

                    // Check Subscriptions Subcollection
                    const subsRef = collection(db, 'customers', uid, 'subscriptions');
                    const subsSnap = await getDocs(subsRef);
                    const hasActiveSubscription = subsSnap.docs.some(d =>
                        ['active', 'trialing'].includes(d.data().status)
                    );

                    const stripeSubData = subsSnap.docs[0]?.data();
                    const subStatus = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing')
                        ? 'active'
                        : (settingsData.subscription?.status || userData.subscription?.status || (stripeSubData?.status || 'free'));

                    const isPremium = (subStatus === 'active' || subStatus === 'lifetime') || hasActiveSubscription;

                    // Subscription Detail Logic
                    const subDateRaw = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing')
                        ? stripeSubData?.current_period_start
                        : (settingsData.subscription?.date || userData.subscription?.date || stripeSubData?.current_period_start);

                    const subDate = subDateRaw?.toDate ? subDateRaw.toDate() : (subDateRaw ? new Date(subDateRaw) : null);

                    const subType = (stripeSubData?.status === 'active' || stripeSubData?.status === 'trialing')
                        ? (stripeSubData?.items?.[0]?.plan?.nickname?.toLowerCase().includes('anual') ? 'annual' : 'monthly')
                        : (settingsData.subscription?.type || (stripeSubData?.items?.[0]?.plan?.nickname?.toLowerCase().includes('anual') ? 'annual' : 'monthly'));

                    let daysLeft = 0;
                    let isExpired = subStatus === 'expired';
                    let tolerance = false;
                    let isLifetime = subStatus === 'lifetime';

                    if (subStatus === 'active' && subDate) {
                        const now = new Date();
                        const cycle = subType === 'annual' ? 365 : 30;
                        const diff = Math.floor((now - subDate) / (1000 * 60 * 60 * 24));

                        if (diff <= cycle) {
                            daysLeft = cycle - diff;
                        } else if (diff <= cycle + 5) {
                            daysLeft = (cycle + 5) - diff;
                            tolerance = true;
                        } else {
                            daysLeft = 0;
                            isExpired = true;
                        }
                    } else if (isLifetime) {
                        daysLeft = 9999; // Representing unlimited
                    }

                    userList.push({
                        uid,
                        email: settingsData.email || userData.email || customerData.email || 'N/A',
                        isPremium: (isPremium || isLifetime) && !isExpired,
                        subType,
                        subDate: subDate ? subDate.toLocaleDateString('pt-BR') : 'N/A',
                        daysLeft,
                        isExpired,
                        isTolerance: tolerance,
                        isLifetime,
                        lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate().toLocaleDateString() || 'N/A'
                    });
                }
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
            await updateDoc(userRef, {
                subscription: {
                    status: currentStatus ? 'expired' : 'active',
                    type: 'monthly',
                    date: new Date(),
                    updatedAt: new Date()
                }
            });

            fetchUsers();
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Erro ao atualizar status do usuário: " + error.message);
        }
    };

    const setLifetime = async (uid) => {
        try {
            const userRef = doc(db, 'users', uid, 'settings', 'general');
            await updateDoc(userRef, {
                subscription: {
                    status: 'lifetime',
                    type: 'lifetime',
                    updatedAt: new Date()
                }
            });
            fetchUsers();
        } catch (error) {
            console.error("Error setting lifetime:", error);
            alert("Erro ao definir acesso vitalício.");
        }
    };

    const simulateExpiration = async (uid) => {
        try {
            const userRef = doc(db, 'users', uid, 'settings', 'general');
            const fortyDaysAgo = new Date();
            fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

            await updateDoc(userRef, {
                'subscription.date': fortyDaysAgo,
                'subscription.status': 'active',
                'subscription.updatedAt': new Date()
            });
            fetchUsers();
        } catch (error) {
            console.error("Error simulating expiration:", error);
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
                updateDoc(settingsRef, resetData),
                updateDoc(userRef, resetData).catch(() => { }) // Ignora se root doc não tiver o campo
            ]);

            alert("Status manual resetado com sucesso!");
            fetchUsers();
        } catch (error) {
            console.error("Error resetting user:", error);
            alert("Erro ao resetar: " + error.message);
        }
    };


    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group w-fit"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Voltar ao Dashboard</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Shield className="w-6 h-6 text-blue-400" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter">Painel Admin</h1>
                    </div>
                </header>

                {/* Search & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por e-mail ou UID..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-base md:text-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl py-4 md:py-0 transition-all"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        <span className="font-bold">Atualizar Lista</span>
                    </button>
                </div>

                {/* Users List */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 border-b border-slate-800">
                                    <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">E-mail / UID</th>
                                    <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">Plano</th>
                                    <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">Pagamento</th>
                                    <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">Vencimento</th>
                                    <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-48"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-16"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                            <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                            <td className="p-6"><div className="h-8 bg-slate-800 rounded w-32 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map(user => (
                                        <tr key={user.uid} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-6 text-sm">
                                                <div className={`font-bold mb-1 transition-colors ${user.email === 'N/A' ? 'text-slate-500 italic' : 'text-white group-hover:text-blue-400'}`}>
                                                    {user.email === 'N/A' ? 'Sem e-mail (Legacy)' : user.email}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono select-all opacity-50">
                                                    {user.uid}
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                {user.isLifetime ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase transition-opacity">
                                                        <TrendingUp className="w-3 h-3 text-purple-400" />
                                                        VITALÍCIO
                                                    </span>
                                                ) : user.isPremium ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase ${user.isTolerance
                                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                            <UserCheck className="w-3 h-3" />
                                                            {user.isTolerance ? 'Tolerância' : user.subType === 'annual' ? 'ANUAL' : 'MENSAL'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-500 text-[10px] font-bold uppercase transition-opacity">
                                                        <UserMinus className="w-3 h-3" />
                                                        FREE / TESTE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-sm text-slate-400">
                                                {user.isLifetime ? 'N/A' : user.subDate}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${user.isLifetime ? 'text-purple-400' : user.daysLeft <= 0 ? 'text-rose-400' : user.daysLeft <= 5 ? 'text-amber-400' : 'text-blue-400'}`}>
                                                        {user.isLifetime ? '∞' : user.daysLeft <= 0 ? (user.isExpired ? 'BLOQUEADO' : 'EXPIRADO') : `${user.daysLeft} dias`}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">{user.isLifetime ? 'Duração Infinta' : user.daysLeft <= 0 ? 'Acesso Revogado' : 'restantes'}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!user.isLifetime && (
                                                        <button
                                                            onClick={() => setLifetime(user.uid)}
                                                            className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-purple-500/20 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white"
                                                        >
                                                            Tornar Vitalício
                                                        </button>
                                                    )}
                                                    {user.isPremium && !user.isExpired && !user.isLifetime && (
                                                        <button
                                                            onClick={() => simulateExpiration(user.uid)}
                                                            className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                                                            title="Simular 40 dias de uso"
                                                        >
                                                            Simular
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => resetUser(user.uid)}
                                                        className="px-3 py-2 rounded-xl font-bold text-[10px] transition-all border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                                                        title="Limpar assinatura manual"
                                                    >
                                                        Resetar
                                                    </button>
                                                    <button
                                                        onClick={() => togglePremium(user.uid, user.isPremium)}
                                                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${user.isPremium
                                                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
                                                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                                            }`}
                                                    >
                                                        {user.isPremium ? 'Bloquear' : 'Ativar'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-slate-500">Nenhum usuário encontrado</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-slate-800">
                        {loading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="p-6 animate-pulse">
                                    <div className="h-4 bg-slate-800 rounded w-48 mb-4"></div>
                                    <div className="h-4 bg-slate-800 rounded w-24 mb-4"></div>
                                    <div className="h-8 bg-slate-800 rounded w-full"></div>
                                </div>
                            ))
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                                <div key={user.uid} className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="font-bold text-white truncate mb-0.5">
                                                {user.email === 'N/A' ? 'Sem e-mail' : user.email}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono truncate">
                                                {user.uid}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {user.isLifetime ? (
                                                <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold">VITALÍCIO</span>
                                            ) : user.isPremium ? (
                                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${user.isTolerance ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                    {user.isTolerance ? 'Tolerância' : user.subType === 'annual' ? 'ANUAL' : 'MENSAL'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 text-[10px] font-bold">FREE</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-slate-800/20 p-4 rounded-2xl border border-white/5">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Pagamento</p>
                                            <p className="text-xs text-slate-300">{user.isLifetime ? 'N/A' : user.subDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Vencimento</p>
                                            <p className={`text-xs font-bold ${user.isLifetime ? 'text-purple-400' : user.daysLeft <= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                                                {user.isLifetime ? '∞' : user.daysLeft <= 0 ? (user.isExpired ? 'BLOQUEADO' : 'EXPIRADO') : `${user.daysLeft} dias`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {!user.isLifetime && (
                                            <button onClick={() => setLifetime(user.uid)} className="flex-1 px-3 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[10px] font-bold">Vitalício</button>
                                        )}
                                        <button onClick={() => resetUser(user.uid)} className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-[10px] font-bold">Resetar</button>
                                        <button
                                            onClick={() => togglePremium(user.uid, user.isPremium)}
                                            className={`w-full py-3 rounded-xl font-bold text-xs border ${user.isPremium ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}
                                        >
                                            {user.isPremium ? 'Bloquear Acesso' : 'Ativar Premium'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-slate-500">Nenhum usuário encontrado</div>
                        )}
                    </div>
                </div>

                <footer className="mt-8 text-center">
                    <p className="text-slate-600 text-[10px]">
                        Gestão de usuários direta integrada com o Firebase Firestore
                    </p>
                </footer>
            </div>
        </div>
    );
}
