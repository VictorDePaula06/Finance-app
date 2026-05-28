import React from 'react';
import {
  LayoutDashboard,
  Target,
  Wallet,
  Sparkles,
  TrendingUp,
  CreditCard,
  Settings,
  LogOut,
  X,
  HelpCircle,
  PieChart,
  Landmark,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  ArrowUpCircle,
  BarChart3,
  Home,
  LayoutGrid,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { isLifetimeEmail } from '../constants/admins';
import logo from '../assets/logo.png';
import { version } from '../../package.json';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, activeModule, setActiveModule }) => {
  const { currentUser, logout, isAdmin, isPremium, isTrial, isLifetime, subType, planLevel } = useAuth();
  const { theme } = useTheme();

  const isFreePlan = planLevel === 'free';

  const menuItems = [
    // Gastos Module
    { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard, module: 'gastos' },
    { id: 'entradas', label: 'Recebimentos', icon: ArrowUpCircle, module: 'gastos' },
    { id: 'fixas', label: 'Contas Fixas', icon: Home, module: 'gastos' },
    { id: 'gastos', label: 'Lançamentos', icon: TrendingDown, module: 'gastos' },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard, module: 'gastos' },
    { id: 'analise', label: 'Análise de Gastos', icon: TrendingUp, module: 'gastos' },

    // Patrimônio Module — itens marcados com premiumOnly mostram badge "Premium" pro Free
    { id: 'patrimonio', label: 'Patrimônio', icon: Landmark, module: 'patrimonio' },
    { id: 'reserva', label: 'Reserva Emergência', icon: ShieldCheck, module: 'patrimonio' },
    { id: 'investimentos', label: 'Investimentos', icon: PieChart, module: 'patrimonio' },
    { id: 'metas', label: 'Metas', icon: Target, module: 'patrimonio' },
    { id: 'evolucao', label: 'Evolução Patrimonial', icon: BarChart3, module: 'patrimonio', premiumOnly: true },

    // Common
    { id: 'ajustes', label: 'Ajustes', icon: Settings, module: 'common' },
  ];

  const visibleItems = menuItems.filter(item => item.module === activeModule || item.module === 'common');

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-full w-64 border-r transition-transform duration-500 z-[100] flex flex-col ${
        theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-950 border-white/5 shadow-2xl'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Close Button (Mobile Only) */}
        <button 
          onClick={() => setIsOpen(false)}
          className={`absolute top-4 right-4 p-2 rounded-xl lg:hidden ${
            theme === 'light' ? 'bg-slate-50 text-slate-400' : 'bg-white/5 text-slate-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo Section */}
        <div
          className="pt-8 px-6 pb-2 flex flex-col items-center justify-center cursor-pointer select-none"
          onDoubleClick={() => {
            if (isAdmin) {
              window.dispatchEvent(new CustomEvent('change-view', { detail: 'admin' }));
            }
          }}
        >
          <img
            src={logo}
            alt="Alívia Logo"
            className={`w-40 h-40 object-contain drop-shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all hover:scale-105 duration-700`}
          />
        </div>

        {/* Botão "Trocar Módulo" — pílula refinada com tipografia uppercase tracking-widest
            totalmente distinta dos itens de menu (que usam text-sm font-bold) */}
        <div className="px-5 pb-5">
          <button
            onClick={() => setActiveModule('hub')}
            className={`group relative w-full overflow-hidden flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-500 hover:scale-[1.02] active:scale-95 ${
              theme === 'light'
                ? 'bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-emerald-100/80 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100'
                : 'bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-blue-500/[0.04] border-white/5 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5'
            }`}
            title="Voltar para a tela de seleção de módulos"
          >
            {/* Shine sutil no hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />

            <div className="relative flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg transition-all duration-500 group-hover:rotate-180 ${
                theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                <ArrowLeftRight className="w-3 h-3" />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.28em] ${
                theme === 'light' ? 'text-slate-600 group-hover:text-emerald-700' : 'text-slate-400 group-hover:text-emerald-300'
              } transition-colors`}>
                Trocar Módulo
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-3 opacity-60">
            {activeModule === 'gastos' ? 'Controle de Gastos' : 'Construção de Patrimônio'}
          </div>

          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? (theme === 'light' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'bg-emerald-500/10 text-emerald-400')
                    : (theme === 'light' ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-800' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200')
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className={`text-sm font-bold ${isActive ? 'translate-x-1' : ''} transition-transform`}>
                    {item.label}
                  </span>
                </div>
                
                {item.badge && (
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                    theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {/* Badge "Premium" — só aparece para Free em itens premium-only */}
                {item.premiumOnly && isFreePlan && (
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                    theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    PRO
                  </span>
                )}
              </button>
            );
          })}

        </nav>

        {/* User Profile Section */}
        <div className={`p-4 border-t mt-auto ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
          <div className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
            theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5 shadow-sm'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
              theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black truncate leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                {currentUser?.displayName?.split(' ')[0] || 'Usuário'}
              </p>
              <p className="text-[10px] text-slate-500 truncate font-mono opacity-70 mt-0.5">
                {currentUser?.email}
              </p>
              {/* Plano — linha dedicada abaixo do e-mail */}
              <div className="mt-1.5">
                {(isLifetime || planLevel === 'lifetime' || isLifetimeEmail(currentUser?.email)) ? (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-tight bg-purple-500/20 text-purple-400 border border-purple-500/20">
                    Vitalício
                  </span>
                ) : planLevel === 'premium' ? (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-tight border ${
                    subType === 'annual'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                  }`}>
                    Plano Premium
                  </span>
                ) : planLevel === 'standard' ? (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-tight border ${
                    subType === 'annual'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                      : 'bg-slate-500/20 text-slate-400 border-slate-500/20'
                  }`}>
                    Plano Standard
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-tight bg-slate-500/10 text-slate-500 border border-slate-500/10">
                    Plano Gratuito
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'light' ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-500' : 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400'
              }`}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          
          {/* System Version */}
          <div className="mt-4 text-center">
            <p className={`text-[9px] font-black uppercase tracking-[0.3em] opacity-20 ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Alívia v.{version}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
