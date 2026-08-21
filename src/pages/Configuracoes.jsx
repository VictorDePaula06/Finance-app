import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import {
    collection, query, where, getDocs, setDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { setGeminiKey } from '../services/gemini';
import { downloadUserData } from '../utils/dataExport';
import {
    Settings, User, MessageCircle, Sparkles, Palette, ShieldCheck,
    KeyRound, ExternalLink, Check, Eye, EyeOff, Trash2, Loader2, Copy,
    Lock, Sun, Moon, Download, FileText, Mail, Link2, Unlink, AlertTriangle,
    CheckCircle2, RefreshCw, Camera, Upload, Bell, Zap, CalendarClock, FileBarChart,
} from 'lucide-react';

const KEY_STORE = 'aliviaGeminiKey';
const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
// Número do bot no WhatsApp (opcional). Defina VITE_WHATSAPP_NUMBER (só dígitos, ex.: 5521999999999).
const WA_NUMBER = import.meta.env?.VITE_WHATSAPP_NUMBER || '';
const genCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1 ambíguos
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
};
const maskPhone = (p) => {
    const d = String(p || '').replace(/\D/g, '');
    if (d.length < 4) return p;
    return `${d.slice(0, 2)} ••• ${d.slice(-4)}`;
};

// Lê um arquivo de imagem e devolve um data URL quadrado (crop central) e leve.
const fileToSquareDataUrl = (file, size = 256) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const TABS = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'ia', label: 'Inteligência Artificial', icon: Sparkles },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'dados', label: 'Dados & Privacidade', icon: ShieldCheck },
    { id: 'conta', label: 'Conta', icon: AlertTriangle },
];

export default function Configuracoes() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const [tab, setTab] = useState('perfil');

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className="max-w-4xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 mb-6">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                    <Settings className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <div>
                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Configurações</h1>
                    <p className={`text-sm mt-0.5 ${muted}`}>Sua conta, integrações e preferências do Alívia.</p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-6">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const on = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap border transition active:scale-95 ${on
                                ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/30'
                                : (isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700')}`}>
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'perfil' && <PerfilTab isDark={isDark} />}
            {tab === 'whatsapp' && <WhatsAppTab isDark={isDark} onGoTo={setTab} />}
            {tab === 'ia' && <IATab isDark={isDark} />}
            {tab === 'aparencia' && <AparenciaTab isDark={isDark} toggleTheme={toggleTheme} />}
            {tab === 'dados' && <DadosTab isDark={isDark} />}
            {tab === 'conta' && <ContaTab isDark={isDark} />}
        </div>
    );
}

// ── Bloco padrão ────────────────────────────────────────────────────
function Card({ isDark, children, className = '' }) {
    return <div className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'} ${className}`}>{children}</div>;
}
function SectionTitle({ isDark, icon: Icon, children, right }) {
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Icon className="w-4 h-4 text-emerald-500" /> {children}
            </h2>
            {right}
        </div>
    );
}
const planBadge = (planLevel) => ({
    lifetime: { label: 'Vitalício', cls: 'bg-purple-500/15 text-purple-400' },
    premium: { label: 'Premium', cls: 'bg-emerald-500/15 text-emerald-500' },
    standard: { label: 'Standard', cls: 'bg-blue-500/15 text-blue-400' },
}[planLevel] || { label: 'Gratuito', cls: 'bg-slate-500/15 text-slate-400' });

