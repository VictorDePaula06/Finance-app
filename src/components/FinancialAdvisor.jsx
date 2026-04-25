
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { calculateFinancialHealth, calculateSpendingPace } from '../utils/financialLogic';
import { CATEGORIES } from '../constants/categories';
import { validateApiKey } from '../services/gemini';

import { Bot, Settings, X, Save, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle, Calculator, Video, ChevronDown, Moon, Sun, Trash2, CreditCard, Pencil, Check } from 'lucide-react';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

import { useTheme } from '../contexts/ThemeContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function FinancialAdvisor({ transactions, manualConfig, onConfigChange, onToggleConfig, onGoToSettings }) {
    const { theme, toggleTheme } = useTheme();
    const { saveUserPreferences, getUserPreferences, isPremium, userPrefs, deleteAccount } = useAuth();
    
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingSubId, setEditingSubId] = useState(null);
    const [editingValues, setEditingValues] = useState({ 
        name: '', 
        amount: '', 
        totalInstallments: '', 
        currentInstallment: '' 
    });

    // Lock body scroll when delete confirmation is open
    useEffect(() => {
        if (showDeleteConfirm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showDeleteConfirm]);

    // Notify parent when configuration mode changes
    useEffect(() => {
        if (onToggleConfig) {
            onToggleConfig(isConfiguring);
        }
    }, [isConfiguring, onToggleConfig]);

    // Inherit config from parent
    const [tempManualConfig, setTempManualConfig] = useState(manualConfig);
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState('');
    const [isWealthLocked, setIsWealthLocked] = useState(true);
    const [showConfirmUnlock, setShowConfirmUnlock] = useState(false);

    // Sync temp config with prop when config mode is entered
    useEffect(() => {
        if (isConfiguring) {
            setTempManualConfig(manualConfig);
            setIsWealthLocked(true); 
            setShowConfirmUnlock(false);
            
            // Sync API Key from userPrefs (cloud) or localStorage (fallback)
            const savedKey = userPrefs?.apiKey || localStorage.getItem('user_gemini_api_key') || '';
            setApiKey(savedKey);
            if (userPrefs?.apiKey) {
                localStorage.setItem('user_gemini_api_key', userPrefs.apiKey);
            }
            setError(''); 
        }
    }, [isConfiguring, manualConfig, userPrefs]);








    const health = useMemo(() => calculateFinancialHealth(transactions, manualConfig), [transactions, manualConfig]);

    const [isLoading, setIsLoading] = useState(false);






    const handleSaveConfig = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setIsConfiguring(true); // Keep modal open during validation
        setError('');

        // Validate Key if one is provided
        if (apiKey.trim()) {
            const isValid = await validateApiKey(apiKey.trim());
            if (!isValid) {
                setError("Chave de API inválida ou expirada. Verifique no Google AI Studio.");
                setIsSaving(false);
                return;
            }
            localStorage.setItem('user_gemini_api_key', apiKey.trim());
            // Sync with Firestore
            saveUserPreferences({ apiKey: apiKey.trim() });
        } else {
            localStorage.removeItem('user_gemini_api_key');
            // Sync with Firestore (remove key)
            saveUserPreferences({ apiKey: '' });
        }

        // Final config
        const finalConfig = { ...tempManualConfig };
        // Handle value changes (investedAt is no longer used for additive model, but we keep it compatible if needed)
        if (tempManualConfig.invested !== manualConfig.invested) {
            finalConfig.investedAt = Date.now();
        }

        onConfigChange(finalConfig); // Parent handles saving

        // Show feedback before closing
        setTimeout(() => {
            setIsSaving(false);
            setIsConfiguring(false);
        }, 1000);
    };

    const handleDeleteAccount = async () => {
        try {
            setIsDeletingAccount(true);
            await deleteAccount();
        } catch (error) {
            console.error("Falha ao excluir conta:", error);
            alert("Erro ao excluir conta. Re-autentique-se e tente novamente.");
            setIsDeletingAccount(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!health.hasData && !manualConfig.income) {
        return (
            <div className="glass-card p-8 text-center relative overflow-hidden group">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#69C8B9]/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#5CCEEA]/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative mb-8 animate-in zoom-in duration-700">
                        <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-3xl animate-pulse"></div>
                        <img 
                            src={aliviaFinal} 
                            alt="Alívia" 
                            className="w-56 h-56 object-cover rounded-full border-4 border-white/50 shadow-2xl relative z-10"
                        />
                    </div>

                    <h3 className={`text-2xl font-black mb-2 tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        Ative sua Alívia 🍃
                    </h3>

                    <p className={`text-sm max-w-md mx-auto mb-8 leading-relaxed font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        Desbloqueie o poder da Inteligência Artificial para analisar seus gastos, prever seu saldo futuro e receber o acolhimento financeiro que você merece.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-8 text-left">
                        <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 hover:border-[#69C8B9]/30 transition-all shadow-sm hover:shadow-md">
                            <Calculator className="w-5 h-5 text-[#69C8B9] mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">Simulação Útil</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-tight">Saiba se uma compra cabe na sua vida financeira sem estresse.</p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 hover:border-[#69C8B9]/30 transition-all shadow-sm hover:shadow-md">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">Avisos Reais</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-tight">Receba orientações antes de comprometer seu equilíbrio.</p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 hover:border-[#69C8B9]/30 transition-all shadow-sm hover:shadow-md">
                            <CheckCircle className="w-5 h-5 text-[#5CCEEA] mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">Paz Mental</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-tight">Sugestões e acolhimento baseados nos seus objetivos.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => onGoToSettings()}
                        className="bg-[#69C8B9] hover:bg-[#5CCEEA] text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-[#69C8B9]/20 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Settings className="w-5 h-5" />
                        Começar Agora
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="glass-card p-6 relative overflow-hidden transition-all hover:bg-white/10">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl overflow-hidden border ${theme === 'light' ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                        <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-lg" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-black flex items-center gap-2 tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                            Sua Alívia
                            {health.isManual && (
                                <span className="bg-[#69C8B9]/10 text-[#69C8B9] text-[9px] px-2 py-0.5 rounded-full border border-[#69C8B9]/20 font-bold tracking-wider">
                                    ATIVA
                                </span>
                            )}
                        </h3>
                        <p className={`text-xs font-medium italic ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Transformando ansiedade em tranquilidade</p>
                    </div>
                </div>
                <button
                    onClick={() => onGoToSettings()}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                    title="Configurar Renda e Margens"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className={`p-4 rounded-2xl border shadow-sm transition-all flex flex-col items-center justify-center text-center ${
                    theme === 'light' 
                    ? 'bg-slate-50 border-slate-100 hover:bg-slate-100/50 hover:border-emerald-200' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-emerald-500/30'
                }`}>
                    <p className={`text-[10px] mb-1 font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Saldo Livre Estimado</p>
                    <p className={`font-black text-xl ${health.disposableIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {health.disposableIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
                <div className={`p-4 rounded-2xl border shadow-sm transition-all flex flex-col items-center justify-center text-center ${
                    theme === 'light' 
                    ? 'bg-slate-50 border-slate-100 hover:bg-slate-100/50 hover:border-blue-200' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/30'
                }`}>
                    <p className={`text-[10px] mb-1 font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Renda Média</p>
                    <p className="font-black text-xl text-blue-400">
                        {health.averageIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>



        </div>
    );
}
