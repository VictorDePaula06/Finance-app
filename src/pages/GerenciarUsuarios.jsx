import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, getDocs, getDoc, doc, writeBatch } from 'firebase/firestore';
import { isAdminEmail } from '../constants/admins';
import {
    Users, Search, ShieldCheck, Crown, Gift, Sparkles, Loader2, X, Check,
    RefreshCw, Save, Lock,
} from 'lucide-react';

// Só este e-mail vê e usa a tela (além do gate no botão).
const OWNER_EMAIL = 'felipe.lopestecnologia11@gmail.com';

// Os 4 grupos do app.
const GROUPS = [
    { id: 'free', label: 'Gratuito', icon: Gift, color: '#94a3b8', desc: 'Plano gratuito (com limites)' },
    { id: 'pro', label: 'Pro', icon: Sparkles, color: '#10b981', desc: 'Acesso completo (pago/concedido)' },
    { id: 'lifetime', label: 'Vitalício', icon: Crown, color: '#a855f7', desc: 'Pro permanente, sem cobrança' },
    { id: 'dev', label: 'Dev', icon: ShieldCheck, color: '#f59e0b', desc: 'Administrador — acesso total + painel' },
];
const groupMeta = (id) => GROUPS.find(g => g.id === id) || GROUPS[0];

