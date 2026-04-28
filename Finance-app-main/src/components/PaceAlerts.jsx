import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { useTheme } from '../contexts/ThemeContext';

const PaceAlerts = ({ paceAlerts }) => {
    const { theme } = useTheme();

    if (!paceAlerts || paceAlerts.length === 0) return null;

    return (
        <div className={`p-8 rounded-[2.5rem] border animate-in fade-in slide-in-from-bottom-4 duration-700 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas de Tranquilidade
            </h3>
            
            <div className="space-y-4">
                {paceAlerts.map((alert, idx) => (
                    <div
                        key={idx}
                        className={`p-6 rounded-3xl border flex items-start gap-4 transition-all hover:scale-[1.01] ${
                            alert.type === 'danger'
                            ? (theme === 'light' ? 'bg-rose-50 border-rose-100' : 'bg-rose-500/10 border-rose-500/20')
                            : (theme === 'light' ? 'bg-amber-50 border-amber-100' : 'bg-amber-500/10 border-amber-500/20')
                        }`}
                    >
                        <div className={`p-3 rounded-2xl shrink-0 ${
                            alert.type === 'danger' ? 'bg-rose-500/20' : 'bg-amber-500/20'
                        }`}>
                            <AlertTriangle className={`w-5 h-5 ${
                                alert.type === 'danger' ? 'text-rose-400' : 'text-amber-400'
                            }`} />
                        </div>
                        
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-center">
                                <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                                    {CATEGORIES.expense.find(c => c.id === alert.categoryId)?.label}
                                </p>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                                    alert.type === 'danger' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                    {Math.round(alert.usage * 100)}% usado
                                </span>
                            </div>
                            
                            <p className={`text-xs leading-relaxed font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                {alert.message}
                            </p>
                            
                            <div className={`w-full h-2 rounded-full overflow-hidden ${
                                theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'
                            }`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                        alert.type === 'danger' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                                    }`}
                                    style={{ width: `${Math.min(alert.usage * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PaceAlerts;
