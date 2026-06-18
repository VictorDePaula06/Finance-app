import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, Send, StopCircle, Loader2, KeyRound } from 'lucide-react';
import { useStore } from '../store.jsx';
import { useFinance } from '../hooks/useFinance.js';
import {
  buildAliviaContext, chatWithAlivia, transcribeAudio, parseAliviaAction,
  resolveKey, setSessionKey, sanitizeAIValue,
} from '../services/gemini.js';
import aliviaFinal from '../assets/alivia-final.png';

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
  r.readAsDataURL(blob);
});

export default function ChatSheet({ onClose, seedMessage, autoRecord }) {
  const { addTransaction, cards = [], transactions = [], prefs } = useStore();
  const finance = useFinance();

  const [messages, setMessages] = useState([
    { role: 'model', text: 'Oi! Sou a Alívia. Pergunte sobre suas finanças ou me diga um gasto pra eu registrar — ex.: "gastei 120 no mercado".' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  const scrollRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const seededRef = useRef(false);

  const apiKey = resolveKey(prefs);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Executa a ação devolvida pela Alívia (por ora: registrar gasto/recebimento).
  const runCommand = async (command, inputMsg) => {
    if (!command || command.action !== 'add_transaction') {
      return '\n\nℹ️ Por aqui eu registro gastos e recebimentos. Para contas fixas, assinaturas, parcelamentos ou reserva, use as abas do app.';
    }
    const data = { ...command.data, amount: parseFloat(sanitizeAIValue(command.data?.amount)) || 0 };
    if (['investment', 'vault'].includes(data.category)) {
      return '\n\n📌 Aportes em investimentos/patrimônio não são lançados pelo chat — faça no site.';
    }
    if (!data.amount) return '\n\n⚠️ Não entendi o valor. Pode me dizer quanto foi?';

    if (data.paymentMethod === 'credito') {
      let cardId = '';
      if (data.cardName) {
        const m = cards.find((c) => (c.name || '').toLowerCase().includes(String(data.cardName).toLowerCase()));
        if (m) cardId = m.id;
      } else if (cards.length === 1) cardId = cards[0].id;
      if (!cardId && cards.length === 0) {
        return '\n\n⚠️ Você não tem cartão cadastrado. Cadastre um na aba Cartão para lançar no crédito.';
      }
      data.selectedCardId = cardId;
    }
    delete data.cardName;

    const ok = await addTransaction({
      type: data.type === 'income' ? 'income' : 'expense',
      amount: data.amount,
      description: data.description || 'Lançamento',
      category: data.category || (data.type === 'income' ? 'other' : 'other'),
      date: data.date,
      paymentMethod: data.paymentMethod,
      selectedCardId: data.selectedCardId,
    });
    if (!ok) return '\n\n❌ Não consegui salvar agora. Tente de novo.';
    const cardTxt = data.selectedCardId ? ` no cartão ${cards.find((c) => c.id === data.selectedCardId)?.name || ''}`.trimEnd() : '';
    return `\n\n✅ **Lançado:** ${data.description} (R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${cardTxt}`;
  };

  const send = async (text) => {
    const msg = (text || '').trim();
    if (!msg || loading) return;
    if (!apiKey) { setMessages((p) => [...p, { role: 'model', text: 'Configure sua chave Gemini abaixo para conversarmos.' }]); return; }

    setInput('');
    setMessages((p) => [...p, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const context = buildAliviaContext({ finance, transactions, cards, prefs });
      const history = messages.filter((m) => m.role === 'user' || m.role === 'model');
      const raw = await chatWithAlivia({ apiKey, context, history, message: msg });
      const { display, command } = parseAliviaAction(raw);
      let out = display || 'Pronto!';
      if (command) out += await runCommand(command, msg);
      setMessages((p) => [...p, { role: 'model', text: out }]);
    } catch (e) {
      console.error(e);
      const m = String(e?.message || '');
      const friendly = m.includes('API key') || m.includes('API_KEY') || m.includes('401') || m.includes('400')
        ? 'A chave Gemini parece inválida. Confira no site (Configurar Alívia).'
        : 'Tive um problema para responder agora. Tente novamente em instantes.';
      setMessages((p) => [...p, { role: 'model', text: friendly }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!apiKey) { setMessages((p) => [...p, { role: 'model', text: 'Configure sua chave Gemini abaixo para usar o áudio.' }]); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (!blob.size) return;
        setLoading(true);
        try {
          const base64 = await blobToBase64(blob);
          const text = await transcribeAudio({ apiKey, base64, mimeType: (rec.mimeType || 'audio/webm').split(';')[0] });
          setLoading(false);
          if (text) await send(text);
          else setMessages((p) => [...p, { role: 'model', text: 'Não consegui entender o áudio. Pode tentar de novo?' }]);
        } catch (e) {
          console.error(e);
          setLoading(false);
          setMessages((p) => [...p, { role: 'model', text: 'Não consegui processar o áudio agora.' }]);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMessages((p) => [...p, { role: 'model', text: 'Não consegui acessar o microfone. Verifique a permissão.' }]);
    }
  };
  const stopRecording = () => { try { recRef.current?.stop(); } catch { /* */ } };

  // Mensagem/áudio inicial (vindo do card da Geral).
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (seedMessage) send(seedMessage);
    else if (autoRecord) startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-bg/40 anim-fade">
      <div className="relative w-full max-w-[440px] h-full bg-bg flex flex-col anim-sheet">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-fg/[0.06] bg-card/60 backdrop-blur">
          <div className="relative shrink-0">
            <img src={aliviaFinal} alt="Alívia" className="w-9 h-9 rounded-full object-cover border border-pos/30" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-pos border-2 border-card" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-none">Alívia</p>
            <p className="text-[10px] text-pos/80 mt-1">Consultora financeira · Online</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-full bg-fg/[0.06] flex items-center justify-center active:scale-90 transition">
            <X className="w-4 h-4 text-fg/70" />
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-pos text-black rounded-br-md font-medium' : 'bg-card border border-fg/[0.06] rounded-bl-md'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl bg-card border border-fg/[0.06] flex items-center gap-2 text-fg/50 text-[12px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Alívia está pensando…
              </div>
            </div>
          )}
        </div>

        {/* Sem chave → entrada da chave (o usuário cola a própria chave Gemini) */}
        {!apiKey && (
          <div className="px-4 pb-2">
            <div className="rounded-2xl bg-warn/10 border border-warn/20 p-3">
              <p className="text-[11px] text-warn flex items-center gap-1.5 mb-2"><KeyRound className="w-3.5 h-3.5" /> Cole sua chave do Google Gemini para conversar (a mesma do site).</p>
              <div className="flex gap-2">
                <input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} type="password" placeholder="AIza…"
                  className="flex-1 min-w-0 rounded-xl bg-fg/[0.06] border border-fg/[0.1] px-3 py-2 text-[12px] outline-none" />
                <button onClick={() => { if (keyDraft.trim()) { setSessionKey(keyDraft.trim()); setKeyDraft(''); setMessages((p) => [...p, { role: 'model', text: 'Chave configurada! Pode mandar sua pergunta. 😊' }]); } }}
                  className="px-3 py-2 rounded-xl bg-warn text-black font-bold text-[12px] active:scale-95 transition">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {/* Entrada */}
        <div className="px-3 py-3 border-t border-fg/[0.06] bg-card/40" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          <div className="flex items-center gap-2 bg-fg/[0.06] rounded-2xl p-1.5 pl-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
              placeholder={recording ? 'Gravando áudio…' : 'Pergunte ou registre um gasto…'}
              disabled={recording}
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-fg/30"
            />
            <button onClick={recording ? stopRecording : startRecording} aria-label="Áudio"
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${recording ? 'bg-rose-500/20' : 'bg-fg/[0.06]'}`}>
              {recording ? <StopCircle className="w-5 h-5 text-neg animate-pulse" /> : <Mic className="w-5 h-5 text-pos" />}
            </button>
            <button onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Enviar"
              className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 active:scale-95 transition disabled:opacity-40">
              <Send className="w-[18px] h-[18px] text-black" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
