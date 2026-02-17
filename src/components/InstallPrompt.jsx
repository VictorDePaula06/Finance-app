import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState('desktop'); // 'desktop', 'ios', 'android'
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        // Check if dismissed previously in this session
        if (sessionStorage.getItem('installPromptDismissed')) {
            return;
        }

        const ua = window.navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua);
        const isAndroid = /android/.test(ua);

        if (isIOS) {
            setPlatform('ios');
            const timer = setTimeout(() => setShow(true), 2000);
            return () => clearTimeout(timer);
        } else if (isAndroid) {
            setPlatform('android');
            // Wait for beforeinstallprompt event for Android, but also set a fallback timer
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        } else {
            setPlatform('desktop');
        }

        const handler = (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShow(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // Optionally, send analytics event with outcome of user choice
        if (outcome === 'accepted') {
            setShow(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShow(false);
        sessionStorage.setItem('installPromptDismissed', 'true');
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-800/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors"
                aria-label="Fechar guia de instalação"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex gap-4">
                <div className="bg-blue-600/20 p-3 rounded-xl h-fit flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-slate-100 mb-1">Instalar App</h4>
                    <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                        Adicione à tela inicial para acesso rápido e modo offline.
                    </p>

                    {platform === 'ios' ? (
                        <div className="text-xs text-slate-300 space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                            <p className="flex items-center gap-2">
                                <span className="bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                                Toque em <Share className="w-4 h-4 text-blue-400" /> <span className="font-semibold">Compartilhar</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                                Selecione <PlusSquare className="w-4 h-4 text-slate-200" /> <span className="font-semibold">Adicionar à Tela de Início</span>
                            </p>
                        </div>
                    ) : (
                        deferredPrompt ? (
                            <button
                                onClick={handleInstallClick}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 px-4 rounded-lg w-full transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Instalar Agora
                            </button>
                        ) : (
                            <div className="text-xs text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                <p className="mb-1 font-semibold text-slate-200">Para instalar:</p>
                                <p className="flex items-center gap-2">
                                    1. Toque no menu do navegador (três pontos)
                                </p>
                                <p className="flex items-center gap-2 mt-1">
                                    2. Selecione <span className="font-bold flex items-center gap-1"><PlusSquare className="w-3 h-3" /> Instalar aplicativo</span> ou <span className="font-bold">Adicionar à tela inicial</span>
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
