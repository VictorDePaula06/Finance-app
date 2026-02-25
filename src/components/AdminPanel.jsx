import React, { useEffect, useState } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, query, getDoc, collectionGroup } from 'firebase/firestore';
import { ArrowLeft, UserCheck, UserMinus, Shield, Search, RefreshCw } from 'lucide-react';

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

                    const isPremium =
                        settingsData.subscription?.status === 'active' ||
                        userData.subscription?.status === 'active' ||
                        customerData.subscription?.status === 'active' ||
                        hasActiveSubscription;

                    userList.push({
                        uid,
                        email: settingsData.email || userData.email || customerData.email || 'N/A',
                        isPremium: isPremium,
                        lastSync: (settingsData.subscription?.updatedAt || userData.subscription?.updatedAt)?.toDate().toLocaleDateString() || 'N/A'
                    });
                }
            }
            setUsers(userList.filter((v, i, a) => a.findIndex(t => (t.uid === v.uid)) === i)); // Remove duplicates if any
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
                    status: currentStatus ? 'expired' : 'active',
                    updatedAt: new Date()
                }
            }, { merge: true });

            // Update local state
            setUsers(users.map(u => u.uid === uid ? { ...u, isPremium: !currentStatus } : u));
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Erro ao atualizar status do usuário: " + error.message);
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
                <header className="flex items-center justify-between mb-12">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Voltar ao Dashboard
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Shield className="w-6 h-6 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter">Painel Admin</h1>
                    </div>
                </header>

                {/* Search & Stats */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por e-mail ou UID..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl transition-all"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar Lista
                    </button>
                </div>

                {/* Users Table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-800">
                                <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">E-mail / UID</th>
                                <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider">Status</th>
                                <th className="p-6 text-slate-400 font-medium uppercase text-xs tracking-wider text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-6"><div className="h-4 bg-slate-800 rounded w-48"></div></td>
                                        <td className="p-6"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                                        <td className="p-6"><div className="h-8 bg-slate-800 rounded w-32 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <tr key={user.uid} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-6">
                                            <div className={`font-bold mb-1 transition-colors ${user.email === 'N/A' ? 'text-slate-500 italic' : 'text-white group-hover:text-blue-400'}`}>
                                                {user.email === 'N/A' ? 'Sem e-mail (Legacy)' : user.email}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono select-all">
                                                {user.uid}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {user.isPremium ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                                    <UserCheck className="w-3 h-3" />
                                                    PREMIUM (Ativo)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-500 text-xs font-bold">
                                                    <UserMinus className="w-3 h-3" />
                                                    FREE / TESTE
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-6 text-right">
                                            <button
                                                onClick={() => togglePremium(user.uid, user.isPremium)}
                                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${user.isPremium
                                                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
                                                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                                    }`}
                                            >
                                                {user.isPremium ? 'Remover Premium' : 'Ativar Premium'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="p-12 text-center text-slate-500">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="mt-8 text-center text-slate-600 text-sm">
                    Gestão de usuários direta integrada com o Firebase Firestore.
                </p>
            </div>
        </div>
    );
}
