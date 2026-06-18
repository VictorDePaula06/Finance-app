import React, { useState } from 'react';
import { User, Star, Bell, Moon, SlidersHorizontal, Shield, Download, HelpCircle, LogOut, Trash2 } from 'lucide-react';
import { TabHeader, Card, Row, SettingRow, Segment, Switch } from '../components/ui.jsx';
import { useStore } from '../store.jsx';
import { useTheme } from '../theme.jsx';
import logo from '../assets/logo.png';

const SITE = 'https://soualivia.com.br';

export default function AjustesTab() {
  const { user, logout, prefs, savePref, updateName, demo, transactions, savings_jars, cards, subscriptions } = useStore();
  const { theme, setTheme } = useTheme();

  const name = user?.displayName || 'Usuário';
  const email = user?.email || '';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  const basis = prefs?.expenseBasis === 'caixa' ? 'caixa' : 'competencia';
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
      <TabHeader title="Ajustes" />

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
          <Row icon={Star} iconColor="#f59e0b" iconBg="rgba(245,158,11,0.12)" title="Meu plano" subtitle="Gerenciar assinatura (no site)" chevron onClick={() => open(SITE)} last />
        </Card>
      </div>

      {/* Preferências (funcionais) */}
      <div className="px-5 mt-4">
        <Card>
          <SettingRow icon={Moon} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Tema"
            right={<Segment value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }]} />} />
          <SettingRow icon={SlidersHorizontal} iconColor="#10b981" iconBg="rgba(16,185,129,0.12)" title="Regime de apuração" subtitle="Como contam os gastos do mês"
            right={<Segment value={basis} onChange={(v) => savePref({ expenseBasis: v })} options={[{ value: 'competencia', label: 'Competência' }, { value: 'caixa', label: 'Caixa' }]} />} />
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
    </div>
  );
}
