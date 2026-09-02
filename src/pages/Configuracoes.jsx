import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import {
    setDoc, deleteDoc, doc, getDoc,
} from 'firebase/firestore';
import { setGeminiKey } from '../services/gemini';
import { downloadUserData } from '../utils/dataExport';
import { toast } from '../components/ui/Toaster';
import Skeleton from '../components/ui/Skeleton';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import aliviaWppHero from '../assets/alivia/alivia-whatsapp-hero.png';
import {
    Settings, User, MessageCircle, Sparkles, Palette, ShieldCheck,
    KeyRound, ExternalLink, Check, Eye, EyeOff, Trash2, Loader2, Copy,
    Lock, Sun, Moon, Download, FileText, Mail, Link2, Unlink, AlertTriangle,
    CheckCircle2, RefreshCw, Camera, Upload, Bell, Zap, CalendarClock, FileBarChart, Wallet, Pencil,
} from 'lucide-react';

const KEY_STORE = 'aliviaGeminiKey';
const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
// Número do bot no WhatsApp. Prioriza VITE_WHATSAPP_NUMBER; senão usa o número
// oficial da Alívia (só dígitos, com país+DDD) — assim o "abrir WhatsApp" funciona.
const WA_NUMBER = import.meta.env?.VITE_WHATSAPP_NUMBER || '5521973052618';
// Mensagem padrão que a pessoa envia pra Alívia (contém o código de vínculo).
const waLinkMessage = (code) => `Oi Alívia! 💚 Quero vincular meu WhatsApp à minha conta do Alívia. Meu código de vínculo é: ${code}`;
const waLinkUrl = (code) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waLinkMessage(code))}`;
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
// Mostra só os últimos caracteres da chave (read-only).
const maskKey = (k) => {
    const s = String(k || '');
    if (s.length <= 6) return '••••••';
    return `${'•'.repeat(Math.min(20, s.length - 4))} ${s.slice(-4)}`;
};

// Lê um arquivo de imagem e devolve um data URL redimensionado (preserva o
// enquadramento — a posição/zoom é escolhida depois pelo usuário) e leve.
const fileToDataUrl = (file, max = 512) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

// WhatsApp tem tela PRÓPRIA (/app/whatsapp) — não fica dentro de Configurações.
const TABS = [
    { id: 'perfil', label: 'Meu Perfil', icon: User },
    { id: 'conta', label: 'Conta', icon: ShieldCheck },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'dados', label: 'Dados & Privacidade', icon: FileText },
];

export default function Configuracoes() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const [searchParams] = useSearchParams();
    const paramTab = searchParams.get('tab');
    const validTab = (id) => TABS.some(t => t.id === id);
    const [tab, setTab] = useState(validTab(paramTab) ? paramTab : 'perfil');
    // Deep-link: abrir direto numa aba (ex.: CTA de WhatsApp na sidebar → ?tab=whatsapp).
    useEffect(() => { if (validTab(paramTab)) setTab(paramTab); }, [paramTab]);

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

            {/* Abas — segmented control */}
            <div role="tablist" aria-label="Seções das configurações"
                className={`flex items-center gap-1 overflow-x-auto no-scrollbar p-1 mb-6 rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-100/70'}`}>
                {TABS.map(t => {
                    const Icon = t.icon;
                    const on = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={on}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.97] ${on
                                ? (isDark ? 'bg-emerald-500/15 text-emerald-400 shadow-sm ring-1 ring-emerald-500/25' : 'bg-white text-emerald-600 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/15')
                                : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]' : 'text-slate-500 hover:text-slate-800 hover:bg-white/70')}`}>
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'perfil' && <PerfilTab isDark={isDark} />}
            {tab === 'aparencia' && <AparenciaTab isDark={isDark} toggleTheme={toggleTheme} />}
            {tab === 'dados' && <DadosTab isDark={isDark} />}
            {tab === 'conta' && <ContaTab isDark={isDark} />}
        </div>
    );
}

