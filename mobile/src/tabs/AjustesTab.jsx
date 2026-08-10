import React, { useState } from 'react';
import { User, Star, Bell, Moon, Sparkles, Key, Shield, Download, HelpCircle, LogOut, Trash2, Check, ChevronLeft } from 'lucide-react';
import { TabHeader, Card, Row, SettingRow, Segment, Switch } from '../components/ui.jsx';
import Sheet from '../components/Sheet.jsx';
import AliviaConfigForm from '../components/forms/AliviaConfigForm.jsx';
import { PLAN_LABEL } from '../lib/plan.js';
import { useStore } from '../store.jsx';
import { useTheme } from '../theme.jsx';
import logo from '../assets/logo.png';

const SITE = 'https://soualivia.com.br';

export default function AjustesTab({ onBack }) {
  const { user, logout, prefs, savePref, updateName, demo, plan, transactions, savings_jars, cards, subscriptions } = useStore();
  const { theme, setTheme } = useTheme();

  const name = user?.displayName || 'Usuário';
  const email = user?.email || '';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

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