// ── Perfil ──────────────────────────────────────────────────────────
function PerfilTab({ isDark }) {
    const { currentUser, planLevel, userPrefs, saveUserPreferences } = useAuth();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const badge = planBadge(planLevel);
    const initial = (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();

    const [name, setName] = useState(currentUser?.displayName || '');
    const [savingName, setSavingName] = useState(false);
    const [nameFlash, setNameFlash] = useState('');
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    // Foto: preferimos a enviada pelo usuário (salva nas preferências); senão a do provedor.
    const fileRef = React.useRef(null);
    const [avatar, setAvatar] = useState(userPrefs?.avatarDataUrl || currentUser?.photoURL || '');
    const [photoBusy, setPhotoBusy] = useState(false);
    const [photoErr, setPhotoErr] = useState('');

    useEffect(() => { setAvatar(userPrefs?.avatarDataUrl || currentUser?.photoURL || ''); }, [userPrefs?.avatarDataUrl, currentUser?.photoURL]);

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite reenviar o mesmo arquivo
        if (!file) return;
        setPhotoErr('');
        if (!file.type.startsWith('image/')) { setPhotoErr('Escolha um arquivo de imagem.'); return; }
        if (file.size > 8 * 1024 * 1024) { setPhotoErr('Imagem muito grande (máx. 8 MB).'); return; }
        setPhotoBusy(true);
        try {
            const dataUrl = await fileToSquareDataUrl(file, 256);
            setAvatar(dataUrl);
            await saveUserPreferences({ avatarDataUrl: dataUrl });
        } catch (err) { console.error(err); setPhotoErr('Não foi possível processar a imagem.'); }
        setPhotoBusy(false);
    };
    const removePhoto = async () => {
        setPhotoErr('');
        setAvatar(currentUser?.photoURL || '');
        try { await saveUserPreferences({ avatarDataUrl: '' }); } catch (e) { console.error(e); }
    };

    const saveName = async () => {
        const n = name.trim();
        if (!n || n === currentUser?.displayName) return;
        setSavingName(true); setNameFlash('');
        try {
            await updateProfile(auth.currentUser, { displayName: n });
            setNameFlash('Nome atualizado!');
        } catch (e) { console.error(e); setNameFlash('Não foi possível salvar o nome.'); }
        setSavingName(false);
        setTimeout(() => setNameFlash(''), 2500);
    };

    const hasCustomPhoto = !!(userPrefs?.avatarDataUrl);

    return (
        <div className="space-y-4">
            {/* Identidade + foto */}
            <Card isDark={isDark}>
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        {avatar
                            ? <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                            : <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl font-black text-white">{initial}</div>}
                        <button onClick={() => fileRef.current?.click()} disabled={photoBusy} title="Alterar foto"
                            className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl flex items-center justify-center shadow-md transition active:scale-95 ${isDark ? 'bg-emerald-500 text-white' : 'bg-emerald-500 text-white'} disabled:opacity-60`}>
                            {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                    </div>
                    <div className="min-w-0">
                        <p className={`text-lg font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentUser?.displayName || 'Usuário Alívia'}</p>
                        <p className={`text-[13px] truncate ${muted}`}>{currentUser?.email}</p>
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-1.5 ${badge.cls}`}>{badge.label}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <button onClick={() => fileRef.current?.click()} disabled={photoBusy}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'} disabled:opacity-60`}>
                        <Upload className="w-4 h-4" /> {hasCustomPhoto ? 'Trocar foto' : 'Enviar foto'}
                    </button>
                    {hasCustomPhoto && (
                        <button onClick={removePhoto} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                            <Trash2 className="w-4 h-4" /> Remover
                        </button>
                    )}
                </div>
                {photoErr && <p className="text-[12px] font-bold text-rose-500 mt-2">{photoErr}</p>}
                <p className={`text-[11px] mt-2 ${muted}`}>JPG ou PNG, quadrada fica melhor. A imagem é reduzida para carregar rápido.</p>
            </Card>

            {/* Nome de exibição */}
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={User}>Nome de exibição</SectionTitle>
                <div className="flex gap-2">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado(a)" className={inputCls} maxLength={40} />
                    <button onClick={saveName} disabled={savingName || !name.trim() || name.trim() === currentUser?.displayName}
                        className="shrink-0 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-50">
                        {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
                    </button>
                </div>
                {nameFlash && <p className="text-[12px] font-bold text-emerald-500 mt-2">{nameFlash}</p>}
            </Card>

            {/* Senha */}
            <ChangePasswordCard isDark={isDark} />
        </div>
    );
}

