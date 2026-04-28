import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, TrendingUp, ChevronRight, LayoutDashboard, Landmark, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Hub({ onSelectModule }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';

  const firstName = currentUser?.displayName?.split(' ')[0] || 'você';

  const modules = [
    {
      id: 'gastos',
      title: 'Controle de Gastos',
      description: 'Gerencie seu orçamento diário, visualize transações e acompanhe faturas de cartões.',
      icon: Wallet,
      color: 'blue',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      border: isDark ? 'border-blue-500/30' : 'border-blue-200',
      bgHover: isDark ? 'hover:bg-blue-500/10' : 'hover:bg-blue-50',
      iconColor: 'text-blue-500',
      iconBg: isDark ? 'bg-blue-500/20' : 'bg-blue-100'
    },
    {
      id: 'patrimonio',
      title: 'Construção de Patrimônio',
      description: 'Acompanhe seu Health Score, gerencie investimentos, cofrinhos e visualize seu crescimento financeiro.',
      icon: Landmark,
      color: 'emerald',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      border: isDark ? 'border-emerald-500/30' : 'border-emerald-200',
      bgHover: isDark ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50',
      iconColor: 'text-emerald-500',
      iconBg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
    }
  ];

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-6 transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 bg-blue-500" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 bg-emerald-500" />

      <div className="relative z-10 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-700 mt-12 md:mt-0">
        
        {/* Theme Toggle */}
        <div className="absolute -top-6 right-0 md:top-0 md:right-0 z-20">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-full transition-all border ${
              isDark
                ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-emerald-400'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-500 shadow-sm'
            }`}
            title="Alternar Tema"
          >
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <img src={logo} alt="Alívia Logo" className="w-24 h-24 object-contain drop-shadow-xl mb-6" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">Bem-vindo(a) de volta</p>
          <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            Olá, {firstName}! 👋
          </h1>
          <p className={`text-base md:text-lg max-w-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Qual é o seu foco hoje? Escolha o módulo que deseja explorar para direcionar as ferramentas do Alívia.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`group relative text-left p-8 rounded-[2.5rem] border backdrop-blur-md transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 shadow-xl hover:shadow-2xl ${
                  isDark ? 'bg-slate-900/80 border-white/10 shadow-black/50' : 'bg-white/80 border-slate-200 shadow-slate-200/50'
                } ${mod.border} ${mod.bgHover}`}
              >
                {/* Subtle Inner Glow on Hover */}
                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300 ${mod.iconBg}`}>
                      <Icon className={`w-8 h-8 ${mod.iconColor}`} />
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDark ? 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-900'
                    }`}>
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black mb-3">
                    {mod.title}
                  </h3>
                  <p className={`text-sm leading-relaxed flex-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {mod.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
