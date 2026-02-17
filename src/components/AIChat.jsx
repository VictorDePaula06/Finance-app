import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MessageSquare, Loader2, Key, Trash2 } from 'lucide-react';
import { sendMessageToGemini, calculateStatsContext, isGeminiConfigured } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

export default function AIChat({ transactions, manualConfig, onAddTransaction, onDeleteTransaction }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('geminiChatHistory');
        return saved ? JSON.parse(saved) : [];
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Save to localStorage whenever messages change
    useEffect(() => {
        localStorage.setItem('geminiChatHistory', JSON.stringify(messages));
    }, [messages]);

    const clearHistory = () => {
        if (confirm('Deseja limpar o histórico da conversa?')) {
            setMessages([]);
            localStorage.removeItem('geminiChatHistory');
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        if (!isGeminiConfigured()) {
            setMessages(prev => [...prev, { role: 'user', text: input }, { role: 'model', text: 'ERRO: API Key não configurada. Adicione VITE_GEMINI_API_KEY no arquivo .env.' }]);
            setInput('');
            return;
        }

        const userMsg = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Prepare context
            const context = calculateStatsContext(transactions, manualConfig);

            const responseText = await sendMessageToGemini(messages, input, context);

            // Check for JSON command
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            let displayMessage = responseText;

            if (jsonMatch) {
                try {
                    const command = JSON.parse(jsonMatch[1]);

                    if (command.action === 'add_transaction') {
                        // Execute Add Action
                        if (onAddTransaction) {
                            await onAddTransaction(command.data);
                            // Clean up the JSON from the display message
                            displayMessage = responseText.replace(/```json[\s\S]*```/, '').trim();
                            displayMessage += `\n\n✅ **Transação Salva:** ${command.data.description} (R$ ${command.data.amount})`;
                        }
                    } else if (command.action === 'delete_transaction') {
                        // Execute Delete Action
                        const { amount, description: descSearch, type } = command.data;

                        // Find transaction: match amount AND (optional) type AND partial description
                        // We iterate backwards to find the most recent one
                        let foundTx = null;
                        const targetAmount = parseFloat(amount);

                        for (let i = transactions.length - 1; i >= 0; i--) {
                            const tx = transactions[i];
                            const isAmountMatch = Math.abs(tx.amount - targetAmount) < 0.05; // float tolerance
                            const isTypeMatch = type ? tx.type === type : true;
                            const isDescMatch = tx.description.toLowerCase().includes(descSearch.toLowerCase());

                            if (isAmountMatch && isDescMatch && isTypeMatch) {
                                foundTx = tx;
                                break;
                            }
                        }

                        if (foundTx && onDeleteTransaction) {
                            await onDeleteTransaction(foundTx.id);
                            displayMessage = responseText.replace(/```json[\s\S]*```/, '').trim();
                            displayMessage += `\n\n🗑️ **Transação Removida:** ${foundTx.description} (R$ ${foundTx.amount.toFixed(2)})`;
                        } else {
                            displayMessage = responseText.replace(/```json[\s\S]*```/, '').trim();
                            displayMessage += `\n\n⚠️ **Não foi possível encontrar a transação:** "${descSearch}" de R$ ${amount}. Verifique o valor ou nome.`;
                        }
                    }

                } catch (e) {
                    console.error("Failed to parse Gemini command:", e);
                }
            }

            setMessages(prev => [...prev, { role: 'model', text: displayMessage }]);
        } catch (error) {
            console.error("Erro detalhado do Gemini:", error);
            let userMsg = "Desculpe, ocorreu um erro ao processar sua solicitação.";

            if (error.message.includes('429') || error.message.includes('quota')) {
                userMsg = "⚠️ **Limite atingido.**\n\nPor favor, aguarde alguns instantes e tente novamente. Se o erro persistir, o limite diário pode ter sido alcançado.";
            }

            setMessages(prev => [...prev, { role: 'model', text: userMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 z-50 flex items-center justify-center group"
            >
                <Bot className="w-6 h-6" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap">
                    Chat com Gemini
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-full max-w-sm h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Bot className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100">Assistente Gemini</h3>
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="text-center mt-10 opacity-50">
                        <Bot className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                        <p className="text-slate-500 text-sm px-6">
                            Olá! Sou seu assistente financeiro. Pergunte sobre seus gastos, peça dicas ou simule compras.
                        </p>
                        {!isGeminiConfigured() && (
                            <div className="mt-4 p-3 bg-rose-900/20 border border-rose-500/30 rounded-xl mx-4">
                                <p className="text-xs text-rose-300 font-bold flex items-center gap-2 justify-center mb-1">
                                    <Key className="w-3 h-3" /> API Key Ausente
                                </p>
                                <p className="text-[10px] text-rose-400">
                                    Configure VITE_GEMINI_API_KEY no .env para eu funcionar!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                            }`}>
                            <ReactMarkdown
                                components={{
                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
                                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-bold text-blue-300" {...props} />
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

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-slate-800/50 border-t border-slate-700 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