// ── Bloco padrão ────────────────────────────────────────────────────
function Card({ isDark, children, className = '' }) {
    return <div className={`rounded-2xl border p-5 sm:p-6 transition-shadow duration-300 ${isDark ? 'border-white/10 bg-white/[0.02] hover:border-white/[0.14]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_34px_-16px_rgba(15,23,42,0.18)]'} ${className}`}>{children}</div>;
}
function SectionTitle({ isDark, icon: Icon, children, right }) {
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                {children}
            </h2>
            {right}
        </div>
    );
}
// Selo de status reutilizável (com "dot") — visual profissional e consistente.
const BADGE_TONES = {
    emerald: { wrap: 'bg-emerald-500/12 text-emerald-500 ring-emerald-500/20', dot: 'bg-emerald-500' },
    amber: { wrap: 'bg-amber-500/12 text-amber-600 ring-amber-500/25', dot: 'bg-amber-500' },
    slate: { wrap: 'bg-slate-500/12 text-slate-400 ring-slate-500/20', dot: 'bg-slate-400' },
    purple: { wrap: 'bg-purple-500/12 text-purple-400 ring-purple-500/20', dot: 'bg-purple-400' },
    blue: { wrap: 'bg-blue-500/12 text-blue-400 ring-blue-500/20', dot: 'bg-blue-400' },
    rose: { wrap: 'bg-rose-500/12 text-rose-500 ring-rose-500/20', dot: 'bg-rose-500' },
};
function Badge({ tone = 'slate', children, dot = true }) {
    const t = BADGE_TONES[tone] || BADGE_TONES.slate;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ring-1 ${t.wrap}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}{children}
        </span>
    );
}
const planBadge = (planLevel) => ({
    lifetime: { label: 'Vitalício', tone: 'purple' },
    premium: { label: 'Premium', tone: 'emerald' },
    standard: { label: 'Standard', tone: 'blue' },
}[planLevel] || { label: 'Gratuito', tone: 'slate' });

