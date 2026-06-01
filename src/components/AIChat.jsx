import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Send, Bot, User, Sparkles, AlertCircle, Key, Trash2, Loader2, Video, ChevronDown, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendMessageToGemini, isGeminiConfigured, validateApiKey, calculateStatsContext } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

import aliviaFinal from '../assets/alivia/alivia-final.png';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';

export default function AIChat({ transactions, manualConfig, onAddTransaction, onDeleteTransaction, onConfigChange }) {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
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
    const [jars, setJars] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [cards, setCards] = useState([]);
    const [fixedExpenses, setFixedExpenses] = useState([]);
    const [goals, setGoals] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const messagesEndRef = useRef(null);
    const initialSyncDone = useRef(false);
    const prevMessagesLength = useRef(messages.length);

    const { currentUser, saveUserPreferences, getUserPreferences, saveChatHistory, getChatHistory, userPrefs, planLevel, isAdmin } = useAuth();

    // IA é exclusiva do Premium. Free/Standard nem renderizam o botão flutuante.
    const canUseAI = planLevel === 'premium' || isAdmin;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // WATCHDOG: Safety reset for Alivia (if she gets stuck for more than 25s)
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => {
                console.warn("[Watchdog] Alívia demorando demais ou travada. Resetando estado...");
                setIsLoading(false);
            }, 25000);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

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

            if (currentUser) {
                const uid = currentUser.uid;
                const mk = (col) => query(collection(db, col), where('userId', '==', uid));
                const unsubJars = onSnapshot(mk('savings_jars'),   snap => setJars(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                const unsubInv  = onSnapshot(mk('investments'),    snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                const unsubCard = onSnapshot(mk('cards'),          snap => setCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                const unsubFix  = onSnapshot(mk('fixed_expenses'), snap => setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                const unsubGoal = onSnapshot(mk('goals'),          snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                const unsubSub  = onSnapshot(mk('subscriptions'),  snap => setSubscriptions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
                return () => { unsubJars(); unsubInv(); unsubCard(); unsubFix(); unsubGoal(); unsubSub(); };
            }
        }
    }, [isOpen, currentUser]);

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
                        return [...prev, { 
                            role: 'model', 
                            text: '✅ **API Key Configurada!**\n\nAgora sou seu assistente pessoal. Em que posso ajudar?',
                            timestamp: new Date().toISOString()
                        }];
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

        const userMsg = { role: 'user', text: inputMsg, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        
        // Final fallback to ensure Alivia doesn't get stuck
        const safetyReset = setTimeout(() => setIsLoading(false), 30000);

        try {
            const context = calculateStatsContext(transactions, manualConfig, isPanic, jars, investments, userPrefs?.onboarding, {
                cards, fixedExpenses, goals, subscriptions, planLevel,
            });
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

                            // Respeita a prioridade DITA pelo usuário (essencial/conforto/supérfluo),
                            // mesmo que a IA não tenha extraído ou que destoe do padrão da categoria.
                            if (sanitizedData.type === 'expense') {
                                const low = (inputMsg || '').toLowerCase();
                                if (/(sup[ée]rfluo|dispens|besteira|f[úu]til|sup[ée]rfulo)/.test(low)) sanitizedData.priority = 'superfluous';
                                else if (/(essenc|necess|obrigat|important|b[áa]sic)/.test(low)) sanitizedData.priority = 'essential';
                                else if (/(conforto|qualidade de vida)/.test(low)) sanitizedData.priority = 'comfort';
                            }

                            // Se for gasto no crédito, casa o cartão pelo nome citado
                            if (sanitizedData.paymentMethod === 'credito') {
                                let cardId = '';
                                if (command.data.cardName) {
                                    const match = cards.find(c =>
                                        (c.name || '').toLowerCase().includes(String(command.data.cardName).toLowerCase())
                                    );
                                    if (match) cardId = match.id;
                                } else if (cards.length === 1) {
                                    cardId = cards[0].id; // único cartão = óbvio
                                }
                                if (!cardId && cards.length === 0) {
                                    displayMessage += `\n\n⚠️ Você pediu um gasto no crédito mas não tem cartão cadastrado. Cadastre um na aba **Cartões**.`;
                                    setMessages(prev => [...prev, { role: 'model', text: displayMessage, timestamp: new Date().toISOString() }]);
                                    setIsLoading(false);
                                    clearTimeout(safetyReset);
                                    return;
                                }
                                sanitizedData.selectedCardId = cardId;
                            }
                            delete sanitizedData.cardName;

                            const success = await Promise.race([
                                onAddTransaction(sanitizedData),
                                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao salvar transação")), 15000))
                            ]);
                            if (success) {
                                const formaTxt = sanitizedData.paymentMethod === 'credito'
                                    ? ` no cartão ${cards.find(c => c.id === sanitizedData.selectedCardId)?.name || ''}`.trimEnd()
                                    : '';
                                displayMessage += `\n\n✅ **Lançamento salvo:** ${sanitizedData.description} (R$ ${sanitizedData.amount.toLocaleString('pt-BR')})${formaTxt}`;
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
                            const isDescMatch = (tx.description || '').toLowerCase().includes((descSearch || '').toLowerCase());
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
                    } else if (command.action === 'add_fixed_expense') {
                        // Conta fixa → coleção fixed_expenses (aba Contas Fixas)
                        if (currentUser) {
                            const d = command.data || {};
                            const val = parseFloat(sanitizeAIValue(d.value || d.amount)) || 0;
                            await addDoc(collection(db, 'fixed_expenses'), {
                                name: d.name || d.description || 'Conta Fixa',
                                value: val,
                                day: parseInt(d.day) || 1,
                                category: d.category || 'housing',
                                priority: d.priority || 'essential',
                                isVariable: !!d.isVariable,
                                userId: currentUser.uid,
                                createdAt: Date.now(),
                            });
                            displayMessage += `\n\n✅ **Conta Fixa cadastrada:** ${d.name || d.description} (R$ ${val.toLocaleString('pt-BR')}) na aba Contas Fixas.`;
                        }
                    } else if (command.action === 'add_subscription' || command.action === 'add_installment') {
                        // Assinatura ou parcelamento → coleção subscriptions (aba Cartões)
                        if (currentUser) {
                            const d = command.data || {};
                            const isInst = command.action === 'add_installment';
                            const val = parseFloat(sanitizeAIValue(d.value || d.amount)) || 0;

                            // Tenta casar o cartão pelo nome citado (ex: "nubank")
                            let cardId = '';
                            if (d.cardName) {
                                const match = cards.find(c =>
                                    (c.name || '').toLowerCase().includes(String(d.cardName).toLowerCase())
                                );
                                if (match) cardId = match.id;
                            }
                            // Se a IA pediu cartão mas não há nenhum, avisa
                            const wantsCard = isInst || d.cardName || d.onCard;
                            if (wantsCard && !cardId && cards.length === 0) {
                                displayMessage += `\n\n⚠️ Você ainda não tem cartão cadastrado. Cadastre um na aba **Cartões** e tente novamente.`;
                            } else {
                                const totalInstallments = isInst ? (parseInt(d.installments || d.totalInstallments) || 2) : null;
                                let finalDay = parseInt(d.day) || 1;
                                if (cardId) {
                                    const linkedCard = cards.find(c => c.id === cardId);
                                    if (linkedCard?.dueDay) finalDay = linkedCard.dueDay;
                                }
                                await addDoc(collection(db, 'subscriptions'), {
                                    name: d.name || d.description || (isInst ? 'Parcelamento' : 'Assinatura'),
                                    value: val,
                                    day: finalDay,
                                    cardId: cardId || '',
                                    category: d.category || (isInst ? 'shopping' : 'subscriptions'),
                                    priority: d.priority || 'comfort',
                                    type: isInst ? 'installment' : 'recurring',
                                    isInstallment: isInst,
                                    totalInstallments,
                                    currentInstallment: isInst ? 1 : null,
                                    installmentMode: isInst ? 'per' : null,
                                    userId: currentUser.uid,
                                    createdAt: Date.now(),
                                });
                                const onde = cardId
                                    ? `no cartão ${cards.find(c => c.id === cardId)?.name}`
                                    : 'como avulsa';
                                displayMessage += isInst
                                    ? `\n\n✅ **Parcelamento criado:** ${d.name || d.description} em ${totalInstallments}x de R$ ${val.toLocaleString('pt-BR')} ${onde} (aba Cartões).`
                                    : `\n\n✅ **Assinatura criada:** ${d.name || d.description} (R$ ${val.toLocaleString('pt-BR')}/mês) ${onde} (aba Cartões).`;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse Gemini command:", e);
                }
            }
            setMessages(prev => [...prev, { role: 'model', text: displayMessage, timestamp: new Date().toISOString() }]);
        } catch (error) {
            console.error("Erro detalhado do Gemini:", error);
            let errMsg = "Desculpe, ocorreu um erro ao processar sua solicitação.";
            
            const isBusy = error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('overloaded');
            const isQuota = error.message?.includes('429') || error.message?.includes('quota');

            if (isBusy) {
                errMsg = "⏳ **A Alívia está muito requisitada agora.**\n\nOs servidores do Google estão com alta demanda. Tentei repetir a mensagem, mas ainda não consegui. Por favor, aguarde um minutinho e tente novamente.";
            } else if (isQuota) {
                errMsg = "⚠️ **Limite de uso atingido.**\n\nO limite de processamento da sua chave de API foi alcançado. Por favor, aguarde alguns instantes antes de enviar uma nova mensagem.";
            }
            
            setMessages(prev => [...prev, { role: 'model', text: errMsg, timestamp: new Date().toISOString() }]);
        } finally {
            clearTimeout(safetyReset);
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

        const handleOpenChat = (e) => {
            const msg = e.detail || "Olá Alívia!";
            setIsOpen(true);
            setTimeout(() => {
                processMessage(msg, false);
            }, 300);
        };

        window.addEventListener('ai-panic', handlePanic);
        window.addEventListener('open-ai-chat', handleOpenChat);
        return () => {
            window.removeEventListener('ai-panic', handlePanic);
            window.removeEventListener('open-ai-chat', handleOpenChat);
        };
    }, [transactions, manualConfig]);

    const chatContent = isOpen ? (
        <div className={`fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 w-auto sm:w-full transition-all duration-300 md:duration-500 ease-in-out ${
            isMaximized ? 'sm:max-w-2xl h-[85vh]' : 'sm:max-w-md h-[560px]'
        } z-[9999] flex flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl animate-in slide-in-from-bottom-10 fade-in ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-emerald-900/10' : 'bg-slate-900 border-white/10 shadow-black/40'
        }`}>
            {/* Header com gradiente sutil */}
            <div className={`relative px-4 py-3.5 flex justify-between items-center shrink-0 border-b ${
                theme === 'light'
                    ? 'bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-slate-100'
                    : 'bg-gradient-to-r from-emerald-500/[0.08] via-slate-900 to-blue-500/[0.08] border-white/[0.06]'
            }`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <img src={aliviaFinal} alt="Alívia" className="w-11 h-11 object-cover rounded-full border-2 border-emerald-400 shadow-md" />
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className={`font-black text-[15px] tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Alívia</h3>
                            <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md ${theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                IA
                            </span>
                        </div>
                        <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Consultora financeira · Online
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className={`hidden sm:flex p-2 rounded-xl transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50' : 'text-slate-500 hover:text-emerald-400 hover:bg-white/5'}`}
                        title={isMaximized ? "Recolher" : "Expandir"}
                    >
                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button onClick={clearHistory} className={`p-2 rounded-xl transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-500 hover:text-rose-400 hover:bg-white/5'}`} title="Limpar Histórico">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className={`p-2 rounded-xl transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-500 hover:text-white hover:bg-white/5'}`} title="Fechar">
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
                    <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-transparent ${
                        theme === 'light' ? 'bg-slate-50/50 scrollbar-thumb-slate-200' : 'bg-slate-950/30 scrollbar-thumb-slate-700'
                    }`}>
                        {messages.length === 0 && (
                            <div className="mt-4 flex flex-col items-center">
                                <div className="relative mb-3">
                                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
                                    <img src={aliviaFinal} alt="Alívia" className="relative w-20 h-20 rounded-full border-2 border-emerald-400 shadow-lg object-cover" />
                                </div>
                                <p className={`text-base text-center px-4 mb-1 font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                    Olá! Sou a Alívia 👋
                                </p>
                                <p className={`text-xs text-center px-6 mb-5 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Sua consultora financeira. Posso analisar seus gastos, lançar transações, projetar seu futuro e tirar dúvidas.
                                </p>

                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2.5 self-start ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Sugestões
                                </p>
                                {/* Sugestões rápidas */}
                                <div className="w-full space-y-2">
                                    {[
                                        { icon: '📊', text: 'Como está minha saúde financeira este mês?' },
                                        { icon: '💸', text: 'Onde estou gastando mais?' },
                                        { icon: '🎯', text: 'Consigo atingir minhas metas no ritmo atual?' },
                                        { icon: '➕', text: 'Lançar um gasto de R$ 50 no mercado' },
                                    ].map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => processMessage(s.text, false)}
                                            disabled={isLoading}
                                            className={`group w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${
                                                theme === 'light'
                                                    ? 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm'
                                                    : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]'
                                            }`}
                                        >
                                            <span className="text-base shrink-0">{s.icon}</span>
                                            <span className="flex-1">{s.text}</span>
                                            <Send className={`w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={idx} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    {/* Avatar da Alívia nas respostas dela */}
                                    {!isUser && (
                                        <img src={aliviaFinal} alt="" className="w-7 h-7 rounded-full border border-emerald-400/50 object-cover shrink-0 mb-1" />
                                    )}
                                    <div className={`max-w-[80%] px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${isUser
                                        ? 'bg-emerald-500 text-white rounded-2xl rounded-br-md'
                                        : theme === 'light'
                                            ? 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-bl-md'
                                            : 'bg-slate-800 text-slate-200 border border-white/[0.06] rounded-2xl rounded-bl-md'
                                        }`}>
                                        <ReactMarkdown
                                            components={{
                                                p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                ul: ({ ...props }) => <ul className="list-disc ml-4 mb-2 space-y-0.5" {...props} />,
                                                li: ({ ...props }) => <li className="mb-0.5" {...props} />,
                                                strong: ({ ...props }) => <strong className={`font-bold ${isUser ? 'text-white' : 'text-emerald-500'}`} {...props} />
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>

                                        {msg.timestamp && (
                                            <div className={`text-[9px] mt-1 flex justify-end ${isUser ? 'text-white/60' : 'text-slate-400/70'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {isLoading && (
                            <div className="flex items-end gap-2 justify-start">
                                <img src={aliviaFinal} alt="" className="w-7 h-7 rounded-full border border-emerald-400/50 object-cover shrink-0 mb-1" />
                                <div className={`rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5 ${
                                    theme === 'light' ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-white/[0.06]'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSend} className={`p-3 border-t shrink-0 ${
                        theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/[0.06]'
                    }`}>
                        <div className={`flex items-center gap-2 rounded-2xl border pl-4 pr-2 py-1.5 transition-all focus-within:ring-2 ${
                            theme === 'light'
                                ? 'bg-slate-50 border-slate-200 focus-within:border-emerald-400 focus-within:ring-emerald-500/10'
                                : 'bg-white/[0.04] border-white/10 focus-within:border-emerald-500/50 focus-within:ring-emerald-500/10'
                        }`}>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Pergunte ou peça para lançar algo..."
                                className={`flex-1 bg-transparent text-sm focus:outline-none ${
                                    theme === 'light' ? 'text-slate-800 placeholder-slate-400' : 'text-slate-200 placeholder-slate-500'
                                }`}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className={`text-[9px] text-center mt-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>
                            A Alívia pode cometer erros. Confira informações importantes.
                        </p>
                    </form>
                </>
            )}
        </div>
    ) : (
        <button
            onClick={() => setIsOpen(true)}
            aria-label="Abrir chat com a Alívia"
            className={`group fixed bottom-6 right-4 sm:right-6 z-[9999] flex items-center gap-3 rounded-full pl-2 pr-2 sm:pr-5 py-2 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-2 ${
                theme === 'light'
                    ? 'bg-white border-emerald-200 shadow-emerald-500/20 hover:border-emerald-300'
                    : 'bg-slate-900 border-emerald-500/30 shadow-emerald-500/20 hover:border-emerald-500/50'
            }`}
        >
            {/* Avatar com anel pulsante */}
            <span className="relative flex items-center justify-center shrink-0">
                <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                <img
                    src={aliviaFinal}
                    alt="Alívia"
                    className="relative w-12 h-12 object-cover rounded-full border-2 border-emerald-400 shadow-md"
                />
                {/* Bolinha de status online */}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </span>

            {/* Label — visível sempre em telas sm+, oculta no mobile pra não ocupar tela */}
            <span className="hidden sm:flex flex-col items-start leading-tight pr-1">
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`}>
                    Assistente IA
                </span>
                <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    Fale com a Alívia
                </span>
            </span>
        </button>
    );

    // IA Alívia: exclusiva do Premium. Não renderiza nem o botão flutuante para Free/Standard.
    if (!canUseAI) return null;

    return createPortal(chatContent, document.body);
}
