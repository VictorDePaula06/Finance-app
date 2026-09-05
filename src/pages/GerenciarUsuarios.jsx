import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db, auth } from '../services/firebase';
import { collection, getDocs, getDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { isAdminEmail } from '../constants/admins';
import {
    Users, Search, ShieldCheck, Crown, Gift, Sparkles, Loader2, X, Check,
    RefreshCw, Save, Lock, Clock, Bell, Send, Wrench, KeyRound, Eye, EyeOff,
    ExternalLink, Trash2, MessageCircle,
} from 'lucide-react';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
const maskKey = (k) => !k ? '' : (k.length <= 8 ? '••••' : `${k.slice(0, 4)}••••••••${k.slice(-4)}`);

// Timestamp Firestore/segundos/ms/ISO → ms.
const toMs = (d) => {
    if (!d) return null;
    if (typeof d === 'number') return d < 1e11 ? d * 1000 : d;
    if (d.seconds != null) return d.seconds * 1000;
    if (typeof d.toMillis === 'function') return d.toMillis();
    const t = new Date(d).getTime();
    return Number.isFinite(t) ? t : null;
};

// Os 4 grupos do app.
const GROUPS = [
    { id: 'free', label: 'Gratuito', icon: Gift, color: '#94a3b8', desc: 'Plano gratuito (com limites)' },
    { id: 'pro', label: 'Pro', icon: Sparkles, color: '#10b981', desc: 'Acesso completo — automático via Stripe (não editável)' },
    { id: 'lifetime', label: 'Vitalício', icon: Crown, color: '#a855f7', desc: 'Pro permanente, sem cobrança' },
    { id: 'dev', label: 'Dev', icon: ShieldCheck, color: '#f59e0b', desc: 'Administrador — acesso total + painel' },
];
const groupMeta = (id) => GROUPS.find(g => g.id === id) || GROUPS[0];

export default function GerenciarUsuarios() {
    const { currentUser, isAdmin } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    // Libera para QUALQUER dev (e-mail admin OU flag users/{uid}.isAdmin === true).
    const allowed = isAdmin;

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('all'); // all | free | pro | lifetime | dev
    const [topTab, setTopTab] = useState('api'); // api (chave global) | usuarios
    const [editing, setEditing] = useState(null); // user sendo editado
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const [notif, setNotif] = useState({ title: '', body: '' });
    const [sending, setSending] = useState(false);
    const mounted = useRef(true);

    const flash = (msg) => { setToast(msg); setTimeout(() => mounted.current && setToast(''), 2800); };

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const card = isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white';

    // Descobre o grupo atual de um usuário a partir dos dados do Firestore.
    const groupOf = (u) => {
        if (u.isAdmin) return 'dev';
        if (u.manualStatus === 'lifetime') return 'lifetime';
        if (u.stripeActive) return 'pro';   // Pro = SOMENTE assinatura paga no Stripe
        return 'free';
    };

    // Validade do Pro: Stripe → dias até current_period_end; Pro manual → sem prazo.
    const expiryInfo = (u) => {
        if (u.stripeActive && u.periodEnd) {
            const days = Math.max(0, Math.ceil((u.periodEnd - Date.now()) / 86400000));
            const d = new Date(u.periodEnd).toLocaleDateString('pt-BR');
            return { text: `${u.cancelAtEnd ? 'cancela' : 'expira'} em ${days}d · ${d}`, warn: days <= 5 };
        }
        return { text: 'sem prazo (manual)', warn: false };
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
                const subData = activeSub?.data();
                const email = (settings.email || userData.email || '').toLowerCase();
                return {
                    uid,
                    email: email || '(sem e-mail)',
                    isAdmin: userData.isAdmin === true || isAdminEmail(email),
                    manualStatus: settings.subscription?.status || userData.subscription?.status || null,
                    stripeActive: !!activeSub,
                    periodEnd: toMs(subData?.current_period_end),
                    cancelAtEnd: subData?.cancel_at_period_end === true,
                    pushSubscriptions: Array.isArray(userData.pushSubscriptions) ? userData.pushSubscriptions : [],
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
        // Pro NÃO é atribuível manualmente — só existe via pagamento no Stripe.
        if (groupId === 'pro') {
            setToast('O plano Pro é automático (pago no Stripe) — não pode ser atribuído manualmente.');
            setTimeout(() => mounted.current && setToast(''), 3200);
            return;
        }
        setSaving(true);
        try {
            const userRef = doc(db, 'users', u.uid);
            const settingsRef = doc(db, 'users', u.uid, 'settings', 'general');
            const status = groupId === 'lifetime' ? 'lifetime'
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

    // Total de dispositivos (push subscriptions) entre todos os usuários.
    const totalDevices = useMemo(() => users.reduce((a, u) => a + (u.pushSubscriptions?.length || 0), 0), [users]);

    // Envia uma notificação push para TODOS os dispositivos cadastrados.
    const sendGlobal = async () => {
        if (!notif.title.trim() || !notif.body.trim()) { flash('Preencha título e mensagem.'); return; }
        const subs = users.flatMap(u => u.pushSubscriptions || []);
        if (subs.length === 0) { flash('Nenhum dispositivo cadastrado para receber.'); return; }
        setSending(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) { flash('Sessão expirada. Faça login de novo.'); return; }
            const res = await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ subscriptions: subs, title: notif.title.trim(), body: notif.body.trim() }),
            });
            if (res.ok) { flash(`Notificação enviada para ${subs.length} dispositivo(s).`); setNotif({ title: '', body: '' }); }
            else { const d = await res.json().catch(() => ({})); flash(d.error || 'Erro no servidor de push.'); }
        } catch (e) {
            console.error(e); flash('Erro ao enviar a notificação.');
        } finally {
            if (mounted.current) setSending(false);
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
                        <Wrench className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div>
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Configurações de dev</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Chave de API global da Alívia e gestão de usuários.</p>
                    </div>
                </div>
                {topTab === 'usuarios' && (
                    <button onClick={fetchUsers} disabled={loading}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                )}
            </div>

            {/* Abas do painel: Chave de API (WhatsApp) · Usuários */}
            <div className={`inline-flex items-center gap-1 p-1 rounded-2xl border mb-5 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-100/70 border-slate-200'}`}>
                {[{ id: 'api', label: 'Chave de API (WhatsApp)', icon: KeyRound }, { id: 'usuarios', label: 'Usuários', icon: Users }].map(t => {
                    const on = topTab === t.id; const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setTopTab(t.id)}
                            className={`inline-flex items-center gap-2 px-3.5 h-9 rounded-xl text-[13px] font-bold transition ${on ? 'bg-amber-500 text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800')}`}>
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {topTab === 'api' && <ApiKeyPanel isDark={isDark} card={card} muted={muted} adminEmail={currentUser?.email} />}

            {topTab === 'usuarios' && (<>
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
                                            {u.stripeActive ? 'Assinatura ativa no Stripe' : u.manualStatus === 'lifetime' ? 'Vitalício' : u.isAdmin ? 'Administrador' : 'Gratuito'}
                                        </p>
                                    </div>
                                    {u.group === 'pro' && (() => {
                                        const exp = expiryInfo(u);
                                        return (
                                            <span className={`hidden sm:flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md shrink-0 ${exp.warn ? 'bg-rose-500/12 text-rose-400' : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                                <Clock className="w-3 h-3" /> {exp.text}
                                            </span>
                                        );
                                    })()}
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

            {/* ── Notificação global ── */}
            <div className={`mt-8 rounded-2xl border p-5 ${card}`}>
                <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-9 h-9 rounded-xl bg-blue-500/12 text-blue-400 flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></span>
                    <div>
                        <h2 className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Notificação global</h2>
                        <p className={`text-[12px] ${muted}`}>Envia um push para todos os dispositivos cadastrados · {totalDevices} dispositivo{totalDevices === 1 ? '' : 's'}</p>
                    </div>
                </div>
                <div className="grid gap-2.5 mt-4">
                    <input value={notif.title} onChange={e => setNotif(n => ({ ...n, title: e.target.value }))} maxLength={60}
                        placeholder="Título (ex.: Novidade no Alívia!)"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-400'}`} />
                    <textarea value={notif.body} onChange={e => setNotif(n => ({ ...n, body: e.target.value }))} maxLength={160} rows={3}
                        placeholder="Mensagem…"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition resize-none ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-blue-400' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-400'}`} />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className={`text-[11px] ${muted}`}>Chega como notificação no dispositivo (push).</span>
                        <button onClick={sendGlobal} disabled={sending || !notif.title.trim() || !notif.body.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition active:scale-95 disabled:opacity-50">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sending ? 'Enviando…' : 'Enviar para todos'}
                        </button>
                    </div>
                </div>
            </div>

            </>)}

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
                            {/* Selecionáveis: Gratuito, Vitalício, Dev. Pro NÃO entra aqui. */}
                            {GROUPS.filter(g => g.id !== 'pro').map(g => {
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

                            {/* Pro é READ-ONLY: só existe com pagamento no Stripe. */}
                            {(() => {
                                const isPro = groupOf(editing) === 'pro';
                                return (
                                    <div className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border-2 border-dashed ${isPro ? '' : (isDark ? 'border-white/10' : 'border-slate-200')}`}
                                        style={isPro ? { borderColor: '#10b981', background: '#10b98112' } : undefined}
                                        title="O Pro é automático via Stripe — não pode ser atribuído manualmente.">
                                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#10b9811f', color: '#10b981' }}><Sparkles className="w-4 h-4" /></span>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Pro</p>
                                            <p className={`text-[11px] ${muted}`}>Automático pelo Stripe — não editável aqui. {isPro ? 'Assinatura ativa.' : 'Ativa só com pagamento.'}</p>
                                        </div>
                                        {isPro ? <Check className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} /> : <Lock className={`w-4 h-4 shrink-0 ${muted}`} />}
                                    </div>
                                );
                            })()}
                        </div>
                        {saving && <p className="text-[12px] text-center mt-4 text-emerald-500 font-bold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Chave de API global do WhatsApp (Gemini) — uma só, do app, com faturamento.
// Todos os usuários usam esta chave; ninguém configura a própria. Guardada em
// admin_configs/whatsapp (só o dev lê/grava; o webhook lê via Admin SDK no servidor).
function ApiKeyPanel({ isDark, card, muted, adminEmail }) {
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState('');       // chave atualmente salva (para máscara)
    const [key, setKey] = useState('');           // valor do input
    const [editing, setEditing] = useState(false);
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState('');
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const inputCls = `w-full pl-10 pr-12 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-amber-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500'}`;

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'admin_configs', 'whatsapp'));
                const k = (snap.exists() && typeof snap.data().geminiKey === 'string') ? snap.data().geminiKey.trim() : '';
                if (alive) { setSaved(k); setKey(k); }
            } catch (e) { console.error('[admin_configs/whatsapp read]', e); }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, []);

    const persist = async (val) => {
        setBusy(true); setFlash('');
        try {
            await setDoc(doc(db, 'admin_configs', 'whatsapp'),
                { geminiKey: val || '', updatedAt: Date.now(), updatedByEmail: adminEmail || '' }, { merge: true });
            setSaved(val || ''); setEditing(false); setShow(false);
            setFlash(val ? 'Chave salva! A Alívia já responde a todos com esta chave.' : 'Chave removida.');
            setTimeout(() => setFlash(''), 3000);
        } catch (e) { console.error('[admin_configs/whatsapp write]', e); setFlash('Não foi possível salvar (verifique permissões de admin).'); }
        finally { setBusy(false); }
    };

    if (loading) {
        return <div className={`rounded-2xl border ${card} py-16 flex items-center justify-center gap-2 text-sm text-slate-400`}><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>;
    }

    return (
        <div className={`rounded-2xl border p-5 sm:p-6 ${card}`}>
            <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0"><MessageCircle className="w-6 h-6" strokeWidth={2.2} /></span>
                <div className="min-w-0 flex-1">
                    <h2 className={`text-[15px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Chave de API do WhatsApp (Gemini)</h2>
                    <p className={`text-[12px] mt-0.5 ${muted}`}>Uma única chave do app (com faturamento) que responde a <b>todos</b> os usuários.</p>
                </div>
                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${saved ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>{saved ? 'Ativa' : 'Não configurada'}</span>
            </div>

            {saved && !editing ? (
                <>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Chave global</span>
                    <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50'}`}>
                        <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><KeyRound className="w-4 h-4" /></span>
                        <span className={`text-sm font-semibold tracking-wider flex-1 truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{maskKey(saved)}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 shrink-0"><Check className="w-3.5 h-3.5" /> Salva</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => { setKey(saved); setShow(false); setEditing(true); }} disabled={busy}
                            className={`px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition border ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                            <RefreshCw className="w-4 h-4" /> Alterar chave
                        </button>
                        <button onClick={() => persist('')} disabled={busy}
                            className="px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition border border-rose-500/25 text-rose-500 hover:bg-rose-500/10 disabled:opacity-60">
                            <Trash2 className="w-4 h-4" /> Remover
                        </button>
                        {flash && <span className="text-[12px] font-bold text-emerald-500">{flash}</span>}
                    </div>
                </>
            ) : (
                <>
                    {!saved && (
                        <>
                            <p className={`text-[13px] ${cell}`}>Cole a chave do <b>Google Gemini</b> com faturamento ativo. Ela vale para <b>todos</b> os usuários no WhatsApp — ninguém precisa configurar chave própria.</p>
                            <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-[13px] font-bold transition active:scale-95 shadow-md shadow-blue-500/30">
                                <KeyRound className="w-4 h-4" /> Abrir Google AI Studio <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </a>
                        </>
                    )}
                    <div className={saved ? '' : 'mt-4'}>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{editing ? 'Nova chave global' : 'Chave global'}</span>
                        <div className="relative">
                            <KeyRound className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                            <input type={show ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} placeholder="AIza…" className={inputCls} autoComplete="off" spellCheck={false} autoFocus={editing} />
                            <button type="button" onClick={() => setShow(s => !s)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
                                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => persist(key.trim())} disabled={busy || !key.trim()}
                            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-50">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {busy ? 'Salvando…' : 'Salvar chave'}
                        </button>
                        {editing && (
                            <button onClick={() => { setEditing(false); setShow(false); setKey(saved); }} disabled={busy}
                                className={`px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
                        )}
                        {flash && <span className="text-[12px] font-bold text-emerald-500">{flash}</span>}
                    </div>
                </>
            )}

            <div className={`mt-4 rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 text-[12px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                A chave fica em <b>admin_configs/whatsapp</b> (só o dev acessa) e é lida pelo servidor da Alívia. Como alternativa, dá pra definir a variável <b>GEMINI_API_KEY</b> na Vercel — a chave daqui tem prioridade.
            </div>
        </div>
    );
}