// Estilo do avatar aplicando posição/zoom escolhidos pelo usuário.
const avatarStyle = (pos) => ({ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${pos?.x ?? 50}% ${pos?.y ?? 50}%`, transform: `scale(${pos?.zoom ?? 1})`, transformOrigin: 'center' });

// ── Perfil ──────────────────────────────────────────────────────────
function PerfilTab({ isDark }) {
    const { currentUser, planLevel, userPrefs, saveUserPreferences, refreshUser } = useAuth();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const badge = planBadge(planLevel);
    const initial = (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();

    const [name, setName] = useState(currentUser?.displayName || '');
    const [savingName, setSavingName] = useState(false);
    const [nameFlash, setNameFlash] = useState('');
    const [editingName, setEditingName] = useState(false);
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    useEffect(() => { setName(currentUser?.displayName || ''); }, [currentUser?.displayName]);

    const fileRef = React.useRef(null);
    const [photoErr, setPhotoErr] = useState('');
    const [editor, setEditor] = useState(null); // { src } quando editando o enquadramento

    const avatar = userPrefs?.avatarDataUrl || currentUser?.photoURL || '';
    const avatarPos = userPrefs?.avatarPos || { x: 50, y: 50, zoom: 1 };
    const hasCustomPhoto = !!(userPrefs?.avatarDataUrl);

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setPhotoErr('');
        if (!file.type.startsWith('image/')) { setPhotoErr('Escolha um arquivo de imagem.'); return; }
        if (file.size > 8 * 1024 * 1024) { setPhotoErr('Imagem muito grande (máx. 8 MB).'); return; }
        try {
            const dataUrl = await fileToDataUrl(file, 512);
            setEditor({ src: dataUrl }); // abre o editor de enquadramento
        } catch (err) { console.error(err); setPhotoErr('Não foi possível processar a imagem.'); }
    };
    const savePhoto = async (src, pos) => {
        try { await saveUserPreferences({ avatarDataUrl: src, avatarPos: pos }); } catch (e) { console.error(e); }
        setEditor(null);
    };
    const removePhoto = async () => { setPhotoErr(''); try { await saveUserPreferences({ avatarDataUrl: '', avatarPos: null }); } catch (e) { console.error(e); } };

    const saveName = async () => {
        const n = name.trim();
        if (!n || n === currentUser?.displayName) return;
        setSavingName(true); setNameFlash('');
        try {
            await updateProfile(auth.currentUser, { displayName: n });
            await refreshUser?.(); // atualiza o nome na sidebar/telas na hora
            setEditingName(false);
            setNameFlash('Nome atualizado!'); toast.success('Nome atualizado!');
        } catch (e) { console.error(e); setNameFlash('Não foi possível salvar o nome.'); toast.error('Não foi possível salvar o nome.'); }
        setSavingName(false);
        setTimeout(() => setNameFlash(''), 2500);
    };
    const cancelName = () => { setEditingName(false); setName(currentUser?.displayName || ''); };

    return (
        <div className="space-y-4">
            {editor && <PhotoEditor isDark={isDark} src={editor.src} initial={avatarPos} onCancel={() => setEditor(null)} onSave={(pos) => savePhoto(editor.src, pos)} />}

            {/* Identidade + foto */}
            <Card isDark={isDark}>
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden">
                            {avatar
                                ? <img src={avatar} alt="" style={avatarStyle(avatarPos)} />
                                : <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl font-black text-white">{initial}</div>}
                        </div>
                        <button onClick={() => fileRef.current?.click()} title="Alterar foto"
                            className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl flex items-center justify-center shadow-md transition active:scale-95 bg-emerald-500 text-white">
                            <Camera className="w-3.5 h-3.5" />
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                    </div>
                    <div className="min-w-0">
                        <p className={`text-lg font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentUser?.displayName || 'Usuário Alívia'}</p>
                        <p className={`text-[13px] truncate ${muted}`}>{currentUser?.email}</p>
                        <span className="inline-block mt-1.5"><Badge tone={badge.tone} dot={false}>{badge.label}</Badge></span>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <button onClick={() => fileRef.current?.click()}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        <Upload className="w-4 h-4" /> {hasCustomPhoto ? 'Trocar foto' : 'Enviar foto'}
                    </button>
                    {hasCustomPhoto && (
                        <>
                            <button onClick={() => setEditor({ src: avatar })} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <Camera className="w-4 h-4" /> Ajustar posição
                            </button>
                            <button onClick={removePhoto} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                                <Trash2 className="w-4 h-4" /> Remover
                            </button>
                        </>
                    )}
                </div>
                {photoErr && <p className="text-[12px] font-bold text-rose-500 mt-2">{photoErr}</p>}
                <p className={`text-[11px] mt-2 ${muted}`}>Ao enviar, você escolhe o enquadramento (arraste e use o zoom) pra não cortar errado.</p>
            </Card>

            {/* Nome de exibição */}
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={User}
                    right={currentUser?.displayName ? <Badge tone="emerald">Definido</Badge> : <Badge tone="amber">Pendente</Badge>}>
                    Nome de exibição
                </SectionTitle>

                {currentUser?.displayName && !editingName ? (
                    /* ── Estado DEFINIDO (read-only) ── */
                    <div className={`animate-in fade-in duration-200 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Como te chamamos</p>
                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentUser.displayName}</p>
                        </div>
                        <button onClick={() => setEditingName(true)}
                            className={`shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-[0.97] border ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                            <Pencil className="w-4 h-4" /> Editar
                        </button>
                    </div>
                ) : (
                    /* ── Estado EDIÇÃO ── */
                    <div className="animate-in fade-in duration-200">
                        <div className="flex gap-2">
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado(a)" className={inputCls} maxLength={40} autoFocus={editingName} />
                            <button onClick={saveName} disabled={savingName || !name.trim() || name.trim() === currentUser?.displayName}
                                className="shrink-0 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-50">
                                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {currentUser?.displayName && (
                                <button onClick={cancelName} className={`px-3.5 py-2 rounded-xl text-[13px] font-bold transition active:scale-[0.97] ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    Cancelar
                                </button>
                            )}
                            {nameFlash && <span className="text-[12px] font-bold text-emerald-500 animate-in fade-in slide-in-from-left-1">{nameFlash}</span>}
                        </div>
                    </div>
                )}
            </Card>

            {/* Senha */}
            <ChangePasswordCard isDark={isDark} />
        </div>
    );
}

// Editor de enquadramento da foto: arrastar para posicionar + zoom.
function PhotoEditor({ isDark, src, initial, onCancel, onSave }) {
    const [x, setX] = useState(initial?.x ?? 50);
    const [y, setY] = useState(initial?.y ?? 50);
    const [zoom, setZoom] = useState(initial?.zoom ?? 1);
    const drag = React.useRef(null);
    const SIZE = 240;

    const onDown = (e) => { drag.current = { px: e.clientX, py: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId); };
    const onMove = (e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.px, dy = e.clientY - drag.current.py;
        drag.current = { px: e.clientX, py: e.clientY };
        const k = 100 / (SIZE * zoom);
        setX(v => Math.max(0, Math.min(100, v - dx * k)));
        setY(v => Math.max(0, Math.min(100, v - dy * k)));
    };
    const onUp = () => { drag.current = null; };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            <div className={`relative w-full max-w-sm rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <h2 className={`text-lg font-black mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Ajustar foto</h2>
                <p className={`text-[12px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Arraste a imagem e use o zoom para escolher o que aparece.</p>
                <div className="flex justify-center">
                    <div className="rounded-full overflow-hidden border-2 border-emerald-400 touch-none cursor-grab active:cursor-grabbing"
                        style={{ width: SIZE, height: SIZE }}
                        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                        <img src={src} alt="" draggable={false} style={avatarStyle({ x, y, zoom })} />
                    </div>
                </div>
                <div className="mt-4">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Zoom</span>
                    <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} className="w-full accent-emerald-500 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={onCancel} className={`py-2.5 rounded-xl text-[13px] font-bold border transition ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                    <button onClick={() => onSave({ x, y, zoom })} className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition"><Check className="w-4 h-4" /> Salvar foto</button>
                </div>
            </div>
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
            setOk(true); setCurrent(''); setNext(''); setConfirm(''); toast.success('Senha alterada com sucesso!');
            setTimeout(() => setOk(false), 2500);
        } catch (err) { console.error('[changePassword]', err?.code, err); const m = pwErrorMsg(err?.code); setError(m); toast.error(m); }
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

// Estado da integração de WhatsApp — feedback visual único e claro.
function waIntegrationStatus({ loading, connecting, hasError, connected, hasKey }) {
    if (loading)    return { key: 'loading',    label: 'Verificando…',  tone: 'slate', icon: Loader2,        spin: true, desc: 'Checando o status da sua integração…' };
    if (connecting) return { key: 'connecting', label: 'Conectando…',   tone: 'blue',  icon: Loader2,        spin: true, desc: 'Abrindo o WhatsApp pra concluir o vínculo…' };
    if (hasError)   return { key: 'error',      label: 'Erro',          tone: 'rose',  icon: AlertTriangle,  desc: 'Algo não saiu como esperado. Tente novamente.' };
    if (connected && hasKey)  return { key: 'connected',  label: 'Conectado',              tone: 'emerald', icon: CheckCircle2,  desc: 'Seu WhatsApp está configurado e pronto para uso.' };
    if (connected && !hasKey) return { key: 'incomplete', label: 'Configuração incompleta', tone: 'amber',   icon: AlertTriangle, desc: 'Falta ativar a chave da IA (Gemini) pra Alívia responder às suas mensagens.' };
    if (!connected && hasKey) return { key: 'incomplete', label: 'Configuração incompleta', tone: 'amber',   icon: AlertTriangle, desc: 'Falta conectar o seu número do WhatsApp.' };
    return { key: 'idle', label: 'Não conectado', tone: 'slate', icon: MessageCircle, desc: 'Conecte seu WhatsApp pra conversar com a Alívia e cuidar das finanças por mensagem.' };
}

// Cabeçalho da tela de WhatsApp: branding + benefício + status + arte de marketing.
function WhatsAppHeader({ isDark, status }) {
    const StatusIcon = status.icon;
    const tone = BADGE_TONES[status.tone] || BADGE_TONES.slate;
    return (
        <div className={`relative rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            <div className="grid md:grid-cols-[1fr_auto]">
                {/* Texto + status */}
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
                            <MessageCircle className="w-6 h-6" />
                        </span>
                        <div className="min-w-0">
                            <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Configurar WhatsApp</h2>
                            <p className={`text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tenha sua vida financeira acompanhada pela Alívia — direto no seu WhatsApp.</p>
                        </div>
                    </div>

                    {/* Banner de status da integração */}
                    <div className={`mt-4 flex items-start gap-3 rounded-xl px-3.5 py-3 ring-1 ${tone.wrap}`}>
                        <StatusIcon className={`w-4 h-4 shrink-0 mt-0.5 ${status.spin ? 'animate-spin' : ''}`} />
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wider">{status.label}</p>
                            <p className={`text-[12px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{status.desc}</p>
                        </div>
                    </div>
                </div>

                {/* Arte de marketing existente (apoio — some no mobile pra não competir com a config) */}
                <div className="hidden md:block relative w-44 lg:w-52 shrink-0">
                    <img src={aliviaWppHero} alt="Alívia no WhatsApp" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '72% 22%' }} />
                    <div className={`absolute inset-0 bg-gradient-to-l ${isDark ? 'from-transparent via-transparent to-[#0e0f12]' : 'from-transparent via-transparent to-white'}`} />
                </div>
            </div>
        </div>
    );
}

export function WhatsAppTab({ isDark, onGoTo }) {
    const { currentUser, userPrefs, saveUserPreferences } = useAuth();
    const uid = currentUser?.uid;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const inputCls = `w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    // Status compartilhado (mesma fonte da sidebar): vínculos + loading + refresh.
    const { loading, linked, connected, refresh } = useWhatsAppStatus();

    const [code, setCode] = useState('');
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    // Chave da IA (reportada pelo IATab) — compõe o status da integração.
    const [hasKey, setHasKey] = useState(() => { try { return !!localStorage.getItem(KEY_STORE); } catch { return false; } });

    // Configuração (número + notificações), persistida nas preferências.
    const [cfg, setCfg] = useState({ ...DEFAULT_WA_CONFIG, ...(userPrefs?.whatsapp || {}) });
    const [savingCfg, setSavingCfg] = useState(false);
    const [cfgFlash, setCfgFlash] = useState('');
    useEffect(() => { setCfg({ ...DEFAULT_WA_CONFIG, ...(userPrefs?.whatsapp || {}) }); }, [userPrefs?.whatsapp]);
    const setC = (patch) => setCfg(c => ({ ...c, ...patch }));

    const saveCfg = async () => {
        setSavingCfg(true); setCfgFlash('');
        try {
            await saveUserPreferences({ whatsapp: { ...cfg, number: String(cfg.number || '').replace(/\D/g, '') } });
            setCfgFlash('Configurações salvas!'); toast.success('Configurações salvas!');
        } catch (e) { console.error(e); setCfgFlash('Não foi possível salvar.'); toast.error('Não foi possível salvar.'); }
        setSavingCfg(false);
        setTimeout(() => setCfgFlash(''), 2500);
    };

    const copiar = () => { try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { } };
    const desvincular = async (phone) => {
        setError('');
        try { await deleteDoc(doc(db, 'wa_users', phone)); refresh(); toast.success('WhatsApp desvinculado.'); }
        catch (e) { console.error(e); setError('Não foi possível desvincular.'); toast.error('Não foi possível desvincular.'); }
    };

    // Gera o código e JÁ abre a conversa com a Alívia no WhatsApp (web/celular)
    // com a mensagem padrão preenchida — a pessoa só aperta enviar.
    // A aba é aberta SÍNCRONA (no gesto do clique) pra não ser bloqueada por popup blocker.
    const conectar = async () => {
        setGenerating(true); setError(''); setCopied(false);
        const c = genCode();
        setCode(c);
        const win = window.open(waLinkUrl(c), '_blank', 'noopener,noreferrer');
        try {
            await setDoc(doc(db, 'wa_links', c), { uid, createdAt: Date.now() });
            const digits = String(cfg.number || '').replace(/\D/g, '');
            if (digits) saveUserPreferences({ whatsapp: { ...cfg, number: digits } }).catch(() => { });
            toast.success('Abrindo o WhatsApp… é só enviar a mensagem pra Alívia. 💬');
        } catch (e) {
            console.error(e);
            try { win && win.close(); } catch { }
            setError('Não foi possível iniciar. Tente novamente.'); toast.error('Não foi possível iniciar.');
        }
        setGenerating(false);
    };

    const waLink = code ? waLinkUrl(code) : '';

    const status = waIntegrationStatus({ loading, connecting: generating, hasError: !!error, connected, hasKey });

    return (
        <div className="space-y-4">
            {/* ── Header: branding + benefício + status + arte de marketing ── */}
            <WhatsAppHeader isDark={isDark} status={status} />

            {/* ── Conexão ── */}
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={MessageCircle}
                    right={<Badge tone={status.tone}>{status.label}</Badge>}>
                    Conexão
                </SectionTitle>
                {/* Tutorial + input de número: só quando NÃO conectado (some quando vinculado). */}
                {!loading && linked.length === 0 && (
                    <>
                        <p className={`text-[13px] ${cell}`}>
                            Digite seu número e toque no botão — vamos <b>abrir o WhatsApp</b> já com uma mensagem pronta pra você enviar pra <b>Alívia</b>. É ela quem faz o vínculo na hora. 💬
                        </p>

                        {/* Seu número de WhatsApp */}
                        <div className="mt-4">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Seu número de WhatsApp</span>
                            <div className="relative">
                                <MessageCircle className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                                <input inputMode="tel" value={cfg.number}
                                    onChange={e => setC({ number: e.target.value.replace(/[^\d\s()+-]/g, '') })}
                                    onKeyDown={e => { if (e.key === 'Enter') conectar(); }}
                                    placeholder="Ex.: +55 21 99999-9999" className={inputCls} />
                            </div>
                            <p className={`text-[11px] mt-1.5 ${muted}`}>Com DDD (e país). Usamos para reconhecer você e enviar as notificações que escolher.</p>
                        </div>

                        <button onClick={conectar} disabled={generating}
                            className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition active:scale-95 disabled:opacity-60 shadow-md shadow-emerald-500/25">
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Conversar com a Alívia no WhatsApp
                        </button>
                    </>
                )}

                {loading ? (
                    <div className={`flex items-center gap-3 mt-4 rounded-xl border px-3.5 py-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <Skeleton className="w-9 h-9" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-2.5 w-24" />
                        </div>
                    </div>
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
                ) : code ? (
                    /* Fallback: já geramos o código e abrimos o WhatsApp — caso não abra. */
                    <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-[12px] ${cell}`}>Não abriu automaticamente? Abra a conversa da <b>Alívia</b> e envie este código (ou toque em "Abrir o WhatsApp"):</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-2xl font-black tracking-[0.3em] tabular-nums text-emerald-500">{code}</span>
                            <button onClick={copiar} className={`p-2 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <a href={waLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition active:scale-95">
                                <MessageCircle className="w-4 h-4" /> Abrir o WhatsApp <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </a>
                            <button onClick={refresh} className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                <Check className="w-4 h-4" /> Já vinculei
                            </button>
                        </div>
                        {error && <p className="text-[12px] font-bold text-rose-500 mt-2">{error}</p>}
                    </div>
                ) : error ? (
                    <p className="text-[12px] font-bold text-rose-500 mt-3">{error}</p>
                ) : null}
            </Card>

            {/* ── Inteligência da Alívia (Gemini) — necessária pra ela responder ── */}
            <IATab isDark={isDark} onSavedChange={setHasKey} />

            {/* ── Preferências e notificações ── */}
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
function IATab({ isDark, onSavedChange }) {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;
    const [key, setKey] = useState(() => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } });
    const [saved, setSaved] = useState(() => { try { return !!localStorage.getItem(KEY_STORE); } catch { return false; } });
    // Reporta o estado da chave pra tela de WhatsApp (banner de status unificado).
    useEffect(() => { onSavedChange?.(saved); }, [saved, onSavedChange]);
    const [editing, setEditing] = useState(false);
    const [show, setShow] = useState(false);
    const [flash, setFlash] = useState('');
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const inputCls = `w-full pl-10 pr-12 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    // Persiste a chave também no Firestore (users/{uid}) para o webhook do WhatsApp
    // responder usando a chave DO PRÓPRIO usuário — não a chave do servidor.
    const persistToCloud = async (k) => {
        if (!uid) return;
        const val = k || null;
        // Grava em DOIS lugares (independentes) pra o webhook do WhatsApp achar
        // a chave mesmo que uma das gravações falhe por regra/permissão.
        try { await setDoc(doc(db, 'users', uid), { geminiKey: val }, { merge: true }); }
        catch (e) { console.error('[geminiKey users]', e); }
        try { await setDoc(doc(db, 'users', uid, 'settings', 'general'), { geminiKey: val }, { merge: true }); }
        catch (e) { console.error('[geminiKey settings]', e); }
    };

    useEffect(() => {
        try {
            const k = localStorage.getItem(KEY_STORE);
            if (k) { setGeminiKey(k); persistToCloud(k); } // migra quem já tinha só no dispositivo
            else if (uid) {
                // Sem chave local: puxa a que já está salva na conta (users OU settings).
                Promise.all([
                    getDoc(doc(db, 'users', uid)),
                    getDoc(doc(db, 'users', uid, 'settings', 'general')),
                ]).then(([u, s]) => {
                    const ck = u.data()?.geminiKey || s.data()?.geminiKey;
                    if (ck) { try { localStorage.setItem(KEY_STORE, ck); } catch { } setGeminiKey(ck); setKey(ck); setSaved(true); persistToCloud(ck); }
                }).catch(() => { });
            }
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    const save = async () => {
        const k = key.trim();
        try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch { }
        setGeminiKey(k || null); setSaved(!!k);
        await persistToCloud(k);
        setEditing(false); setShow(false);
        setFlash(k ? 'Chave salva! A Alívia já responde no WhatsApp e na Consultoria.' : 'Chave removida.');
        if (k) toast.success('Chave salva! A Alívia já responde no WhatsApp.'); else toast.info('Chave removida.');
        setTimeout(() => setFlash(''), 2800);
    };
    const remove = async () => { setKey(''); try { localStorage.removeItem(KEY_STORE); } catch { } setGeminiKey(null); setSaved(false); setEditing(false); await persistToCloud(null); setFlash('Chave removida.'); toast.info('Chave removida.'); setTimeout(() => setFlash(''), 2500); };
    const cancelEdit = () => { setEditing(false); setShow(false); try { setKey(localStorage.getItem(KEY_STORE) || ''); } catch { } };

    return (
        <Card isDark={isDark}>
            <SectionTitle isDark={isDark} icon={Sparkles}
                right={<Badge tone={saved ? 'emerald' : 'amber'}>{saved ? 'Ativa' : 'Não configurada'}</Badge>}>
                Inteligência Artificial (Gemini)
            </SectionTitle>
            {saved && !editing ? (
                /* ── Estado SALVO (read-only, limpo) ── */
                <div className="animate-in fade-in duration-200">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Sua chave de API</span>
                    <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50'}`}>
                        <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"><KeyRound className="w-4 h-4" /></span>
                        <span className={`text-sm font-semibold tracking-wider flex-1 truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{maskKey(key)}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Salva</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => { setShow(false); setEditing(true); }}
                            className={`px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-[0.97] border ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                            <RefreshCw className="w-4 h-4" /> Alterar chave
                        </button>
                        <button onClick={remove}
                            className="px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-[0.97] border border-rose-500/25 text-rose-500 hover:bg-rose-500/10">
                            <Trash2 className="w-4 h-4" /> Remover
                        </button>
                        {flash && <span className="text-[12px] font-bold text-emerald-500 animate-in fade-in slide-in-from-left-1">{flash}</span>}
                    </div>
                </div>
            ) : (
                /* ── Estado CONFIGURAÇÃO / EDIÇÃO ── */
                <div className="animate-in fade-in duration-200">
                    {!saved && (
                        <>
                            <p className={`text-[13px] ${cell}`}>
                                Com uma chave de API do Google Gemini, a <b>Alívia</b> entende e responde suas mensagens no <b>WhatsApp</b> usando a <b>sua própria</b> chave. É <b>gratuita</b> e leva 1 minuto pra gerar.
                            </p>
                            <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-[13px] font-bold transition active:scale-95 shadow-md shadow-blue-500/30">
                                <KeyRound className="w-4 h-4" /> Gerar chave no Google AI Studio <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </a>
                        </>
                    )}
                    <div className={saved ? '' : 'mt-4'}>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{editing ? 'Nova chave de API' : 'Sua chave de API'}</span>
                        <div className="relative">
                            <KeyRound className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                            <input type={show ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} placeholder="AIza…" className={inputCls} autoComplete="off" spellCheck={false} autoFocus={editing} />
                            <button type="button" onClick={() => setShow(s => !s)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
                                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={save} disabled={!key.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 transition disabled:opacity-50">
                            <Check className="w-4 h-4" /> Salvar chave
                        </button>
                        {editing && (
                            <button onClick={cancelEdit} className={`px-3.5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97] ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                Cancelar
                            </button>
                        )}
                        {editing && (
                            <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                                Gerar nova <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        {flash && <span className="text-[12px] font-bold text-emerald-500 animate-in fade-in slide-in-from-left-1">{flash}</span>}
                    </div>
                </div>
            )}

            <div className={`mt-4 rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 text-[12px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                Sua chave fica salva na sua conta (e neste dispositivo), usada só para a Alívia falar com o Gemini — no WhatsApp e no app. Você pode remover quando quiser.
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
const parseMoney = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

// Ação sensível reutilizável: expande, pede senha (contas e-mail) e executa.
function SensitiveAction({ isDark, isPasswordUser, icon: Icon, title, desc, tone = 'amber', triggerLabel, confirmLabel, withValue, valueLabel, action }) {
    const [open, setOpen] = useState(false);
    const [val, setVal] = useState('');
    const [pw, setPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState('');
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const tones = {
        amber: { br: 'border-amber-500/30', bg: isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200', btn: 'bg-amber-500 hover:bg-amber-600', txt: 'text-amber-500' },
        rose: { br: 'border-rose-500/30', bg: isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200', btn: 'bg-rose-500 hover:bg-rose-600', txt: 'text-rose-500' },
        blue: { br: 'border-blue-500/30', bg: isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200', btn: 'bg-blue-500 hover:bg-blue-600', txt: 'text-blue-500' },
    }[tone];
    const inputCls = `w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    const canRun = (!withValue || val.trim()) && (!isPasswordUser || pw);
    const run = async () => {
        setBusy(true); setErr('');
        try {
            await action({ password: pw, value: val });
            setOk('Feito!'); setOpen(false); setVal(''); setPw(''); setTimeout(() => setOk(''), 2500);
        } catch (e) {
            if (e?.code === 'WRONG_PASSWORD') setErr('Senha incorreta.');
            else if (e?.code === 'NEEDS_PASSWORD') setErr('Informe sua senha.');
            else if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') setErr('Confirmação cancelada.');
            else if (e?.code === 'auth/too-many-requests') setErr('Muitas tentativas. Aguarde um pouco.');
            else { console.error(e); setErr('Não foi possível concluir.'); }
            setBusy(false); return;
        }
        setBusy(false);
    };

    return (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5' : 'bg-slate-100'} ${tones.txt}`}><Icon className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
                    <p className={`text-[12px] mt-0.5 ${muted}`}>{desc}</p>
                </div>
                {!open && <button onClick={() => { setOpen(true); setErr(''); }} className={`shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-bold border transition ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{triggerLabel}</button>}
                {ok && <span className={`shrink-0 text-[12px] font-bold ${tones.txt}`}>{ok}</span>}
            </div>

            {open && (
                <div className={`mt-3 rounded-xl border p-3.5 ${tones.bg}`}>
                    {withValue && (
                        <div className="relative mb-2.5">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${muted}`}>R$</span>
                            <input inputMode="decimal" value={val} onChange={e => setVal(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder={valueLabel || '0,00'}
                                className={`w-full pl-9 pr-3 py-3 rounded-xl border text-sm font-bold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} autoFocus />
                        </div>
                    )}
                    {isPasswordUser ? (
                        <div className="relative mb-2.5">
                            <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                            <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password"
                                onKeyDown={e => { if (e.key === 'Enter' && canRun) run(); }} placeholder="Confirme sua senha" className={inputCls} autoFocus={!withValue} />
                            <button type="button" onClick={() => setShowPw(s => !s)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                        </div>
                    ) : <p className={`text-[12px] mb-2.5 ${muted}`}>Você confirmará pela janela do Google.</p>}
                    {err && <p className="text-[12px] font-bold text-rose-500 mb-2.5">{err}</p>}
                    <div className="flex gap-2">
                        <button onClick={run} disabled={busy || !canRun} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-bold transition disabled:opacity-60 ${tones.btn}`}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {confirmLabel}
                        </button>
                        <button onClick={() => { setOpen(false); setErr(''); setPw(''); }} disabled={busy} className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border transition ${isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ContaTab({ isDark }) {
    const { currentUser, deleteAccount, reauthenticate, setAccountBalance, resetUserData } = useAuth();
    const isPasswordUser = (currentUser?.providerData || []).some(p => p.providerId === 'password');
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [needsPw, setNeedsPw] = useState(false);
    const [pw, setPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const inputCls = `w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-rose-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-rose-500'}`;

    const doDelete = async (password) => {
        setDeleting(true); setError('');
        try {
            await deleteAccount(password);
        } catch (err) {
            setDeleting(false);
            if (err?.code === 'NEEDS_PASSWORD') { setNeedsPw(true); return; }
            if (err?.code === 'WRONG_PASSWORD') { setNeedsPw(true); setError('Senha incorreta. Tente de novo.'); return; }
            if (err?.code === 'auth/too-many-requests') { setError('Muitas tentativas. Aguarde um pouco e tente de novo.'); return; }
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') { setError('Você fechou a janela de confirmação. Tente de novo.'); return; }
            console.error('[deleteAccount]', err);
            setError('Não foi possível apagar agora. Tente novamente.');
        }
    };

    const reset = () => { setConfirm(false); setError(''); setNeedsPw(false); setPw(''); };

    return (
        <div className="space-y-4">
            {/* Ajustar saldo em conta */}
            <SensitiveAction isDark={isDark} isPasswordUser={isPasswordUser} icon={Wallet} tone="blue"
                title="Ajustar saldo em conta" desc="Define o saldo atual da sua conta para o valor exato que você quiser."
                triggerLabel="Ajustar" confirmLabel="Salvar saldo" withValue valueLabel="Novo saldo (R$)"
                action={async ({ password, value }) => { await reauthenticate(password); await setAccountBalance(parseMoney(value)); }} />

            {/* Zerar dados (sem apagar a conta) */}
            <SensitiveAction isDark={isDark} isPasswordUser={isPasswordUser} icon={RefreshCw} tone="amber"
                title="Zerar dados da conta" desc="Apaga transações, cartões, recorrentes, reservas, metas e investimentos — mas mantém sua conta e login."
                triggerLabel="Zerar" confirmLabel="Zerar meus dados"
                action={async ({ password }) => { await reauthenticate(password); await resetUserData(currentUser.uid); setTimeout(() => window.location.reload(), 400); }} />

            {/* Zona de perigo — apagar conta */}
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
                        <p className="text-[13px] font-bold text-rose-500 mb-1">Tem certeza absoluta? Isso apaga tudo e não pode ser desfeito.</p>
                        <p className={`text-[12px] mb-3 ${muted}`}>
                            {isPasswordUser ? 'Confirme sua senha para excluir a conta.' : 'Você confirmará pela janela do Google.'}
                        </p>
                        {needsPw && isPasswordUser && (
                            <div className="relative mb-3">
                                <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                                <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password"
                                    onKeyDown={e => { if (e.key === 'Enter' && pw) doDelete(pw); }} placeholder="Sua senha" className={inputCls} autoFocus />
                                <button type="button" onClick={() => setShowPw(s => !s)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`}>
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        )}
                        {error && <p className="text-[12px] font-bold text-rose-400 mb-3">{error}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => (needsPw && isPasswordUser) ? doDelete(pw) : doDelete()} disabled={deleting || (needsPw && isPasswordUser && !pw)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-[13px] font-bold hover:bg-rose-600 transition disabled:opacity-60">
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {deleting ? 'Apagando…' : (needsPw ? 'Confirmar exclusão' : 'Sim, apagar tudo')}
                            </button>
                            <button onClick={reset} disabled={deleting} className={`px-4 py-2.5 rounded-xl text-[13px] font-bold border transition ${isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
