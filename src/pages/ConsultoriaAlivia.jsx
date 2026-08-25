import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { buildWalletLedger } from '../utils/financialLogic';
import { sendMessageToGemini, setGeminiKey, calculateStatsContext, extractTransactionsFromFile } from '../services/gemini';
import aliviaAvatar from '../assets/alivia/alivia-final.png';
import { Send, Paperclip, Sparkles, Check, Loader2, FileText, ChevronRight, CreditCard, Landmark, RotateCcw } from 'lucide-react';

const WELCOME = { role: 'alivia', text: 'Olá, sou a Alívia, sua consultora financeira. Posso lançar gastos e ganhos (ex.: *"gastei 50 no mercado"*), analisar seu saldo e seus gastos, e **importar seu extrato ou fatura** — em PDF, imagem, CSV ou OFX. Como posso ajudar?' };
const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };

// Normaliza sinais de menos unicode (−, –, —) para hífen ASCII.
const deDash = (s) => String(s).replace(/[−–—]/g, '-');
// Número BR/US: "1.234,56", "1234.56", "-50,00", "R$ 50", "−R$ 1.000,00", "(30,00)".
const smartNum = (s) => {
    let t = deDash(s).trim().replace(/[R$\s]/gi, '');
    const neg = /^-|-$|^\(/.test(t);
    t = t.replace(/[()]/g, '').replace(/^-|-$/, '');
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.includes(',')) t = t.replace(',', '.');
    const n = parseFloat(t);
    if (!isFinite(n)) return 0;
    return neg ? -Math.abs(n) : n;
};
const isMoney = (s) => { const t = deDash(s).replace(/\s/g, ''); return /^[+-]?\(?R?\$?[+-]?\d{1,3}(\.\d{3})*(,\d{1,2})?\)?$/.test(t) || /^[+-]?R?\$?[+-]?\d+([.,]\d{1,2})?$/.test(t); };
const isDateCell = (s) => /(\d{2}[\/-]\d{2}[\/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/.test(String(s));
const parseDate = (s) => {
    let m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`).toISOString();
    m = String(s).match(/(\d{2})[\/-](\d{2})[\/-](\d{2,4})/); // dd/mm/aaaa (BR)
    if (m) { const yr = m[3].length === 2 ? '20' + m[3] : m[3]; return new Date(`${yr}-${m[2]}-${m[1]}T12:00:00`).toISOString(); }
    return null;
};

const CAT_KW = [
    // Contas de moradia vêm ANTES (para "conta de água/luz" não cair em alimentação).
    { cat: 'housing', kw: /conta\s*d[e'’]?\s*[aá]gua|conta\s*de\s*(luz|energia|g[aá]s)|aluguel|condom[ií]nio|iptu|sanep|enel|cemig|copel/i },
    { cat: 'divida', kw: /d[ií]vida|empr[eé]stimo|financ|credi[aá]rio|presta[cç][aã]o|parcela\s+atrasad|nome\s+sujo/i },
    { cat: 'food', kw: /mercado|super|padaria|acougue|hortifr|feira|alimenta|comida|almo[cç]o|janta|carrefour|assai|atacad|[aá]gua|garrafa|refri|refrigerante|suco|caf[eé]|cerveja|bebida/i },
    { cat: 'fast_food', kw: /lanche|mc\s?donald|burger|ifood|pizza|fast|hamburg|subway|bobs/i },
    { cat: 'transport', kw: /uber|99|t[aá]xi|[oô]nibus|metr[oô]|gasolina|combust|posto|estacion|bilhete|ped[aá]gio|shell|ipiranga/i },
    { cat: 'health', kw: /farm[aá]cia|drogaria|rem[eé]dio|m[eé]dico|hospital|sa[uú]de|dentista|consulta|raia|pacheco/i },
    { cat: 'housing', kw: /luz|energia|el[eé]tr|g[aá]s|internet|vivo|claro|tim\b|oi\b/i },
    { cat: 'subscriptions', kw: /netflix|spotify|assinatura|prime|disney|hbo|max|youtube|apple\.com|google/i },
    { cat: 'leisure', kw: /cinema|bar\b|balada|lazer|show|viagem|jogo|game|steam|ingress/i },
    { cat: 'shopping', kw: /roupa|loja|shopping|amazon|mercado\s?livre|magalu|americanas|shopee|aliexpress|renner|riachuelo/i },
    { cat: 'education', kw: /curso|escola|faculdade|livro|educa|mensalidade|udemy|alura/i },
];
const guessCat = (text, type) => {
    if (type === 'income') return /sal[aá]rio/i.test(text) ? 'salary' : /freela/i.test(text) ? 'freelance' : 'other';
    return CAT_KW.find(c => c.kw.test(text))?.cat || 'other';
};
// Transferência interna (cofrinho/reserva) — não é gasto/renda de verdade.
const isCofrinho = (d) => /cofrinho|reserva|guardad|resgatad/i.test(String(d || ''));
const isFaturaPgto = (d) => /fatura/i.test(String(d || ''));

// Confirmação curta quando a IA executa uma ação sem escrever texto próprio.
const confirmMsg = (action, d = {}) => {
    const val = Math.abs(parseFloat(String(d.amount ?? d.value ?? '').replace(',', '.')) || 0);
    const nome = normalizeName(d.description || d.name || '');
    const v = val ? ` de **R$ ${money(val)}**` : '';
    const em = nome ? ` em *${nome}*` : '';
    switch (action) {
        case 'add_transaction': return `Pronto, lancei${v}${em}. ✅`;
        case 'add_fixed_expense': return `Cadastrei a conta fixa${v}${em}. ✅`;
        case 'add_subscription': return `Cadastrei a assinatura${v}${em}. ✅`;
        case 'add_installment': return `Registrei o parcelamento${em}. ✅`;
        case 'add_to_reserve': return `Guardei${v} na sua reserva. ✅`;
        default: return 'Pronto, registrei. ✅';
    }
};

// Lê um arquivo como base64 (sem o prefixo data:...;base64,).
const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(file);
});

export default function ConsultoriaAlivia({ onNavigate }) {
    const { currentUser, userPrefs, planLevel } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();
    const fileRef = useRef(null);
    const endRef = useRef(null);

    const [tx, setTx] = useState([]);
    const [cards, setCards] = useState([]);
    const [jars, setJars] = useState([]);
    const [subs, setSubs] = useState([]);
    const [invs, setInvs] = useState([]);
    const [fixExp, setFixExp] = useState([]);
    const [goals, setGoals] = useState([]);
    const [msgs, setMsgs] = useState([WELCOME]);
    const [loaded, setLoaded] = useState(false);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(null); // { items, fileName, docType, cardId, tratarCofrinho }
    const [hasKey, setHasKey] = useState(false);
    const [thinking, setThinking] = useState('');

    const chatKey = uid ? `aliviaChat_${uid}` : 'aliviaChat';

    // Ativa a chave da IA (se configurada) e detecta se está disponível.
    useEffect(() => {
        try { const k = localStorage.getItem('aliviaGeminiKey'); if (k) { setGeminiKey(k); setHasKey(true); } else setHasKey(false); } catch { setHasKey(false); }
    }, []);

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const subsList = [
            onSnapshot(q('transactions'), s => setTx(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('cards'), s => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('savings_jars'), s => setJars(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('subscriptions'), s => setSubs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('investments'), s => setInvs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('fixed_expenses'), s => setFixExp(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
            onSnapshot(q('expense_goals'), s => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { }),
        ];
        return () => subsList.forEach(u => u());
    }, [uid]);

    // Carrega o histórico salvo do usuário.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(chatKey);
            if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) setMsgs(arr); }
        } catch { }
        setLoaded(true);
    }, [chatKey]);

    // Salva o histórico a cada mensagem (últimas 200).
    useEffect(() => { if (loaded) { try { localStorage.setItem(chatKey, JSON.stringify(msgs.slice(-200))); } catch { } } }, [msgs, loaded, chatKey]);

    const clearChat = () => { setMsgs([WELCOME]); try { localStorage.removeItem(chatKey); } catch { } };

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, pending]);

    const saldo = useMemo(() => buildWalletLedger(tx, mk).finalBalance, [tx, mk]);
    const monthTx = useMemo(() => tx.filter(t => (t.month || String(t.date || '').slice(0, 7)) === mk && t.paymentMethod !== 'credito'), [tx, mk]);
    const gastosMes = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const ganhosMes = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

    const say = (text, role = 'alivia', options = null) => setMsgs(m => [...m, { role, text, ...(options && options.length ? { options } : {}) }]);

    // Executa uma ação retornada pela IA (bloco JSON).
    const executeAction = async (action, data = {}) => {
        const now = new Date();
        const iso = data.date ? new Date(data.date + 'T12:00:00').toISOString() : now.toISOString();
        const amt = Math.abs(parseFloat(String(data.amount ?? data.value ?? 0).replace(',', '.')) || 0);
        const findCard = (n) => cards.find(c => (c.name || c.bank || '').toLowerCase().includes(String(n || '').toLowerCase()));
        if (action === 'add_transaction') {
            const credito = data.paymentMethod === 'credito';
            const card = credito ? findCard(data.cardName) : null;
            await addDoc(collection(db, 'transactions'), {
                description: normalizeName(data.description || 'Lançamento'), amount: amt, type: data.type === 'income' ? 'income' : 'expense',
                category: data.category || 'other', date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(),
                paymentMethod: data.paymentMethod || 'pix', source: 'alivia_ia',
                ...(credito && card ? { selectedCardId: card.id, invoiceStatus: 'unpaid' } : {}),
                ...(data.type !== 'income' ? { priority: data.priority || 'comfort' } : {}),
            });
        } else if (action === 'add_fixed_expense') {
            await addDoc(collection(db, 'fixed_expenses'), { name: normalizeName(data.name || 'Conta'), value: amt, day: parseInt(data.day) || 5, category: data.category || 'conta_fixa', isVariable: !!data.isVariable, priority: 'essential', paymentMethod: 'pix', userId: uid, createdAt: Date.now() });
        } else if (action === 'add_subscription') {
            const card = findCard(data.cardName);
            await addDoc(collection(db, 'subscriptions'), { name: normalizeName(data.name || 'Assinatura'), value: amt, day: card ? card.dueDay : (parseInt(data.day) || 1), cardId: card ? card.id : '', category: data.category || 'subscriptions', priority: 'comfort', type: 'recurring', userId: uid, createdAt: Date.now() });
        } else if (action === 'add_installment') {
            const card = findCard(data.cardName);
            await addDoc(collection(db, 'subscriptions'), { name: normalizeName(data.name || 'Parcelamento'), value: amt, day: card ? card.dueDay : 1, cardId: card ? card.id : '', category: data.category || 'shopping', priority: 'comfort', isInstallment: true, totalInstallments: parseInt(data.installments) || 1, currentInstallment: 1, installmentMode: 'per', type: 'installment', userId: uid, createdAt: Date.now() });
        } else if (action === 'add_to_reserve') {
            const jar = jars[0];
            let jarId, jarName;
            if (jar) {
                jarId = jar.id; jarName = jar.name || 'Reserva de emergência';
                await updateDoc(doc(db, 'savings_jars', jar.id), { balance: (parseFloat(jar.balance) || 0) + amt, invested: (parseFloat(jar.invested ?? jar.balance) || 0) + amt, lastYieldAt: Date.now() });
            } else {
                jarName = 'Reserva de emergência';
                const ref = await addDoc(collection(db, 'savings_jars'), { name: jarName, balance: amt, invested: amt, cdiPercent: 100, lastYieldAt: Date.now(), type: 'reserva', userId: uid, createdAt: Date.now() });
                jarId = ref.id;
            }
            // Registra o APORTE ligado à reserva (jarId) — aparece na lista de aportes.
            // Aporte interno (dinheiro já guardado): não mexe no saldo nem no extrato.
            await addDoc(collection(db, 'transactions'), {
                description: `Aporte reserva: ${jarName}`, amount: amt, type: 'expense', category: 'vault',
                date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(), paymentMethod: 'pix',
                source: 'patrimonio', jarId, isTransfer: true, reserveInternal: true,
            });
        }
    };

    // Conversa com o Gemini (IA generativa) + executa ações.
    const askAlivia = async (text) => {
        setThinking('Analisando suas finanças…');
        let context = '';
        try {
            const mc = userPrefs?.manualConfig || {};
            const onboarding = userPrefs?.onboarding || mc.onboarding || {};
            context = calculateStatsContext(tx, mc, false, jars, invs, onboarding, {
                cards, subscriptions: subs, fixedExpenses: fixExp, expenseGoals: goals, planLevel,
            });
        } catch (e) { console.warn('[ctx]', e); }
        let reply;
        try { reply = await sendMessageToGemini(msgs, text, context); }
        catch (e) { console.error(e); setThinking(''); say('Não consegui falar com a IA agora. Verifique a **chave** em Configurações (ou pode estar sem internet / no limite gratuito). 🙏'); return; }
        // Extrai o bloco de ação (JSON) e o remove por completo do texto exibido,
        // para o chat nunca mostrar nada técnico ao usuário.
        const jsonMatch = reply.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i) || reply.match(/(\{[\s\S]*?"action"[\s\S]*?\})/);
        const display = reply
            .replace(/```(?:json)?\s*[\s\S]*?```/gi, '')   // qualquer bloco de código
            .replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '')   // qualquer objeto de ação solto
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        setThinking('');
        if (display) say(display);
        if (jsonMatch) {
            try {
                const obj = JSON.parse(jsonMatch[1].trim());
                // "ask": a Alívia precisa de mais dados → mostra a pergunta com opções
                // clicáveis e NÃO executa nada até o usuário responder.
                if (obj.action === 'ask') {
                    const d0 = obj.data || {};
                    const opts = Array.isArray(obj.options) ? obj.options : (Array.isArray(d0.options) ? d0.options : []);
                    const q = obj.question || d0.question;
                    if (q && !display) say(q, 'alivia', opts);
                    else if (opts.length) setMsgs(m => m.length ? [...m.slice(0, -1), { ...m[m.length - 1], options: opts }] : m);
                    setThinking('');
                    return;
                }
                if (obj.action) {
                    const d = obj.data || {};
                    const val = parseFloat(String(d.amount ?? d.value ?? '').replace(',', '.')) || 0;
                    const nome = d.description || d.name || 'lançamento';
                    setThinking(val ? `Registrando R$ ${money(val)} em ${normalizeName(nome)}…` : 'Registrando no app…');
                    await executeAction(obj.action, d);
                    setThinking('');
                    // Se a IA não escreveu confirmação, garantimos um retorno claro.
                    if (!display) say(confirmMsg(obj.action, d));
                }
            } catch (e) { console.warn('[ia action]', e); setThinking(''); }
        }
    };

    const handleText = async (raw) => {
        const text = raw.trim();
        if (!text) return;
        say(text, 'user');
        setBusy(true);
        try {
            if (hasKey) { await askAlivia(text); setBusy(false); return; }
            const amountMatch = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
            const amount = amountMatch ? Math.abs(smartNum(amountMatch[1])) : 0;
            const incomeWord = /\b(recebi|ganhei|ganho|ganhar|entrou|entrada|receb\w*|sal[aá]rio|renda|caiu|freela\w*)\b/i.test(text);
            const expenseWord = /\b(gast\w*|paguei|pagar|paga\w*|comprei|comprar|compra\w*|torrei|saiu|d[eé]bito|despes\w*)\b/i.test(text);
            const launchWord = /\b(lan[cç]\w*|registr\w*|adicion\w*|anot\w*|coloca\w*|põe|poe)\b/i.test(text);
            const question = (/\?/.test(text) || /\b(qual|quanto|quantos|quantas|como|quais|est[aã]o|tenho|posso)\b/i.test(text)) && !launchWord;

            const reserveWord = /\b(cofrinho|reserva|guard(ei|ar|o)?|poup(ar|ei|o)?)\b/i.test(text);
            if (amount > 0 && reserveWord && !question) {
                setThinking(`Guardando R$ ${money(amount)} na reserva…`);
                await executeAction('add_to_reserve', { amount });
                setThinking('');
                say(`Pronto! Guardei **R$ ${money(amount)}** na sua **reserva** 🐷 (saiu do saldo em conta). ✅`);
            } else if (amount > 0 && (incomeWord || expenseWord || launchWord) && !question) {
                const type = incomeWord && !expenseWord ? 'income' : 'expense';
                let desc = text.replace(amountMatch[0], ' ')
                    .replace(/\b(gast\w*|pag\w*|compr\w*|receb\w*|ganh\w*|entrou|entrada|torrei|saiu|d[eé]bito|despes\w*|lan[cç]\w*|registr\w*|adicion\w*|anot\w*|coloca\w*|reais?|real|r\$|no|na|nos|nas|de|do|da|com|em|pra|para|hoje|ontem|meu|meus|minha|um|uma)\b/gi, ' ')
                    .replace(/\s+/g, ' ').trim() || (type === 'income' ? 'Entrada' : 'Gasto');
                setThinking(`Lançando ${type === 'income' ? '➕' : '➖'} R$ ${money(amount)} em ${normalizeName(desc)}…`);
                const iso = new Date().toISOString();
                await addDoc(collection(db, 'transactions'), {
                    description: normalizeName(desc), amount, type, category: guessCat(text, type),
                    date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(), paymentMethod: 'pix', source: 'alivia',
                    ...(type === 'expense' ? { priority: 'comfort' } : {}),
                });
                setThinking('');
                say(`Pronto! Lancei ${type === 'income' ? '➕ entrada' : '➖ gasto'} de **R$ ${money(amount)}** em *${normalizeName(desc)}*. ✅`);
            } else if (/\bsaldo\b/i.test(text)) say(`Seu **saldo em conta** hoje é **R$ ${money(saldo)}**.`);
            else if (/\bgast|despes/i.test(text)) say(`Neste mês você gastou **R$ ${money(gastosMes)}**${ganhosMes ? ` e recebeu R$ ${money(ganhosMes)}` : ''}. ${gastosMes > ganhosMes && ganhosMes > 0 ? 'Atenção: gastou mais do que ganhou. ⚠️' : 'Segue no controle. 👍'}`);
            else if (/\bganho|receb|entrada/i.test(text)) say(`Neste mês você recebeu **R$ ${money(ganhosMes)}**.`);
            else if (/\b(ajuda|o que|como|pode|consegue)\b/i.test(text)) say('Posso **lançar** ("gastei 30 no uber"), responder sobre **saldo/gastos**, e **importar seu extrato ou fatura** — toque no 📎 e envie o CSV/OFX do banco. 😉');
            else say('Entendi! Diga algo como *"gastei 45 no mercado"* pra eu lançar, pergunte *"qual meu saldo?"*, ou envie o extrato/fatura no 📎. 🙂');
        } catch (e) { console.error(e); say('Ops, não consegui concluir agora. Tenta de novo? 🙏'); }
        setBusy(false);
    };

    // Recebe os itens extraídos (por parser ou IA) e monta a confirmação de importação.
    const proporImportacao = (items, fileName, sugestaoDocType) => {
        if (!items.length) { say('Não identifiquei lançamentos nesse arquivo. Confira se é um extrato ou fatura com **data, descrição e valor**. 🤔'); return; }
        const anyNeg = items.some(i => i.amount < 0);
        const docType = sugestaoDocType || (anyNeg ? 'extrato' : 'fatura');
        const cofres = items.filter(i => isCofrinho(i.description)).length;
        setPending({ items, fileName, docType, cardId: cards[0]?.id || '', tratarCofrinho: 'ignorar' });
        say(cofres > 0
            ? `Encontrei **${items.length} lançamentos** — e **${cofres}** parecem ser de cofrinho/reserva (transferências internas, não são gasto de verdade). Confirme abaixo **como tratar** e o **tipo** do arquivo antes de importar. 👇`
            : `Encontrei **${items.length} lançamentos**. Confirme abaixo se é **extrato** ou **fatura de cartão** e importe. 👇`);
    };

    const handleFile = async (file) => {
        if (!file) return;
        say(`📎 ${file.name}`, 'user');
        setBusy(true);
        setThinking('Lendo o arquivo…');
        try {
            const name = file.name.toLowerCase();
            const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(name);

            if (isPdf || isImage) {
                // PDF e imagem só com a IA (leitura multimodal do Gemini).
                if (!hasKey) {
                    setThinking('');
                    say('Para ler **PDF** (ou foto) do extrato/fatura eu preciso da **IA generativa** ativada. Configure sua chave gratuita do Gemini em Configurações, ou me envie o arquivo em **CSV/OFX** que também funciona. 🙏');
                    setBusy(false);
                    return;
                }
                setThinking(isPdf ? 'Lendo o PDF…' : 'Lendo a imagem…');
                const base64Data = await fileToBase64(file);
                const { docType, items } = await extractTransactionsFromFile({ base64Data, mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg') });
                setThinking('');
                proporImportacao(items, file.name, docType);
            } else {
                const content = await file.text();
                setThinking('');
                const items = (name.endsWith('.ofx') || /<OFX>/i.test(content)) ? parseOFX(content) : parseCSV(content);
                proporImportacao(items, file.name);
            }
        } catch (e) { console.error(e); setThinking(''); say('Não consegui ler esse arquivo. Se for um PDF muito grande ou protegido, tente exportar o **CSV/OFX** do banco. 🙏'); }
        setBusy(false);
    };

    const importPending = async () => {
        if (!pending) return;
        const fatura = pending.docType === 'fatura';
        if (fatura && !pending.cardId) { say('Selecione o **cartão** da fatura antes de importar. 💳'); return; }
        setBusy(true);
        let importados = 0, ignorados = 0, reservas = 0;
        try {
            const batch = writeBatch(db);
            for (const it of pending.items) {
                const cofre = !fatura && isCofrinho(it.description);
                if (cofre && pending.tratarCofrinho === 'ignorar') { ignorados++; continue; }
                const iso = it.date || new Date().toISOString();
                let type = fatura ? 'expense' : (it.amount < 0 ? 'expense' : 'income');
                let category;
                if (cofre) { category = it.amount < 0 ? 'vault' : 'vault_redemption'; reservas++; }
                else if (!fatura && isFaturaPgto(it.description)) category = 'credit_card_bill';
                else category = guessCat(it.description || '', type);
                const data = {
                    description: normalizeName(it.description || 'Lançamento'), amount: Math.abs(it.amount), type,
                    category, date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(), source: 'alivia_import',
                    ...(type === 'expense' ? { priority: 'comfort' } : {}),
                };
                if (fatura) { data.paymentMethod = 'credito'; data.selectedCardId = pending.cardId; data.invoiceStatus = 'unpaid'; }
                else data.paymentMethod = 'pix';
                batch.set(doc(collection(db, 'transactions')), data);
                importados++;
            }
            setThinking(`Importando ${importados} lançamentos…`);
            await batch.commit();
            setThinking('');
            const extra = ignorados ? ` (ignorei ${ignorados} de cofrinho)` : reservas ? ` (${reservas} como movimento de reserva)` : '';
            say(`Importei **${importados} lançamentos**${fatura ? ' na **fatura do cartão** 💳 (não mexe no saldo até pagar a fatura)' : ' no seu **extrato**'}${extra}. ✅ Já aparecem em Lançamentos${fatura ? '/Cartão' : ''}!`);
        } catch (e) { console.error(e); setThinking(''); say('Deu erro ao importar os lançamentos. 🙏'); }
        setPending(null);
        setBusy(false);
    };

    const cellText = isDark ? 'text-slate-200' : 'text-slate-700';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    return (
        <div className="max-w-3xl mx-auto w-full h-[calc(100vh-6rem)] lg:h-[calc(100vh-5rem)] flex flex-col">
            {/* Cabeçalho */}
            <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                <img src={aliviaAvatar} alt="Alívia" className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400" />
                <div className="min-w-0 flex-1">
                    <p className={`font-black flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Alívia <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">IA</span></p>
                    <p className="text-[12px] text-emerald-500 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Consultora financeira · {hasKey ? 'IA generativa ativa' : 'Online'}</p>
                </div>
                {msgs.length > 1 && (
                    <button onClick={clearChat} title="Nova conversa (limpar histórico)"
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold shrink-0 transition ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nova conversa</span>
                    </button>
                )}
            </div>

            {/* Aviso IA generativa — só quando NÃO há chave */}
            {!hasKey && (
                <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-[12px] text-amber-500/90 leading-snug">
                            No momento entendo <b>comandos</b> (lançar gastos/ganhos), respondo sobre suas finanças e <b>importo extratos/faturas em CSV/OFX</b> — mas ainda não converso livremente nem leio <b>PDF/imagem</b>. Para a <b>IA completa</b> (incluindo leitura de PDF), configure uma chave gratuita do Gemini.
                        </p>
                        <button onClick={() => onNavigate?.('configuracoes')} className="mt-1.5 inline-flex items-center gap-0.5 text-[12px] font-bold text-amber-500 hover:text-amber-400 transition">
                            Configurar chave de IA <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 no-scrollbar">
                {msgs.map((m, i) => (
                    <div key={i} className="space-y-2">
                        <Bubble isDark={isDark} role={m.role} text={m.text} />
                        {m.options && m.options.length > 0 && (
                            <div className="flex flex-wrap gap-2 ml-9">
                                {m.options.map((opt, j) => (
                                    <button key={j} type="button" onClick={() => handleText(opt)} disabled={busy}
                                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition active:scale-95 disabled:opacity-50 ${isDark ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-50'}`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {thinking && (
                    <div className="flex gap-2.5 max-w-[85%]">
                        <img src={aliviaAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
                        <div className={`px-3.5 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-2 ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                            <span className={`text-[12px] italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{thinking}</span>
                        </div>
                    </div>
                )}

                {pending && (
                    <div className="flex gap-2.5 max-w-[92%]">
                        <img src={aliviaAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
                        <div className={`w-full rounded-2xl rounded-tl-md border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                            <div className={`flex items-center gap-2 px-3.5 py-2.5 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                <FileText className="w-4 h-4 text-emerald-500" /><span className={`text-[12px] font-bold ${cellText}`}>{pending.fileName}</span>
                            </div>

                            {/* Tipo do documento */}
                            <div className={`px-3.5 py-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>Este arquivo é:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[{ id: 'extrato', label: 'Extrato bancário', icon: Landmark }, { id: 'fatura', label: 'Fatura de cartão', icon: CreditCard }].map(o => {
                                        const on = pending.docType === o.id; const Icon = o.icon;
                                        return (
                                            <button key={o.id} onClick={() => setPending(p => ({ ...p, docType: o.id }))}
                                                className={`py-2 rounded-xl text-[12px] font-bold border flex items-center justify-center gap-1.5 transition ${on ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40' : (isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500')}`}>
                                                <Icon className="w-4 h-4" /> {o.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {pending.docType === 'fatura' && (
                                    cards.length === 0 ? (
                                        <p className="text-[11px] text-amber-500 font-semibold mt-2">Cadastre um cartão em “Meu cartão” pra importar a fatura.</p>
                                    ) : (
                                        <select value={pending.cardId} onChange={e => setPending(p => ({ ...p, cardId: e.target.value }))}
                                            className={`w-full mt-2 px-3 py-2 rounded-xl border text-[13px] font-semibold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                            {cards.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.name || c.bank || 'Cartão'}</option>)}
                                        </select>
                                    )
                                )}
                            </div>

                            {/* Cofrinho / reserva — pergunta quando em dúvida */}
                            {pending.docType === 'extrato' && pending.items.some(i => isCofrinho(i.description)) && (
                                <div className={`px-3.5 py-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${muted}`}>Movimentos de cofrinho/reserva ({pending.items.filter(i => isCofrinho(i.description)).length})</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ id: 'ignorar', label: 'Ignorar (recomendado)' }, { id: 'reserva', label: 'Lançar como reserva' }].map(o => {
                                            const on = pending.tratarCofrinho === o.id;
                                            return (
                                                <button key={o.id} onClick={() => setPending(p => ({ ...p, tratarCofrinho: o.id }))}
                                                    className={`py-2 rounded-xl text-[12px] font-bold border transition ${on ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40' : (isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500')}`}>
                                                    {o.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className={`text-[11px] mt-1.5 ${muted}`}>São transferências internas (não são gasto/renda). Ignorar deixa seus números limpos.</p>
                                </div>
                            )}

                            {/* Lista */}
                            <div className="max-h-40 overflow-y-auto">
                                {pending.items.slice(0, 40).map((it, i) => {
                                    const cofre = pending.docType === 'extrato' && isCofrinho(it.description);
                                    const ignorado = cofre && pending.tratarCofrinho === 'ignorar';
                                    const type = pending.docType === 'fatura' ? 'expense' : (it.amount < 0 ? 'expense' : 'income');
                                    return (
                                        <div key={i} className={`flex items-center justify-between gap-3 px-3.5 py-1.5 text-[12px] ${i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''} ${ignorado ? 'opacity-40' : ''}`}>
                                            <span className={`truncate flex items-center gap-1.5 ${cellText}`}>
                                                {it.description || 'Lançamento'}
                                                {cofre && <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-indigo-500/15 text-indigo-400 shrink-0">cofrinho</span>}
                                            </span>
                                            <span className={`font-black tabular-nums shrink-0 ${ignorado ? 'line-through' : ''} ${type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{type === 'income' ? '+' : '−'} R$ {money(Math.abs(it.amount))}</span>
                                        </div>
                                    );
                                })}
                                {pending.items.length > 40 && <p className={`text-[11px] text-center py-1.5 ${muted}`}>+{pending.items.length - 40} lançamentos…</p>}
                            </div>

                            <div className={`grid grid-cols-2 gap-2 p-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                <button onClick={() => { setPending(null); say('Ok, cancelei a importação. 👍'); }} className={`py-2 rounded-lg text-[12px] font-bold ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                                {(() => {
                                    const n = pending.items.filter(it => !(pending.docType === 'extrato' && isCofrinho(it.description) && pending.tratarCofrinho === 'ignorar')).length;
                                    return (
                                        <button onClick={importPending} disabled={busy || (pending.docType === 'fatura' && (!pending.cardId || cards.length === 0))} className="py-2 rounded-lg text-[12px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1.5 disabled:opacity-50">
                                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Importar {n}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Sugestões */}
            <div className="flex gap-2 flex-wrap mb-2">
                {['Qual meu saldo?', 'Como estão meus gastos?', 'Gastei 40 no mercado'].map(q => (
                    <button key={q} onClick={() => handleText(q)} disabled={busy}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition disabled:opacity-50 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{q}</button>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); const v = input; setInput(''); handleText(v); }}
                className={`flex items-center gap-2 rounded-2xl border p-2 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                <input ref={fileRef} type="file" accept=".csv,.ofx,.txt,.qfx,.pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f); }} />
                <button type="button" onClick={() => fileRef.current?.click()} title="Enviar extrato ou fatura (PDF, imagem, CSV ou OFX)" className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <Paperclip className="w-5 h-5" />
                </button>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Pergunte ou registre um gasto…" disabled={busy}
                    className={`flex-1 bg-transparent outline-none text-sm font-medium ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
                <button type="submit" disabled={busy || !input.trim()} className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </form>
        </div>
    );
}

function Bubble({ isDark, role, text }) {
    const me = role === 'user';
    const html = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/^\s*[-•]\s+(.*)$/gm, '<span style="display:block;padding-left:0.9em;text-indent:-0.9em">• $1</span>')
        .replace(/\n/g, '<br/>');
    return (
        <div className={`flex gap-2.5 max-w-[85%] ${me ? 'ml-auto flex-row-reverse' : ''}`}>
            {!me && <img src={aliviaAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />}
            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${me ? 'bg-emerald-500 text-white rounded-tr-md' : (isDark ? 'bg-white/[0.05] text-slate-200 rounded-tl-md' : 'bg-slate-100 text-slate-700 rounded-tl-md')}`}
                dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}

// ── Parsers ─────────────────────────────────────────────────────────
function parseOFX(content) {
    const items = [];
    const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
    for (const b of blocks) {
        const amt = smartNum((b.match(/<TRNAMT>([^<\r\n]+)/i) || [])[1] || '0');
        const memo = ((b.match(/<MEMO>([^<\r\n]+)/i) || [])[1] || (b.match(/<NAME>([^<\r\n]+)/i) || [])[1] || 'Lançamento').trim();
        const dt = ((b.match(/<DTPOSTED>([^<\r\n]+)/i) || [])[1] || '').trim();
        let iso = null;
        if (/^\d{8}/.test(dt)) iso = new Date(`${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T12:00:00`).toISOString();
        if (amt !== 0) items.push({ description: memo, amount: amt, date: iso });
    }
    return items;
}

function splitCSVLine(line, delim) {
    const out = []; let cur = '', q = false;
    for (const ch of line) {
        if (ch === '"') q = !q;
        else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out.map(c => c.replace(/^"|"$/g, '').trim());
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const header = splitCSVLine(lines[0], delim).map(h => h.toLowerCase());
    const findIdx = (re) => header.findIndex(h => re.test(h));
    const idxDate = findIdx(/data|date|dt\b/);
    const idxDesc = findIdx(/descri|hist|lan[cç]|memo|t[ií]tulo|title|estabelec|nome|detalhe|origem|destino|contrapart/);
    const idxTipo = findIdx(/tipo|categoria|opera[cç]/);
    const idxVal = findIdx(/valor|amount|montante|value|d[eé]bito|cr[eé]dito/);
    const hasHeader = idxVal !== -1 || (idxDate !== -1 && (idxDesc !== -1 || idxTipo !== -1));
    const items = [];
    for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
        const cells = splitCSVLine(lines[i], delim);
        if (cells.length < 2) continue;
        let amt = null, amtIdx = -1;
        if (idxVal >= 0 && cells[idxVal] != null && isMoney(cells[idxVal])) { amt = smartNum(cells[idxVal]); amtIdx = idxVal; }
        if (amt == null) { for (let j = cells.length - 1; j >= 0; j--) { if (!isDateCell(cells[j]) && isMoney(cells[j])) { amt = smartNum(cells[j]); amtIdx = j; break; } } }
        if (amt == null || amt === 0) continue;
        const dCell = (idxDate >= 0 && isDateCell(cells[idxDate])) ? cells[idxDate] : cells.find(isDateCell);
        const iso = dCell ? parseDate(dCell) : null;
        let desc = (idxDesc >= 0 && cells[idxDesc]) ? cells[idxDesc] : ((idxTipo >= 0 && cells[idxTipo]) ? cells[idxTipo] : null);
        if (!desc) desc = cells.filter((c, j) => j !== amtIdx && c !== dCell && !isMoney(c) && !isDateCell(c) && !/^\d{1,2}:\d{2}/.test(c)).sort((a, b) => b.length - a.length)[0];
        items.push({ description: desc || 'Lançamento', amount: amt, date: iso });
    }
    return items;
}
