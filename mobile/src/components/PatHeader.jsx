import React from 'react';
import { Settings } from 'lucide-react';
import { useStore } from '../store.jsx';
import ModuleToggle from './ModuleToggle.jsx';
import logo from '../assets/logo.png';

// Header das abas do módulo Patrimônio (marca + Olá + seletor de módulo + engrenagem).
export default function PatHeader({ module, onModule, onOpenSettings }) {
  const { user } = useStore();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Você';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="px-5 pt-4 pb-2 bg-ink/95 backdrop-blur-xl border-b border-fg/[0.05]">
      <div className="flex items-center justify-center gap-2 mb-3">
        <img src={logo} alt="Alívia" className="w-6 h-6 object-contain" />
        <span className="text-[14px] font-extrabold tracking-tight">Alívia</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-info to-blue-500 flex items-center justify-center font-black text-sm shrink-0">{initial}</div>}
          <div className="min-w-0">
            <p className="text-[11px] text-fg/40 leading-none">Olá,</p>
            <p className="text-[14px] font-bold leading-tight truncate">{firstName}</p>
          </div>
        </div>
        <ModuleToggle value={module} onChange={onModule} />
        <button onClick={onOpenSettings} aria-label="Ajustes" className="w-9 h-9 rounded-full bg-fg/[0.06] flex items-center justify-center active:scale-95 transition shrink-0"><Settings className="w-[18px] h-[18px] text-fg/70" /></button>
      </div>
    </div>
  );
}
