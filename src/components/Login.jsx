import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function Login() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginWithGoogle } = useAuth();

    async function handleGoogleLogin() {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
        } catch (e) {
            console.error(e);
            setError('Falha no login com Google.');
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50 font-sans">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-400/10 rounded-full blur-[120px] -z-10" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] -z-10" />

            <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in duration-700">
                {/* Header/Brand */}
                <div className="flex flex-col items-center mb-12">
                    <img 
                        src={logo} 
                        alt="Alívia Logo" 
                        className="w-48 h-auto object-contain mb-8 drop-shadow-sm brightness-0" 
                    />
                    
                    <div className="relative group">
                        <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl animate-pulse"></div>
                        <div className="p-1 rounded-[3rem] bg-gradient-to-br from-white to-emerald-50 shadow-2xl relative overflow-hidden">
                            <img 
                                src={aliviaFinal} 
                                alt="Alívia" 
                                className="w-48 h-48 md:w-56 md:h-56 object-cover rounded-[2.8rem] transition-transform duration-700 group-hover:scale-105"
                            />
                        </div>
                        <div className="absolute -bottom-2 -right-2 p-3 bg-white rounded-full shadow-xl border-2 border-emerald-50 animate-bounce-subtle">
                            <Sparkles className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        Acesse sua conta
                    </h1>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-4 rounded-2xl relative mb-8 text-sm text-center font-bold animate-shake" role="alert">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="group w-full bg-white hover:bg-slate-50 text-slate-900 font-bold py-5 px-8 rounded-[1.5rem] transition-all flex items-center justify-center gap-4 shadow-xl border border-slate-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="h-6 w-6 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
                        ) : (
                            <>
                                <svg className="w-6 h-6" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                <span className="tracking-tight text-lg text-slate-700">Acessar com Google</span>
                                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-slate-400" />
                            </>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-8 pt-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5" /> Seguro
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <Heart className="w-3.5 h-3.5" /> Privado
                        </div>
                    </div>
                </div>
            </div>

            <footer className="absolute bottom-10 text-slate-400 text-xs font-bold uppercase tracking-widest pointer-events-none opacity-50">
                © {new Date().getFullYear()} ALÍVIA
            </footer>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}} />
        </div>
    );
}
