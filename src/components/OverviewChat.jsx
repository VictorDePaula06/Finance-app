import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { sendMessageToGemini, isGeminiConfigured, calculateStatsContext } from '../services/gemini';
import { getExpenseBasis, isMonthlyExpenseTx, txMonthKey } from '../utils/financialLogic';
import { OBJECTIVE_LABELS_SHORT } from '../constants/onboarding';
import ReactMarkdown from 'react-markdown';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const SUGGESTIONS = ['Como estão meus gastos?', 'Quanto posso gastar hoje?', 'Registrar mercado R$ 120', 'Minha reserva está boa?'];
const fmtMoney = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Resumo automático da Visão Geral (mesmos números do card "Análise do mês").
function buildSummary({ transactions, manualConfig, walletStats, healthIndex, investmentStats, totalDebt, userPrefs }) {
  const cm = new Date().toISOString().slice(0, 7);
  const basis = getExpenseBasis(manualConfig);
  const exp = (transactions || []).filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === cm);
  const sum = (a) => a.reduce((x, t) => x + (parseFloat(t.amount) || 0), 0);
  const essential = sum(exp.filter(t => (t.priority || 'comfort') === 'essential'));
  const superf = sum(exp.filter(t => t.priority === 'superfluous'));
  const totalExp = sum(exp);
  const supPct = totalExp > 0 ? Math.round((superf / totalExp) * 100) : 0;
  const reserveMonths = healthIndex?.pillars?.reserve?.months || 0;
  const reserveAmount = investmentStats?.totalGuarded || 0;
  const sobrou = (walletStats?.income || 0) - (walletStats?.expense || 0);
  const hasDebt = (totalDebt || 0) > 0.005;
  const ob = userPrefs?.onboarding || {};
  const primaryObjective = (ob.objectives || []).find(o => o !== 'debt') || (ob.objectives || [])[0] || '';
  const objLabel = OBJECTIVE_LABELS_SHORT[primaryObjective] || '';
  const aporteAlvo = parseFloat(ob.monthlyContribution) || 0;

  // Resumo QUALITATIVO — sem citar valores em R$ (análise geral).
  const L = [];
  L.push('Oi! Dei uma olhada geral no seu mês 👀');
  if (hasDebt) L.push('⚠️ **Prioridade:** você tem dívidas em aberto — quitá-las vem antes de investir (veja em *Gerenciamento de Dívidas*).');
  L.push(supPct > 30
    ? 'Seus gastos **supérfluos** estão **acima do ideal** — dá pra enxugar um pouco.'
    : 'Seus gastos **supérfluos** estão **sob controle** (dentro do ideal). 👍');
  L.push(sobrou >= 0
    ? 'No geral, você está **no positivo** este mês.'
    : 'Atenção: neste mês você **gastou mais do que ganhou** — vale rever os supérfluos.');
  L.push(reserveAmount > 0
    ? (reserveMonths < 6
      ? 'Sua **reserva de emergência** ainda está **abaixo do ideal** — mire pelo menos 6 meses de cobertura.'
      : 'Sua **reserva de emergência** está em **ótimo nível**! 🎉')
    : 'Você ainda **não tem reserva de emergência** — vale começar a construir uma.');
  if (objLabel) L.push(`Seu objetivo principal é **${objLabel}**. Acompanhe suas **metas** em *Objetivos / Metas* que eu fico de olho no seu progresso.`);
  else L.push('Cadastre suas **metas** em *Objetivos / Metas* que eu acompanho seu progresso por aqui.');
  L.push('Pode me perguntar qualquer coisa ou **registrar um gasto** aqui mesmo. 😊');
  return L.join('\n\n');
}

