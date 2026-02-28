
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateFinancialHealth, calculateSpendingPace } from '../utils/financialLogic';
import { CATEGORIES } from '../constants/categories';
import { calculateStatsContext, sendMessageToGemini, validateApiKey } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { Bot, Settings, X, Save, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle, Calculator, Video, ChevronDown } from 'lucide-react';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

export default function FinancialAdvisor({ transactions, manualConfig, onConfigChange }) {
    const [simAmount, setSimAmount] = useState('');
    const [simInstallments, setSimInstallments] = useState(1);
    const [simulationResult, setSimulationResult] = useState(null);

    // Manual Configuration State
    const [isConfiguring, setIsConfiguring] = useState(false);
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

            let errorMsg = "Erro ao consultar o Mêntore.";
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

        onConfigChange(tempManualConfig); // Parent handles saving

        // Show feedback before closing
        setTimeout(() => {
            setIsSaving(false);
            setIsConfiguring(false);
        }, 1000);
    };

    if (isConfiguring) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        Configurar Assistente
                    </h3>
                    <button onClick={() => setIsConfiguring(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form key="advisor-config-form" onSubmit={handleSaveConfig} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Renda Mensal Média (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.income}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, income: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, income: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 5000.00"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Gastos Fixos Mensais (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.fixedExpenses}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: parseFloat(e.target.value) || 0 })}
                            placeholder="Aluguel, Internet, etc."
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Estimativa de Variáveis (Cartão/Outros) (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.variableEstimate}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, variableEstimate: e.target.value })}
                            placeholder="Média de fatura de cartão"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500/50"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            Se não preencher, usaremos a média do seu histórico de transações.
                        </p>
                    </div>
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-purple-400">Patrimônio Base / Saldo Inicial (R$)</label>
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
                                    Tem certeza que deseja ajustar manualmente seu patrimônio base?
                                    Isso mudará o ponto inicial do seu saldo total.
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
                                className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none transition-all ${isWealthLocked
                                    ? 'border-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'border-purple-500/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                                    }`}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                            Este valor é o seu ponto de partida. Investimentos lançados no histórico serão SOMADOS a este valor.
                        </p>
                    </div>


                    <div className="pt-4 border-t border-slate-700/50">
                        <label className="block text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Limites Mensais por Categoria
                        </label>
                        <div className="space-y-3 bg-slate-900/30 p-3 rounded-xl border border-slate-700/30 max-h-48 overflow-y-auto custom-scrollbar">
                            {CATEGORIES.expense.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                                        <span className="text-[10px] text-slate-300">{cat.label}</span>
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
                                            className="w-24 bg-slate-900/50 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500/50 pr-6"
                                        />
                                        <span className="absolute right-2 top-1.5 text-[8px] text-slate-500">R$</span>
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
                            <span>Se preenchida, usa seu limite pessoal.</span>
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
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700/50 text-center relative overflow-hidden group">

                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col items-center">
                    <div className="bg-slate-800/80 p-4 rounded-full border border-slate-700 shadow-xl mb-6 animate-in zoom-in duration-500">
                        <Bot className="w-12 h-12 text-blue-400" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">
                        Ative seu Assistente Financeiro
                    </h3>

                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                        Desbloqueie o poder da Inteligência Artificial para analisar seus gastos, prever seu saldo futuro e receber dicas personalizadas de economia.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-8 text-left">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                            <Calculator className="w-5 h-5 text-emerald-400 mb-2" />
                            <h4 className="font-semibold text-slate-200 text-sm">Simulação de Compras</h4>
                            <p className="text-xs text-slate-500 mt-1">Saiba se uma compra cabe no seu orçamento futuro.</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                            <AlertTriangle className="w-5 h-5 text-amber-400 mb-2" />
                            <h4 className="font-semibold text-slate-200 text-sm">Alertas de Risco</h4>
                            <p className="text-xs text-slate-500 mt-1">Receba avisos antes de entrar no vermelho.</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                            <CheckCircle className="w-5 h-5 text-blue-400 mb-2" />
                            <h4 className="font-semibold text-slate-200 text-sm">Dicas Inteligentes</h4>
                            <p className="text-xs text-slate-500 mt-1">Sugestões reais baseadas nos seus hábitos.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsConfiguring(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-600/30 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Settings className="w-5 h-5" />
                        Configurar Agora
                    </button>

                    <p className="text-[10px] text-slate-600 mt-4">
                        Configuração rápida • Chave de API própria ou compartilhada
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600/20 rounded-xl">
                        <Bot className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            Seu Consultor
                            {health.isManual && (
                                <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20">
                                    Manual
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-slate-400">Análise de viabilidade financeira</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsConfiguring(true)}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Configurar Renda e Gastos"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Saldo Livre Estimado</p>
                    <p className={`font-bold text-lg ${health.disposableIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {health.disposableIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Renda Média</p>
                    <p className="font-bold text-lg text-blue-400">
                        {health.averageIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>

            {paceAlerts.length > 0 && (
                <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-1">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 px-1">
                        <AlertTriangle className="w-3 h-3" />
                        Alertas de Orçamento
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

            <div className="border-t border-slate-700/50 pt-6">
                <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-400" />
                    Simular Nova Compra
                </h4>

                <form onSubmit={handleSimulate} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Valor Total</label>
                            <input
                                type="number"
                                value={simAmount}
                                onChange={e => setSimAmount(e.target.value)}
                                placeholder="R$ 0,00"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Parcelas</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={simInstallments}
                                onChange={e => setSimInstallments(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
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
                    <div className={`mt-4 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 bg-slate-900/50 border-blue-500/20`}>
                        {simulationResult.error ? (
                            <div key="sim-error" className="flex items-center gap-2 text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-sm font-medium">{simulationResult.error}</span>
                            </div>
                        ) : (
                            <div key="sim-success" className="text-sm text-slate-300 leading-relaxed space-y-2">
                                <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold border-b border-blue-500/20 pb-2">
                                    <Bot className="w-4 h-4" />
                                    Análise do Consultor
                                </div>
                                <ReactMarkdown
                                    components={{
                                        strong: ({ node, ...props }) => <span className="font-bold text-slate-100" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 ml-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="text-slate-300" {...props} />
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
