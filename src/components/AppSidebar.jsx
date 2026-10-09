import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard, Repeat, ArrowLeftRight, CreditCard, Landmark,
    BarChart3, BookOpen, Settings, LogOut, Sun, Moon, X, PiggyBank, Wrench, TrendingUp,
} from 'lucide-react';

import marca from '../assets/logo-mark.png';
import UserAvatar from './UserAvatar';
import { useI18n } from '../contexts/LanguageContext';

// Versão do app (exibida discretamente na sidebar).
export const APP_VERSION = '2.0';
// Notas da atualização (página pública, abre em nova aba ao clicar na versão).
export const RELEASE_NOTES_URL = '/novidades';

// Navegação plana (sem módulos, sem subabas) — padrão Gym.
// `label` é a chave de tradução (ver src/locales); `fallback` cobre quem
// importa NAV_ITEMS fora de um provider de idioma.
export const NAV_ITEMS = [
    { id: 'dashboard',  label: 'nav.dashboard', fallback: 'Dashboard',        icon: LayoutDashboard },
    { id: 'extrato',    label: 'nav.statement', fallback: 'Extrato',          icon: ArrowLeftRight },
    { id: 'receber',    label: 'nav.toReceive', fallback: 'Contas a receber', icon: TrendingUp },
    { id: 'pagar',      label: 'nav.toPay',     fallback: 'Contas a pagar',   icon: Repeat },
    { id: 'cartoes',    label: 'nav.card',      fallback: 'Meu cartão',       icon: CreditCard },
    { id: 'reservas',   label: 'nav.reserves',  fallback: 'Reservas',         icon: PiggyBank },
    { id: 'patrimonio', label: 'nav.patrimony', fallback: 'Patrimônio',       icon: Landmark },
    { id: 'analises',   label: 'nav.reports',   fallback: 'Análises',         icon: BarChart3 },
    { id: 'manual',     label: 'nav.manual',    fallback: 'Manual',           icon: BookOpen },
];

const PLAN_LABEL = { lifetime: 'Vitalício', premium: 'Pro', standard: 'Pro', free: 'Gratuito' };

