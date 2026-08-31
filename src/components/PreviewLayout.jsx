import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from './ui/Toaster';
import OnboardingAlivia from './OnboardingAlivia';
import AppSidebar, { NAV_ITEMS } from './AppSidebar';
import Recorrentes from '../pages/Recorrentes';
import Lancamentos from '../pages/Lancamentos';
import Cartoes from '../pages/Cartoes';
import Patrimonio from '../pages/Patrimonio';
import Reservas from '../pages/Reservas';
import Dashboard from '../pages/Dashboard';
import ConsultoriaAlivia from '../pages/ConsultoriaAlivia';
import Configuracoes from '../pages/Configuracoes';
import Analises from '../pages/Analises';
import Manual from '../pages/Manual';
import Assinatura from '../pages/Assinatura';
import GerenciarUsuarios from '../pages/GerenciarUsuarios';

// Preview TEMPORÁRIO do novo layout (só pra validar o visual da sidebar).
// Acesse em /preview-layout. Não faz parte do app final.
// Caminho de URL de cada aba (paginação). O dashboard vive em /inicio.
export const tabPath = (id) => (id === 'dashboard' ? '/inicio' : `/app/${id}`);

export default function PreviewLayout({ tab = 'dashboard' }) {
    const { theme } = useTheme();
    const { logout, userPrefs, isDataLoaded } = useAuth();
    const navigate = useNavigate();
    const isDark = theme !== 'light';
    const active = tab || 'dashboard';
    const go = (id) => navigate(tabPath(id));
    const [drawer, setDrawer] = useState(false);
    const [obDismissed, setObDismissed] = useState(false);

    // Atalho de teste: abrir com ?onboarding=1 força a tela de boas-vindas
    // (sem precisar apagar a conta). Útil no localhost para validar o fluxo.
    const forceOnboarding = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).has('onboarding');

    // Onboarding de boas-vindas na PRIMEIRA entrada (conta nova):
    // ainda não completou o onboarding novo e nunca viu a apresentação.
    const showOnboarding = !obDismissed && (forceOnboarding
        || (isDataLoaded && !(userPrefs?.onboardingDone) && !(userPrefs?.hasSeenWelcome)));

    const label = active === 'configuracoes' ? 'Configurações' : (NAV_ITEMS.find(i => i.id === active)?.label || active);
    const sidebarProps = {
        active,
        onNavigate: (id) => { go(id); setDrawer(false); },
        onSettings: () => { go('configuracoes'); setDrawer(false); },
        onLogout: async () => { try { await logout?.(); } catch (e) { console.error(e); } },
    };

    return (
        <div className={`min-h-screen flex ${isDark ? 'bg-[#0e0f12]' : 'bg-slate-50'}`}>
            <Toaster />
            {showOnboarding && <OnboardingAlivia onDone={() => setObDismissed(true)} />}

            {/* Sidebar desktop (some no mobile) */}
            <AppSidebar {...sidebarProps} />

            {/* Drawer mobile */}
            {drawer && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
                    <div className="relative z-10">
                        <AppSidebar {...sidebarProps} mobile onClose={() => setDrawer(false)} />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0"
                style={isDark ? { backgroundImage: 'radial-gradient(1300px 620px at 12% -6%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(820px 480px at 88% -10%, rgba(20,184,166,0.10), transparent 62%)' } : undefined}>
                {/* Topo mobile (some no desktop) */}
                <header className={`lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b ${isDark ? 'bg-[#0a0a0a]/90 border-white/[0.06]' : 'bg-white/90 border-slate-100'} backdrop-blur`}>
                    <button onClick={() => setDrawer(true)} aria-label="Abrir menu"
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="text-[17px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500">Alívia</span>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Finanças</span>
                </header>

            {/* Área de conteúdo */}
            <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
                {active === 'consultoria' ? <ConsultoriaAlivia onNavigate={go} /> : active === 'configuracoes' ? <Configuracoes /> : active === 'gerenciar-usuarios' ? <GerenciarUsuarios /> : active === 'dashboard' ? <Dashboard onNavigate={go} onSettings={() => go('configuracoes')} /> :active === 'recorrentes' ? <Recorrentes onNavigate={go} /> : active === 'lancamentos' ? <Lancamentos /> : active === 'cartoes' ? <Cartoes /> : active === 'patrimonio' ? <Patrimonio /> : active === 'reservas' ? <Reservas /> : active === 'analises' ? <Analises /> : active === 'manual' ? <Manual /> : active === 'assinatura' ? <Assinatura /> : (
                <div className="max-w-4xl">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Preview do novo layout</span>
                    <h1 className={`text-3xl font-black tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</h1>
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Esta é só a casca da navegação nova (sidebar plana, verde, com bloco do usuário).
                        Clique nas abas à esquerda pra ver a seleção mudar. O conteúdo real de cada tela
                        entra na próxima fase.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`rounded-3xl p-5 h-40 border ${isDark ? 'bg-slate-800/60 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 mb-3" />
                                <div className={`h-3 w-2/3 rounded ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
                                <div className={`h-3 w-1/2 rounded mt-2 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
                            </div>
                        ))}
                    </div>
                </div>
                )}
            </main>
            </div>
        </div>
    );
}
