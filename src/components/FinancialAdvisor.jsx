
import React, { useState, useMemo, useEffect } from 'react';
import { calculateFinancialHealth } from '../utils/financialLogic';
import { calculateStatsContext, sendMessageToGemini } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { Bot, Calculator, AlertTriangle, CheckCircle, XCircle, Settings, Save, X } from 'lucide-react';

export default function FinancialAdvisor({ transactions, manualConfig, onConfigChange }) {
    const [simAmount, setSimAmount] = useState('');
    const [simInstallments, setSimInstallments] = useState(1);
    const [simulationResult, setSimulationResult] = useState(null);

    // Manual Configuration State
    const [isConfiguring, setIsConfiguring] = useState(false);
    // Inherit config from parent
    const [tempManualConfig, setTempManualConfig] = useState(manualConfig);

    // Sync temp config with prop when config mode is entered
    useEffect(() => {
        if (isConfiguring) {
            setTempManualConfig(manualConfig);
        }
    }, [isConfiguring, manualConfig]);

    const health = useMemo(() => calculateFinancialHealth(transactions, manualConfig), [transactions, manualConfig]);

    const [isLoading, setIsLoading] = useState(false);

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

            const response = await sendMessageToGemini([], prompt, context);
            setSimulationResult({ aiResponse: response });
        } catch (error) {
            console.error("Erro na simulação IA:", error);

            let errorMsg = "Erro ao consultar o assistente.";
            if (error.message.includes('429') || error.message.includes('quota')) {
                errorMsg = "⚠️ Limite atingido. Tente novamente em instantes.";
            }

            setSimulationResult({ error: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = (e) => {
        e.preventDefault();
        onConfigChange(tempManualConfig); // Parent handles saving
        setIsConfiguring(false);
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

                <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Renda Mensal Média (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.income}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, income: e.target.value })}
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

                    <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Salvar Configuração
                    </button>
                </form>
            </div>
        );
    }

    if (!health.hasData && !manualConfig.income) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center relative">
                <button
                    onClick={() => setIsConfiguring(true)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <Settings className="w-5 h-5" />
                </button>
                <Bot className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <h3 className="text-slate-300 font-bold mb-1">Assistente Financeiro</h3>
                <p className="text-slate-500 text-sm mb-4">Configure sua renda manual ou adicione transações.</p>
                <button
                    onClick={() => setIsConfiguring(true)}
                    className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors"
                >
                    Configurar Agora
                </button>
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
                            <div className="flex items-center gap-2 text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-sm font-medium">{simulationResult.error}</span>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-300 leading-relaxed space-y-2">
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