export default function AppSidebar({ active, onNavigate, onSettings, onLogout, mobile = false, onClose }) {
    const { theme, toggleTheme } = useTheme();
    const { t } = useI18n();
    const { currentUser, planLevel, isAdmin } = useAuth();
    const isDark = theme !== 'light';
    // Grupo REAL (mesma prioridade do gerenciador): Dev > Vitalício > Pro > Gratuito.
    const roleKey = isAdmin ? 'dev' : (planLevel === 'lifetime' ? 'lifetime' : (planLevel === 'premium' || planLevel === 'standard') ? 'pro' : 'free');
    const roleLabel = { dev: 'Dev', lifetime: 'Vitalício', pro: 'Pro', free: 'Gratuito' }[roleKey];
    const roleBadgeCls = {
        dev: 'bg-amber-500/15 text-amber-400',
        lifetime: 'bg-purple-500/15 text-purple-400',
        pro: 'bg-emerald-500/15 text-emerald-500',
        free: 'bg-slate-500/15 text-slate-400',
    }[roleKey];

    const name = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuário';
    const initial = (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();

    // No mobile, navegar/ajustar/sair também fecha o drawer.
    const withClose = (fn) => (...args) => { fn?.(...args); if (mobile) onClose?.(); };

    return (
        <aside className={`flex flex-col p-4 border-r ${
            mobile
                ? 'w-[280px] max-w-[85vw] h-full'
                : 'hidden lg:flex w-[260px] shrink-0 h-screen sticky top-0'} ${
            isDark ? 'bg-[#030505] border-white/[0.06]' : 'bg-white border-slate-100'}`}
            style={isDark ? { backgroundImage: 'linear-gradient(180deg, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0.055) 30%, transparent 62%)' } : undefined}>
            {/* Marca — linha única de 56px, na mesma altura da barra superior. */}
            <div className="flex items-center gap-2.5 h-14 -mt-4 mb-1 shrink-0">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10 ring-1 ring-emerald-500/25' : 'bg-emerald-50 ring-1 ring-emerald-100'}`}>
                    <img src={marca} alt="Alívia" className="w-[22px] h-[22px] object-contain" />
                </span>
                <span className="text-[15px] font-black tracking-tight leading-none min-w-0 truncate">
                    <span className={isDark ? 'text-white' : 'text-slate-800'}>Alívia</span>{' '}
                    <span className="text-emerald-400">Finanças</span>
                </span>
                <button onClick={mobile ? onClose : toggleTheme} aria-label={mobile ? 'Fechar menu' : 'Alternar tema'}
                    className={`ml-auto w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${isDark ? 'bg-white/5 text-amber-300 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {mobile ? <X className="w-4 h-4" /> : (isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
                </button>
            </div>

            {/* Separador + rótulo da seção */}
            <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} />
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-3 mb-2 px-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('nav.menu')}</p>

            {/* Navegação */}
            <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                    const on = active === id;
                    return (
                        <button key={id} onClick={() => withClose(onNavigate)(id)}
                            className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all active:scale-[0.98] ${
                                on
                                    ? (isDark ? 'font-bold text-white' : 'font-bold bg-emerald-50 text-emerald-800')
                                    : (isDark ? 'font-semibold text-slate-400 hover:bg-white/[0.045] hover:text-slate-200'
                                              : 'font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800')
                            }`}
                            style={on && isDark ? {
                                backgroundImage: 'linear-gradient(90deg, rgba(36,219,146,0.17), rgba(36,219,146,0.07))',
                                boxShadow: '0 0 22px -6px rgba(36,219,146,0.35)',
                            } : undefined}>
                            {/* A luz verde da aba: barrinha acesa colada na borda. */}
                            {on && <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_rgba(36,219,146,0.9)]' : 'bg-emerald-500'}`} />}
                            <Icon className={`w-4 h-4 shrink-0 ${on ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : ''}`} strokeWidth={on ? 2.3 : 2} />
                            <span className="truncate">{t(label)}</span>
                        </button>
                    );
                })}

            </nav>

            {/* Conversa com a Alívia agora acontece só no WhatsApp (aba removida). */}

            {/* Configurações e Cadastros + bloco do usuário + sair */}
            <div className="mt-3 pt-3 space-y-1">
                {/* Cadastros (recorrentes, tetos), WhatsApp e configurações da conta */}
                <button onClick={withClose(onSettings)}
                    className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-bold transition ${
                        active === 'configuracoes'
                            ? (isDark ? 'text-white' : 'bg-emerald-50 text-emerald-800')
                            : (isDark ? 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}`}
                    style={active === 'configuracoes' && isDark ? {
                        backgroundImage: 'linear-gradient(90deg, rgba(36,219,146,0.17), rgba(36,219,146,0.07))',
                        boxShadow: '0 0 22px -6px rgba(36,219,146,0.35)',
                    } : undefined}>
                    {active === 'configuracoes' && <span aria-hidden className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_rgba(36,219,146,0.9)]' : 'bg-emerald-500'}`} />}
                    <Settings className={`w-4 h-4 shrink-0 ${active === 'configuracoes' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : ''}`} /> <span className="truncate">{t('nav.settings')}</span>
                </button>

                {/* Bloco do usuário (abaixo de Configurações e Cadastros) */}
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <UserAvatar className="w-9 h-9 rounded-full shrink-0"
                        fallbackClassName="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600" textClassName="font-black text-white text-sm" />
                    <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</p>
                        <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${roleBadgeCls}`}>
                            {roleLabel}
                        </span>
                    </div>
                    {isAdmin && (
                        <button onClick={() => withClose(onNavigate)('gerenciar-usuarios')} title="Configurações de dev"
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition active:scale-95 ${
                                active === 'gerenciar-usuarios'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : (isDark ? 'bg-white/5 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10' : 'bg-slate-100 text-slate-500 hover:text-amber-600 hover:bg-amber-50')}`}>
                            <Wrench className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button onClick={withClose(onLogout)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-bold text-rose-500 hover:bg-rose-500/10 transition">
                    <LogOut className="w-[18px] h-[18px]" /> {t('nav.logout')}
                </button>
            </div>
        </aside>
    );
}
