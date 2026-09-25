import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard, Repeat, ArrowLeftRight, CreditCard, Landmark,
    BarChart3, BookOpen, Settings, LogOut, Sun, Moon, X, PiggyBank, Wrench,
} from 'lucide-react';

import logo from '../assets/logo.png';
import UserAvatar from './UserAvatar';
import { useI18n } from '../contexts/LanguageContext';

// Versão do app (exibida discretamente na sidebar).
export const APP_VERSION = '1.2';
// Notas da atualização (página pública, abre em nova aba ao clicar na versão).
export const RELEASE_NOTES_URL = '/novidades';

// Navegação plana (sem módulos, sem subabas) — padrão Gym.
// `label` é a chave de tradução (ver src/locales); `fallback` cobre quem
// importa NAV_ITEMS fora de um provider de idioma.
export const NAV_ITEMS = [
    { id: 'dashboard',   label: 'nav.dashboard',    fallback: 'Dashboard',   icon: LayoutDashboard },
    { id: 'recorrentes', label: 'nav.recurring',    fallback: 'Recorrentes', icon: Repeat },
    { id: 'lancamentos', label: 'nav.transactions', fallback: 'Lançamentos', icon: ArrowLeftRight },
    { id: 'cartoes',     label: 'nav.card',         fallback: 'Meu cartão',  icon: CreditCard },
    { id: 'reservas',    label: 'nav.reserves',     fallback: 'Reservas',    icon: PiggyBank },
    { id: 'patrimonio',  label: 'nav.patrimony',    fallback: 'Patrimônio',  icon: Landmark },
    { id: 'analises',    label: 'nav.analysis',     fallback: 'Análises',    icon: BarChart3 },
    { id: 'manual',      label: 'nav.manual',       fallback: 'Manual',      icon: BookOpen },
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
            isDark ? 'bg-[#0a0a0a] border-white/[0.06]' : 'bg-white border-slate-100'}`}>
            {/* Marca — ícone grande centralizado + "Alívia Finanças" embaixo */}
            <div className="relative flex flex-col items-center pt-1 pb-5 mb-1">
                <button onClick={mobile ? onClose : toggleTheme} aria-label={mobile ? 'Fechar menu' : 'Alternar tema'}
                    className={`absolute top-0 right-0 w-9 h-9 rounded-xl flex items-center justify-center transition ${isDark ? 'bg-white/5 text-amber-300 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {mobile ? <X className="w-4 h-4" /> : (isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
                </button>
                {/* Só o símbolo (recorta o "Alívia" que vem embutido no PNG) */}
                <div className="w-[132px] h-[76px] overflow-hidden flex justify-center mb-2">
                    <img src={logo} alt="Alívia" className="w-[132px] h-[132px] object-cover object-top drop-shadow-[0_0_24px_rgba(16,185,129,0.25)]" />
                </div>
                <div className="flex flex-col items-center leading-none">
                    <span className="text-[28px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500">
                        Alívia
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.42em] mt-1.5 ml-[0.42em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Finanças
                    </span>
                    <a href={RELEASE_NOTES_URL} target="_blank" rel="noopener noreferrer" title={t('nav.releaseNotesTitle')}
                        className={`text-[10px] font-bold tracking-wide mt-1.5 px-1.5 py-0.5 rounded-md transition ${isDark ? 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                        v{APP_VERSION} · {t('nav.releaseNotes')}
                    </a>
                </div>
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
                            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-[0.98] ${
                                on
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-sm'
                                    : (isDark ? 'text-slate-400 border border-transparent hover:bg-white/5 hover:text-slate-200'
                                              : 'text-slate-500 border border-transparent hover:bg-slate-50 hover:text-slate-800')
                            }`}>
                            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={on ? 2.4 : 2} />
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-[12.5px] font-bold transition ${
                        active === 'configuracoes'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : (isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}`}>
                    <Settings className="w-[18px] h-[18px] shrink-0" /> <span className="truncate">{t('nav.settings')}</span>
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
