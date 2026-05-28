import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Settings, Check, Info } from 'lucide-react';

/**
 * Banner de consentimento LGPD-conforme.
 *
 * Diferente da versão anterior (que era um "dark pattern" com botão X que
 * aceitava), esta versão respeita o princípio de consentimento livre,
 * informado e específico (art. 5º, XII e art. 8º LGPD):
 *
 *   - Botão "Aceitar todos"     → consent.functional = true
 *   - Botão "Apenas essenciais" → consent.functional = false
 *   - Botão "Personalizar"      → painel com toggles individuais
 *   - X fecha o banner sem registrar consentimento (volta a aparecer)
 *
 * Cookies/localStorage são classificados em duas categorias:
 *
 *   essenciais (sempre ativos, sem necessidade de consentimento):
 *     - sessão/autenticação Firebase
 *     - preferências de UI (tema, esconder saldo)
 *     - aceite de termos
 *
 *   funcionais (opcionais, exigem consentimento):
 *     - chave de API do Gemini
 *     - histórico de chat da IA
 *     - cache de análises da IA
 *
 * NÃO usamos cookies de tracking/publicidade.
 */

const STORAGE_KEY = 'cookieConsent_v2';

export const getCookieConsent = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const hasFunctionalConsent = () => {
    const consent = getCookieConsent();
    return consent?.functional === true;
};

export default function CookieConsent() {
    const [show, setShow] = useState(false);
    const [customizing, setCustomizing] = useState(false);
    const [functionalEnabled, setFunctionalEnabled] = useState(true);

    useEffect(() => {
        const consent = getCookieConsent();
        if (!consent) {
            const timer = setTimeout(() => setShow(true), 800);
            return () => clearTimeout(timer);
        }
    }, []);

    const saveConsent = (functional) => {
        const payload = {
            version: '2.0',
            essential: true,
            functional,
            timestamp: new Date().toISOString(),
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            // Dispatch para qualquer listener do app reagir (ex: desativar IA se rejeitado)
            window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: payload }));
        } catch (err) {
            console.warn('[CookieConsent] localStorage indisponível:', err?.message);
        }
        setShow(false);
    };

    const handleAcceptAll = () => saveConsent(true);
    const handleOnlyEssential = () => saveConsent(false);
    const handleSaveCustom = () => saveConsent(functionalEnabled);
    const handleClose = () => setShow(false);

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-auto md:max-w-md z-[1000] animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative">
                <button
                    onClick={handleClose}
                    aria-label="Fechar banner"
                    className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4 mb-4 mt-2">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-1.5">Sua privacidade importa</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Usamos armazenamento local <strong className="text-emerald-400">essencial</strong> para
                            funcionar (login, preferências). Cookies <strong>funcionais</strong> (IA Alívia,
                            histórico de chat) são opcionais.{' '}
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'privacy' }))}
                                className="text-emerald-400 underline hover:text-emerald-300"
                            >
                                Ler política completa
                            </button>
                        </p>
                    </div>
                </div>

                {/* Painel de customização (toggle) */}
                {customizing && (
                    <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-3 animate-in fade-in duration-300">
                        {/* Essenciais — sempre ativos */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-200">Essenciais</p>
                                <p className="text-[10px] text-slate-500 leading-snug">
                                    Necessários para login, sessão e preferências básicas.
                                </p>
                            </div>
                            <div className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase tracking-widest shrink-0">
                                Sempre ativo
                            </div>
                        </div>

                        {/* Funcionais — opcionais */}
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-200">Funcionais</p>
                                <p className="text-[10px] text-slate-500 leading-snug">
                                    IA Alívia, histórico de chat, cache de análises.
                                </p>
                            </div>
                            <button
                                onClick={() => setFunctionalEnabled(v => !v)}
                                className={`w-10 h-6 rounded-full flex items-center px-1 shrink-0 transition-colors ${
                                    functionalEnabled ? 'bg-emerald-500 justify-end' : 'bg-white/10 justify-start'
                                }`}
                                aria-pressed={functionalEnabled}
                                aria-label="Ativar cookies funcionais"
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {customizing ? (
                        <>
                            <button
                                onClick={handleSaveCustom}
                                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Check className="w-3.5 h-3.5" /> Salvar Preferências
                            </button>
                            <button
                                onClick={() => setCustomizing(false)}
                                className="w-full py-2 text-slate-500 hover:text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                Voltar
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleAcceptAll}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Aceitar Todos
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleOnlyEssential}
                                    className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                >
                                    Apenas Essenciais
                                </button>
                                <button
                                    onClick={() => setCustomizing(true)}
                                    className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Settings className="w-3 h-3" /> Personalizar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
