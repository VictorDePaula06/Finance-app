import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { auth, db } from '../services/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import aliviaAvatar from '../assets/alivia/alivia-final.png';
import { Check, Loader2, Send, Sparkles, Briefcase, CreditCard, PiggyBank, Landmark, FileText } from 'lucide-react';

// Formulários REAIS reaproveitados (mesmos campos do cadastro manual).
import { RecorrenteForm } from '../pages/Recorrentes';
import { CardForm, BuyForm } from '../pages/Cartoes';
import { ReservaForm } from '../pages/Reservas';
import { AtivoForm } from '../pages/Patrimonio';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };

export default function OnboardingAlivia({ onDone }) {
    const { currentUser, saveUserPreferences, userPrefs } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const endRef = useRef(null);

    const [msgs, setMsgs] = useState([]);
    const [typing, setTyping] = useState(false);
    const [phase, setPhase] = useState('intro');
    const [activeForm, setActiveForm] = useState(null); // 'renda'|'despesa'|'cartao'|'parcelamento'|'assinatura'|'reserva'|'ativo'
    const [saving, setSaving] = useState(false);
    const [cards, setCards] = useState([]);
    const [cardId, setCardId] = useState('');
    const data = useRef({ nome: '', idade: '' }).current;

    // Cartões do usuário (para vincular parcelamentos/assinaturas ao cartão criado).
    useEffect(() => {
        if (!uid) return;
        return onSnapshot(query(collection(db, 'cards'), where('userId', '==', uid)),
            s => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
    }, [uid]);
    const createdCard = cards.find(c => c.id === cardId) || cards[0] || null;

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing, phase, activeForm]);

    // Boas-vindas
    useEffect(() => {
        setTyping(true);
        const t = setTimeout(() => {
            setTyping(false);
            setMsgs([
                { role: 'alivia', text: 'Oi! Eu sou a **Alívia**, sua consultora aqui dentro. 💚 Que bom ter você por aqui!' },
                { role: 'alivia', text: 'Vou deixar sua conta pronta com você. A cada etapa eu **preparo o formulário** e você só preenche — assim nada fica faltando. Começamos?' },
            ]);
            setPhase('nome');
        }, 1200);
        return () => clearTimeout(t);
    }, []);

    const pushUser = (text) => setMsgs(m => [...m, { role: 'user', text }]);
    const advance = (userText, aliviaLines, nextPhase, delay = 900) => {
        if (userText) pushUser(userText);
        setPhase('__wait'); setTyping(true);
        setTimeout(() => {
            setTyping(false);
            const lines = Array.isArray(aliviaLines) ? aliviaLines : (aliviaLines ? [aliviaLines] : []);
            if (lines.length) setMsgs(m => [...m, ...lines.map(text => ({ role: 'alivia', text }))]);
            setPhase(nextPhase);
        }, delay);
    };

    // ── Etapas de texto (perfil) ──
    const onNome = (v) => { data.nome = normalizeName(v); advance(v, `Prazer, ${data.nome}! Quantos anos você tem?`, 'idade'); };
    const onIdade = (v) => { data.idade = parseInt(v) || ''; advance(`${v} anos`, 'Perfeito. Você está **empregado(a)** atualmente?', 'empregado'); };

    // ── Renda ──
    const onEmpregado = (sim) => {
        if (sim) advance('Sim, estou empregado(a)', 'Ótimo! **Preparei o cadastro da sua renda** — é só preencher 👇', 'rendaIntro');
        else advance('No momento não', 'Sem problema. Você tem alguma **renda recorrente** (aluguel, pensão, bico fixo…)?', 'temRenda');
    };
    const onTemRenda = (sim) => {
        if (sim) advance('Tenho sim', '**Preparei o cadastro da renda** pra você 👇', 'rendaIntro');
        else advance('Não tenho', 'Tranquilo, seguimos. Agora as **despesas que se repetem todo mês** (aluguel, luz, internet…).', 'despesasIntro');
    };

    // ── Encerramento de cada formulário ──
    const closeForm = (next) => { setActiveForm(null); next(); };

    // ── UI helpers ──
    const cellText = isDark ? 'text-slate-200' : 'text-slate-700';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className={`relative w-full max-w-lg h-full sm:h-[92vh] sm:max-h-[720px] flex flex-col sm:rounded-3xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#0e0f12] border-white/10' : 'bg-white border-slate-100'}`}>
                {/* Cabeçalho */}
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                    <img src={aliviaAvatar} alt="Alívia" className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" />
                    <div className="min-w-0 flex-1">
                        <p className={`font-black flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Bem-vindo(a) à Alívia <Sparkles className="w-4 h-4 text-emerald-500" /></p>
                        <p className="text-[12px] text-emerald-500 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Vamos configurar sua conta</p>
                    </div>
                    {phase !== 'done' && <button onClick={pular} className={`text-[12px] font-bold px-2.5 py-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>Pular</button>}
                </div>

                {/* Chat */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {msgs.map((m, i) => <Bubble key={i} isDark={isDark} role={m.role} text={m.text} />)}
                    {typing && <TypingBubble isDark={isDark} />}

                    {!typing && (
                        <div className="pt-1">
                            {phase === 'nome' && <TextPrompt isDark={isDark} placeholder="Seu nome" onSubmit={onNome} />}
                            {phase === 'idade' && <NumberPrompt isDark={isDark} placeholder="Sua idade" suffix="anos" onSubmit={onIdade} />}
                            {phase === 'empregado' && <ChoiceRow isDark={isDark} options={[{ label: 'Sim, estou', icon: Briefcase, value: true }, { label: 'No momento não', value: false }]} onPick={onEmpregado} />}
                            {phase === 'temRenda' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', value: true }, { label: 'Não tenho', value: false }]} onPick={onTemRenda} />}

                            {phase === 'rendaIntro' && <OpenFormBtn isDark={isDark} label="Preencher renda" icon={FileText} onClick={() => setActiveForm('renda')} />}

                            {phase === 'despesasIntro' && <OpenFormBtn isDark={isDark} label="Cadastrar despesa fixa" icon={FileText}
                                onClick={() => setActiveForm('despesa')} secondary={{ label: 'Não tenho despesas fixas', onClick: () => advance('Sem despesas fixas', 'Agora uma importante: **quanto você tem hoje na sua conta** (saldo disponível)? Isso evita que seu saldo fique negativo depois.', 'saldo') }} />}
                            {phase === 'despesaMore' && <ChoiceRow isDark={isDark} options={[{ label: 'Adicionar outra', value: true }, { label: 'Concluir despesas', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('despesa') : advance('Concluí as despesas', 'Agora uma importante: **quanto você tem hoje na sua conta** (saldo disponível)? Isso evita que seu saldo fique negativo depois.', 'saldo')} />}

                            {phase === 'saldo' && <MoneyPrompt isDark={isDark} onSubmit={onSaldo} />}

                            {phase === 'usaCartao' && <ChoiceRow isDark={isDark} options={[{ label: 'Uso sim', icon: CreditCard, value: true }, { label: 'Não uso', value: false }]} onPick={onUsaCartao} />}
                            {phase === 'cartaoIntro' && <OpenFormBtn isDark={isDark} label="Cadastrar cartão" icon={FileText} onClick={() => setActiveForm('cartao')} />}

                            {phase === 'parcelasIntro' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho parcelas', value: true }, { label: 'Não tenho', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('parcelamento') : advance('Sem parcelamentos', 'E **assinaturas** nesse cartão (Netflix, Spotify, academia…)?', 'assinaturasIntro')} />}
                            {phase === 'parcelaMore' && <ChoiceRow isDark={isDark} options={[{ label: 'Adicionar outro', value: true }, { label: 'Concluir', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('parcelamento') : advance('Parcelamentos ok', 'E **assinaturas** nesse cartão (Netflix, Spotify, academia…)?', 'assinaturasIntro')} />}

                            {phase === 'assinaturasIntro' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho assinaturas', value: true }, { label: 'Não tenho', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('assinatura') : advance('Sem assinaturas', 'Agora as **reservas**. Você já tem uma **reserva de emergência** guardada?', 'reserva')} />}
                            {phase === 'assinaturaMore' && <ChoiceRow isDark={isDark} options={[{ label: 'Adicionar outra', value: true }, { label: 'Concluir', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('assinatura') : advance('Assinaturas ok', 'Agora as **reservas**. Você já tem uma **reserva de emergência** guardada?', 'reserva')} />}

                            {phase === 'reserva' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', icon: PiggyBank, value: true }, { label: 'Ainda não', value: false }]}
                                onPick={(sim) => sim ? advance('Tenho reserva', 'Ótimo! **Preparei o cadastro da reserva** — informe o valor que já tem guardado (registro como já existente, sem descontar da conta) 👇', 'reservaIntro')
                                    : advance('Ainda não', 'Sem problema. Por último, o **patrimônio**: você tem **investimentos** (Tesouro, CDB, ações, cripto…)?', 'patrimonio')} />}
                            {phase === 'reservaIntro' && <OpenFormBtn isDark={isDark} label="Cadastrar reserva" icon={FileText} onClick={() => setActiveForm('reserva')} />}

                            {phase === 'patrimonio' && <ChoiceRow isDark={isDark} options={[{ label: 'Tenho sim', icon: Landmark, value: true }, { label: 'Ainda não', value: false }]}
                                onPick={(sim) => sim ? advance('Tenho investimentos', 'Show! **Preparei o cadastro do investimento** — preencha os dados do que você já tem 👇', 'ativoIntro') : finalizar()} />}
                            {phase === 'ativoIntro' && <OpenFormBtn isDark={isDark} label="Cadastrar investimento" icon={FileText} onClick={() => setActiveForm('ativo')} />}
                            {phase === 'ativoMore' && <ChoiceRow isDark={isDark} options={[{ label: 'Adicionar outro', value: true }, { label: 'Concluir', value: false }]}
                                onPick={(sim) => sim ? setActiveForm('ativo') : finalizar()} />}

                            {phase === 'done' && <button onClick={() => onDone?.()} disabled={saving}
                                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-emerald-500/30 disabled:opacity-60">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Ir para o app</>}
                            </button>}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
            </div>

            {/* Formulários REAIS (abrem por cima do chat) */}
            {activeForm === 'renda' && <RecorrenteForm isDark={isDark} uid={uid} kind="income"
                onClose={() => closeForm(() => advance('Renda cadastrada ✅', 'Anotado! Agora as **despesas que se repetem todo mês** (aluguel, luz, internet…).', 'despesasIntro'))} />}
            {activeForm === 'despesa' && <RecorrenteForm isDark={isDark} uid={uid} kind="expense"
                onClose={() => closeForm(() => advance('Despesa cadastrada ✅', 'Quer adicionar outra despesa fixa?', 'despesaMore'))} />}
            {activeForm === 'cartao' && <CardForm isDark={isDark} uid={uid} onSaved={(id) => setCardId(id)}
                onClose={() => closeForm(() => advance('Cartão cadastrado ✅', 'Cartão salvo! Você tem **parcelamentos** em aberto nesse cartão?', 'parcelasIntro'))} />}
            {activeForm === 'parcelamento' && createdCard && <BuyForm isDark={isDark} uid={uid} card={createdCard} initialTipo="parcelamento" lockTipo
                onClose={() => closeForm(() => advance('Parcelamento cadastrado ✅', 'Quer adicionar outro parcelamento?', 'parcelaMore'))} />}
            {activeForm === 'assinatura' && createdCard && <BuyForm isDark={isDark} uid={uid} card={createdCard} initialTipo="assinatura" lockTipo
                onClose={() => closeForm(() => advance('Assinatura cadastrada ✅', 'Quer adicionar outra assinatura?', 'assinaturaMore'))} />}
            {activeForm === 'reserva' && <ReservaForm isDark={isDark} uid={uid} cdi={null} skipLedger
                onClose={() => closeForm(() => advance('Reserva cadastrada ✅', 'Perfeito, registrei sua reserva. Por último, o **patrimônio**: você tem **investimentos** (Tesouro, CDB, ações, cripto…)?', 'patrimonio'))} />}
            {activeForm === 'ativo' && <AtivoForm isDark={isDark} uid={uid}
                onClose={() => closeForm(() => advance('Investimento cadastrado ✅', 'Quer adicionar outro investimento?', 'ativoMore'))} />}
        </div>
    );

    // ── Handlers que dependem de estado abaixo (hoisted por function declaration) ──
    function onSaldo(v) {
        const saldo = numBR(v);
        if (saldo > 0) {
            const iso = new Date().toISOString();
            addDoc(collection(db, 'transactions'), {
                description: 'Saldo inicial', amount: saldo, type: 'income', category: 'initial_balance',
                date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(),
            }).catch(e => console.error('[saldo]', e));
        }
        advance(`R$ ${money(saldo)}`, 'Show. Você usa **cartão de crédito**?', 'usaCartao');
    }
    function onUsaCartao(sim) {
        if (sim) advance('Uso sim', '**Preparei o cadastro do cartão** — preencha os dados 👇', 'cartaoIntro');
        else advance('Não uso', 'Beleza! Vamos para as **reservas**. Você já tem uma **reserva de emergência** guardada?', 'reserva');
    }
    async function finalizar() {
        setPhase('__wait'); setTyping(true); setSaving(true);
        try {
            if (data.nome) { try { await updateProfile(auth.currentUser, { displayName: data.nome }); } catch { } }
            await saveUserPreferences({ onboardingDone: true, hasSeenWelcome: true, idade: data.idade });
        } catch (e) { console.error('[onboarding finish]', e); }
        setTyping(false);
        setMsgs(m => [...m, { role: 'alivia', text: `Tudo pronto, ${data.nome || 'tudo certo'}! 🎉 Sua conta já está organizada com o que você me contou. Sempre que precisar, é só me chamar na **Consultoria**.` }]);
        setPhase('done'); setSaving(false);
    }
    async function pular() {
        try { await saveUserPreferences({ onboardingDone: true, hasSeenWelcome: true }); } catch { }
        onDone?.();
    }
}

// ── Bolhas e widgets ────────────────────────────────────────────────
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

const inputBase = (isDark) => `px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
function SendBtn({ onClick, disabled }) {
    return <button onClick={onClick} disabled={disabled} className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition disabled:opacity-40"><Send className="w-4 h-4" /></button>;
}
function TextPrompt({ isDark, placeholder, onSubmit }) {
    const [v, setV] = useState('');
    const go = () => { if (v.trim()) onSubmit(v.trim()); };
    return <div className="flex gap-2"><input autoFocus value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder={placeholder} className={`flex-1 ${inputBase(isDark)}`} maxLength={40} /><SendBtn onClick={go} disabled={!v.trim()} /></div>;
}
function NumberPrompt({ isDark, placeholder, suffix, onSubmit }) {
    const [v, setV] = useState('');
    const go = () => { if (v) onSubmit(v); };
    return <div className="flex gap-2"><div className="relative flex-1"><input autoFocus inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 3))} onKeyDown={e => e.key === 'Enter' && go()} placeholder={placeholder} className={`w-full ${inputBase(isDark)}`} />{suffix && v && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{suffix}</span>}</div><SendBtn onClick={go} disabled={!v} /></div>;
}
function MoneyPrompt({ isDark, onSubmit }) {
    const [v, setV] = useState('');
    return <div className="flex gap-2"><div className="relative flex-1"><span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span><input autoFocus inputMode="decimal" value={v} onChange={e => setV(e.target.value.replace(/[^0-9.,]/g, ''))} onKeyDown={e => e.key === 'Enter' && onSubmit(v || '0')} placeholder="0,00" className={`w-full pl-9 ${inputBase(isDark)}`} /></div><SendBtn onClick={() => onSubmit(v || '0')} disabled={!v} /></div>;
}
function ChoiceRow({ isDark, options, onPick }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {options.map((o, i) => {
                const Icon = o.icon;
                return <button key={i} onClick={() => onPick(o.value)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-bold transition active:scale-95 ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}>{Icon && <Icon className="w-4 h-4 text-emerald-500" />} {o.label}</button>;
            })}
        </div>
    );
}
function OpenFormBtn({ isDark, label, icon: Icon, onClick, secondary }) {
    return (
        <div className="flex gap-2 flex-wrap">
            <button onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[13px] font-black transition active:scale-95 shadow-md shadow-emerald-500/30">
                {Icon && <Icon className="w-4 h-4" />} {label}
            </button>
            {secondary && <button onClick={secondary.onClick} className={`px-4 py-2.5 rounded-xl border text-[13px] font-bold transition ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{secondary.label}</button>}
        </div>
    );
}