function pwErrorMsg(code) {
    switch (code) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Senha atual incorreta.';
        case 'auth/weak-password': return 'A nova senha precisa ter ao menos 6 caracteres.';
        case 'auth/requires-recent-login': return 'Por segurança, saia e entre de novo para trocar a senha.';
        case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
        default: return 'Não foi possível alterar a senha. Tente novamente.';
    }
}

function ChangePasswordCard({ isDark }) {
    const { currentUser, changePassword } = useAuth();
    const hasPassword = (currentUser?.providerData || []).some(p => p.providerId === 'password');
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState(false);
    const [loading, setLoading] = useState(false);
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const inputCls = `w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    if (!hasPassword) return (
        <Card isDark={isDark}>
            <SectionTitle isDark={isDark} icon={Lock}>Senha</SectionTitle>
            <p className={`text-[13px] ${muted}`}>Você entra pelo Google, então não há senha para gerenciar aqui.</p>
        </Card>
    );

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!current || !next) { setError('Preencha a senha atual e a nova.'); return; }
        if (next.length < 6) { setError('A nova senha precisa ter ao menos 6 caracteres.'); return; }
        if (next !== confirm) { setError('As senhas não conferem.'); return; }
        if (next === current) { setError('A nova senha precisa ser diferente da atual.'); return; }
        setLoading(true);
        try {
            await changePassword(current, next);
            setOk(true); setCurrent(''); setNext(''); setConfirm('');
            setTimeout(() => setOk(false), 2500);
        } catch (err) { console.error('[changePassword]', err?.code, err); setError(pwErrorMsg(err?.code)); }
        setLoading(false);
    };
    const eye = (
        <button type="button" onClick={() => setShow(v => !v)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`}>
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
    );

    return (
        <Card isDark={isDark}>
            <SectionTitle isDark={isDark} icon={Lock}>Alterar senha</SectionTitle>
            {ok ? (
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm py-2"><CheckCircle2 className="w-5 h-5" /> Senha alterada com sucesso!</div>
            ) : (
                <form onSubmit={submit} className="space-y-3">
                    {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                    <div className="relative"><Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} /><input type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Senha atual" className={inputCls} />{eye}</div>
                    <div className="relative"><Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} /><input type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} placeholder="Nova senha (mín. 6)" className={inputCls} />{eye}</div>
                    <div className="relative"><Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} /><input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmar nova senha" className={inputCls} />{eye}</div>
                    <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Salvar nova senha</>}
                    </button>
                </form>
            )}
        </Card>
    );
}

