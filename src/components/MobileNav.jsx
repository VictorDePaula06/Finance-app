import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import UserAvatar from './UserAvatar';
import {
    Home, ArrowLeftRight, BarChart3, CreditCard, LayoutGrid, X,
    Repeat, PiggyBank, Landmark, Receipt, BookOpen, Settings, User,
    MessageCircle, LogOut, Sun, Moon, Users, ChevronRight, CheckCircle2,
} from 'lucide-react';

// Navegação mobile nativa: bottom navigation fixa + sheet "Mais".
// Reutiliza as MESMAS rotas/telas do desktop (via `go(id)`), só reorganiza
// o acesso pra uma experiência de app em telas pequenas.

// Áreas de uso diário na barra inferior (as demais vão pro "Mais").
const BOTTOM = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'lancamentos', label: 'Lançamentos', icon: ArrowLeftRight },
    { id: 'analises', label: 'Análises', icon: BarChart3 },
    { id: 'cartoes', label: 'Cartão', icon: CreditCard },
];
// Telas que vivem dentro do "Mais" (usadas p/ marcar a aba "Mais" como ativa).
const IN_MORE = ['recorrentes', 'reservas', 'patrimonio', 'assinatura', 'manual', 'configuracoes', 'whatsapp', 'gerenciar-usuarios'];

