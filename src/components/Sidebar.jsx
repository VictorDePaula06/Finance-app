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
  PieChart
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { currentUser, logout } = useAuth();
  const { theme } = useTheme();

  const menuItems = [
    { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'metas', label: 'Metas', icon: Target },
    { id: 'transacoes', label: 'Transações', icon: Wallet },
    { id: 'cartoes', label: 'Cartões', icon: CreditCard },
    { id: 'investimentos', label: 'Investimentos', icon: PieChart },
    { id: 'analise', label: 'Análise', icon: TrendingUp },
    { id: 'ajustes', label: 'Ajustes', icon: Settings },
  ];

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
        <div className="p-8 flex flex-col items-center justify-center">
          <img src={logo} alt="Alívia Logo" className="w-48 h-48 object-contain drop-shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all hover:scale-105 duration-700" />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
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
              <p className="text-[10px] text-slate-500 truncate font-mono opacity-70">
                {currentUser?.email}
              </p>
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
              Alívia • v6.5.5
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