// ── WhatsApp ────────────────────────────────────────────────────────
// Interruptor (linha) reutilizável.
function ToggleRow({ isDark, icon: Icon, title, desc, on, onClick, disabled }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <button type="button" onClick={onClick} disabled={disabled}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${on && !disabled ? 'bg-emerald-500/[0.08] border-emerald-500/30' : (isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200')}`}>
            {Icon && <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${on && !disabled ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}><Icon className="w-4 h-4" /></span>}
            <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
                {desc && <p className={`text-[11px] mt-0.5 ${muted}`}>{desc}</p>}
            </div>
            <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition shrink-0 ${on && !disabled ? 'bg-emerald-500 justify-end' : (isDark ? 'bg-white/15 justify-start' : 'bg-slate-300 justify-start')}`}>
                <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
        </button>
    );
}

const DEFAULT_WA_CONFIG = {
    number: '', enabled: true, allowExpenseEntry: true,
    spendingAlerts: true, billReminders: true, weeklyReport: true,
};

function WhatsAppTab({ isDark, onGoTo }) {
    const { currentUser, userPrefs, saveUserPreferences } = useAuth();
    const uid = currentUser?.uid;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const inputCls = `w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    const [loading, setLoading] = useState(true);
    const [linked, setLinked] = useState([]);   // vínculos existentes (telefones)
    const [code, setCode] = useState('');
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    // Configuração (número + notificações), persistida nas preferências.
    const [cfg, setCfg] = useState({ ...DEFAULT_WA_CONFIG, ...(userPrefs?.whatsapp || {}) });
    const [savingCfg, setSavingCfg] = useState(false);
    const [cfgFlash, setCfgFlash] = useState('');
    useEffect(() => { setCfg({ ...DEFAULT_WA_CONFIG, ...(userPrefs?.whatsapp || {}) }); }, [userPrefs?.whatsapp]);
    const setC = (patch) => setCfg(c => ({ ...c, ...patch }));

    // A IA (Gemini) é o cérebro da Alívia no WhatsApp — avisamos se ainda não há chave.
    const geminiConfigured = (() => { try { return !!localStorage.getItem(KEY_STORE); } catch { return false; } })();

    const saveCfg = async () => {
        setSavingCfg(true); setCfgFlash('');
        try {
            await saveUserPreferences({ whatsapp: { ...cfg, number: String(cfg.number || '').replace(/\D/g, '') } });
            setCfgFlash('Configurações salvas!');
        } catch (e) { console.error(e); setCfgFlash('Não foi possível salvar.'); }
        setSavingCfg(false);
        setTimeout(() => setCfgFlash(''), 2500);
    };

    const refresh = async () => {
        if (!uid) return;
        setLoading(true); setError('');
        try {
            const snap = await getDocs(query(collection(db, 'wa_users'), where('uid', '==', uid)));
            setLinked(snap.docs.map(d => ({ phone: d.id, ...d.data() })));
        } catch (e) { console.error(e); setError('Não foi possível verificar o vínculo agora.'); }
        setLoading(false);
    };
    useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [uid]);

    const gerar = async () => {
        setGenerating(true); setError(''); setCopied(false);
        try {
            const c = genCode();
            await setDoc(doc(db, 'wa_links', c), { uid, createdAt: Date.now() });
            setCode(c);
        } catch (e) { console.error(e); setError('Não foi possível gerar o código. Tente novamente.'); }
        setGenerating(false);
    };
    const copiar = () => { try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { } };
    const desvincular = async (phone) => {
        setError('');
        try { await deleteDoc(doc(db, 'wa_users', phone)); refresh(); }
        catch (e) { console.error(e); setError('Não foi possível desvincular.'); }
    };

    const waLink = WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(code || '')}` : '';

    return (
        <div className="space-y-4">
            {/* Passo 0: orientar a configurar a chave da IA */}
            <div className={`rounded-2xl border p-4 ${geminiConfigured
                ? (isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50')
                : (isDark ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-amber-300 bg-amber-50')}`}>
                <div className="flex items-start gap-2.5">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${geminiConfigured ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}><Sparkles className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-black ${geminiConfigured ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                            {geminiConfigured ? 'Inteligência Artificial ativa' : 'Ative a Inteligência Artificial primeiro'}
                        </p>
                        <p className={`text-[12px] mt-1 leading-relaxed ${cell}`}>
                            A Alívia entende suas mensagens no WhatsApp usando o <b>Google Gemini</b>. {geminiConfigured
                                ? 'Sua chave já está configurada — é só conectar seu número abaixo.'
                                : 'Sem a chave da IA, ela não consegue conversar nem registrar gastos por mensagem. Configure em Inteligência Artificial.'}
                        </p>
                        {!geminiConfigured && (
                            <button onClick={() => onGoTo?.('ia')}
                                className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold transition active:scale-95">
                                <KeyRound className="w-3.5 h-3.5" /> Configurar chave da IA
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={MessageCircle}
                    right={<span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${linked.length ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>{linked.length ? 'Conectado' : 'Não conectado'}</span>}>
                    Conectar WhatsApp
                </SectionTitle>
                <p className={`text-[13px] ${cell}`}>
                    Vincule seu número para conversar com a <b>Alívia</b> pelo WhatsApp e registrar gastos por mensagem (ex.: “mercado 120”).
                    Gere um código, envie para a Alívia no WhatsApp e pronto.
                </p>

                {/* Seu número de WhatsApp */}
                <div className="mt-4">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Seu número de WhatsApp</span>
                    <div className="relative">
                        <MessageCircle className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                        <input inputMode="tel" value={cfg.number}
                            onChange={e => setC({ number: e.target.value.replace(/[^\d\s()+-]/g, '') })}
                            placeholder="Ex.: +55 21 99999-9999" className={inputCls} />
                    </div>
                    <p className={`text-[11px] mt-1.5 ${muted}`}>Com DDD (e país). Usamos para reconhecer você e enviar as notificações que escolher.</p>
                </div>

                {loading ? (
                    <div className={`flex items-center gap-2 mt-4 text-[13px] ${muted}`}><Loader2 className="w-4 h-4 animate-spin" /> Verificando vínculo…</div>
                ) : linked.length > 0 ? (
                    <div className="mt-4 space-y-2">
                        {linked.map(l => (
                            <div key={l.phone} className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50'}`}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><Link2 className="w-4 h-4" /></span>
                                    <div className="min-w-0">
                                        <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>WhatsApp vinculado</p>
                                        <p className={`text-[12px] ${muted}`}>+{maskPhone(l.phone)}</p>
                                    </div>
                                </div>
                                <DisconnectBtn isDark={isDark} onConfirm={() => desvincular(l.phone)} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-4">
                        {!code ? (
                            <button onClick={gerar} disabled={generating}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition active:scale-95 disabled:opacity-60">
                                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Gerar código de vínculo
                            </button>
                        ) : (
                            <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                                <p className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>Seu código</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-2xl font-black tracking-[0.3em] tabular-nums text-emerald-500">{code}</span>
                                    <button onClick={copiar} className={`ml-1 p-2 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                                    </button>
                                </div>
                                <ol className={`mt-3 space-y-1.5 text-[12px] ${cell}`}>
                                    <li>1. Abra a conversa da Alívia no WhatsApp.</li>
                                    <li>2. Envie o código <span className="font-black text-emerald-500">{code}</span> como mensagem.</li>
                                    <li>3. Pronto — seu número fica vinculado à sua conta.</li>
                                </ol>
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    {waLink && (
                                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition active:scale-95">
                                            <MessageCircle className="w-4 h-4" /> Abrir no WhatsApp <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                                        </a>
                                    )}
                                    <button onClick={gerar} disabled={generating} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <RefreshCw className="w-4 h-4" /> Gerar outro
                                    </button>
                                    <button onClick={refresh} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <Check className="w-4 h-4" /> Já vinculei
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && <p className="text-[12px] font-bold text-rose-500 mt-3">{error}</p>}
            </Card>

            {/* Notificações e o que enviar */}
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={Bell}>Notificações no WhatsApp</SectionTitle>
                <div className="space-y-2.5">
                    <ToggleRow isDark={isDark} icon={Bell} title="Ativar notificações"
                        desc="Receber mensagens da Alívia no seu WhatsApp."
                        on={cfg.enabled} onClick={() => setC({ enabled: !cfg.enabled })} />

                    <div className="space-y-2.5 pl-1">
                        <ToggleRow isDark={isDark} icon={Zap} title="Alertas de gasto"
                            desc="Avisos de gasto alto ou saldo perto do negativo."
                            on={cfg.spendingAlerts} disabled={!cfg.enabled} onClick={() => setC({ spendingAlerts: !cfg.spendingAlerts })} />
                        <ToggleRow isDark={isDark} icon={CalendarClock} title="Lembretes de contas"
                            desc="Aviso quando uma conta ou fatura está perto de vencer."
                            on={cfg.billReminders} disabled={!cfg.enabled} onClick={() => setC({ billReminders: !cfg.billReminders })} />
                        <ToggleRow isDark={isDark} icon={FileBarChart} title="Relatório semanal"
                            desc="Um fechamento com o resumo da semana."
                            on={cfg.weeklyReport} disabled={!cfg.enabled} onClick={() => setC({ weeklyReport: !cfg.weeklyReport })} />
                    </div>

                    <div className={`h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />

                    <ToggleRow isDark={isDark} icon={MessageCircle} title="Registrar gastos por mensagem"
                        desc="Permitir lançar despesas escrevendo pra Alívia (ex.: “uber 23”). Ela sempre pede confirmação."
                        on={cfg.allowExpenseEntry} onClick={() => setC({ allowExpenseEntry: !cfg.allowExpenseEntry })} />
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <button onClick={saveCfg} disabled={savingCfg}
                        className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-60">
                        {savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar configurações
                    </button>
                    {cfgFlash && <span className="text-[12px] font-bold text-emerald-500">{cfgFlash}</span>}
                </div>
            </Card>

            <div className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 text-[12px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                O código é de uso único e expira quando usado. Antes de lançar qualquer gasto, a Alívia sempre pede sua confirmação no WhatsApp.
            </div>
        </div>
    );
}

function DisconnectBtn({ isDark, onConfirm }) {
    const [confirm, setConfirm] = useState(false);
    if (confirm) return (
        <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setConfirm(false)} className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${isDark ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>Cancelar</button>
            <button onClick={onConfirm} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-rose-500 text-white">Desvincular</button>
        </div>
    );
    return <button onClick={() => setConfirm(true)} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-rose-500 hover:bg-rose-500/10 transition"><Unlink className="w-3.5 h-3.5" /> Desvincular</button>;
}

// ── Inteligência Artificial (Gemini) ────────────────────────────────
function IATab({ isDark }) {
    const [key, setKey] = useState(() => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } });
    const [saved, setSaved] = useState(() => { try { return !!localStorage.getItem(KEY_STORE); } catch { return false; } });
    const [show, setShow] = useState(false);
    const [flash, setFlash] = useState('');
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const inputCls = `w-full pl-10 pr-12 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    useEffect(() => { try { const k = localStorage.getItem(KEY_STORE); if (k) setGeminiKey(k); } catch { } }, []);

    const save = () => {
        const k = key.trim();
        try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch { }
        setGeminiKey(k || null); setSaved(!!k);
        setFlash(k ? 'Chave salva! A IA generativa está ativa na Consultoria Alívia.' : 'Chave removida.');
        setTimeout(() => setFlash(''), 2500);
    };
    const remove = () => { setKey(''); try { localStorage.removeItem(KEY_STORE); } catch { } setGeminiKey(null); setSaved(false); setFlash('Chave removida.'); setTimeout(() => setFlash(''), 2500); };

    return (
        <Card isDark={isDark}>
            <SectionTitle isDark={isDark} icon={Sparkles}
                right={<span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${saved ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>{saved ? 'Ativa' : 'Não configurada'}</span>}>
                Inteligência Artificial (Gemini)
            </SectionTitle>
            <p className={`text-[13px] ${cell}`}>
                Com uma chave de API do Google Gemini, a <b>Consultoria Alívia</b> conversa de forma aberta (IA generativa) e ajuda a lançar seus dados. É <b>gratuita</b> e leva 1 minuto pra gerar.
            </p>

            <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-[13px] font-bold transition active:scale-95 shadow-md shadow-blue-500/30">
                <KeyRound className="w-4 h-4" /> Gerar chave no Google AI Studio <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <div className="mt-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Sua chave de API</span>
                <div className="relative">
                    <KeyRound className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                    <input type={show ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} placeholder="AIza…" className={inputCls} autoComplete="off" spellCheck={false} />
                    <button type="button" onClick={() => setShow(s => !s)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={save} disabled={!key.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Salvar chave
                </button>
                {saved && (
                    <button onClick={remove} className={`px-3 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <Trash2 className="w-4 h-4" /> Remover
                    </button>
                )}
                {flash && <span className="text-[12px] font-bold text-emerald-500">{flash}</span>}
            </div>

            <div className={`mt-4 rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 text-[12px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                Sua chave fica no seu dispositivo e é usada só para falar com o Gemini. Você pode remover quando quiser.
            </div>
        </Card>
    );
}

// ── Aparência ───────────────────────────────────────────────────────
function AparenciaTab({ isDark, toggleTheme }) {
    return (
        <Card isDark={isDark}>
            <SectionTitle isDark={isDark} icon={Palette}>Aparência</SectionTitle>
            <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Tema {isDark ? 'escuro' : 'claro'}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">Alterne entre claro e escuro conforme sua preferência.</p>
                </div>
                <button onClick={toggleTheme}
                    className={`p-3 rounded-xl border transition active:scale-95 ${isDark ? 'bg-slate-800 border-white/10 text-amber-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </Card>
    );
}

// ── Dados & Privacidade (LGPD) ──────────────────────────────────────
function DadosTab({ isDark }) {
    const { currentUser } = useAuth();
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';

    const exportar = async () => {
        setExporting(true); setError('');
        try { await downloadUserData(currentUser); }
        catch (e) { setError(e?.message || 'Erro ao exportar dados.'); }
        setExporting(false);
    };

    const btn = `w-full px-4 py-3 rounded-xl text-[13px] font-bold transition flex items-center justify-center gap-2 border active:scale-95 ${isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`;

    return (
        <div className="space-y-4">
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={ShieldCheck}>Seus direitos (LGPD)</SectionTitle>
                <p className={`text-[13px] mb-4 ${cell}`}>
                    Você pode acessar, exportar e excluir seus dados a qualquer momento (Lei 13.709/2018, art. 18).
                </p>
                <button onClick={exportar} disabled={exporting} className={btn + ' disabled:opacity-60 mb-2'}>
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exporting ? 'Preparando arquivo…' : 'Baixar meus dados (JSON)'}
                </button>
                {error && <p className="text-[12px] text-rose-500 mb-2">{error}</p>}
                <button onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'privacy' }))} className={btn + ' mb-2'}>
                    <FileText className="w-4 h-4" /> Ver política de privacidade
                </button>
                <a href="mailto:dpo.alivia@gmail.com?subject=LGPD%20-%20Solicita%C3%A7%C3%A3o%20de%20Titular" className={btn}>
                    <Mail className="w-4 h-4" /> Falar com o DPO
                </a>
            </Card>
        </div>
    );
}

// ── Conta (zona de perigo) ──────────────────────────────────────────
function ContaTab({ isDark }) {
    const { deleteAccount } = useAuth();
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';

    return (
        <Card isDark={isDark} className={isDark ? '!border-rose-500/20' : '!border-rose-200'}>
            <SectionTitle isDark={isDark} icon={AlertTriangle}>Zona de perigo</SectionTitle>
            <p className={`text-[13px] mb-4 ${cell}`}>
                Apagar a conta é <b>irreversível</b>. Todas as suas transações, cartões, metas e dados serão removidos permanentemente.
            </p>
            {!confirm ? (
                <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 text-[13px] font-bold hover:bg-rose-500 hover:text-white hover:border-rose-500 transition active:scale-95">
                    <Trash2 className="w-4 h-4" /> Apagar minha conta
                </button>
            ) : (
                <div className={`rounded-xl border p-4 ${isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
                    <p className="text-[13px] font-bold text-rose-500 mb-3">Tem certeza absoluta? Isso apaga tudo e não pode ser desfeito.</p>
                    {error && <p className="text-[12px] text-rose-400 mb-3">{error}</p>}
                    <div className="flex gap-2">
                        <button onClick={async () => {
                            setDeleting(true); setError('');
                            try { await deleteAccount(); }
                            catch { setError('Erro ao apagar. Saia e entre de novo, depois tente outra vez.'); setDeleting(false); }
                        }} disabled={deleting} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[13px] font-bold hover:bg-rose-600 transition disabled:opacity-60">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {deleting ? 'Apagando…' : 'Sim, apagar tudo'}
                        </button>
                        <button onClick={() => { setConfirm(false); setError(''); }} className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border transition ${isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                    </div>
                </div>
            )}
        </Card>
    );
}
