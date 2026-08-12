import React, { useState } from 'react';
import { User, Star, Bell, Moon, Sparkles, Key, Shield, Download, HelpCircle, LogOut, Trash2, Check, ChevronLeft, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { TabHeader, Card, Row, SettingRow, Segment, Switch } from '../components/ui.jsx';
import Sheet from '../components/Sheet.jsx';
import AliviaConfigForm from '../components/forms/AliviaConfigForm.jsx';
import { PLAN_LABEL } from '../lib/plan.js';
import { useStore } from '../store.jsx';
import { useTheme } from '../theme.jsx';
import logo from '../assets/logo.png';

const SITE = 'https://soualivia.com.br';

export default function AjustesTab({ onBack }) {
  const { user, logout, prefs, savePref, updateName, changePassword, demo, plan, transactions, savings_jars, cards, subscriptions } = useStore();
  const { theme, setTheme } = useTheme();

  const name = user?.displayName || 'Usuário';
  const email = user?.email || '';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  // Só contas de e-mail/senha podem trocar senha (Google gerencia na conta Google).
  const hasPassword = (user?.providerData || []).some(p => p.providerId === 'password');

  const [sheet, setSheet] = useState(null); // 'alivia' | 'gemini'
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const hasKey = !!(prefs?.apiKey || prefs?.manualConfig?.geminiKey);
  const openGemini = () => { setKeyInput(prefs?.manualConfig?.geminiKey || prefs?.apiKey || ''); setKeySaved(false); setSheet('gemini'); };
  const saveGemini = async () => {
    const k = keyInput.trim();
    await savePref({ apiKey: k, manualConfig: { ...(prefs?.manualConfig || {}), geminiKey: k } });
    setKeySaved(true);
    setTimeout(() => setSheet(null), 700);
  };

  const [notif, setNotif] = useState(() => {
    try { return localStorage.getItem('alivia_mobile_notif') !== 'off'; } catch { return true; }
  });
  const toggleNotif = () => setNotif(n => { const v = !n; try { localStorage.setItem('alivia_mobile_notif', v ? 'on' : 'off'); } catch { /* */ } return v; });

  const editName = () => {
    const novo = window.prompt('Seu nome', name);
    if (novo && novo.trim()) updateName(novo.trim());
  };

  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), user: { email }, prefs, transactions, savings_jars, cards, subscriptions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `alivia-meus-dados-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const open = (url) => { try { window.open(url, '_blank', 'noopener'); } catch { /* */ } };

  const confirmDelete = () => {
    if (window.confirm('A exclusão da conta é feita no site, por segurança. Abrir o site agora?')) open(`${SITE}`);
  };

  return (
    <div className="pb-6">
      <TabHeader title="Ajustes" right={onBack ? (
        <button onClick={onBack} aria-label="Voltar" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-fg/[0.06] text-fg/70 text-[12px] font-bold active:scale-95 transition shrink-0">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
      ) : undefined} />

      {/* Perfil */}
      <div className="px-5 mt-3">
        <Card className="p-4 flex items-center gap-3">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
            : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pos to-blue-500 flex items-center justify-center font-black">{initial}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold truncate">{name}{demo ? ' · demo' : ''}</p>
            <p className="text-[11px] text-fg/40 truncate">{email}</p>
          </div>
        </Card>
      </div>

      {/* Conta */}
      <div className="px-5 mt-4">
        <Card>
          <Row icon={User} iconColor="#60a5fa" iconBg="rgba(96,165,250,0.12)" title="Editar nome" subtitle={name} chevron onClick={editName} />
          {hasPassword && (
            <Row icon={Key} iconColor="#10b981" iconBg="rgba(16,185,129,0.12)" title="Alterar senha" subtitle="Trocar a senha da conta" chevron onClick={() => setSheet('senha')} />
          )}
          <Row icon={Star} iconColor="#f59e0b" iconBg="rgba(245,158,11,0.12)" title="Meu plano" subtitle={`${PLAN_LABEL[plan] || 'Gratuito'} · gerenciar no site`} chevron onClick={() => open(SITE)} last />
        </Card>
      </div>

      {/* Configurar Alívia (mesmas configs do site) */}
      <div className="px-5 mt-4">
        <Card>
          <Row icon={Sparkles} iconColor="#10b981" iconBg="rgba(16,185,129,0.12)" title="Configurar Alívia" subtitle="Renda, regime e metas do Índice" chevron onClick={() => setSheet('alivia')} />
          <Row icon={Key} iconColor="#a855f7" iconBg="rgba(168,85,247,0.12)" title="Inteligência Artificial" subtitle={hasKey ? 'Chave Gemini configurada' : 'Adicionar chave Gemini'} chevron onClick={openGemini} last />
        </Card>
      </div>

      {/* Preferências (funcionais) */}
      <div className="px-5 mt-4">
        <Card>
          <SettingRow icon={Moon} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Tema"
            right={<Segment value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }]} />} />
          <SettingRow icon={Bell} iconColor="#a855f7" iconBg="rgba(168,85,247,0.12)" title="Notificações" subtitle={notif ? 'Ativadas' : 'Desativadas'}
            right={<Switch on={notif} onClick={toggleNotif} />} last />
        </Card>
      </div>

      {/* Privacidade */}
      <div className="px-5 mt-4">
        <Card>
          <Row icon={Shield} iconColor="#60a5fa" iconBg="rgba(96,165,250,0.12)" title="Privacidade" subtitle="Política e termos" chevron onClick={() => open(`${SITE}`)} />
          <Row icon={Download} iconColor="#34d399" iconBg="rgba(52,211,153,0.12)" title="Baixar meus dados" subtitle="Exportar em JSON (LGPD)" chevron onClick={exportData} />
          <Row icon={HelpCircle} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Ajuda e suporte" subtitle="suporte@soualivia.com.br" chevron onClick={() => { window.location.href = 'mailto:suporte@soualivia.com.br'; }} last />
        </Card>
      </div>

      {/* Conta — ações */}
      <div className="px-5 mt-4">
        <Card>
          <Row icon={LogOut} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Sair da conta" onClick={logout} />
          <Row icon={Trash2} iconColor="#f43f5e" iconBg="rgba(244,63,94,0.12)" title="Excluir conta" danger onClick={confirmDelete} last />
        </Card>
      </div>

      <div className="flex flex-col items-center gap-2 mt-7 opacity-40">
        <img src={logo} alt="Alívia" className="w-8 h-8 object-contain" />
        <span className="text-[10px] tracking-widest uppercase font-bold">Alívia</span>
      </div>

      {sheet === 'alivia' && (
        <Sheet title="Configurar Alívia" subtitle="Como a Alívia conta seus gastos e calcula sua saúde" onClose={() => setSheet(null)}>
          <AliviaConfigForm prefs={prefs} onSave={savePref} onDone={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'senha' && (
        <Sheet title="Alterar senha" subtitle="Confirme a senha atual e defina a nova" onClose={() => setSheet(null)}>
          <ChangePasswordForm changePassword={changePassword} onDone={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'gemini' && (
        <Sheet title="Inteligência Artificial" subtitle="Sua chave Gemini (BYOK)" onClose={() => setSheet(null)}>
          <div className="space-y-4">
            <p className="text-[12px] text-fg/50 leading-snug">
              A Alívia usa a API do Google Gemini com a <span className="font-bold text-fg/70">sua própria chave</span>. Gere gratuitamente em <span className="text-info font-semibold">aistudio.google.com/apikey</span> e cole abaixo.
            </p>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Cole sua Gemini API Key (AIza...)"
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="w-full rounded-xl bg-fg/[0.05] border border-fg/[0.08] px-3.5 py-3 text-[14px] text-fg placeholder:text-fg/30 outline-none focus:border-fg/25 transition"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => { setKeyInput(''); }} className="py-3.5 rounded-2xl bg-fg/[0.06] text-fg/70 font-bold text-[14px] active:scale-95 transition">Limpar</button>
              <button onClick={saveGemini} className="py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-95 transition">
                <Check className="w-4 h-4" /> {keySaved ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="block text-center text-[12px] font-bold text-info">Gerar chave gratuita →</a>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// Erros amigáveis para a troca de senha.
function pwError(code) {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Senha atual incorreta.';
    case 'auth/weak-password': return 'A nova senha precisa ter ao menos 6 caracteres.';
    case 'auth/requires-recent-login': return 'Por segurança, saia e entre de novo para trocar a senha.';
    case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    default: return 'Não foi possível alterar a senha. Tente novamente.';
  }
}

// Formulário de alteração de senha (dentro do bottom-sheet).
function ChangePasswordForm({ changePassword, onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const cls = 'w-full pl-11 pr-11 py-3.5 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] text-[14px] font-semibold text-fg placeholder:text-fg/30 outline-none focus:border-fg/25 transition';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!current || !next) { setError('Preencha a senha atual e a nova.'); return; }
    if (next.length < 6) { setError('A nova senha precisa ter ao menos 6 caracteres.'); return; }
    if (next !== confirm) { setError('As senhas não conferem.'); return; }
    if (next === current) { setError('A nova senha precisa ser diferente da atual.'); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      setOk(true);
      setTimeout(onDone, 1200);
    } catch (err) { console.error('[changePassword]', err?.code, err); setError(pwError(err?.code)); setLoading(false); }
  };

  if (ok) {
    return (
      <div className="py-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/12 flex items-center justify-center mb-3"><CheckCircle2 className="w-7 h-7 text-pos" /></div>
        <p className="text-[15px] font-bold">Senha alterada com sucesso!</p>
      </div>
    );
  }

  const eye = (
    <button type="button" onClick={() => setShow(v => !v)} aria-label="Mostrar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/35 active:text-fg/70">
      {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-2xl text-[12px] text-center font-bold">{error}</div>}
      <div className="relative">
        <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Senha atual" className={cls} />
        {eye}
      </div>
      <div className="relative">
        <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nova senha (mín. 6)" className={cls} />
        {eye}
      </div>
      <div className="relative">
        <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-fg/35" />
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar nova senha" className={cls} />
        {eye}
      </div>
      <button type="submit" disabled={loading} className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25 disabled:opacity-70">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-4 h-4" /> Alterar senha</>}
      </button>
    </form>
  );
}
