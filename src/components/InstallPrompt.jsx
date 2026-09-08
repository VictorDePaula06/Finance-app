import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { isNativeApp } from '../services/nativeAuth';

// Card flutuante que ensina a instalar o app na tela inicial (PWA).
// Aparece SEMPRE no mobile web (navegador), enquanto o app não estiver instalado.
// O "X" só dispensa por esta sessão — volta a aparecer no próximo acesso/refresh.
const DISMISS_KEY = 'aliviaInstallDismissed';

export default function InstallPrompt() {
    const [show, setShow] = useState(false);
    // Detecta a plataforma uma vez, no init (evita setState dentro do effect).
    const [platform] = useState(() => {
        const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
        return (/iphone|ipad|ipod/.test(ua) || (/(macintosh)/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)) ? 'ios' : 'android';
    });
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // 1) No app NATIVO (Capacitor) já está instalado — nunca mostrar.
        if (isNativeApp()) return;

        // 2) Já instalado como PWA (standalone) — Android/desktop e iOS.
        const standalone = window.matchMedia?.('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (standalone) return;

        // 3) Dispensado nesta sessão? (volta no próximo acesso)
        try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch { /* ignore */ }

        // 4) Só no mobile (celular/tablet).
        const ua = (window.navigator.userAgent || '').toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua) || (/(macintosh)/.test(ua) && 'ontouchend' in document);
        const isAndroid = /android/.test(ua);
        if (!isIOS && !isAndroid) return;

        // Captura o prompt nativo do Android/Chrome (se disponível).
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShow(true); };
        window.addEventListener('beforeinstallprompt', handler);

        // Mostra logo (no iOS não existe beforeinstallprompt; no Android é fallback).
        const timer = setTimeout(() => setShow(true), 1200);
        return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(timer); };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setShow(false);
        setDeferredPrompt(null);
    };

    // Dispensa só por esta sessão — volta a aparecer no próximo acesso/refresh.
    const handleDismiss = () => {
        setShow(false);
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    };

    if (!show) return null;

    return (
        <div
            className="lg:hidden fixed left-3 right-3 z-[80] rounded-2xl border border-white/10 bg-[#0e1621]/95 backdrop-blur-md shadow-2xl p-4 animate-in slide-in-from-bottom-6 fade-in duration-500"
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
            role="dialog" aria-label="Instalar aplicativo"
        >
            <button onClick={handleDismiss} aria-label="Fechar"
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition">
                <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3.5">
                <span className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0 pr-5">
                    <h4 className="font-black text-white text-[15px] leading-tight">Instalar Aplicativo</h4>
                    <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">
                        Adicione à tela inicial para abrir rapidinho, como um app.
                    </p>

                    {platform === 'ios' ? (
                        <div className="mt-3 text-[12px] text-slate-300 space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/[0.06]">
                            <p className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                Toque em <Share className="w-4 h-4 text-emerald-400 shrink-0" /> <span className="font-bold">Compartilhar</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                <span><span className="font-bold">Adicionar à Tela de Início</span></span>
                            </p>
                        </div>
                    ) : deferredPrompt ? (
                        <button onClick={handleInstallClick}
                            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition active:scale-95 shadow-lg shadow-emerald-500/25">
                            <Download className="w-4 h-4" /> Instalar agora
                        </button>
                    ) : (
                        <div className="mt-3 text-[12px] text-slate-300 space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/[0.06]">
                            <p className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                Abra o menu do navegador (⋮)
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                <span className="inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5" /> <span className="font-bold">Instalar app</span> / Adicionar à tela inicial</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
