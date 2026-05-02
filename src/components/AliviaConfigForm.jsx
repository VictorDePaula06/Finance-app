import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Key, Calculator, AlertTriangle, TrendingUp, CreditCard, Pencil, Trash2, Check, CheckCircle2, Loader2, Moon, Sun } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { validateApiKey } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

const AliviaConfigForm = ({ manualConfig, onConfigChange, onClose }) => {
    const { theme, toggleTheme } = useTheme();
    const { saveUserPreferences, userPrefs, deleteAccount } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [tempManualConfig, setTempManualConfig] = useState(manualConfig);
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState('');
    const [isWealthLocked, setIsWealthLocked] = useState(true);
    const [showConfirmUnlock, setShowConfirmUnlock] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingSubId, setEditingSubId] = useState(null);
    const [editingValues, setEditingValues] = useState({ 
        name: '', 
        amount: '', 
        totalInstallments: '', 
        currentInstallment: '' 
    });

    useEffect(() => {
        setTempManualConfig(manualConfig);
        const savedKey = userPrefs?.apiKey || localStorage.getItem('user_gemini_api_key') || '';
        setApiKey(savedKey);
    }, [manualConfig, userPrefs]);

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        if (apiKey.trim()) {
            const isValid = await validateApiKey(apiKey.trim());
            if (!isValid) {
                setError("Chave de API inválida ou expirada.");
                setIsSaving(false);
                return;
            }
            localStorage.setItem('user_gemini_api_key', apiKey.trim());
            saveUserPreferences({ apiKey: apiKey.trim() });
        } else {
            localStorage.removeItem('user_gemini_api_key');
            saveUserPreferences({ apiKey: '' });
        }

        const finalConfig = { ...tempManualConfig };
        if (tempManualConfig.invested !== manualConfig.invested) {
            finalConfig.investedAt = Date.now();
        }

        onConfigChange(finalConfig);

        setTimeout(() => {
            setIsSaving(false);
            if (onClose) onClose();
        }, 1000);
    };

    return (
        <div className={`p-8 rounded-[2.5rem] border animate-in fade-in slide-in-from-bottom-4 duration-500 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                <h3 className={`text-xl font-black flex items-center gap-3 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    <Settings className="w-6 h-6 text-emerald-500" />
                    Configurar Alívia
                </h3>
                {onClose && (
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Renda Mensal Média (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.income ?? ''}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, income: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, income: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 5000.00"
                            className={`w-full p-4 rounded-2xl border transition-all ${
                                theme === 'light' ? 'bg-slate-50 border-slate-200 focus:bg-white' : 'bg-white/5 border-white/5 focus:bg-white/10 text-white'
                            }`}
                        />
                        <p className={`text-[10px] mt-2 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Valor médio que você ganha no mês. A Alívia usa isso para projetar sua capacidade de reserva financeira.
                        </p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Gastos Fixos Mensais (R$)</label>
                        <input
                            type="number"
                            value={tempManualConfig.fixedExpenses ?? ''}
                            onChange={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: e.target.value })}
                            onBlur={e => setTempManualConfig({ ...tempManualConfig, fixedExpenses: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 1500.00"
                            className={`w-full p-4 rounded-2xl border transition-all ${
                                theme === 'light' ? 'bg-slate-50 border-slate-200 focus:bg-white' : 'bg-white/5 border-white/5 focus:bg-white/10 text-white'
                            }`}
                        />
                        <p className={`text-[10px] mt-2 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Despesas previsíveis e essenciais que não mudam muito (aluguel, contas de luz, internet, mensalidades).
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Estimativa de Variáveis (R$)</label>
                    <input
                        type="number"
                        value={tempManualConfig.variableEstimate ?? ''}
                        onChange={e => setTempManualConfig({ ...tempManualConfig, variableEstimate: e.target.value })}
                        placeholder="Ex: 2000.00"
                        className={`w-full p-4 rounded-2xl border transition-all ${
                            theme === 'light' ? 'bg-slate-50 border-slate-200 focus:bg-white' : 'bg-white/5 border-white/5 focus:bg-white/10 text-white'
                        }`}
                    />
                    <p className={`text-[10px] mt-2 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        Estimativa do seu custo de vida flexível (fatura do cartão de crédito, lazer, iFood, compras). 
                        <br/><span className="text-emerald-500 font-bold">Dica da IA:</span> Se deixar em branco, a Alívia vai calcular automaticamente a média do seu histórico real de gastos.
                    </p>
                </div>

                <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Saldo Inicial / Patrimônio Externo (R$)</label>
                        <button
                            type="button"
                            onClick={() => setShowConfirmUnlock(true)}
                            className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                        >
                            {isWealthLocked ? 'Forçar Ajuste' : 'Liberado'}
                        </button>
                    </div>
                    <input
                        type="number"
                        disabled={isWealthLocked}
                        value={tempManualConfig.invested ?? ''}
                        onChange={e => setTempManualConfig({ ...tempManualConfig, invested: e.target.value })}
                        onBlur={e => setTempManualConfig({ ...tempManualConfig, invested: parseFloat(e.target.value) || 0 })}
                        className={`w-full p-4 rounded-2xl border transition-all ${
                            isWealthLocked ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                            theme === 'light' ? 'bg-slate-50 border-slate-200 focus:bg-white' : 'bg-white/5 border-white/5 focus:bg-white/10 text-white'
                        }`}
                    />
                </div>

                <div className="pt-6 border-t border-white/5">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Margem de Segurança por Categoria
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {CATEGORIES.expense.map(cat => (
                            <div key={cat.id} className={`flex items-center justify-between p-4 rounded-2xl border ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                    <span className="text-xs font-bold">{cat.label}</span>
                                </div>
                                <input
                                    type="number"
                                    value={tempManualConfig.categoryBudgets?.[cat.id] || ''}
                                    onChange={e => {
                                        const newBudgets = { ...tempManualConfig.categoryBudgets, [cat.id]: e.target.value };
                                        setTempManualConfig({ ...tempManualConfig, categoryBudgets: newBudgets });
                                    }}
                                    placeholder="0,00"
                                    className={`w-24 p-2 text-right text-xs font-bold rounded-xl border ${
                                        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5 text-white'
                                    }`}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 ${
                        isSaving ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                    }`}
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSaving ? 'Salvando...' : 'Salvar Todas as Configurações'}
                </button>
            </form>
        </div>
    );
};

export default AliviaConfigForm;