// Chat da Alívia embutido na Visão Geral (Controle de Gastos). Sempre aberto;
// abre com um resumo automático (instantâneo) e a pessoa conversa normalmente —
// análises e lançamentos pelo mesmo Gemini do assistente.
export default function OverviewChat({ transactions = [], manualConfig = {}, onAddTransaction, theme = 'dark', planLevel, walletStats, healthIndex, investmentStats, totalDebt }) {
  const { currentUser, userPrefs } = useAuth();
  const isDark = theme !== 'light';

  const [messages, setMessages] = useState(() => [{ role: 'model', text: buildSummary({ transactions, manualConfig, walletStats, healthIndex, investmentStats, totalDebt, userPrefs }) }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Lançamento aguardando seleção (prioridade, cartão, …) via botões.
  const [pending, setPending] = useState(null); // { data, queue: [{ kind, field, label, options }] }

  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [cards, setCards] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expenseGoals, setExpenseGoals] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  const scrollRef = useRef(null);

  // Dados extras para enriquecer o contexto da IA (mesmas coleções do assistente).
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const mk = (col) => query(collection(db, col), where('userId', '==', uid));
    const subs = [
      onSnapshot(mk('savings_jars'), s => setJars(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('investments'), s => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('cards'), s => setCards(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('fixed_expenses'), s => setFixedExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('goals'), s => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('expense_goals'), s => setExpenseGoals(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(mk('subscriptions'), s => setSubscriptions(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => subs.forEach(u => u());
  }, [currentUser]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const sanitizeAIValue = (val) => {
    if (!val) return '0';
    let s = String(val).trim().replace(/[R$\s]/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (s.includes('.')) { const p = s.split('.'); if (p.length > 2 || p[p.length - 1].length !== 2) s = s.replace(/\./g, ''); }
    return s;
  };

  const parseAction = (responseText) => {
    let jsonString = null;
    const blocks = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/g);
    if (blocks) jsonString = blocks[blocks.length - 1].replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    else { const a = responseText.indexOf('{'); const b = responseText.lastIndexOf('}'); if (a !== -1 && b > a) { const c = responseText.substring(a, b + 1); if (c.includes('"action"')) jsonString = c; } }
    let display = responseText.replace(/```(?:json)?[\s\S]*?```/g, '').replace(/\{"action"[\s\S]*?\}\s*$/g, '').trim();
    let command = null;
    if (jsonString) { try { command = JSON.parse(jsonString); } catch { command = null; } }
    if (!display && command) display = 'Pronto!';
    return { display, command };
  };

  const addModelMsg = (text) => setMessages(p => [...p, { role: 'model', text }]);

  // Monta a fila de seleções necessárias para o lançamento (prioridade, cartão…).
  const buildSelectionQueue = (data, inputMsg) => {
    const queue = [];
    const low = (inputMsg || '').toLowerCase();
    if ((data.type || 'expense') === 'expense') {
      // Prioridade: se o usuário já disse, usamos; senão, pedimos por botões.
      if (/(sup[ée]rfluo|dispens|besteira|f[úu]til)/.test(low)) data.priority = 'superfluous';
      else if (/(essenc|necess|obrigat|important|b[áa]sic)/.test(low)) data.priority = 'essential';
      else if (/(conforto|qualidade de vida)/.test(low)) data.priority = 'comfort';
      else queue.push({ kind: 'priority', field: 'priority', label: 'Esse gasto é…', options: [
        { value: 'essential', label: 'Essencial', color: '#10b981' },
        { value: 'comfort', label: 'Conforto', color: '#f59e0b' },
        { value: 'superfluous', label: 'Supérfluo', color: '#f43f5e' },
      ] });
    }
    if (data.paymentMethod === 'credito') {
      if (cards.length === 1) data.selectedCardId = cards[0].id;
      else if (cards.length > 1 && !data.selectedCardId) {
        if (data.cardName) { const m = cards.find(c => (c.name || '').toLowerCase().includes(String(data.cardName).toLowerCase())); if (m) data.selectedCardId = m.id; }
        if (!data.selectedCardId) queue.push({ kind: 'card', field: 'selectedCardId', label: 'Em qual cartão?', options: cards.map(c => ({ value: c.id, label: c.name || 'Cartão' })) });
      }
    }
    return queue;
  };

  // Prepara o lançamento: valida e ou pede as seleções (botões) ou já confirma.
  const prepareTransaction = (command, inputMsg) => {
    const d = command.data || {};
    if (['investment', 'vault'].includes(d.category)) { addModelMsg('📌 Aportes em investimentos/patrimônio são feitos no módulo Patrimônio.'); return; }
    const data = {
      type: d.type === 'income' ? 'income' : 'expense',
      amount: parseFloat(sanitizeAIValue(d.amount)) || 0,
      description: d.description || 'Lançamento',
      category: d.category || 'other',
      date: d.date,
      paymentMethod: d.paymentMethod,
      cardName: d.cardName,
    };
    if (!data.amount) { addModelMsg('⚠️ Não entendi o valor — quanto foi?'); return; }
    if (data.paymentMethod === 'credito' && cards.length === 0) { addModelMsg('⚠️ Você pediu no crédito, mas não tem cartão cadastrado.'); return; }
    const queue = buildSelectionQueue(data, inputMsg);
    delete data.cardName;
    if (queue.length === 0) { commitTransaction(data); return; }
    setPending({ data, queue });
  };

  // Grava o lançamento e confirma em uma linha.
  const commitTransaction = async (data) => {
    const ok = onAddTransaction ? await onAddTransaction(data) : false;
    if (!ok) { addModelMsg('❌ Não consegui salvar agora. Tente de novo.'); return; }
    const cardTxt = data.selectedCardId ? ` no cartão ${cards.find(c => c.id === data.selectedCardId)?.name || ''}`.trimEnd() : '';
    addModelMsg(`✅ Lançado: ${data.description} — R$ ${(data.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${cardTxt}`);
  };

  // Usuário clicou numa opção da seleção pendente.
  const pickSelection = (value) => {
    if (!pending) return;
    const step = pending.queue[0];
    const data = { ...pending.data, [step.field]: value };
    const rest = pending.queue.slice(1);
    if (rest.length === 0) { setPending(null); commitTransaction(data); }
    else setPending({ data, queue: rest });
  };

  const send = async (text) => {
    const msg = (text || '').trim();
    if (!msg || isLoading) return;
    setInput('');
    setPending(null);
    setMessages(p => [...p, { role: 'user', text: msg }]);
    if (!isGeminiConfigured()) {
      setMessages(p => [...p, { role: 'model', text: 'Para conversar comigo aqui, configure sua chave do Google Gemini no assistente **Fale com a Alívia** (canto inferior direito). O resumo acima já fica pronto pra te ajudar. 😊' }]);
      return;
    }
    setIsLoading(true);
    try {
      const context = calculateStatsContext(transactions, manualConfig, false, jars, investments, userPrefs?.onboarding, { cards, fixedExpenses, goals, expenseGoals, subscriptions, planLevel })
        + `\n\n── INSTRUÇÕES DESTE CHAT (Visão Geral) ──\n`
        + `- NÃO cite valores monetários específicos (nada de "R$ X" ou números de reais). Use os dados só para entender a situação.\n`
        + `- Faça uma análise GERAL e qualitativa (ex.: "seus gastos supérfluos estão altos", "sua reserva está baixa", "você está no positivo").\n`
        + `- Comente também sobre as METAS/OBJETIVOS cadastrados (progresso, se algum teto estourou, ritmo) — sempre sem citar valores.\n`
        + `- Se o usuário pedir explicitamente um número/valor, oriente-o a ver nos cartões/relatórios do app.\n`
        + `- Seja breve, clara e acolhedora.`;
      const raw = await sendMessageToGemini(messages, msg, context);
      const { display, command } = parseAction(raw);
      if (display) addModelMsg(display);
      if (command && command.action === 'add_transaction') prepareTransaction(command, msg);
      else if (!display) addModelMsg('Pronto!');
    } catch (e) {
      console.error('OverviewChat', e);
      setMessages(p => [...p, { role: 'model', text: 'Tive um probleminha para responder agora. Tente novamente em instantes.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-[480px] xl:min-h-0 rounded-2xl border overflow-hidden pat-card`}>
      {/* Cabeçalho */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.06] bg-gradient-to-r from-emerald-500/[0.08] to-transparent' : 'border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent'}`}>
        <div className="relative shrink-0">
          <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow" />
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 ${isDark ? 'border-[#1e2330]' : 'border-white'}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Alívia</p>
            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">IA</span>
          </div>
          <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Consultora financeira · Online</p>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3.5 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-emerald-500 text-white rounded-br-md font-medium'
                : (isDark ? 'bg-white/[0.04] text-slate-200 rounded-bl-md' : 'bg-slate-50 text-slate-700 rounded-bl-md')
            }`}>
              {m.role === 'user'
                ? m.text
                : <div className="prose-chat space-y-1.5">{<ReactMarkdown>{m.text}</ReactMarkdown>}</div>}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`px-3.5 py-2.5 rounded-2xl flex items-center gap-2 text-[12px] ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Alívia está pensando…
            </div>
          </div>
        )}
      </div>

      {/* Seleção pendente (prioridade, cartão…) — clicar em vez de digitar */}
      {pending && (
        <div className="px-3.5 pb-2">
          <div className={`rounded-2xl p-3 border ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-[12px] font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{pending.queue[0].label}</p>
            <div className="flex flex-wrap gap-2">
              {pending.queue[0].options.map(o => (
                <button key={o.value} onClick={() => pickSelection(o.value)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition active:scale-95 ${isDark ? 'bg-white/[0.06] hover:bg-white/[0.12]' : 'bg-white hover:bg-slate-50'}`}
                  style={o.color ? { borderColor: `${o.color}66`, color: o.color } : { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}>
                  {o.label}
                </button>
              ))}
              <button onClick={() => { setPending(null); addModelMsg('Ok, cancelei o lançamento.'); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sugestões (escondidas durante uma seleção) */}
      {!pending && (
        <div className="px-3.5 pb-2 flex gap-2 overflow-x-auto custom-scrollbar">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} disabled={isLoading}
              className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Entrada */}
      <div className={`px-3 py-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className={`flex items-center gap-2 rounded-2xl p-1.5 pl-4 ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            placeholder="Pergunte ou registre um gasto…"
            className={`flex-1 min-w-0 bg-transparent outline-none text-[13px] ${isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
          />
          <button onClick={() => send(input)} disabled={isLoading || !input.trim()} aria-label="Enviar"
            className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shrink-0 active:scale-95 transition disabled:opacity-40">
            <Send className="w-[18px] h-[18px] text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
