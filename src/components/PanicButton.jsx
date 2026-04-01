
import React, { useState } from 'react';
import { Octagon, X, MessageCircle, HeartPulse, Sparkles } from 'lucide-react';

export default function PanicButton({ onPanicClick }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-28 right-4 sm:right-6 w-16 h-16 flex items-center justify-center bg-rose-500 text-white rounded-full shadow-lg shadow-rose-900/20 hover:scale-110 transition-all z-40 group"
                title="Botão do Pânico"
            >
                <Octagon className="w-7 h-7 group-hover:animate-pulse" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="glass-card max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                        <div className="bg-rose-500/10 p-4 rounded-full w-fit mx-auto mb-6">
                            <HeartPulse className="w-12 h-12 text-rose-500" />
                        </div>
                        
                        <h3 className="text-2xl font-bold text-slate-100 mb-2">Calma, respira.</h3>
                        <p className="text-slate-400 text-sm mb-8">
                            A Alívia está aqui para ajudar. Recebeu uma conta inesperada ou uma notícia difícil? Vamos ver juntos como ajustar sua rota sem desespero.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onPanicClick("Preciso de ajuda com um gasto inesperado.");
                                }}
                                className="w-full bg-verde-respira text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Falar com a Alívia
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
                            >
                                Já estou melhor, obrigado.
                            </button>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
                            <Sparkles className="w-3 h-3" />
                            Ambiente Seguro
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
