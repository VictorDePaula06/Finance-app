import React from 'react';
import { Sparkles, Construction } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Tela de layout padrão (placeholder) para as novas abas do módulo
 * Construção de Patrimônio. Segue o mesmo padrão de header e cards das
 * demais abas (ex: EmergencyReserveTab), mas ainda sem conteúdo funcional.
 *
 * Props:
 *   - title:       título principal da aba
 *   - subtitle:    descrição curta sob o título
 *   - icon:        ícone (componente lucide) exibido no estado vazio
 *   - description: texto explicativo dentro do card de "em breve"
 *   - badge:       rótulo opcional ('Novo' | 'Ação')
 */
export default function PatrimonioPlaceholderTab({
    title = 'Nova Seção',
    subtitle = 'Em construção',
    icon: Icon = Construction,
    description = 'Esta funcionalidade está sendo preparada e estará disponível em breve.',
    badge,
}) {
    const { theme } = useTheme();

    const badgeStyles = badge === 'Ação'
        ? 'bg-orange-500/15 text-orange-400 border-orange-500/20'
        : 'bg-violet-500/15 text-violet-400 border-violet-500/20';

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area — mesmo padrão das demais abas do patrimônio */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {title}
                        </h2>
                        {badge && (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${badgeStyles}`}>
                                {badge}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Em breve</span>
                </div>
            </div>

            {/* Estado vazio — card padrão centralizado */}
            <div className={`flex flex-col items-center justify-center text-center gap-6 p-12 md:p-20 rounded-[2.5rem] border pat-card`}>
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
                    theme === 'light' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                    <Icon className="w-9 h-9" />
                </div>
                <div className="max-w-md">
                    <h3 className={`text-lg md:text-xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        {title} está chegando
                    </h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        {description}
                    </p>
                </div>
                <span className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full ${
                    theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'
                }`}>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Em desenvolvimento
                </span>
            </div>
        </div>
    );
}
