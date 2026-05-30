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
  Gem,
  Star,
  Briefcase,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Umbrella
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { isLifetimeEmail } from '../constants/admins';
import logo from '../assets/logo.png';
import { version } from '../../package.json';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, activeModule, setActiveModule, healthScore }) => {
  const { currentUser, logout, isAdmin, isPremium, isTrial, isLifetime, subType, planLevel } = useAuth();
  const { theme } = useTheme();

  const isFreePlan = planLevel === 'free';

  // ── Saúde (card do topo) ──
  // Usa o statusLabel/improvements já calculados pela função de saúde do módulo.
  const hsScore = healthScore?.score ?? 0;
  const hsHasData = !!healthScore && hsScore > 0;
  const hsStatus = healthScore?.statusLabel || (
    hsScore >= 80 ? 'Excelente'
    : hsScore >= 60 ? 'Bom'
    : hsScore >= 40 ? 'Atenção'
    : hsScore > 0 ? 'Crítico'
    : 'Sem dados'
  );
  const hsColor = healthScore?.color || 'text-slate-400';
  const hsImprovements = healthScore?.improvements ?? 0;
  // Label do card varia por módulo: Gastos → "Saúde Financeira"; Patrimônio → "Saúde Patrimonial".
  const hsLabel = activeModule === 'patrimonio' ? 'Saúde Patrimonial' : 'Saúde Financeira';

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
      {
        type: 'group', id: 'grp_analise', label: 'Análise de Gastos', icon: TrendingUp,
        children: [
          { id: 'analise', label: 'Gastos por Período', icon: BarChart3 },
          { id: 'analise_cartoes', label: 'Movimentações Cartões', icon: CreditCard },
          { id: 'analise_metas', label: 'Metas de Gasto', icon: Target },
          { id: 'analise_comparativo', label: 'Comparativo', icon: PieChart },
        ],
      },
    ],
    patrimonio: [
      { type: 'section', label: 'Visão' },
      { type: 'item', id: 'patrimonio', label: 'Visão Geral', icon: LayoutDashboard },
      { type: 'item', id: 'fluxo', label: 'Fluxo Patrimonial', icon: Activity },

      { type: 'section', label: 'Meu Patrimônio' },
      {
        type: 'group', id: 'grp_ativos', label: 'Meu Patrimônio', icon: Star,
        children: [
          { id: 'reserva', label: 'Reserva de Emergência', icon: ShieldCheck },
          { id: 'investimentos', label: 'Investimentos', icon: PieChart },
          { id: 'bens', label: 'Bens & Imóveis', icon: Home, badge: 'Novo' },
          { id: 'previdencia', label: 'Previdência', icon: Briefcase, badge: 'Novo' },
        ],
      },

      { type: 'section', label: 'Planejamento' },
      {
        type: 'group', id: 'grp_plan', label: 'Planejamento', icon: Target,
        children: [
          { id: 'metas', label: 'Metas', icon: CheckCircle2 },
          { id: 'evolucao', label: 'Evolução Patrimonial', icon: BarChart3, premiumOnly: true },
          { id: 'independencia', label: 'Independência Financeira', icon: TrendingUp, badge: 'Novo' },
          { id: 'rebalanceamento', label: 'Rebalanceamento', icon: AlertTriangle, badge: 'Ação' },
        ],
      },

      { type: 'section', label: 'Proteção' },
      { type: 'item', id: 'seguros', label: 'Seguros & Proteção', icon: Umbrella, badge: 'Novo' },
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
        className={`relative w-full flex items-center justify-between ${isChild ? 'pl-3' : 'pl-3'} pr-3 py-1.5 rounded-xl border transition-all duration-300 group ${
          isActive
            ? (theme === 'light'
                ? 'bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-transparent border-emerald-100 text-emerald-700 shadow-sm'
                : 'bg-gradient-to-r from-emerald-500/[0.14] via-emerald-500/[0.05] to-transparent border-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/10')
            : (theme === 'light' ? 'border-transparent text-slate-500 hover:bg-slate-100/70 hover:text-slate-800' : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')
        }`}
      >
        {/* Indicador de aba ativa (barra à esquerda) */}
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-300 ${
          isActive ? 'h-5 bg-emerald-500' : 'h-0 bg-transparent'
        }`} />

        <div className="flex items-center gap-2.5">
          {isChild ? (
            // Sub-item: ícone menor, sem pílula (hierarquia visual)
            <span className="flex items-center justify-center w-7 h-7">
              <Icon className={`w-4 h-4 transition-colors ${
                isActive ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400') : 'text-slate-400 group-hover:text-current'
              }`} />
            </span>
          ) : (
            // Item direto: ícone em pílula
            <span className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-300 ${
              isActive
                ? (theme === 'light' ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-sm' : 'bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-500/20')
                : (theme === 'light' ? 'bg-slate-100/60 text-slate-400 group-hover:bg-slate-200/70' : 'bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-300')
            }`}>
              <Icon className="w-4 h-4" />
            </span>
          )}
          <span className={`tracking-tight text-left whitespace-nowrap ${isChild ? 'text-[11px]' : 'text-[13px]'} ${isActive ? 'font-bold' : isChild ? 'font-medium' : 'font-semibold'}`}>
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

        {/* Badge custom — "Novo" (violeta) ou "Ação" (laranja) */}
        {item.badge && (
          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
            item.badge === 'Ação'
              ? (theme === 'light' ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400')
              : (theme === 'light' ? 'bg-violet-100 text-violet-600' : 'bg-violet-500/20 text-violet-400')
          }`}>
            {item.badge}
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
          className="pt-5 px-6 pb-1 flex flex-col items-center justify-center cursor-pointer select-none"
          onDoubleClick={() => {
            if (isAdmin) {
              window.dispatchEvent(new CustomEvent('change-view', { detail: 'admin' }));
            }
          }}
        >
          <img
            src={logo}
            alt="Alívia Logo"
            className={`w-20 h-20 object-contain drop-shadow-[0_0_30px_rgba(16,185,129,0.18)] transition-all hover:scale-105 duration-700`}
          />
        </div>

        {/* Botão "Trocar Módulo" — pílula refinada com tipografia uppercase tracking-widest
            totalmente distinta dos itens de menu (que usam text-sm font-bold) */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setActiveModule('hub')}
            className={`group relative w-full overflow-hidden flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all duration-500 hover:scale-[1.02] active:scale-95 ${
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

        {/* Card de Saúde Financeira — resumo compacto do score com identidade Alívia */}
        {healthScore && (
          <div className="px-4 pb-2.5">
            <div className={`relative overflow-hidden rounded-xl border px-3.5 py-2.5 transition-all duration-500 ${
              theme === 'light'
                ? 'bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-100/80'
                : 'bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent border-white/5'
            }`}>
              {/* Glow decorativo */}
              <div className="absolute -top-10 -right-8 w-24 h-24 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {hsLabel}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 mb-1.5">
                  <div className="flex items-end gap-1">
                    <span className={`text-2xl font-black leading-none ${hsColor}`}>{hsScore}</span>
                    <span className="text-[9px] font-bold text-slate-500 mb-0.5">/ 100</span>
                  </div>
                  <div className="flex items-baseline gap-1 leading-none">
                    <span className={`text-[11px] font-black ${hsColor}`}>{hsStatus}</span>
                    {hsHasData && hsImprovements > 0 && (
                      <span className="text-[9px] font-medium text-slate-500">· {hsImprovements} {hsImprovements === 1 ? 'melhoria' : 'melhorias'}</span>
                    )}
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    style={{ width: `${Math.max(4, Math.min(100, hsScore))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto custom-scrollbar">
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 px-3 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>
            {activeModule === 'gastos' ? 'Controle de Gastos' : 'Construção de Patrimônio'}
          </div>

          {navEntries.map((entry, idx) => {
            // ── CABEÇALHO DE SEÇÃO ──
            if (entry.type === 'section') {
              return (
                <div
                  key={`section-${entry.label}-${idx}`}
                  className="flex items-center gap-2 px-3 pt-2.5 pb-1 select-none"
                >
                  <span className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                    theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {entry.label}
                  </span>
                  <span className={`flex-1 h-px ${
                    theme === 'light' ? 'bg-gradient-to-r from-slate-200/80 to-transparent' : 'bg-gradient-to-r from-white/[0.07] to-transparent'
                  }`} />
                </div>
              );
            }

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
                  className={`w-full flex items-center justify-between pl-3 pr-2.5 py-1.5 rounded-xl transition-all duration-200 group ${
                    hasActiveChild && !isExpanded
                      ? (theme === 'light' ? 'text-emerald-700' : 'text-emerald-400')
                      : (theme === 'light' ? 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-800' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100')
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ${
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
                    <div className="pl-3 pt-0.5 space-y-0.5">
                      {entry.children.map(child => renderNavItem(child, true))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ajustes — item fixo, separado, acessível de qualquer módulo */}
          <div className={`pt-1.5 mt-1.5 border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
            {renderNavItem({ id: 'ajustes', label: 'Ajustes', icon: Settings })}
          </div>

        </nav>

        {/* User Profile Section */}
        <div className={`px-4 pt-2.5 pb-3 border-t mt-auto ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
          <div className={`p-2.5 rounded-2xl border flex items-center gap-3 transition-all ${
            theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5 shadow-sm'
          }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
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
          <div className="mt-2 text-center">
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
