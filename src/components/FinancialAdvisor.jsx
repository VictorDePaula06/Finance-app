
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateFinancialHealth, calculateSpendingPace } from '../utils/financialLogic';
import { CATEGORIES } from '../constants/categories';
import { calculateStatsContext, sendMessageToGemini, validateApiKey } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { Bot, Settings, X, Save, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle, Calculator, Video, ChevronDown, Moon, Sun } from 'lucide-react';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

import { useTheme } from '../contexts/ThemeContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function FinancialAdvisor({ transactions, manualConfig, onConfigChange, onToggleConfig }) {
    const { theme, toggleTheme } = useTheme();
    const [simAmount, setSimAmount] = useState('');
    const [simInstallments, setSimInstallments] = useState(1);
    const [simulationResult, setSimulationResult] = useState(null);

    // Manual Configuration State
    const [isConfiguring, setIsConfiguring] = useState(false);

    // Notify parent when configuration mode changes
    useEffect(() => {
        if (onToggleConfig) {
            onToggleConfig(isConfiguring);
        }
    }, [isConfiguring, onToggleConfig]);

    // Inherit config from parent
    const [tempManualConfig, setTempManualConfig] = useState(manualConfig);
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isWealthLocked, setIsWealthLocked] = useState(true);
    const [showConfirmUnlock, setShowConfirmUnlock] = useState(false);

    // Sync temp config with prop when config mode is entered
    useEffect(() => {
        if (isConfiguring) {
            setTempManualConfig(manualConfig);
            setIsWealthLocked(true); // Lock wealth by default when opening
            setShowConfirmUnlock(false);
            // Load saved API Key (LocalStorage as fallback)
            const savedKey = localStorage.getItem('user_gemini_api_key') || '';
            setApiKey(savedKey);
            setError(''); // Clear error when opening

            // Load from Firestore
            if (getUserPreferences) {
                getUserPreferences().then(prefs => {
                    if (prefs && prefs.apiKey) {
                        setApiKey(prefs.apiKey);
                        localStorage.setItem('user_gemini_api_key', prefs.apiKey);
                    }
                });
            }
        }
    }, [isConfiguring, manualConfig]);








    const health = useMemo(() => calculateFinancialHealth(transactions, manualConfig), [transactions, manualConfig]);
    const paceAlerts = useMemo(() => calculateSpendingPace(transactions, manualConfig), [transactions, manualConfig]);

    const [isLoading, setIsLoading] = useState(false);

    const { saveUserPreferences, getUserPreferences, isPremium } = useAuth(); // Added isPremium

    const handleSimulate = async (e) => {
        e.preventDefault();
        if (!simAmount || !health.hasData) return;

        setIsLoading(true);
        setSimulationResult(null);

        try {
            const context = calculateStatsContext(transactions, manualConfig);
            const prompt = `
            ACAO: O usuário quer simular uma compra.
            Item: Compra simulada
            Valor: R$ ${simAmount}
            Parcelas: ${simInstallments}x de R$ ${(parseFloat(simAmount) / parseInt(simInstallments)).toFixed(2)}
            
            Analise a viabilidade dessa compra considerando:
            1. O impacto no saldo deste mês.
            2. O impacto nos PRÓXIMOS meses (veja a "PROJEÇÃO FUTURA" no contexto), considerando que as parcelas vão somar aos gastos comprometidos já existentes.
            3. Se o saldo ficar negativado em algum mês futuro, ALERTE com gravidade.
            
            Seja direto: "Compra Viável" ou "Alto Risco". Explique o porquê citando os meses afetados.`;

            const history = JSON.parse(localStorage.getItem('geminiChatHistory') || '[]');
            const response = await sendMessageToGemini(history, prompt, context);
            setSimulationResult({ aiResponse: response });
        } catch (error) {
            console.error("Erro na simulação IA:", error);

            let errorMsg = "Erro ao consultar o Mêntor.";
            if (error.message.includes('429') || error.message.includes('quota')) {
                if (isPremium) {
                    errorMsg = "⏳ Alta demanda no servidor. Aguarde um momento e tente novamente.";
                } else {
                    errorMsg = "🔒 Limite do Plano Gratuito atingido. O plano gratuito tem um limite de requisições por minuto. Aguarde alguns segundos ou faça Upgrade para liberar acesso ilimitado.";
                }
            }

            setSimulationResult({ error: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };



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

        // Add timestamp if wealth was unlocked during this save (Directly indicates an adjustment)
        const finalConfig = { ...tempManualConfig };
        if (!isWealthLocked && tempManualConfig.invested > 0) {
            finalConfig.investedAt = Date.now();
        } else if (tempManualConfig.invested !== manualConfig.invested) {
            // Fallback for case where value changed without manual unlock (security/backwards compatibility)
            finalConfig.investedAt = Date.now();
        }

        onConfigChange(finalConfig); // Parent handles saving

        // Show feedback before closing
        setTimeout(() => {
            setIsSaving(false);
            setIsConfiguring(false);
        }, 1000);
    };

    if (isConfiguring) {
        return (
            <div className="glass-card p-6 relative overflow-hidden transition-all">
                <div className="flex justify-between items-center mb-6 border-b border-emerald-100/30 dark:border-white/10 pb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
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
                            value={tempManualConfig.income}
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
                            value={tempManualConfig.fixedExpenses}
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
                            value={tempManualConfig.variableEstimate}
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
                            <label className="block text-xs font-medium text-emerald-400">Sementinha Base / Saldo Inicial (R$)</label>
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
                                value={tempManualConfig.invested}
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
                            Este valor é **ABSOLUTO** e sobrescreve o saldo calculado pelo seu histórico de lançamentos.
                        </p>
                    </div>


                    <div className="pt-4 border-t border-emerald-100/50">
                        <label className="block text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Margem de Segurança por Categoria
                        </label>
                        <div className={`space-y-3 p-4 rounded-2xl border max-h-48 overflow-y-auto scrollbar-thin ${
                            theme === 'light'
                            ? 'bg-[#f0fdfa]/30 border-emerald-100/50 scrollbar-thumb-slate-200'
                            : 'bg-slate-900/30 border-slate-700/50 scrollbar-thumb-slate-700'
                        }`}>
                            {CATEGORIES.expense.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                                        <span className={`text-[11px] font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>{cat.label}</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={tempManualConfig.categoryBudgets?.[cat.id] || ''}
                                            onChange={e => {
                                                const newBudgets = { ...tempManualConfig.categoryBudgets, [cat.id]: e.target.value };
                                                setTempManualConfig({ ...tempManualConfig, categoryBudgets: newBudgets });
                                            }}
                                            placeholder="0,00"
                                            className={`w-24 border rounded-lg px-2 py-1 text-[10px] focus:outline-none shadow-sm pr-6 ${
                                                theme === 'light'
                                                ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-300'
                                                : 'bg-slate-800 border-slate-700 text-slate-100 focus:border-emerald-500/50'
                                            }`}
                                        />
                                        <span className="absolute right-2 top-1.5 text-[8px] text-slate-400">R$</span>
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
                </form >
            </div >
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

                    <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
                        Ative sua Alívia 🍃
                    </h3>

                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 leading-relaxed font-medium">
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
                                <p className="text-xs font-bold text-slate-200">
                                    {CATEGORIES.expense.find(c => c.id === alert.categoryId)?.label}
                                </p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
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

            <div className="border-t border-slate-100 pt-6">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                    <Calculator className="w-3.5 h-3.5 text-[#5CCEEA]" />
                    Simular Nova Conquista
                </h4>

                <form onSubmit={handleSimulate} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-widest">Valor Total</label>
                            <input
                                type="number"
                                value={simAmount}
                                onChange={e => setSimAmount(e.target.value)}
                                placeholder="R$ 0,00"
                                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm transition-all ${
                                    theme === 'light'
                                    ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/50'
                                }`}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-widest">Parcelas</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={simInstallments}
                                onChange={e => setSimInstallments(e.target.value)}
                                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none shadow-sm transition-all ${
                                    theme === 'light'
                                    ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500/50'
                                }`}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#5CCEEA] hover:bg-[#69C8B9] disabled:bg-slate-100 disabled:text-slate-300 text-white font-black py-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5CCEEA]/10 mt-2 active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Analisando...
                            </>
                        ) : (
                            'Analisar Viabilidade'
                        )}
                    </button>
                </form>

                {simulationResult && (
                    <div className={`mt-4 p-5 rounded-2xl border animate-in fade-in slide-in-from-top-2 bg-white/20 border-[#5CCEEA]/20 shadow-md`}>
                        {simulationResult.error ? (
                            <div key="sim-error" className="flex items-center gap-2 text-rose-500">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <span className="text-sm font-bold">{simulationResult.error}</span>
                            </div>
                        ) : (
                            <div key="sim-success" className="text-sm text-slate-700 leading-relaxed space-y-2">
                                <div className="flex items-center gap-2 mb-3 text-[#69C8B9] font-black border-b border-slate-100 pb-3 text-[10px] uppercase tracking-widest">
                                    <img src={aliviaFinal} alt="Alívia" className="w-5 h-5 object-cover rounded-full shadow-sm" />
                                    Análise da Alívia
                                </div>
                                <ReactMarkdown
                                    components={{
                                        strong: ({ node, ...props }) => <span className="font-bold text-slate-800" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2 ml-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="text-slate-600 font-medium" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-2 font-medium" {...props} />
                                    }}
                                >
                                    {simulationResult.aiResponse}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
