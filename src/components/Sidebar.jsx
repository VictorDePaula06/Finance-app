import React, { useState, useEffect } from 'react';
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
  ArrowLeftRight,
  ChevronDown,
  Gem
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

  // Estrutura de navegação por módulo: cada entrada é um item direto ({type:'item'})
  // ou um grupo colapsável ({type:'group', children:[...]}). Itens diretos ficam
  // sempre visíveis; grupos organizam o que é relacionado.
  const navByModule = {
    gastos: [
      { type: 'item', id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
      {
        type: 'group', id: 'grp_entradas', label: 'Entradas', icon: ArrowUpCircle,
        children: [
          { id: 'entradas', label: 'Recebimentos', icon: ArrowUpCircle },
          { id: 'resgates', label: 'Resgates', icon: Landmark },
        ],
      },
      {
        type: 'group', id: 'grp_lancamentos', label: 'Lançamentos', icon: TrendingDown,
        children: [
          { id: 'gastos', label: 'Despesas', icon: TrendingDown },
          { id: 'aportes', label: 'Aportes', icon: PiggyBank },
          { id: 'fixas', label: 'Contas Fixas', icon: Home },
          { id: 'cartoes', label: 'Cartões', icon: CreditCard },
        ],
      },
      { type: 'item', id: 'analise', label: 'Análise de Gastos', icon: TrendingUp },
    ],
    patrimonio: [
      { type: 'item', id: 'patrimonio', label: 'Visão Geral', icon: LayoutDashboard },
      {
        type: 'group', id: 'grp_ativos', label: 'Meus Ativos', icon: Gem,
        children: [
          { id: 'reserva', label: 'Reserva Emergência', icon: ShieldCheck },
          { id: 'investimentos', label: 'Investimentos', icon: PieChart },
        ],
      },
      {
        type: 'group', id: 'grp_plan', label: 'Planejamento', icon: Target,
        children: [
          { id: 'metas', label: 'Metas', icon: Target },
          { id: 'evolucao', label: 'Evolução Patrimonial', icon: BarChart3, premiumOnly: true },
        ],
      },
    ],
  };

  const navEntries = navByModule[activeModule] || navByModule.gastos;

  // Descobre em qual grupo está a aba ativa, para abri-lo automaticamente.
  const groupOfActive = navEntries.find(
    e => e.type === 'group' && e.children.some(c => c.id === activeTab)
  );

  const [openGroups, setOpenGroups] = useState({});

  // Abre automaticamente o grupo que contém a aba ativa (e ao trocar de módulo).
  useEffect(() => {
    if (groupOfActive) {
      setOpenGroups(prev => ({ ...prev, [groupOfActive.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeModule]);

  const toggleGroup = (id) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  // Renderiza um item de navegação (direto ou sub-item de grupo).
  const renderNavItem = (item, isChild = false) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`relative w-full flex items-center justify-between ${isChild ? 'pl-3' : 'pl-3'} pr-3 py-2.5 rounded-xl transition-all duration-200 group ${
          isActive
            ? (theme === 'light' ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400')
            : (theme === 'light' ? 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')
        }`}
      >
        {/* Indicador de aba ativa (barra à esquerda) */}
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-300 ${
          isActive ? 'h-5 bg-emerald-500' : 'h-0 bg-transparent'
        }`} />

        <div className="flex items-center gap-3">
          {isChild ? (
            // Sub-item: ícone menor, sem pílula (hierarquia visual)
            <span className="flex items-center justify-center w-8 h-8">
              <Icon className={`w-4 h-4 transition-colors ${
                isActive ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400') : 'text-slate-400 group-hover:text-current'
              }`} />
            </span>
          ) : (
            // Item direto: ícone em pílula
            <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
              isActive
                ? (theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400')
                : (theme === 'light' ? 'bg-slate-100/60 text-slate-400 group-hover:bg-slate-200/70' : 'bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-300')
            }`}>
              <Icon className="w-4 h-4" />
            </span>
          )}
          <span className={`text-[13px] tracking-tight ${isActive ? 'font-bold' : isChild ? 'font-medium' : 'font-semibold'}`}>
            {item.label}
          </span>
        </div>

        {/* Badge "Premium" — só aparece para Free em itens premium-only */}
        {item.premiumOnly && isFreePlan && (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
            theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'
          }`}>
            PRO
          </span>
        )}
      </button>
    );
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
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-3 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>
            {activeModule === 'gastos' ? 'Controle de Gastos' : 'Construção de Patrimônio'}
          </div>

          {navEntries.map((entry) => {
            // ── ITEM DIRETO ──
            if (entry.type === 'item') {
              return renderNavItem(entry);
            }

            // ── GRUPO COLAPSÁVEL ──
            const GroupIcon = entry.icon;
            const isExpanded = !!openGroups[entry.id];
            const hasActiveChild = entry.children.some(c => c.id === activeTab);

            return (
              <div key={entry.id} className="select-none">
                <button
                  onClick={() => toggleGroup(entry.id)}
                  className={`w-full flex items-center justify-between pl-3 pr-2.5 py-2.5 rounded-xl transition-all duration-200 group ${
                    hasActiveChild && !isExpanded
                      ? (theme === 'light' ? 'text-emerald-700' : 'text-emerald-400')
                      : (theme === 'light' ? 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                      hasActiveChild
                        ? (theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400')
                        : (theme === 'light' ? 'bg-slate-100/60 text-slate-400 group-hover:bg-slate-200/70' : 'bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-300')
                    }`}>
                      <GroupIcon className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] font-bold tracking-tight">{entry.label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${
                    theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`} />
                </button>

                {/* Sub-itens — animação de altura via grid */}
                <div className={`grid transition-all duration-300 ease-in-out ${
                  isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}>
                  <div className="overflow-hidden">
                    <div className="pl-4 pt-0.5 space-y-0.5">
                      {entry.children.map(child => renderNavItem(child, true))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ajustes — item fixo, separado, acessível de qualquer módulo */}
          <div className={`pt-2 mt-2 border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
            {renderNavItem({ id: 'ajustes', label: 'Ajustes', icon: Settings })}
          </div>

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
