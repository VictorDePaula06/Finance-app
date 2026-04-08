import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Send, Bot, User, Sparkles, AlertCircle, Key, Trash2, Loader2, Video, ChevronDown, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendMessageToGemini, isGeminiConfigured, validateApiKey, calculateStatsContext } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

import aliviaFinal from '../assets/alivia/alivia-final.png';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

export default function AIChat({ transactions, manualConfig, onAddTransaction, onDeleteTransaction, onConfigChange }) {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [hasKey, setHasKey] = useState(isGeminiConfigured());
    const [apiKey, setApiKey] = useState('');
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('geminiChatHistory');
        return saved ? JSON.parse(saved) : [];
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingKey, setIsSavingKey] = useState(false);
    const [keyError, setKeyError] = useState('');
    const messagesEndRef = useRef(null);
    const initialSyncDone = useRef(false);
    const prevMessagesLength = useRef(messages.length);

    const { saveUserPreferences, getUserPreferences, saveChatHistory, getChatHistory } = useAuth();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setHasKey(isGeminiConfigured());

            if (getUserPreferences) {
                getUserPreferences().then(prefs => {
                    if (prefs && prefs.apiKey) {
                        if (!isGeminiConfigured()) {
                            localStorage.setItem('user_gemini_api_key', prefs.apiKey);
                            setHasKey(true);
                        }
                    }
                });
            }

            if (getChatHistory) {
                getChatHistory().then(remoteHistory => {
                    if (remoteHistory && remoteHistory.length > 0) {
                        setMessages(remoteHistory);
                        prevMessagesLength.current = remoteHistory.length;
                    }
                    initialSyncDone.current = true;
                });
            }
        }
    }, [isOpen]);

    const handleSaveKey = async () => {
        setKeyError('');
        if (apiKey.trim()) {
            setIsSavingKey(true);

            const isValid = await validateApiKey(apiKey.trim());
            if (!isValid) {
                setKeyError("Chave de API inválida! Verifique e tente novamente.");
                setIsSavingKey(false);
                return;
            }

            localStorage.setItem('user_gemini_api_key', apiKey.trim());
            saveUserPreferences({ apiKey: apiKey.trim() });

            setTimeout(() => {
                setIsSavingKey(false);
                setHasKey(true);
                setMessages(prev => {
                    if (prev.length === 0) {
                        return [...prev, { role: 'model', text: '✅ **API Key Configurada!**\n\nAgora sou seu assistente pessoal. Em que posso ajudar?' }];
                    }
                    return prev;
                });
            }, 1000);
        }
    };

    useEffect(() => {
        localStorage.setItem('geminiChatHistory', JSON.stringify(messages));
        
        // Só salva na nuvem se o sync inicial já terminou E o número de mensagens mudou
        // Isso evita que o cache local sobrescreva a nuvem no carregamento inicial
        if (initialSyncDone.current && messages.length > prevMessagesLength.current) {
            saveChatHistory(messages);
        }
        
        // Se mensagens foram limpas, também sincroniza
        if (initialSyncDone.current && messages.length === 0 && prevMessagesLength.current > 0) {
            saveChatHistory([]);
        }

        prevMessagesLength.current = messages.length;
    }, [messages]);

    const clearHistory = () => {
        if (confirm('Deseja limpar o histórico da conversa?')) {
            setMessages([]);
            localStorage.removeItem('geminiChatHistory');
        }
    };

    const processMessage = async (inputMsg, isPanic = false) => {
        if (!inputMsg.trim() || isLoading) return;

        if (!isGeminiConfigured()) {
            setMessages(prev => [...prev, { role: 'user', text: inputMsg }, { role: 'model', text: 'ERRO: API Key não configurada. Por favor, configure sua chave no menu do assistente.' }]);
            return;
        }

        const userMsg = { role: 'user', text: inputMsg };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const context = calculateStatsContext(transactions, manualConfig, isPanic);
            const responseText = await sendMessageToGemini(messages, inputMsg, context);

            const sanitizeAIValue = (val) => {
                if (!val) return '0';
                let s = String(val).trim();
                s = s.replace(/[R$\s]/g, '');
                if (s.includes(',') && s.includes('.')) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else if (s.includes(',')) {
                    s = s.replace(',', '.');
                } else if (s.includes('.')) {
                    const parts = s.split('.');
                    if (parts.length > 2 || parts[parts.length - 1].length !== 2) {
                        s = s.replace(/\./g, '');
                    }
                }
                return s;
            };

            let jsonString = null;
            const blocks = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/g);
            if (blocks) {
                const lastBlock = blocks[blocks.length - 1];
                jsonString = lastBlock.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
            } else {
                const firstBrace = responseText.indexOf('{');
                const lastBrace = responseText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const candidate = responseText.substring(firstBrace, lastBrace + 1);
                    if (candidate.includes('"action"')) jsonString = candidate;
                }
            }

            let displayMessage = responseText;

            if (jsonString) {
                try {
                    const command = JSON.parse(jsonString);
                    displayMessage = responseText
                        .replace(/```(?:json)?[\s\S]*?```/g, '')
                        .replace(/\{"action"[\s\S]*?\}/g, '')
                        .split(/⚙️|Configuração\s+Atualizada|Patrimônio\s+Declarado|Ação\s+Registrada|Comando\s+Executado|```/i)[0]
                        .trim();

                    if (!displayMessage && command.action) {
                        displayMessage = "Entendido! Processando sua solicitação...";
                    }

                    if (command.action === 'add_transaction') {
                        if (onAddTransaction) {
                            const sanitizedData = {
                                ...command.data,
                                amount: parseFloat(sanitizeAIValue(command.data.amount)) || 0
                            };
                            const success = await onAddTransaction(sanitizedData);
                            if (success) {
                                displayMessage += `\n\n✅ **Transação Salva:** ${sanitizedData.description} (R$ ${sanitizedData.amount.toLocaleString('pt-BR')})`;
                            } else {
                                displayMessage += `\n\n❌ **Erro:** Não foi possível salvar a transação.`;
                            }
                        }
                    } else if (command.action === 'delete_transaction') {
                        const { amount, description: descSearch } = command.data;
                        let foundTx = null;
                        const targetAmount = parseFloat(sanitizeAIValue(amount));
                        for (let i = transactions.length - 1; i >= 0; i--) {
                            const tx = transactions[i];
                            const isAmountMatch = Math.abs(tx.amount - targetAmount) < 0.05;
                            const isDescMatch = tx.description.toLowerCase().includes(descSearch.toLowerCase());
                            if (isAmountMatch && isDescMatch) { foundTx = tx; break; }
                        }
                        if (foundTx && onDeleteTransaction) {
                            await onDeleteTransaction(foundTx.id);
                            displayMessage += `\n\n🗑️ **Transação Removida:** ${foundTx.description}`;
                        } else {
                            displayMessage += `\n\n⚠️ **Não foi possível encontrar a transação de R$ ${targetAmount}.**`;
                        }
                    } else if (command.action === 'update_manual_config') {
                        if (onConfigChange) {
                            const newConfig = { ...manualConfig };
                            let updates = [];
                            if (command.data.invested) {
                                const val = sanitizeAIValue(command.data.invested);
                                newConfig.invested = val;
                                updates.push(`Patrimônio: **R$ ${parseFloat(val).toLocaleString('pt-BR')}**`);
                            }
                            if (command.data.income) {
                                const val = sanitizeAIValue(command.data.income);
                                newConfig.income = val;
                                updates.push(`Renda: **R$ ${parseFloat(val).toLocaleString('pt-BR')}**`);
                            }
                            if (command.data.fixedExpenses) {
                                const val = sanitizeAIValue(command.data.fixedExpenses);
                                newConfig.fixedExpenses = val;
                                updates.push(`Gastos Fixos: **R$ ${parseFloat(val).toLocaleString('pt-BR')}**`);
                            }
                            if (updates.length > 0) {
                                onConfigChange(newConfig);
                                displayMessage += `\n\n⚙️ **Configuração Atualizada:**\n${updates.map(u => `- ${u}`).join('\n')}`;
                            } else {
                                displayMessage = "O patrimônio já está atualizado com esse valor.";
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse Gemini command:", e);
                }
            }
            setMessages(prev => [...prev, { role: 'model', text: displayMessage }]);
        } catch (error) {
            console.error("Erro detalhado do Gemini:", error);
            let errMsg = "Desculpe, ocorreu um erro ao processar sua solicitação.";
            if (error.message.includes('429') || error.message.includes('quota')) {
                errMsg = "⚠️ **Limite atingido.**\n\nPor favor, aguarde alguns instantes e tente novamente. Se o erro persistir, o limite diário pode ter sido alcançado.";
            }
            setMessages(prev => [...prev, { role: 'model', text: errMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        const msg = input;
        setInput('');
        processMessage(msg, false);
    };

    useEffect(() => {
        const handlePanic = (e) => {
            const panicMsg = e.detail || "Preciso de ajuda com um gasto inesperado.";
            setIsOpen(true);
            setTimeout(() => {
                processMessage(panicMsg, true);
            }, 300);
        };

        window.addEventListener('ai-panic', handlePanic);
        return () => window.removeEventListener('ai-panic', handlePanic);
    }, [transactions, manualConfig]);

    const chatContent = isOpen ? (
        <div className={`fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 w-auto sm:w-full sm:max-w-sm h-[500px] glass-card z-[9999] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in ${
            theme === 'light' ? '!bg-white/95 shadow-xl border-verde-respira/20' : '!bg-slate-900/98 border-slate-700'
        }`}>
            {/* Header */}
            <div className={`p-4 border-b flex justify-between items-center ${
                theme === 'light' ? 'bg-[#f0fdfa]/80 border-verde-respira/10' : 'bg-slate-800 border-slate-700'
            }`}>
                <div className="flex items-center gap-3">
                    <img src={aliviaFinal} alt="Alívia" className="w-12 h-12 object-cover rounded-full border-2 border-emerald-400 shadow-sm" />
                    <div>
                        <h3 className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Sua Alívia</h3>
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={clearHistory} className="text-slate-400 hover:text-rose-400 transition-colors" title="Limpar Histórico">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {!hasKey ? (
                <div className="flex-1 p-6 flex flex-col items-center text-center overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    <div className="bg-slate-800/50 p-4 rounded-full mb-4">
                        <Key className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Configuração Necessária</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Para conversar com a IA, você precisa configurar sua chave de API gratuita.
                    </p>

                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 w-full mb-4">
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-400 hover:text-white transition-colors">
                                <span className="flex items-center gap-2">
                                    <Video className="w-4 h-4" />
                                    Como obter uma chave? (Vídeo)
                                </span>
                                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="mt-3 text-xs text-slate-400 space-y-2">
                                <p>1. Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.</p>
                                <p>2. Crie uma nova chave de API.</p>
                                <p>3. Cole a chave abaixo.</p>

                                <div className="mt-3 rounded-lg overflow-hidden border border-slate-700 bg-black">
                                    <video src={tutorialVideo} controls className="w-full max-h-48 object-contain">
                                        Seu navegador não suporta a tag de vídeo.
                                    </video>
                                </div>
                            </div>
                        </details>
                    </div>

                    <div className="w-full space-y-3">
                        {keyError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-200 text-xs animate-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                                {keyError}
                            </div>
                        )}
                        <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Cole sua API Key aqui..."
                            className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${
                                theme === 'light' 
                                ? 'bg-white/40 border-slate-200 text-slate-800 focus:ring-verde-respira/30 focus:border-verde-respira' 
                                : 'bg-slate-950 border-slate-700 text-white focus:ring-blue-500/30 focus:border-blue-500'
                            }`}
                        />
                        <button
                            onClick={handleSaveKey}
                            disabled={!apiKey.trim() || isSavingKey}
                            className={`w-full font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg ${isSavingKey
                                ? 'bg-emerald-600 text-white'
                                : theme === 'light'
                                    ? 'bg-[#69C8B9] hover:bg-[#5CCEEA] text-white'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                        >
                            {isSavingKey ? (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Chave Salva!
                                </>
                            ) : (
                                <>
                                    <Bot className="w-4 h-4" />
                                    Ativar Alívia
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {messages.length === 0 && (
                            <div className="text-center mt-10 opacity-70">
                                <img src={aliviaFinal} alt="Alívia" className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-emerald-400 shadow-lg object-cover" />
                                <p className="text-slate-500 text-sm px-6">
                                    Olá! Sou a Alívia, seu acolhimento financeiro. Vamos conversar sobre seus gastos ou como encontrar mais tranquilidade hoje?
                                </p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-[#5CCEEA] text-white rounded-br-none'
                                    : theme === 'light'
                                        ? 'bg-white/60 text-slate-800 border border-verde-respira/20 rounded-bl-none'
                                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                                    }`}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({ ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                            li: ({ ...props }) => <li className="mb-1" {...props} />,
                                            strong: ({ ...props }) => <strong className="font-bold text-blue-300" {...props} />
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                    <span className="text-xs text-slate-400">Digitando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSend} className={`p-3 border-t flex gap-2 ${
                        theme === 'light' ? 'bg-[#f0fdfa]/50 border-verde-respira/10' : 'bg-slate-800/50 border-slate-700'
                    }`}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Digite sua mensagem..."
                            className={`flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none transition-all ${
                                theme === 'light'
                                ? 'bg-white/40 border-slate-200 text-slate-800 focus:border-verde-respira'
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-blue-500/50'
                            }`}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className={`p-2 rounded-xl transition-all shadow-md ${
                                theme === 'light'
                                ? 'bg-[#69C8B9] hover:bg-[#5CCEEA] text-white shadow-emerald-500/10'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </>
            )}
        </div>
    ) : (
        <button
            onClick={() => setIsOpen(true)}
            className={`fixed bottom-8 right-4 sm:right-6 h-16 w-16 hover:w-60 rounded-full shadow-2xl transition-all duration-500 ease-in-out hover:scale-105 z-[9999] flex items-center justify-start px-2 overflow-hidden group border-2 border-white/10 ${
                theme === 'light' ? 'bg-[#69C8B9] text-white shadow-emerald-500/20' : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
        >
            <img src={aliviaFinal} alt="Alívia" className="w-12 h-12 object-contain filter drop-shadow-md rounded-full border-2 border-white/20" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-bold tracking-tight">
                Chat com Alívia
            </span>
        </button>
    );

    return createPortal(chatContent, document.body);
}
