import { Sparkles, ArrowRight, ArrowLeft, X, Bot, ShieldCheck, Heart, TrendingUp, Target, Calendar, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function WelcomeModal({ onStartConfig, onSkip, theme }) {
    const [step, setStep] = useState(0);

    const slides = [
        {
            title: "Bem-vinda(o) à Alívia!",
            description: "Esqueça as planilhas chatas. Estou aqui para transformar seus números em paz de espírito e liberdade real.",
            icon: (
                <div className={`p-1 rounded-[2.5rem] bg-gradient-to-br shadow-2xl animate-bounce-subtle ${
                    theme === 'light' ? 'from-emerald-100 to-white' : 'from-blue-600/20 to-emerald-500/20'
                }`}>
                    <div className="rounded-[2.4rem] overflow-hidden border-4 border-white dark:border-slate-800 shadow-inner">
                        <img src={aliviaFinal} alt="Alívia" className="w-32 h-32 md:w-40 md:h-40 object-cover" />
                    </div>
                </div>
            ),
            badge: <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />,
            color: "text-emerald-500"
        },
        {
            title: "IA Consultora",
            subtitle: "CONVERSE COMIGO",
            description: "Você pode me perguntar: 'Quanto gastei com mercado?' ou 'Dá para economizar este mês?'. Eu analiso seus dados e te respondo na hora.",
            icon: (
                <div className="p-8 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20">
                    <Bot className="w-20 h-20 text-emerald-500" />
                </div>
            ),
            color: "text-emerald-500"
        },
        {
            title: "Health Score",
            subtitle: "SUE SAÚDE FINANCEIRA",
            description: "Sua 'Nota de Paz' mostra como está seu equilíbrio entre ganhos, gastos e metas. Ela se adapta em tempo real aos seus lançamentos.",
            icon: (
                <div className="p-8 bg-blue-500/10 rounded-[2.5rem] border border-blue-500/20">
                    <TrendingUp className="w-20 h-20 text-blue-500" />
                </div>
            ),
            color: "text-blue-500"
        },
        {
            title: "Metas de Vida",
            subtitle: "FOCO NO FUTURO",
            description: "Defina seus sonhos e eu te ajudo a calcular quanto falta para chegar lá. Ver o progresso visual é o segredo para não desistir.",
            icon: (
                <div className="p-8 bg-purple-500/10 rounded-[2.5rem] border border-purple-500/20">
                    <Target className="w-20 h-20 text-purple-500" />
                </div>
            ),
            color: "text-purple-500"
        },
        {
            title: "Resumo Mensal",
            subtitle: "EVOLUÇÃO CONSTANTE",
            description: "Todo primeiro dia do mês, eu preparo um relatório carinhoso e realista sobre sua evolução, com dicas exclusivas para o próximo mês.",
            icon: (
                <div className="p-8 bg-amber-500/10 rounded-[2.5rem] border border-amber-500/20">
                    <Calendar className="w-20 h-20 text-amber-500" />
                </div>
            ),
            color: "text-amber-500"
        }
    ];

    const currentSlide = slides[step];

    const nextStep = () => {
        if (step < slides.length - 1) setStep(step + 1);
        else onStartConfig();
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className={`relative w-full max-w-xl max-h-[90vh] rounded-[2rem] md:rounded-[3rem] border overflow-y-auto shadow-2xl transition-all duration-500 animate-in zoom-in-95 slide-in-from-bottom-8 scrollbar-hide ${
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
                    {/* Progress Indicator */}
                    <div className="flex gap-2 mb-8">
                        {slides.map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    i === step 
                                    ? `w-8 ${step === 0 ? 'bg-emerald-500' : step === 1 ? 'bg-emerald-500' : step === 2 ? 'bg-blue-500' : step === 3 ? 'bg-purple-500' : 'bg-amber-500'}` 
                                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Badge Subtitle */}
                    {currentSlide.subtitle && (
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${currentSlide.color}`}>
                            {currentSlide.subtitle}
                        </p>
                    )}

                    {/* Main Icon Area */}
                    <div className="relative mb-10">
                        {currentSlide.icon}
                        {currentSlide.badge && (
                            <div className="absolute -bottom-2 -right-2 p-3 bg-white rounded-full shadow-xl border-2 border-emerald-50">
                                {currentSlide.badge}
                            </div>
                        )}
                    </div>

                    {/* Text Area */}
                    <div className="min-h-[160px] flex flex-col items-center">
                        <h2 className={`text-3xl md:text-4xl font-black mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>
                            {currentSlide.title}
                        </h2>
                        
                        <p className={`text-base md:text-lg mb-4 leading-relaxed max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700 ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                        }`}>
                            {currentSlide.description}
                        </p>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="w-full flex flex-col items-center gap-4 mt-8">
                        <button
                            onClick={nextStep}
                            className={`group w-full max-w-sm py-5 px-8 text-white rounded-[2rem] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 ${
                                step === slides.length - 1 
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/20' 
                                : `bg-gradient-to-r ${step === 0 || step === 1 ? 'from-blue-600 to-emerald-500 shadow-emerald-500/20' : step === 2 ? 'from-blue-500 to-blue-600 shadow-blue-500/20' : step === 3 ? 'from-purple-500 to-purple-600 shadow-purple-500/20' : 'from-amber-500 to-amber-600 shadow-amber-500/20'}`
                            }`}
                        >
                            <span className="font-bold text-lg leading-none">
                                {step === slides.length - 1 ? 'Começar Configuração' : 'Próximo Passo'}
                            </span>
                            {step === slides.length - 1 ? <CheckCircle2 className="w-6 h-6" /> : <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />}
                        </button>
                        
                        <div className="flex items-center gap-6">
                            {step > 0 && (
                                <button
                                    onClick={prevStep}
                                    className={`flex items-center gap-2 p-2 text-sm font-bold transition-all ${
                                        theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <ArrowLeft className="w-4 h-4" /> Voltar
                                </button>
                            )}
                            
                            {step < slides.length - 1 && (
                                <button
                                    onClick={onSkip}
                                    className={`p-2 text-sm font-bold transition-all ${
                                        theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    Pular Tudo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    {step === 0 && (
                        <div className="mt-12 flex items-center justify-center gap-6 opacity-40 grayscale pointer-events-none">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                <ShieldCheck className="w-3 h-3" /> Seguro
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                <Heart className="w-3 h-3" /> Privado
                            </div>
                        </div>
                    )}
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
