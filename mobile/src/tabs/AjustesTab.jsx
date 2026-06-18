import React from 'react';
import { User, Star, Bell, Moon, SlidersHorizontal, Shield, Download, HelpCircle, LogOut, Trash2 } from 'lucide-react';
import { TabHeader, Card, Row } from '../components/ui.jsx';
import { useStore } from '../store.jsx';
import logo from '../assets/logo.png';

export default function AjustesTab() {
  const { user, logout } = useStore();
  const name = user?.displayName || 'Usuário';
  const email = user?.email || '';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="pb-6">
      <TabHeader title="Ajustes" />

      {/* Perfil */}
      <div className="px-5 mt-3">
        <Card className="p-4 flex items-center gap-3">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
            : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center font-black">{initial}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold truncate">{name}</p>
            <p className="text-[11px] text-white/40 truncate">{email}</p>
          </div>
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          <Row icon={User} iconColor="#60a5fa" iconBg="rgba(96,165,250,0.12)" title="Perfil" subtitle="Nome, foto e dados" chevron />
          <Row icon={Star} iconColor="#f59e0b" iconBg="rgba(245,158,11,0.12)" title="Meu plano" subtitle="Gerenciar assinatura (no site)" chevron />
          <Row icon={Bell} iconColor="#a855f7" iconBg="rgba(168,85,247,0.12)" title="Notificações" subtitle="Lembretes e alertas" chevron last />
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          <Row icon={Moon} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Tema" subtitle="Escuro" chevron />
          <Row icon={SlidersHorizontal} iconColor="#10b981" iconBg="rgba(16,185,129,0.12)" title="Regime de apuração" subtitle="Competência" chevron last />
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          <Row icon={Shield} iconColor="#60a5fa" iconBg="rgba(96,165,250,0.12)" title="Privacidade" subtitle="Política e termos" chevron />
          <Row icon={Download} iconColor="#34d399" iconBg="rgba(52,211,153,0.12)" title="Baixar meus dados" subtitle="Exportar em JSON (LGPD)" chevron />
          <Row icon={HelpCircle} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Ajuda e suporte" chevron last />
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          <Row icon={LogOut} iconColor="#94a3b8" iconBg="rgba(148,163,184,0.12)" title="Sair da conta" onClick={logout} />
          <Row icon={Trash2} iconColor="#f43f5e" iconBg="rgba(244,63,94,0.12)" title="Excluir conta" danger last />
        </Card>
      </div>

      <div className="flex flex-col items-center gap-2 mt-7 opacity-40">
        <img src={logo} alt="Alívia" className="w-8 h-8 object-contain" />
        <span className="text-[10px] tracking-widest uppercase font-bold">Alívia</span>
      </div>
    </div>
  );
}
