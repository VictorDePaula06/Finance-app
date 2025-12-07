import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Sparkles } from 'lucide-react';

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
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float -z-10" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-float -z-10" style={{ animationDelay: '3s' }} />

            <div className="glass-card p-10 rounded-3xl w-full max-w-md backdrop-blur-xl relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center mb-10">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 mb-6 animate-bounce-slow">
                        <LayoutDashboard className="h-12 w-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                        Finance Control
                    </h2>
                    <p className="text-slate-400 text-sm font-medium">
                        Gerencie seus ativos com inteligência
                    </p>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl relative mb-6 text-sm text-center font-medium" role="alert">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="group w-full bg-white hover:bg-slate-50 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                        ) : (
                            <>
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                                <span>Entrar com Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-700/50"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-[#0f172a] px-4 text-xs text-slate-500 uppercase tracking-widest bg-opacity-0 backdrop-blur-sm rounded-full">
                                Acesso Seguro
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-center items-center gap-2 text-xs text-slate-500">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        <span>Seus dados são criptografados</span>
                    </div>
                </div>
            </div>

            <footer className="absolute bottom-6 text-slate-500 text-xs font-medium">
                © {new Date().getFullYear()} Finance Control
            </footer>
        </div>
    );
}
