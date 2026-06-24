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

  const L = [];
  L.push('Oi! Dei uma olhada no seu mês 👀');
  if (hasDebt) L.push(`⚠️ **Prioridade:** você tem **R$ ${fmtMoney(totalDebt)}** em dívidas — quitar vem antes de qualquer investimento (veja em *Gerenciamento de Dívidas*).`);
  L.push(`Os gastos **essenciais** somaram **R$ ${fmtMoney(essential)}** e os **supérfluos** **R$ ${fmtMoney(superf)}** (${supPct}% dos gastos${supPct > 30 ? ' — acima do ideal de 30%' : ' — dentro do ideal'}).`);
  L.push(sobrou >= 0 ? `Você está **no positivo**: sobram **R$ ${fmtMoney(sobrou)}** este mês.` : `Atenção: você gastou **R$ ${fmtMoney(Math.abs(sobrou))}** a mais do que ganhou neste mês.`);
  L.push(reserveAmount > 0
    ? `Sua **reserva de emergência** cobre **${reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${reserveMonths === 1 ? 'mês' : 'meses'}** de despesas${reserveMonths < 6 ? ' — mire ao menos 6 meses.' : ' — ótimo nível!'}`
    : 'Você ainda **não tem reserva de emergência** — vale começar a construir uma.');
  if (!hasDebt && (objLabel || aporteAlvo > 0)) {
    let s = '';
    if (objLabel) s += `Seu objetivo é **${objLabel}**. `;
    if (aporteAlvo > 0) {
      s += sobrou >= aporteAlvo
        ? `Sua meta de aporte é **R$ ${fmtMoney(aporteAlvo)}/mês** e a sobra já cobre isso — **bom momento para investir.**`
        : sobrou > 0
          ? `Sua meta de aporte é **R$ ${fmtMoney(aporteAlvo)}/mês**; faltam **R$ ${fmtMoney(aporteAlvo - sobrou)}** para o aporte completo.`
          : `Sua meta de aporte é **R$ ${fmtMoney(aporteAlvo)}/mês**, mas não houve sobra — reveja os supérfluos.`;
    } else {
      s += 'Defina um aporte mensal em *Construção de Patrimônio* para eu acompanhar seu ritmo.';
    }
    L.push(s);
  }
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

  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [cards, setCards] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
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

  // Executa um lançamento avulso (add_transaction) pedido pela conversa.
  const runAddTransaction = async (command, inputMsg) => {
    const data = { ...(command.data || {}) };
    if (['investment', 'vault'].includes(data.category)) return '\n\n📌 Aportes em investimentos/patrimônio são feitos no módulo **Patrimônio**.';
    const sanitized = { ...data, amount: parseFloat(sanitizeAIValue(data.amount)) || 0 };
    if (sanitized.type === 'expense') {
      const low = (inputMsg || '').toLowerCase();
      if (/(sup[ée]rfluo|dispens|besteira|f[úu]til)/.test(low)) sanitized.priority = 'superfluous';
      else if (/(essenc|necess|obrigat|important|b[áa]sic)/.test(low)) sanitized.priority = 'essential';
      else if (/(conforto|qualidade de vida)/.test(low)) sanitized.priority = 'comfort';
    }
    if (sanitized.paymentMethod === 'credito') {
      let cardId = '';
      if (data.cardName) { const m = cards.find(c => (c.name || '').toLowerCase().includes(String(data.cardName).toLowerCase())); if (m) cardId = m.id; }
      else if (cards.length === 1) cardId = cards[0].id;
      if (!cardId && cards.length === 0) return '\n\n⚠️ Você pediu no crédito, mas não tem cartão cadastrado.';
      sanitized.selectedCardId = cardId;
    }
    delete sanitized.cardName;
    if (!sanitized.amount) return '\n\n⚠️ Não entendi o valor — pode me dizer quanto foi?';
    const ok = onAddTransaction ? await onAddTransaction(sanitized) : false;
    if (!ok) return '\n\n❌ Não consegui salvar agora. Tente de novo.';
    const cardTxt = sanitized.selectedCardId ? ` no cartão ${cards.find(c => c.id === sanitized.selectedCardId)?.name || ''}`.trimEnd() : '';
    return `\n\n✅ **Lançado:** ${sanitized.description} (R$ ${sanitized.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${cardTxt}`;
  };

  const send = async (text) => {
    const msg = (text || '').trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', text: msg }]);
    if (!isGeminiConfigured()) {
      setMessages(p => [...p, { role: 'model', text: 'Para conversar comigo aqui, configure sua chave do Google Gemini no assistente **Fale com a Alívia** (canto inferior direito). O resumo acima já fica pronto pra te ajudar. 😊' }]);
      return;
    }
    setIsLoading(true);
    try {
      const context = calculateStatsContext(transactions, manualConfig, false, jars, investments, userPrefs?.onboarding, { cards, fixedExpenses, goals, subscriptions, planLevel });
      const raw = await sendMessageToGemini(messages, msg, context);
      const { display, command } = parseAction(raw);
      let out = display || 'Pronto!';
      if (command && command.action === 'add_transaction') out += await runAddTransaction(command, msg);
      setMessages(p => [...p, { role: 'model', text: out }]);
    } catch (e) {
      console.error('OverviewChat', e);
      setMessages(p => [...p, { role: 'model', text: 'Tive um probleminha para responder agora. Tente novamente em instantes.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-[480px] xl:min-h-0 rounded-2xl border overflow-hidden ${isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm'}`}>
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

      {/* Sugestões */}
      <div className="px-3.5 pb-2 flex gap-2 overflow-x-auto custom-scrollbar">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} disabled={isLoading}
            className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s}
          </button>
        ))}
      </div>

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