export default function GerenciarUsuarios() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const allowed = (currentUser?.email || '').toLowerCase() === OWNER_EMAIL;

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('all'); // all | free | pro | lifetime | dev
    const [editing, setEditing] = useState(null); // user sendo editado
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const mounted = useRef(true);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const card = isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white';

    // Descobre o grupo atual de um usuário a partir dos dados do Firestore.
    const groupOf = (u) => {
        if (u.isAdmin) return 'dev';
        if (u.manualStatus === 'lifetime') return 'lifetime';
        if (u.stripeActive || u.manualStatus === 'pro') return 'pro';
        return 'free';
    };

    const fetchUsers = async () => {
        setLoading(true); setError('');
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const rows = await Promise.all(usersSnap.docs.map(async (d) => {
                const uid = d.id;
                const userData = d.data() || {};
                const [settingsSnap, subsSnap] = await Promise.all([
                    getDoc(doc(db, 'users', uid, 'settings', 'general')),
                    getDocs(collection(db, 'customers', uid, 'subscriptions')),
                ]);
                const settings = settingsSnap.exists() ? settingsSnap.data() : {};
                const activeSub = subsSnap.docs.find(s => ['active', 'trialing'].includes(s.data().status));
                const email = (settings.email || userData.email || '').toLowerCase();
                return {
                    uid,
                    email: email || '(sem e-mail)',
                    isAdmin: userData.isAdmin === true || isAdminEmail(email),
                    manualStatus: settings.subscription?.status || userData.subscription?.status || null,
                    stripeActive: !!activeSub,
                    createdAt: userData.createdAt || null,
                    isDeleted: userData.status === 'deleted',
                };
            }));
            if (mounted.current) setUsers(rows.filter(r => !r.isDeleted));
        } catch (e) {
            console.error('[gerenciar-usuarios] erro:', e);
            if (mounted.current) setError('Não foi possível carregar os usuários. Confirme que seu e-mail está como admin nas regras do Firestore (isAdmin) e que elas foram publicadas.');
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    useEffect(() => {
        mounted.current = true;
        if (allowed) fetchUsers(); else setLoading(false);
        return () => { mounted.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowed]);

    const withGroup = useMemo(() => users.map(u => ({ ...u, group: groupOf(u) })), [users]);

    const counts = useMemo(() => {
        const c = { free: 0, pro: 0, lifetime: 0, dev: 0 };
        withGroup.forEach(u => { c[u.group] = (c[u.group] || 0) + 1; });
        return c;
    }, [withGroup]);

    const list = useMemo(() => {
        const q = search.trim().toLowerCase();
        return withGroup
            .filter(u => tab === 'all' || u.group === tab)
            .filter(u => !q || u.email.includes(q))
            .sort((a, b) => a.email.localeCompare(b.email));
    }, [withGroup, tab, search]);

    // Aplica o grupo escolhido, gravando o que o AuthContext entende.
    const applyGroup = async (u, groupId) => {
        setSaving(true);
        try {
            const userRef = doc(db, 'users', u.uid);
            const settingsRef = doc(db, 'users', u.uid, 'settings', 'general');
            const status = groupId === 'lifetime' ? 'lifetime'
                : groupId === 'pro' ? 'pro'
                    : groupId === 'dev' ? 'lifetime'   // dev = acesso total
                        : 'free';
            const isAdmin = groupId === 'dev';
            const batch = writeBatch(db);
            batch.set(userRef, { isAdmin, subscription: { status, updatedAt: new Date() } }, { merge: true });
            batch.set(settingsRef, { subscription: { status, updatedAt: new Date() } }, { merge: true });
            await batch.commit();
            setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, isAdmin, manualStatus: status } : x));
            setToast(`${u.email} agora é ${groupMeta(groupId).label}.`);
            setTimeout(() => mounted.current && setToast(''), 2500);
            setEditing(null);
        } catch (e) {
            console.error(e);
            setToast('Erro ao salvar. Verifique permissões de admin.');
            setTimeout(() => mounted.current && setToast(''), 3000);
        } finally {
            if (mounted.current) setSaving(false);
        }
    };

    if (!allowed) {
        return (
            <div className="max-w-md mx-auto w-full py-20 text-center">
                <span className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><Lock className="w-6 h-6" /></span>
                <h1 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Acesso restrito</h1>
                <p className={`text-sm mt-1 ${muted}`}>Esta área é exclusiva do administrador.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto w-full">
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl shadow-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[13px] font-bold flex items-center gap-2 backdrop-blur">
                    <Check className="w-4 h-4" /> {toast}
                </div>
            )}

            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                <div className="flex items-center gap-4">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-600/15 ring-1 ring-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(245,158,11,0.18)]">
                        <Users className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div>
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Gerenciar usuários</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Veja e altere o plano de cada usuário.</p>
                    </div>
                </div>
                <button onClick={fetchUsers} disabled={loading}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
            </div>

            {/* Cards de contagem por grupo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {GROUPS.map(g => {
                    const Icon = g.icon;
                    return (
                        <button key={g.id} onClick={() => setTab(tab === g.id ? 'all' : g.id)}
                            className={`rounded-2xl border p-4 text-left transition ${tab === g.id ? 'ring-2 ring-offset-2 ' + (isDark ? 'ring-offset-[#0e0f12]' : 'ring-offset-slate-50') : ''} ${card}`}
                            style={tab === g.id ? { borderColor: g.color, '--tw-ring-color': g.color } : undefined}>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${g.color}22`, color: g.color }}><Icon className="w-4 h-4" /></span>
                            <p className="text-2xl font-black tabular-nums mt-2" style={{ color: g.color }}>{counts[g.id] || 0}</p>
                            <p className={`text-[12px] ${muted}`}>{g.label}</p>
                        </button>
                    );
                })}
            </div>

            {/* Busca + filtro ativo */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por e-mail…"
                        className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`} />
                </div>
                {tab !== 'all' && (
                    <button onClick={() => setTab('all')} className={`px-3 py-2 rounded-xl text-[12px] font-bold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                        Filtro: {groupMeta(tab).label} ✕
                    </button>
                )}
                <span className={`text-[12px] ${muted}`}>{list.length} usuário{list.length === 1 ? '' : 's'}</span>
            </div>

            {/* Lista */}
            <div className={`rounded-2xl border overflow-hidden ${card}`}>
                {loading ? (
                    <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando usuários…</div>
                ) : error ? (
                    <div className="py-12 px-6 text-center">
                        <p className="text-sm font-bold text-rose-400">{error}</p>
                    </div>
                ) : list.length === 0 ? (
                    <div className="py-14 text-center">
                        <Users className={`w-8 h-8 mx-auto mb-2 ${muted}`} />
                        <p className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nenhum usuário aqui</p>
                    </div>
                ) : (
                    <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {list.map(u => {
                            const g = groupMeta(u.group);
                            const Icon = g.icon;
                            return (
                                <div key={u.uid} className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${g.color}1f`, color: g.color }}><Icon className="w-4 h-4" /></span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{u.email}</p>
                                        <p className={`text-[11px] ${muted}`}>
                                            {u.stripeActive ? 'Assinatura ativa no Stripe' : u.manualStatus === 'pro' ? 'Pro concedido manualmente' : u.manualStatus === 'lifetime' ? 'Vitalício' : u.isAdmin ? 'Administrador' : 'Gratuito'}
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-md shrink-0" style={{ background: `${g.color}1f`, color: g.color }}>{g.label}</span>
                                    <button onClick={() => setEditing(u)} className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border transition shrink-0 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Alterar</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <p className={`text-[12px] mt-4 flex items-start gap-2 ${muted}`}>
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                Alterar aqui não cancela cobrança no Stripe. Se o usuário tem assinatura paga ativa e você rebaixa, a sincronização do Stripe pode reverter — cancele no painel do Stripe primeiro.
            </p>

            {/* Modal de alteração de grupo */}
            {editing && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && setEditing(null)} />
                    <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Alterar plano</h2>
                            <button onClick={() => !saving && setEditing(null)} className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                        </div>
                        <p className={`text-[13px] mb-4 truncate ${muted}`}>{editing.email}</p>
                        <div className="space-y-2">
                            {GROUPS.map(g => {
                                const Icon = g.icon;
                                const on = groupOf(editing) === g.id;
                                return (
                                    <button key={g.id} disabled={saving} onClick={() => applyGroup(editing, g.id)}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border-2 text-left transition active:scale-[0.99] disabled:opacity-60 ${on ? '' : (isDark ? 'border-white/10 hover:border-white/20' : 'border-slate-200 hover:border-slate-300')}`}
                                        style={on ? { borderColor: g.color, background: `${g.color}12` } : undefined}>
                                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${g.color}1f`, color: g.color }}><Icon className="w-4 h-4" /></span>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{g.label}</p>
                                            <p className={`text-[11px] ${muted}`}>{g.desc}</p>
                                        </div>
                                        {on ? <Check className="w-4 h-4 shrink-0" style={{ color: g.color }} /> : <span className={`text-[11px] font-bold ${muted}`}>definir</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {saving && <p className="text-[12px] text-center mt-4 text-emerald-500 font-bold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