export default function MobileNav({ active, go, onOpenWhatsApp, onOpenProfile, onLogout }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const { currentUser, planLevel, isAdmin } = useAuth();
    const { connected, loading: waLoading } = useWhatsAppStatus();
    const [more, setMore] = useState(false);

    // Trava o scroll do body enquanto o sheet está aberto.
    useEffect(() => {
        if (!more) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [more]);

    const name = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuário';
    const roleKey = isAdmin ? 'dev' : (planLevel === 'lifetime' ? 'lifetime' : (planLevel === 'premium' || planLevel === 'standard') ? 'pro' : 'free');
    const roleLabel = { dev: 'Dev', lifetime: 'Vitalício', pro: 'Pro', free: 'Gratuito' }[roleKey];
    const roleBadgeCls = {
        dev: 'bg-amber-500/15 text-amber-400',
        lifetime: 'bg-purple-500/15 text-purple-400',
        pro: 'bg-emerald-500/15 text-emerald-500',
        free: 'bg-slate-500/15 text-slate-400',
    }[roleKey];

    const moreActive = IN_MORE.includes(active) || more;

    const nav = (id) => { setMore(false); go(id); };
    const doWhatsApp = () => { setMore(false); onOpenWhatsApp?.(); };
    const doProfile = () => { setMore(false); onOpenProfile?.(); };

    const tabCls = (on) => `flex-1 flex flex-col items-center justify-center gap-1 h-full min-w-0 transition-colors ${
        on ? 'text-emerald-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`;

    // Linha de item dentro do sheet.
    const Row = ({ icon: Icon, label, desc, onClick, right, danger }) => (
        <button type="button" onClick={onClick}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition active:scale-[0.99] ${
                danger ? 'text-rose-500 hover:bg-rose-500/10'
                    : (isDark ? 'text-slate-200 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50')}`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                danger ? 'bg-rose-500/10 text-rose-500' : (isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                <Icon className="w-[18px] h-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold truncate">{label}</span>
                {desc && <span className={`block text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</span>}
            </span>
            {right || <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />}
        </button>
    );

    const GroupLabel = ({ children }) => (
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] px-2 mt-4 mb-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{children}</p>
    );

    return (
        <>
            {/* ── Bottom navigation (só mobile) ── */}
            <nav aria-label="Navegação principal"
                className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur ${isDark ? 'bg-[#0a0a0a]/95 border-white/[0.06]' : 'bg-white/95 border-slate-200'}`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex items-stretch h-16 max-w-xl mx-auto">
                    {BOTTOM.map(({ id, label, icon: Icon }) => {
                        const on = active === id;
                        return (
                            <button key={id} onClick={() => nav(id)} className={tabCls(on)} aria-current={on ? 'page' : undefined}>
                                <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.5 : 2} />
                                <span className="text-[9px] font-bold leading-none tracking-tight whitespace-nowrap">{label}</span>
                            </button>
                        );
                    })}
                    <button onClick={() => setMore(true)} className={tabCls(moreActive)} aria-haspopup="dialog" aria-expanded={more}>
                        <span className="relative">
                            <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={moreActive ? 2.5 : 2} />
                            {!waLoading && !connected && (
                                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ${isDark ? 'ring-[#0a0a0a]' : 'ring-white'}`} />
                            )}
                        </span>
                        <span className="text-[9px] font-bold leading-none tracking-tight">Mais</span>
                    </button>
                </div>
            </nav>

            {/* ── Sheet "Mais" ── */}
            {more && (
                <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Mais opções">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMore(false)} />
                    <div className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 ${isDark ? 'bg-[#0e0f12] border-white/10' : 'bg-white border-slate-200'}`}
                        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        {/* Handle + fechar */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
                            <span className={`mx-auto w-10 h-1.5 rounded-full ${isDark ? 'bg-white/15' : 'bg-slate-200'}`} />
                            <button onClick={() => setMore(false)} aria-label="Fechar"
                                className={`absolute right-3 top-3 w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto px-3 pb-4">
                            {/* Perfil (atalho) */}
                            <button onClick={doProfile}
                                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition active:scale-[0.99] ${isDark ? 'bg-white/5 hover:bg-white/[0.08]' : 'bg-slate-50 hover:bg-slate-100'}`}>
                                <UserAvatar className="w-11 h-11 rounded-full shrink-0"
                                    fallbackClassName="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600" textClassName="font-black text-white" />
                                <div className="min-w-0 flex-1">
                                    <p className={`text-[15px] font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</p>
                                    <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${roleBadgeCls}`}>{roleLabel}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                            </button>

                            {/* Integração WhatsApp — com estado de pendência/conexão */}
                            <GroupLabel>Integrações</GroupLabel>
                            <Row
                                icon={MessageCircle}
                                label="WhatsApp"
                                desc={waLoading ? 'Verificando…' : connected ? 'Conectado' : 'Configure seu WhatsApp'}
                                onClick={doWhatsApp}
                                right={waLoading ? null : connected
                                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                    : <span className="shrink-0 w-5 h-5 rounded-full bg-amber-400/20 text-amber-500 flex items-center justify-center text-[12px] font-black">!</span>}
                            />

                            <GroupLabel>Finanças</GroupLabel>
                            <Row icon={Repeat} label="Recorrentes" onClick={() => nav('recorrentes')} />
                            <Row icon={PiggyBank} label="Reservas" onClick={() => nav('reservas')} />
                            <Row icon={Landmark} label="Patrimônio" onClick={() => nav('patrimonio')} />

                            <GroupLabel>Conta &amp; app</GroupLabel>
                            <Row icon={Receipt} label="Assinatura" onClick={() => nav('assinatura')} />
                            <Row icon={Settings} label="Configurações" onClick={() => nav('configuracoes')} />
                            <Row icon={User} label="Perfil" onClick={doProfile} />
                            <Row icon={BookOpen} label="Manual" onClick={() => nav('manual')} />
                            {isAdmin && <Row icon={Users} label="Gerenciar usuários" onClick={() => nav('gerenciar-usuarios')} />}

                            <GroupLabel>Sistema</GroupLabel>
                            <Row icon={isDark ? Sun : Moon} label={`Tema ${isDark ? 'claro' : 'escuro'}`} onClick={toggleTheme} right={<span />} />
                            <Row icon={LogOut} label="Sair" onClick={() => { setMore(false); onLogout?.(); }} right={<span />} danger />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
