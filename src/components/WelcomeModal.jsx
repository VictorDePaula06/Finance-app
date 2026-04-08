import React from 'react';
import { Sparkles, ArrowRight, X, Bot, ShieldCheck, Heart, TrendingUp, Target, Calendar } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function WelcomeModal({ onStartConfig, onSkip, theme }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className={`relative w-full max-w-xl max-h-[90vh] rounded-[2rem] md:rounded-[2.5rem] border overflow-y-auto shadow-2xl transition-all duration-700 animate-in zoom-in-95 slide-in-from-bottom-8 scrollbar-hide ${
                theme === 'light' 
                ? 'bg-white border-emerald-100 shadow-emerald-500/10' 
                : 'bg-slate-900 border-white/10 shadow-black/50'
            }`}>
                {/* Background Decoration */}
                <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[80px] pointer-events-none opacity-40 ${
                    theme === 'light' ? 'bg-emerald-400' : 'bg-blue-600'
                }`}></div>

                {/* Close Button */}
                <button 
                    onClick={onSkip}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                >
                    <X className="w-5 h-5 text-slate-400" />
                </button>

                <div className="relative p-8 md:p-12 text-center flex flex-col items-center">
                    {/* Alívia Persona Image */}
                    <div className="relative mb-8">
                        <div className={`p-1 rounded-[2.5rem] bg-gradient-to-br shadow-2xl animate-bounce-subtle ${
                            theme === 'light' ? 'from-emerald-100 to-white' : 'from-blue-600/20 to-emerald-500/20'
                        }`}>
                            <div className="rounded-[2.4rem] overflow-hidden border-4 border-white dark:border-slate-800 shadow-inner">
                                <img 
                                    src={aliviaFinal} 
                                    alt="Alívia" 
                                    className="w-32 h-32 md:w-40 md:h-40 object-cover"
                                />
                            </div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 p-3 bg-white rounded-full shadow-xl border-2 border-emerald-50">
                            <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
                        </div>
                    </div>

                    <h2 className={`text-3xl md:text-4xl font-black mb-4 tracking-tight ${
                        theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
                        Bem-vinda(o) à Alívia! 
                    </h2>
                    
                    <p className={`text-base md:text-lg mb-8 leading-relaxed ${
                        theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                        Sou sua nova assistente financeira. Estou aqui para transformar seus números em <span className="font-bold text-emerald-500 italic">paz de espírito</span>.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-10 text-left">
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <Bot className="w-5 h-5 text-emerald-500" />
                                <span className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>IA Consultora</span>
                            </div>
                            <p className="text-xs opacity-70">Tire dúvidas e peça dicas sobre suas finanças em tempo real com a Alívia.</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                <span className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Health Score</span>
                            </div>
                            <p className="text-xs opacity-70">Sua saúde financeira resumida em uma nota que se adapta aos seus hábitos.</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-purple-50/50 border-purple-100' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <Target className="w-5 h-5 text-purple-500" />
                                <span className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Metas de Vida</span>
                            </div>
                            <p className="text-xs opacity-70">Transforme sonhos em realidade acompanhando o progresso dos seus objetivos.</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-100' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="w-5 h-5 text-amber-500" />
                                <span className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Resumo Mensal</span>
                            </div>
                            <p className="text-xs opacity-70">Todo primeiro dia do mês, receba um feedback detalhado da sua evolução.</p>
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <button
                            onClick={onStartConfig}
                            className="group w-full max-w-sm py-5 px-8 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white rounded-[2rem] shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            <span className="font-bold text-lg leading-none">Configurar sua Alívia</span>
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </button>
                        
                        <button
                            onClick={onSkip}
                            className={`w-full py-4 text-sm font-bold transition-all border-none ${
                                theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            Explorar o sistema primeiro
                        </button>
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-12 flex items-center justify-center gap-6 opacity-40 grayscale pointer-events-none">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <ShieldCheck className="w-3 h-3" /> Seguro
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <Heart className="w-3 h-3" /> Privado
                        </div>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}
