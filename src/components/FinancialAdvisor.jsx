
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

export default function FinancialAdvisor({ transactions, manualConfig, onConfigChange, onToggleConfig }) {
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
    const paceAlerts = useMemo(() => calculateSpendingPace(transactions, manualConfig), [transactions, manualConfig]);

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

    if (isConfiguring) {
        return (
            <div className="glass-card p-6 relative overflow-hidden transition-all">
                <div className="flex justify-between items-center mb-6 border-b border-emerald-100/30 dark:border-white/10 pb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                        <Settings className="w-5 h-5 text-emerald-500" />
                        Configurar Alívia
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-black tracking-widest uppercase ${theme === 'light'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {theme === 'light' ? (
                                <>
                                    <Moon className="w-3.5 h-3.5" />
                                    Escuro
                                </>
                            ) : (
                                <>
                                    <Sun className="w-3.5 h-3.5" />
                                    Claro
                                </>
                            )}
                        </button>
                        <button onClick={() => setIsConfiguring(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <form key="advisor-config-form" onSubmit={handleSaveConfig} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tight">Renda Mensal Média (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.income ?? ''}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, income: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, income: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 5000.00"
                            className={`w-full border rounded-lg px-3 py-2 transition-all shadow-sm focus:outline-none ${
                                theme === 'light'
                                ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:border-emerald-300'
                                : 'bg-slate-900/50 border-slate-700 text-slate-100 focus:border-emerald-500/50'
                            }`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tight">Gastos Fixos Mensais (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.fixedExpenses ?? ''}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: parseFloat(e.target.value) || 0 })}
                            placeholder="Aluguel, Internet, etc."
                            className={`w-full border rounded-lg px-3 py-2 transition-all shadow-sm focus:outline-none ${
                                theme === 'light'
                                ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:border-emerald-300'
                                : 'bg-slate-900/50 border-slate-700 text-slate-100 focus:border-emerald-500/50'
                            }`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-tight">Estimativa de Variáveis (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.variableEstimate ?? ''}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, variableEstimate: e.target.value })}
                            placeholder="Média de fatura de cartão"
                            className={`w-full border rounded-lg px-3 py-2 transition-all shadow-sm focus:outline-none ${
                                theme === 'light'
                                ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:border-emerald-300'
                                : 'bg-slate-900/50 border-slate-700 text-slate-100 focus:border-emerald-500/50'
                            }`}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Se não preencher, usaremos a média do seu histórico de transações.
                        </p>
                    </div>
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-emerald-400">Saldo Inicial / Patrimônio Externo (R$)</label>
                            {isWealthLocked ? (
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmUnlock(true)}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                    <Calculator className="w-3 h-3" />
                                    Forçar Ajuste
                                </button>
                            ) : (
                                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Ajuste Liberado
                                </span>
                            )}
                        </div>

                        {showConfirmUnlock && (
                            <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <p className="text-[10px] text-slate-300 mb-2 leading-relaxed">
                                    Tem certeza que deseja ajustar manualmente seu valor base?
                                    Isso mudará o ponto inicial da sua tranquilidade financeira.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsWealthLocked(false);
                                            setShowConfirmUnlock(false);
                                        }}
                                        className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors font-bold"
                                    >
                                        Sim, confirmar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmUnlock(false)}
                                        className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <input
                                type="number"
                                disabled={isWealthLocked}
                                value={tempManualConfig.invested ?? ''}
                                onChange={e => setTempManualConfig({ ...tempManualConfig, invested: e.target.value })}
                                onBlur={e => setTempManualConfig({ ...tempManualConfig, invested: parseFloat(e.target.value) || 0 })}
                                placeholder="Ex: 10000.00"
                                className={`w-full border rounded-lg px-3 py-2 transition-all shadow-sm ${isWealthLocked
                                    ? theme === 'light'
                                        ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-400 cursor-not-allowed opacity-60'
                                        : 'bg-slate-900/30 border-slate-700 text-slate-500 cursor-not-allowed'
                                    : theme === 'light'
                                        ? 'bg-white border-purple-300 text-slate-800 focus:outline-none ring-2 ring-purple-100'
                                        : 'bg-slate-800 border-purple-500/50 text-slate-100 focus:outline-none ring-2 ring-purple-500/20'
                                    }`}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Este valor é **ADITIVO** e soma ao patrimônio calculado pelo seu histórico de lançamentos. Deixe **0** para usar apenas as transações.
                        </p>
                    </div>


                    <div className="pt-6 border-t border-emerald-100/50">
                        <div className="flex flex-col gap-2 mb-4">
                            <label className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Margem de Segurança por Categoria
                            </label>
                            <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed transition-all ${
                                theme === 'light'
                                ? 'bg-blue-50/50 border-blue-100 text-slate-600'
                                : 'bg-blue-500/5 border-blue-500/20 text-slate-400'
                            }`}>
                                <p>
                                    <span className="font-bold text-blue-400 mr-1">O que é isso?</span> 
                                    Defina quanto você pretende gastar no máximo em cada categoria. A Alívia usará esses valores para monitorar seu ritmo e te avisar se você estiver gastando rápido demais, garantindo que o dinheiro dure até o fim do mês.
                                </p>
                            </div>
                        </div>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border max-h-[400px] overflow-y-auto scrollbar-thin ${
                            theme === 'light'
                            ? 'bg-[#f0fdfa]/30 border-emerald-100/50 scrollbar-thumb-slate-200'
                            : 'bg-slate-900/30 border-slate-700/50 scrollbar-thumb-slate-700'
                        }`}>
                            {CATEGORIES.expense.map(cat => (
                                <div key={cat.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                                    theme === 'light'
                                    ? 'bg-white/80 border-slate-100 hover:border-emerald-200'
                                    : 'bg-slate-800/40 border-slate-700/50 hover:border-emerald-500/30'
                                }`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1.5 rounded-lg shrink-0 ${theme === 'light' ? 'bg-slate-50' : 'bg-slate-900/50'}`}>
                                            <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                        </div>
                                        <span className={`text-[12px] font-bold truncate ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{cat.label}</span>
                                    </div>
                                    <div className="relative shrink-0">
                                        <input
                                            type="number"
                                            value={tempManualConfig.categoryBudgets?.[cat.id] || ''}
                                            onChange={e => {
                                                const newBudgets = { ...tempManualConfig.categoryBudgets, [cat.id]: e.target.value };
                                                setTempManualConfig({ ...tempManualConfig, categoryBudgets: newBudgets });
                                            }}
                                            placeholder="0,00"
                                            className={`w-28 border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none shadow-sm pr-7 transition-all ${
                                                theme === 'light'
                                                ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10'
                                                : 'bg-slate-900 border-slate-600 text-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                                            }`}
                                        />
                                        <span className={`absolute right-3 top-2.5 text-[10px] font-black ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>R$</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700/50">
                        {error && (
                            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-200 text-xs animate-in slide-in-from-top-1">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                {error}
                            </div>
                        )}
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-2">
                            Chave de API do Gemini (Opcional)
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Avançado</span>
                        </label>
                        <input
                            type="text"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="Cole sua API Key aqui para usar seu próprio limite"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-500 mt-1 flex justify-between items-center">
                            <span>Se preenchida, usa sua própria margem de segurança.</span>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                            >
                                Obter chave gratuita
                            </a>
                        </p>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-400 hover:text-white transition-colors">
                                <span className="flex items-center gap-2">
                                    <Video className="w-4 h-4" />
                                    Como obter uma chave? (Tutorial em Vídeo)
                                </span>
                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="mt-3 text-xs text-slate-400 space-y-2">
                                <p>1. Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.</p>
                                <p>2. Crie uma nova chave de API (é gratuito).</p>
                                <p>3. Cole a chave no campo acima.</p>
                                <div className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-black">
                                    <video
                                        src={tutorialVideo}
                                        controls
                                        className="w-full max-h-48 object-contain"
                                    >
                                        Seu navegador não suporta a tag de vídeo.
                                    </video>
                                </div>
                            </div>
                        </details>
                    </div>

                    {/* Recurring Subscriptions Management */}
                    <div className="pt-6 border-t border-emerald-100/50">
                        <div className="flex flex-col gap-2 mb-4">
                            <label className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Assinaturas e Base do Cartão
                            </label>
                            <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed transition-all ${
                                theme === 'light'
                                ? 'bg-purple-50/50 border-purple-100 text-slate-600'
                                : 'bg-purple-500/5 border-purple-500/20 text-slate-400'
                            }`}>
                                <p>
                                    <span className="font-bold text-purple-400 mr-1">Base Fixa:</span> 
                                    Cadastre aqui assinaturas (Spotify, Netflix) que você paga via cartão. Elas não aparecerão individualmente no extrato, mas a Alívia as considerará como um compromisso fixo mensal automático.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(tempManualConfig.recurringSubs || []).map((sub, idx) => {
                                const isEditing = editingSubId === sub.id;
                                return (
                                    <div key={sub.id || idx} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                        theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-800/40 border-slate-700/50'
                                    }`}>
                                        {isEditing ? (
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    value={editingValues.name}
                                                    onChange={e => setEditingValues({ ...editingValues, name: e.target.value })}
                                                    className={`px-2 py-1 text-xs rounded border focus:outline-none ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-700 text-white'
                                                    }`}
                                                />
                                                <input
                                                    type="number"
                                                    value={editingValues.amount}
                                                    onChange={e => setEditingValues({ ...editingValues, amount: e.target.value })}
                                                    placeholder="Valor R$"
                                                    className={`px-2 py-1 text-xs rounded border focus:outline-none ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-700 text-white'
                                                    }`}
                                                />
                                                <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Parcela Atual</label>
                                                        <input
                                                            type="number"
                                                            value={editingValues.currentInstallment}
                                                            onChange={e => setEditingValues({ ...editingValues, currentInstallment: e.target.value })}
                                                            placeholder="Ex: 5"
                                                            className={`px-2 py-1 text-[10px] rounded border focus:outline-none ${
                                                                theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-700 text-white'
                                                            }`}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Total de Parcelas</label>
                                                        <input
                                                            type="number"
                                                            value={editingValues.totalInstallments}
                                                            onChange={e => setEditingValues({ ...editingValues, totalInstallments: e.target.value })}
                                                            placeholder="Ex: 12"
                                                            className={`px-2 py-1 text-[10px] rounded border focus:outline-none ${
                                                                theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-700 text-white'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1">
                                                <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{sub.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] text-slate-500 font-medium">R$ {parseFloat(sub.amount).toFixed(2)}</p>
                                                    {sub.totalInstallments > 0 && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                            theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-700/50 text-slate-400'
                                                        }`}>
                                                            Parcela {sub.currentInstallment} de {sub.totalInstallments}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newSubs = [...tempManualConfig.recurringSubs];
                                                            newSubs[idx] = { 
                                                                ...sub, 
                                                                name: editingValues.name, 
                                                                amount: parseFloat(editingValues.amount) || 0,
                                                                currentInstallment: parseInt(editingValues.currentInstallment) || 0,
                                                                totalInstallments: parseInt(editingValues.totalInstallments) || 0
                                                            };
                                                            setTempManualConfig({ ...tempManualConfig, recurringSubs: newSubs });
                                                            setEditingSubId(null);
                                                        }}
                                                        className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingSubId(null)}
                                                        className="p-2 text-slate-400 hover:bg-slate-500/10 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingSubId(sub.id);
                                                            setEditingValues({ 
                                                                name: sub.name, 
                                                                amount: sub.amount,
                                                                currentInstallment: sub.currentInstallment || '',
                                                                totalInstallments: sub.totalInstallments || ''
                                                            });
                                                        }}
                                                        className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newSubs = tempManualConfig.recurringSubs.filter((_, i) => i !== idx);
                                                            setTempManualConfig({ ...tempManualConfig, recurringSubs: newSubs });
                                                        }}
                                                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className={`p-4 rounded-2xl border-2 border-dashed flex flex-col gap-3 ${
                                theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-800'
                            }`}>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        id="new-sub-name"
                                        placeholder="Ex: Spotify"
                                        className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 ${
                                            theme === 'light' ? 'bg-white border-slate-200 focus:ring-blue-400' : 'bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50'
                                        }`}
                                    />
                                    <input
                                        type="number"
                                        id="new-sub-amount"
                                        placeholder="Valor R$"
                                        className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 ${
                                            theme === 'light' ? 'bg-white border-slate-200 focus:ring-blue-400' : 'bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50'
                                        }`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-black text-slate-500 ml-1 tracking-widest">Parcela Atual</label>
                                        <input
                                            type="number"
                                            id="new-sub-current"
                                            placeholder="Ex: 1"
                                            className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 ${
                                                theme === 'light' ? 'bg-white border-slate-200 focus:ring-blue-400' : 'bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] uppercase font-black text-slate-500 ml-1 tracking-widest">Total Parcelas</label>
                                        <input
                                            type="number"
                                            id="new-sub-total"
                                            placeholder="Ex: 12"
                                            className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 ${
                                                theme === 'light' ? 'bg-white border-slate-200 focus:ring-blue-400' : 'bg-slate-900 border-slate-700 text-white focus:ring-blue-500/50'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nameEl = document.getElementById('new-sub-name');
                                        const amountEl = document.getElementById('new-sub-amount');
                                        const currentEl = document.getElementById('new-sub-current');
                                        const totalEl = document.getElementById('new-sub-total');
                                        
                                        if (nameEl.value && amountEl.value) {
                                            const newSub = { 
                                                id: Date.now().toString(), 
                                                name: nameEl.value, 
                                                amount: parseFloat(amountEl.value),
                                                currentInstallment: parseInt(currentEl.value) || 0,
                                                totalInstallments: parseInt(totalEl.value) || 0
                                            };
                                            const currentSubs = tempManualConfig.recurringSubs || [];
                                            setTempManualConfig({ ...tempManualConfig, recurringSubs: [...currentSubs, newSub] });
                                            nameEl.value = '';
                                            amountEl.value = '';
                                            currentEl.value = '';
                                            totalEl.value = '';
                                        }
                                    }}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                                >
                                    Adicionar Assinatura
                                </button>
                            </div>
                        </div>

                        {(tempManualConfig.recurringSubs || []).length > 0 && (
                            <div className="mt-3 flex justify-between items-center px-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Total Mensal:</span>
                                <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-purple-400'}`}>
                                    R$ {tempManualConfig.recurringSubs.reduce((acc, s) => acc + parseFloat(s.amount), 0).toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Danger Zone */}
                    <div className={`mt-8 pt-6 border-t ${theme === 'light' ? 'border-rose-100' : 'border-rose-500/20'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Zona de Perigo
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                                theme === 'light'
                                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                            } mb-2`}
                        >
                            <Trash2 className="w-4 h-4" />
                            {isDeletingAccount ? 'Excluindo...' : 'Excluir minha conta e todos os dados'}
                        </button>
                        <p className="text-[9px] text-slate-500 text-center italic">
                            Ação irreversível. Todos os seus registros serão apagados.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`w-full font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${isSaving
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                        >
                            {isSaving ? (
                                <React.Fragment key="saving-content">
                                    <CheckCircle key="icon-check" className="w-4 h-4" />
                                    <span key="text-saved">Configuração Salva!</span>
                                </React.Fragment>
                            ) : (
                                <React.Fragment key="ready-content">
                                    <Save key="icon-save" className="w-4 h-4" />
                                    <span key="text-save">Salvar Configuração</span>
                                </React.Fragment>
                            )}
                        </button>
                    </div>
                </form>

                {/* Custom Delete Confirmation Modal */}
                {showDeleteConfirm && createPortal(
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className={`w-full max-w-sm p-8 rounded-3xl border shadow-2xl animate-in zoom-in-95 duration-300 ${
                            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                        }`}>
                            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                                <Trash2 className="w-8 h-8 text-rose-500 animate-pulse" />
                            </div>
                            <h3 className={`text-xl font-bold text-center mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                                Adeus, Capitão?
                            </h3>
                            <div className={`text-sm text-center mb-8 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                Esta ação é <span className="font-black text-rose-500">irreversível</span>. Todas as suas transações e metas serão apagadas para sempre.
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={isDeletingAccount}
                                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isDeletingAccount ? "Processando..." : "SIM, APAGAR TUDO"}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className={`w-full py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all border ${
                                        theme === 'light' 
                                        ? 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-600' 
                                        : 'bg-slate-800/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                                    }`}
                                >
                                    Mudei de ideia, manter dados
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

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
                        onClick={() => setIsConfiguring(true)}
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
                    onClick={() => setIsConfiguring(true)}
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

            {paceAlerts.length > 0 && (
                <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 px-1">
                        <AlertTriangle className="w-3 h-3" />
                        Alertas de Tranquilidade
                    </h4>
                    {paceAlerts.map((alert, idx) => (
                        <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-3 ${alert.type === 'danger'
                                ? 'bg-rose-500/10 border-rose-500/20'
                                : 'bg-amber-500/10 border-amber-500/20'
                                }`}
                        >
                            <div className={`p-1.5 rounded-lg shrink-0 ${alert.type === 'danger' ? 'bg-rose-500/20' : 'bg-amber-500/20'
                                }`}>
                                <AlertTriangle className={`w-4 h-4 ${alert.type === 'danger' ? 'text-rose-400' : 'text-amber-400'
                                    }`} />
                            </div>
                            <div className="space-y-1">
                                <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                                    {CATEGORIES.expense.find(c => c.id === alert.categoryId)?.label}
                                </p>
                                <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {alert.message}
                                </p>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${alert.type === 'danger' ? 'bg-rose-500' : 'bg-amber-500'
                                            }`}
                                        style={{ width: `${Math.min(alert.usage * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}


        </div>
    );
}
