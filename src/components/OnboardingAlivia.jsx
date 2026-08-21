import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth, db } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, doc, writeBatch } from 'firebase/firestore';
import aliviaAvatar from '../assets/alivia/alivia-final.png';
import {
    Check, Loader2, Send, TrendingUp, TrendingDown, CreditCard, PiggyBank,
    Landmark, Plus, X, Sparkles, Briefcase, Wallet,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };
const clampDay = (d) => Math.min(31, Math.max(1, parseInt(d) || 1));

// ── Componente principal ────────────────────────────────────────────
export default function OnboardingAlivia({ onDone }) {
    const { currentUser, saveUserPreferences, userPrefs } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const endRef = useRef(null);

    const [msgs, setMsgs] = useState([]);
    const [typing, setTyping] = useState(false);
    const [phase, setPhase] = useState('intro');
    const [saving, setSaving] = useState(false);
    const data = useRef({
        nome: '', idade: '', empregado: null, renda: null,
        despesas: [], saldo: 0, cartao: null, parcelas: [], assinaturas: [],
        reserva: 0, patrimonio: 0,
    }).current;

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing, phase]);

    // Mensagem inicial (com "digitando").
    useEffect(() => {
        setTyping(true);
        const t = setTimeout(() => {
            setTyping(false);
            setMsgs([{ role: 'alivia', text: 'Oi! Eu sou a **Alívia**, sua consultora aqui dentro. 💚 Que bom ter você por aqui!' },
            { role: 'alivia', text: 'Vou te fazer algumas perguntas rápidas pra deixar tudo pronto do seu jeito — assim seus números já começam certos. Leva só uns minutinhos.' }]);
            setPhase('nome');
        }, 1200);
        return () => clearTimeout(t);
    }, []);

    const pushUser = (text) => setMsgs(m => [...m, { role: 'user', text }]);

    // Avança: mostra a resposta do usuário, a Alívia "digita" e responde, e vai pra próxima fase.
    const advance = (userText, aliviaLines, nextPhase, delay = 950) => {
        if (userText) pushUser(userText);
        setPhase('__wait');
        setTyping(true);
        setTimeout(() => {
            setTyping(false);
            const lines = Array.isArray(aliviaLines) ? aliviaLines : [aliviaLines];
            setMsgs(m => [...m, ...lines.map(text => ({ role: 'alivia', text }))]);
            setPhase(nextPhase);
        }, delay);
    };

    // ── Handlers por etapa ──
    const onNome = (v) => { data.nome = normalizeName(v); advance(v, `Prazer, ${data.nome}! Quantos anos você tem?`, 'idade'); };
    const onIdade = (v) => { data.idade = parseInt(v) || ''; advance(`${v} anos`, 'Perfeito. Você está **empregado(a)** atualmente?', 'empregado'); };

    const onEmpregado = (sim) => {
        data.empregado = sim;
        if (sim) advance('Sim, estou empregado(a)', 'Ótimo! Qual o valor do seu **salário** e o dia que costuma cair?', 'renda');
        else advance('No momento não', 'Sem problema. Você tem alguma **renda recorrente** (aluguel, pensão, bico fixo…)?', 'temRenda');
    };
    const onTemRenda = (sim) => {
        if (sim) advance('Tenho sim', 'Legal! Qual o valor e em que dia costuma entrar?', 'renda');
        else advance('Não tenho', 'Tranquilo, seguimos. Agora as **despesas que se repetem todo mês** (aluguel, luz, internet…). Vamos adicionar?', 'despesas');
    };
    const onRenda = ({ valor, dia }) => {
        data.renda = { value: numBR(valor), day: clampDay(dia) };
        advance(`R$ ${money(numBR(valor))} · dia ${clampDay(dia)}`,
            'Anotado! Agora as **despesas que se repetem todo mês** (aluguel, luz, internet, mensalidades…). Adicione as que tiver:', 'despesas');
    };
    const onDespesas = (list) => {
        data.despesas = list;
        const resumo = list.length ? `${list.length} despesa${list.length > 1 ? 's' : ''} recorrente${list.length > 1 ? 's' : ''}` : 'Nenhuma por enquanto';
        advance(resumo, 'Agora uma importante: **quanto você tem hoje na sua conta** (saldo disponível)? Isso evita que seu saldo fique negativo depois.', 'saldo');
    };
    const onSaldo = (v) => {
        data.saldo = numBR(v);
        advance(`R$ ${money(numBR(v))}`, 'Show. Você usa **cartão de crédito**?', 'usaCartao');
    };
    const onUsaCartao = (sim) => {
        if (sim) advance('Uso sim', 'Vamos cadastrar seu cartão então. Preencha os dados:', 'cartao');
        else advance('Não uso', 'Beleza! Vamos para as **reservas**. Você já tem uma **reserva de emergência** guardada?', 'reserva');
    };
    const onCartao = (card) => {
        data.cartao = card;
        advance(`${card.name} · limite R$ ${money(card.limit)}`,
            'Cartão salvo! Tem **parcelamentos** em aberto nesse cartão (compras em X vezes)?', 'parcelas');
    };
    const onParcelas = (list) => {
        data.parcelas = list;
        advance(list.length ? `${list.length} parcelamento(s)` : 'Nenhum parcelamento',
            'E **assinaturas** no cartão (Netflix, Spotify, academia…)?', 'assinaturas');
    };
    const onAssinaturas = (list) => {
        data.assinaturas = list;
        advance(list.length ? `${list.length} assinatura(s)` : 'Nenhuma assinatura',
            'Agora as **reservas**. Você já tem uma **reserva de emergência** guardada?', 'reserva');
    };
    const onReserva = (sim) => {
        if (sim) advance('Tenho sim', 'Quanto você já tem guardado na reserva? (vou registrar como já existente, sem descontar da conta)', 'reservaValor');
        else advance('Ainda não', 'Sem problema — dá pra começar quando quiser. Por último, o **patrimônio**: você tem **investimentos** (Tesouro, CDB, ações, cripto…)?', 'patrimonio');
    };
    const onReservaValor = (v) => {
        data.reserva = numBR(v);
        advance(`R$ ${money(numBR(v))} na reserva`, 'Perfeito, registrei sua reserva. Por último, o **patrimônio**: você tem **investimentos** (Tesouro, CDB, ações, cripto…)?', 'patrimonio');
    };
    const onPatrimonio = (sim) => {
        if (sim) advance('Tenho sim', 'Qual o valor total que você tem investido hoje? (registro como já existente também)', 'patrimonioValor');
        else finalizar();
    };
    const onPatrimonioValor = (v) => {
        data.patrimonio = numBR(v);
        advance(`R$ ${money(numBR(v))} investidos`, null, 'finish');
        setTimeout(finalizar, 700);
    };

    // ── Gravação final ──
    const finalizar = async () => {
        setPhase('__wait'); setTyping(true); setSaving(true);
        try {
            const batch = writeBatch(db);
            const now = Date.now();
            const iso = new Date().toISOString();
            const mk = iso.slice(0, 7);
            const add = (coll, obj) => batch.set(doc(collection(db, coll)), { ...obj, userId: uid, createdAt: now });

            // Renda recorrente
            if (data.renda && data.renda.value > 0) {
                add('fixed_incomes', { name: data.empregado ? 'Salário' : 'Renda', value: data.renda.value, category: 'salary', day: data.renda.day, isVariable: false });
            }
            // Despesas recorrentes
            data.despesas.forEach(d => add('fixed_expenses', {
                name: normalizeName(d.name), value: numBR(d.value), category: 'conta_fixa',
                day: clampDay(d.day), isVariable: false, priority: 'essential', paymentMethod: 'pix', cardId: '',
            }));
            // Saldo inicial (define o saldo em conta, sem virar negativo)
            if (data.saldo > 0) {
                add('transactions', { description: 'Saldo inicial', amount: data.saldo, type: 'income', category: 'initial_balance', date: iso, month: mk });
            }
            // Cartão + parcelamentos + assinaturas
            let cardRef = null;
            if (data.cartao) {
                cardRef = doc(collection(db, 'cards'));
                batch.set(cardRef, {
                    name: normalizeName(data.cartao.name), bank: '', brand: 'Visa', last4: '',
                    limit: data.cartao.limit || null, closingDay: clampDay(data.cartao.closingDay),
                    dueDay: clampDay(data.cartao.dueDay), color: 'from-purple-600 to-indigo-700',
                    userId: uid, createdAt: now,
                });
                const cardId = cardRef.id;
                const dueDay = clampDay(data.cartao.dueDay);
                data.parcelas.forEach(p => add('subscriptions', {
                    name: normalizeName(p.name), value: numBR(p.valor), day: dueDay, cardId,
                    category: 'shopping', priority: 'comfort', isInstallment: true, type: 'installment',
                    totalInstallments: parseInt(p.parcelas) || 1, currentInstallment: 1, installmentMode: 'per',
                }));
                data.assinaturas.forEach(s => add('subscriptions', {
                    name: normalizeName(s.name), value: numBR(s.valor), day: dueDay, cardId,
                    category: 'subscriptions', priority: 'comfort', type: 'recurring',
                }));
            }
            // Reserva de emergência JÁ EXISTENTE (sem debitar a conta)
            if (data.reserva > 0) {
                add('savings_jars', { name: 'Reserva de emergência', target: null, cdiPercent: 100, balance: data.reserva, invested: data.reserva, lastYieldAt: now, type: 'reserva' });
            }
            // Patrimônio / investimentos JÁ EXISTENTE
            if (data.patrimonio > 0) {
                add('investments', { name: 'Investimentos', type: 'renda_fixa', symbol: '', quantity: 1, purchasePrice: data.patrimonio, manualCurrentPrice: data.patrimonio, totalApplied: data.patrimonio });
            }

            await batch.commit();

            // Nome no perfil + preferências
            if (data.nome) { try { await updateProfile(auth.currentUser, { displayName: data.nome }); } catch { } }
            const mc = { ...(userPrefs?.manualConfig || {}) };
            if (data.renda?.value) mc.income = data.renda.value;
            if (data.patrimonio > 0) mc.invested = data.patrimonio;
            await saveUserPreferences({
                onboardingDone: true, hasSeenWelcome: true, idade: data.idade,
                manualConfig: mc,
            });

            setTyping(false);
            setMsgs(m => [...m, { role: 'alivia', text: `Tudo pronto, ${data.nome || 'tudo certo'}! 🎉 Deixei sua conta organizada com o que você me contou. Agora é só usar — e sempre que precisar, é só me chamar na **Consultoria**.` }]);
            setPhase('done');
        } catch (e) {
            console.error('[onboarding]', e);
            setTyping(false);
            setMsgs(m => [...m, { role: 'alivia', text: 'Ops, tive um problema ao salvar. Você pode pular por agora e cadastrar depois nas abas. 🙏' }]);
            setPhase('done');
        }
        setSaving(false);
    };

    const pular = async () => {
        try { await saveUserPreferences({ onboardingDone: true, hasSeenWelcome: true }); } catch { }
        onDone?.();
    };

    // ── UI ──
    const cell = isDark ? 'text-slate-200' : 'text-slate-700';
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className={`relative w-full max-w-lg h-full sm:h-[92vh] sm:max-h-[720px] flex flex-col sm:rounded-3xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#0e0f12] border-white/10' : 'bg-white border-slate-100'}`}>
                {/* Cabeçalho */}
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                    <img src={aliviaAvatar} alt="Alívia" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" />
                    <div className="min-w-0 flex-1">
                        <p className={`font-black flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Bem-vindo(a) à Alívia <Sparkles className="w-4 h-4 text-emerald-500" />
                        </p>
                        <p className="text-[12px] text-emerald-500 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Vamos configurar sua conta</p>
                    </div>
                    {phase !== 'done' && (
                        <button onClick={pular} className={`text-[12px] font-bold px-2.5 py-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>Pular</button>
                    )}
                </div>

                {/* Chat */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {msgs.map((m, i) => <Bubble key={i} isDark={isDark} role={m.role} text={m.text} />)}
                    {typing && <TypingBubble isDark={isDark} />}

                    {/* Widget da etapa atual */}
                    {!typing && (
                        <div className="pt-1">
                            {phase === 'nome' && <TextPrompt isDark={isDark} placeholder="Seu nome" onSubmit={onNome} />}
                            {phase === 'idade' && <NumberPrompt isDark={isDark} placeholder="Sua idade" suffix="anos" onSubmit={onIdade} />}
                            {phase === 'empregado' && <ChoiceRow isDark={isDark} options={[{ label: 'Sim, estou', icon: Briefcase, value: true }, { label: 'No momento não', value: false }]} onPick={onEmpregado} />}
                            {phase === 'temRenda' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', value: true }, { label: 'Não tenho', value: false }]} onPick={onTemRenda} />}
                            {phase === 'renda' && <ValueDayPrompt isDark={isDark} onSubmit={onRenda} />}
                            {phase === 'despesas' && <ListPrompt isDark={isDark} tone="rose" addLabel="Adicionar despesa"
                                fields={[{ key: 'name', placeholder: 'Ex.: Aluguel', flex: 2 }, { key: 'value', placeholder: 'Valor', money: true }, { key: 'day', placeholder: 'Dia', num: true, w: 'w-16' }]}
                                emptyDone="Não tenho despesas fixas" onDone={onDespesas} />}
                            {phase === 'saldo' && <MoneyPrompt isDark={isDark} onSubmit={onSaldo} />}
                            {phase === 'usaCartao' && <ChoiceRow isDark={isDark} options={[{ label: 'Uso sim', icon: CreditCard, value: true }, { label: 'Não uso', value: false }]} onPick={onUsaCartao} />}
                            {phase === 'cartao' && <CardPrompt isDark={isDark} onSubmit={onCartao} />}
                            {phase === 'parcelas' && <ListPrompt isDark={isDark} tone="blue" addLabel="Adicionar parcelamento"
                                fields={[{ key: 'name', placeholder: 'Ex.: Notebook', flex: 2 }, { key: 'valor', placeholder: 'Parcela', money: true }, { key: 'parcelas', placeholder: 'Nº', num: true, w: 'w-16' }]}
                                emptyDone="Não tenho parcelamentos" onDone={onParcelas} />}
                            {phase === 'assinaturas' && <ListPrompt isDark={isDark} tone="purple" addLabel="Adicionar assinatura"
                                fields={[{ key: 'name', placeholder: 'Ex.: Netflix', flex: 2 }, { key: 'valor', placeholder: 'Valor/mês', money: true }]}
                                emptyDone="Não tenho assinaturas" onDone={onAssinaturas} />}
                            {phase === 'reserva' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', icon: PiggyBank, value: true }, { label: 'Ainda não', value: false }]} onPick={onReserva} />}
                            {phase === 'reservaValor' && <MoneyPrompt isDark={isDark} onSubmit={onReservaValor} />}
                            {phase === 'patrimonio' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', icon: Landmark, value: true }, { label: 'Ainda não', value: false }]} onPick={onPatrimonio} />}
                            {phase === 'patrimonioValor' && <MoneyPrompt isDark={isDark} onSubmit={onPatrimonioValor} />}
                            {phase === 'done' && (
                                <button onClick={() => onDone?.()} disabled={saving}
                                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-emerald-500/30 disabled:opacity-60">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Ir para o app</>}
                                </button>
                            )}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
            </div>
        </div>
    );
}

// ── Bolhas ──────────────────────────────────────────────────────────
function Bubble({ isDark, role, text }) {
    const me = role === 'user';
    const html = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    return (
        <div className={`flex gap-2.5 max-w-[88%] ${me ? 'ml-auto flex-row-reverse' : ''}`}>
            {!me && <img src={aliviaAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />}
            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${me ? 'bg-emerald-500 text-white rounded-tr-md' : (isDark ? 'bg-white/[0.05] text-slate-200 rounded-tl-md' : 'bg-slate-100 text-slate-700 rounded-tl-md')}`}
                dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}
function TypingBubble({ isDark }) {
    return (
        <div className="flex gap-2.5">
            <img src={aliviaAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
            <div className={`px-3.5 py-3 rounded-2xl rounded-tl-md flex items-center ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
                <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
            </div>
        </div>
    );
}

// ── Widgets de entrada ──────────────────────────────────────────────
const inputBase = (isDark) => `px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

function SendBtn({ onClick, disabled }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition disabled:opacity-40">
            <Send className="w-4 h-4" />
        </button>
    );
}

function TextPrompt({ isDark, placeholder, onSubmit }) {
    const [v, setV] = useState('');
    const go = () => { if (v.trim()) onSubmit(v.trim()); };
    return (
        <div className="flex gap-2">
            <input autoFocus value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder={placeholder} className={`flex-1 ${inputBase(isDark)}`} maxLength={40} />
            <SendBtn onClick={go} disabled={!v.trim()} />
        </div>
    );
}

function NumberPrompt({ isDark, placeholder, suffix, onSubmit }) {
    const [v, setV] = useState('');
    const go = () => { if (v) onSubmit(v); };
    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <input autoFocus inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 3))} onKeyDown={e => e.key === 'Enter' && go()} placeholder={placeholder} className={`w-full ${inputBase(isDark)}`} />
                {suffix && v && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{suffix}</span>}
            </div>
            <SendBtn onClick={go} disabled={!v} />
        </div>
    );
}

function MoneyPrompt({ isDark, onSubmit }) {
    const [v, setV] = useState('');
    const go = () => onSubmit(v || '0');
    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                <input autoFocus inputMode="decimal" value={v} onChange={e => setV(e.target.value.replace(/[^0-9.,]/g, ''))} onKeyDown={e => e.key === 'Enter' && go()} placeholder="0,00" className={`w-full pl-9 ${inputBase(isDark)}`} />
            </div>
            <SendBtn onClick={go} disabled={!v} />
        </div>
    );
}

function ValueDayPrompt({ isDark, onSubmit }) {
    const [valor, setValor] = useState('');
    const [dia, setDia] = useState('');
    const go = () => { if (numBR(valor) > 0) onSubmit({ valor, dia: dia || '5' }); };
    return (
        <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[120px]">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                <input autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Valor" className={`w-full pl-9 ${inputBase(isDark)}`} />
            </div>
            <input inputMode="numeric" value={dia} onChange={e => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Dia" className={`w-20 ${inputBase(isDark)}`} />
            <SendBtn onClick={go} disabled={numBR(valor) <= 0} />
        </div>
    );
}

function CardPrompt({ isDark, onSubmit }) {
    const [name, setName] = useState('');
    const [limit, setLimit] = useState('');
    const [closingDay, setClosingDay] = useState('');
    const [dueDay, setDueDay] = useState('');
    const ok = name.trim();
    const go = () => { if (ok) onSubmit({ name, limit: numBR(limit) || null, closingDay: closingDay || 1, dueDay: dueDay || 10 }); };
    return (
        <div className={`rounded-2xl border p-3 space-y-2 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cartão (ex.: Nubank)" className={`w-full ${inputBase(isDark)}`} maxLength={30} />
            <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                <input inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Limite" className={`w-full pl-9 ${inputBase(isDark)}`} />
            </div>
            <div className="flex gap-2">
                <input inputMode="numeric" value={closingDay} onChange={e => setClosingDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Dia fecham." className={`flex-1 ${inputBase(isDark)}`} />
                <input inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Dia venc." className={`flex-1 ${inputBase(isDark)}`} />
            </div>
            <button onClick={go} disabled={!ok} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                <Check className="w-4 h-4" /> Salvar cartão
            </button>
        </div>
    );
}

// Lista com "adicionar vários" + concluir.
function ListPrompt({ isDark, fields, addLabel, emptyDone, onDone, tone = 'emerald' }) {
    const [items, setItems] = useState([]);
    const [draft, setDraft] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])));
    const toneColor = { emerald: 'text-emerald-500', rose: 'text-rose-500', blue: 'text-blue-400', purple: 'text-purple-400' }[tone];
    const primaryOk = String(draft[fields[0].key] || '').trim() && numBR(draft[fields.find(f => f.money)?.key] ?? '1') >= 0;

    const setF = (k, v, f) => setDraft(d => ({ ...d, [k]: f.money ? v.replace(/[^0-9.,]/g, '') : f.num ? v.replace(/\D/g, '').slice(0, 2) : v }));
    const add = () => {
        if (!String(draft[fields[0].key] || '').trim()) return;
        setItems(x => [...x, draft]);
        setDraft(Object.fromEntries(fields.map(f => [f.key, ''])));
    };
    const rm = (i) => setItems(x => x.filter((_, idx) => idx !== i));

    return (
        <div className={`rounded-2xl border p-3 space-y-2.5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            {items.length > 0 && (
                <div className="space-y-1.5">
                    {items.map((it, i) => (
                        <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                            <span className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{normalizeName(it[fields[0].key])}</span>
                            <span className="flex items-center gap-2 shrink-0">
                                {fields.find(f => f.money) && <span className={`font-black tabular-nums ${toneColor}`}>R$ {money(numBR(it[fields.find(f => f.money).key]))}</span>}
                                <button onClick={() => rm(i)} className="text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                {fields.map(f => (
                    <div key={f.key} className={`relative ${f.flex ? 'flex-1' : f.w || 'w-24'}`}>
                        {f.money && <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>}
                        <input inputMode={f.money ? 'decimal' : f.num ? 'numeric' : 'text'} value={draft[f.key]}
                            onChange={e => setF(f.key, e.target.value, f)} onKeyDown={e => e.key === 'Enter' && add()}
                            placeholder={f.placeholder} className={`w-full ${f.money ? 'pl-8' : ''} ${inputBase(isDark)} !py-2`} />
                    </div>
                ))}
                <button onClick={add} disabled={!primaryOk} className="shrink-0 px-3 rounded-xl bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-bold text-sm flex items-center gap-1 transition disabled:opacity-40">
                    <Plus className="w-4 h-4" strokeWidth={2.6} />
                </button>
            </div>
            <div className="flex gap-2 pt-0.5">
                <button onClick={() => onDone([])} className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {items.length === 0 ? emptyDone : 'Concluir sem adicionar mais'}
                </button>
                {items.length > 0 && (
                    <button onClick={() => onDone(items)} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition">
                        <Check className="w-4 h-4" /> Pronto ({items.length})
                    </button>
                )}
            </div>
        </div>
    );
}

function ChoiceRow({ isDark, options, onPick }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {options.map((o, i) => {
                const Icon = o.icon;
                return (
                    <button key={i} onClick={() => onPick(o.value)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-bold transition active:scale-95 ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                        {Icon && <Icon className="w-4 h-4 text-emerald-500" />} {o.label}
                    </button>
                );
            })}
        </div>
    );
}
