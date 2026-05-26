import React, { useState } from 'react';
import {
  Settings, Shield, Moon, Sun, Key, Check, Loader2, Video,
  HelpCircle, Sparkles, ChevronDown, Bookmark, X, CreditCard,
  Trash2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { validateApiKey } from '../services/gemini';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';
import Manual from './Manual';
import UpgradeModal from './UpgradeModal';
import { Sparkles as SparklesIcon } from 'lucide-react';

const SettingsTab = ({ manualConfig, updateManualConfig }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, deleteAccount, planLevel, subType, resetGastosData, resetPatrimonioData } = useAuth();

  // Accordion state — todas fechadas por padrão
  const [open, setOpen] = useState({});
  const toggle = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showResetGastosConfirm, setShowResetGastosConfirm] = useState(false);
  const [isResettingGastos, setIsResettingGastos] = useState(false);
  const [showResetPatrimonioConfirm, setShowResetPatrimonioConfirm] = useState(false);
  const [isResettingPatrimonio, setIsResettingPatrimonio] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [apiKey, setApiKey] = useState(manualConfig.geminiKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey) return;
    setIsValidating(true);
    setValidationStatus(null);
    const isValid = await validateApiKey(apiKey);
    setIsValidating(false);
    if (isValid) {
      updateManualConfig({ ...manualConfig, geminiKey: apiKey });
      setValidationStatus('success');
      setTimeout(() => setValidationStatus(null), 3000);
    } else {
      setValidationStatus('error');
    }
  };

  const changelog = [
    { version: '6.7.0', title: 'Gestão de Cartões', items: ['Aba de cartões dedicada', 'Vínculo de assinaturas a cartões', 'Dashboard enriquecido'] },
    { version: '6.6.0', title: 'Layout Sidebar', items: ['Nova navegação vertical', 'Melhoria na densidade de informação', 'Modo escuro otimizado'] },
  ];

  // ── Helpers de estilo ──
  const wrap = `rounded-2xl border overflow-hidden ${
    theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
  }`;
  const headerBtn = `w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
    theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
  }`;
  const divider = `border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`;
  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
    theme === 'light' ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
  }`;
  const iconWrap = `p-1.5 rounded-lg ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'}`;
  const labelCls = `text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-white'}`;
  const chevronCls = (id) => `w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0 ${open[id] ? 'rotate-180' : ''}`;

  // ── Componente de cabeçalho de seção ──
  const SectionHeader = ({ id, icon: Icon, label, iconColor = 'text-slate-400', badge }) => (
    <button onClick={() => toggle(id)} className={headerBtn}>
      <div className="flex items-center gap-3">
        <span className={iconWrap}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </span>
        <span className={labelCls}>{label}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {badge}
          </span>
        )}
      </div>
      <ChevronDown className={chevronCls(id)} />
    </button>
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-2xl mx-auto">

      {/* Manual Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
          <div className={`relative w-full max-w-7xl h-[95vh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 ${
            theme === 'light' ? 'bg-white' : 'bg-slate-900'
          }`}>
            <button
              onClick={() => setShowManualModal(false)}
              className={`absolute top-4 right-4 z-10 p-2 rounded-xl transition-colors ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-500' : 'bg-white/10 hover:bg-white/20 text-slate-400'}`}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="h-full overflow-y-auto">
              <Manual manualConfig={manualConfig} updateManualConfig={updateManualConfig} />
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h2 className={`text-2xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Ajustes</h2>
        <p className="text-xs text-slate-500 mt-0.5">Personalize sua experiência e gerencie sua conta</p>
      </div>

      {/* ── Accordion List ── */}
      <div className="space-y-2">

        {/* 1. Perfil e Segurança */}
        <div className={wrap}>
          <SectionHeader id="profile" icon={Shield} label="Perfil e Segurança" iconColor="text-emerald-500" />
          {open.profile && (
            <div className={`px-4 pb-4 pt-1 ${divider} animate-in fade-in duration-200`}>
              <div className="flex items-center gap-4 pt-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl font-black text-emerald-500 shrink-0">
                  {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {currentUser?.displayName || 'Usuário Alívia'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Sua Assinatura */}
        <div className={wrap}>
          <SectionHeader
            id="subscription"
            icon={CreditCard}
            label="Sua Assinatura"
            iconColor="text-blue-400"
            badge={planLevel === 'lifetime' ? 'Vitalício' : planLevel === 'premium' ? 'Premium' : planLevel === 'standard' ? 'Standard' : undefined}
          />
          {open.subscription && (
            <div className={`px-4 pb-4 pt-3 ${divider} animate-in fade-in duration-200`}>
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${
                planLevel === 'lifetime' ? 'border-purple-500/40 bg-purple-500/5'
                : planLevel === 'premium'  ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-blue-500/40 bg-blue-500/5'
              }`}>
                <div className="min-w-0">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    planLevel === 'lifetime' ? 'text-purple-400'
                    : planLevel === 'premium' ? 'text-emerald-400'
                    : 'text-blue-400'
                  }`}>Plano Atual</p>
                  <h4 className={`text-base font-black capitalize truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {planLevel === 'lifetime' ? 'Premium' : planLevel}{' '}
                    <span className="text-xs opacity-50 font-medium">
                      ({planLevel === 'lifetime' ? 'Vitalício' : subType === 'annual' ? 'Anual' : 'Mensal'})
                    </span>
                  </h4>
                </div>
                {planLevel === 'standard' ? (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" /> Upgrade
                  </button>
                ) : (
                  <button
                    onClick={() => window.open('https://billing.stripe.com/p/login/00waEY8WW5ZK0V95TJ7kc00', '_blank')}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                      theme === 'light' ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Gerenciar
                  </button>
                )}
              </div>
              <p className="mt-3 text-[10px] text-slate-500 leading-relaxed text-center italic">
                Gerencie seu plano, faturas e cancelamentos pelo e-mail ou fale com o suporte.
              </p>
            </div>
          )}
        </div>

        {/* 3. Inteligência Artificial */}
        <div className={wrap}>
          <SectionHeader id="ai" icon={Key} label="Inteligência Artificial" iconColor="text-violet-400" />
          {open.ai && (
            <div className={`px-4 pb-4 pt-3 ${divider} animate-in fade-in duration-200`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    O Alívia utiliza o Google Gemini.{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                      Clique aqui para obter sua chave gratuita.
                    </a>
                  </p>
                  <button
                    onClick={() => setShowVideo(!showVideo)}
                    className="shrink-0 ml-3 text-[10px] font-semibold text-blue-500 flex items-center gap-1 hover:underline"
                  >
                    <Video className="w-3 h-3" /> Tutorial
                  </button>
                </div>
                {showVideo && (
                  <div className="rounded-xl overflow-hidden border border-white/5 bg-black animate-in zoom-in duration-300">
                    <video src={tutorialVideo} controls className="w-full h-auto" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Sua Gemini API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className={inp}
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isValidating}
                    className={`shrink-0 px-4 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 ${
                      validationStatus === 'success'
                        ? 'bg-emerald-500 text-white'
                        : theme === 'light'
                          ? 'bg-slate-800 text-white hover:bg-slate-700'
                          : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {isValidating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : validationStatus === 'success'
                        ? <Check className="w-4 h-4" />
                        : 'Salvar'
                    }
                  </button>
                </div>
                {validationStatus === 'error' && (
                  <p className="text-xs text-rose-500 font-medium">Chave inválida. Verifique e tente novamente.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Aparência */}
        <div className={wrap}>
          <SectionHeader id="appearance" icon={Settings} label="Aparência" iconColor="text-slate-400" />
          {open.appearance && (
            <div className={`px-4 pb-4 pt-3 ${divider} animate-in fade-in duration-200`}>
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
              }`}>
                <div>
                  <p className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>Tema Escuro</p>
                  <p className="text-[10px] text-slate-500">Melhor para uso noturno</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`p-2.5 rounded-xl border transition-all ${
                    theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800 border-white/10 text-yellow-400 hover:bg-slate-700'
                  }`}
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. Central de Ajuda */}
        <div className={wrap}>
          <SectionHeader id="help" icon={HelpCircle} label="Central de Ajuda" iconColor="text-amber-400" />
          {open.help && (
            <div className={`px-4 pb-4 pt-3 ${divider} space-y-2 animate-in fade-in duration-200`}>
              <button
                onClick={() => setShowManualModal(true)}
                className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between group transition-all ${
                  theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-emerald-50 hover:border-emerald-100' : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bookmark className="w-4 h-4 text-emerald-500" />
                  <span className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Manual do Usuário</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => { setOpen(prev => ({ ...prev, ai: true })); setShowVideo(true); }}
                className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between group transition-all ${
                  theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-blue-50 hover:border-blue-100' : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-blue-500" />
                  <span className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Tutorial de Início</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => {
                  setShowManualModal(true);
                  setTimeout(() => window.dispatchEvent(new CustomEvent('manual-section', { detail: 'billing' })), 100);
                }}
                className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between group transition-all ${
                  theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-purple-50 hover:border-purple-100' : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  <span className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Assinatura e Faturamento</span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* 6. Novidades */}
        <div className={wrap}>
          <SectionHeader id="changelog" icon={Sparkles} label="Novidades" iconColor="text-yellow-400" />
          {open.changelog && (
            <div className={`px-4 pb-4 pt-3 ${divider} space-y-4 animate-in fade-in duration-200`}>
              {changelog.map((entry, idx) => (
                <div key={idx} className="relative pl-5 border-l-2 border-emerald-500/20">
                  <div className="absolute left-[-7px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40" />
                  <p className="text-[10px] font-black text-emerald-500 uppercase mb-0.5">{entry.version}</p>
                  <p className={`text-sm font-bold mb-1.5 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{entry.title}</p>
                  <ul className="space-y-0.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="text-[10px] text-slate-500 flex items-center gap-2">
                        <div className="w-1 h-1 bg-slate-400 rounded-full shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Zerar Módulos */}
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'light' ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-900 border-amber-500/20'
        }`}>
          <button onClick={() => toggle('reset')} className={headerBtn}>
            <div className="flex items-center gap-3">
              <span className={`p-1.5 rounded-lg ${theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'}`}>
                <RefreshCw className="w-4 h-4 text-amber-500" />
              </span>
              <span className={labelCls}>Zerar Módulos</span>
            </div>
            <ChevronDown className={chevronCls('reset')} />
          </button>
          {open.reset && (
            <div className={`px-4 pb-4 pt-2 ${theme === 'light' ? 'border-t border-amber-100' : 'border-t border-amber-500/10'} animate-in fade-in duration-200`}>
              <p className="text-xs text-slate-500 mb-4 pt-1">
                Apague os dados de um módulo específico e refaça a configuração inicial. Essa ação não pode ser desfeita.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Gastos */}
                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'}`}>
                  <h4 className={`text-xs font-bold mb-1 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Controle de Gastos</h4>
                  <p className="text-[10px] text-slate-500 mb-3">Zera transações, cartões, despesas fixas e assinaturas.</p>
                  {!showResetGastosConfirm ? (
                    <button
                      onClick={() => setShowResetGastosConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 text-amber-600 text-xs font-semibold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" /> Zerar Gastos
                    </button>
                  ) : (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-semibold text-rose-500">Os dados não poderão ser recuperados.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setIsResettingGastos(true);
                            try { await resetGastosData(currentUser.uid); window.location.reload(); }
                            catch (e) { console.error(e); setIsResettingGastos(false); }
                          }}
                          disabled={isResettingGastos}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                        >
                          {isResettingGastos ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setShowResetGastosConfirm(false)}
                          disabled={isResettingGastos}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                            theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/10 border-white/10 text-slate-300'
                          }`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Patrimônio */}
                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'}`}>
                  <h4 className={`text-xs font-bold mb-1 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Construção de Patrimônio</h4>
                  <p className="text-[10px] text-slate-500 mb-3">Zera investimentos, metas e reserva de emergência.</p>
                  {!showResetPatrimonioConfirm ? (
                    <button
                      onClick={() => setShowResetPatrimonioConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 text-amber-600 text-xs font-semibold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" /> Zerar Patrimônio
                    </button>
                  ) : (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-semibold text-rose-500">Os dados não poderão ser recuperados.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setIsResettingPatrimonio(true);
                            try { await resetPatrimonioData(currentUser.uid); window.location.reload(); }
                            catch (e) { console.error(e); setIsResettingPatrimonio(false); }
                          }}
                          disabled={isResettingPatrimonio}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                        >
                          {isResettingPatrimonio ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setShowResetPatrimonioConfirm(false)}
                          disabled={isResettingPatrimonio}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                            theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/10 border-white/10 text-slate-300'
                          }`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8. Zona de Perigo */}
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'light' ? 'bg-white border-rose-100 shadow-sm' : 'bg-slate-900 border-rose-500/20'
        }`}>
          <button onClick={() => toggle('danger')} className={headerBtn}>
            <div className="flex items-center gap-3">
              <span className={`p-1.5 rounded-lg ${theme === 'light' ? 'bg-rose-50' : 'bg-rose-500/10'}`}>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </span>
              <span className={`text-sm font-bold ${theme === 'light' ? 'text-rose-600' : 'text-rose-400'}`}>Zona de Perigo</span>
            </div>
            <ChevronDown className={chevronCls('danger')} />
          </button>
          {open.danger && (
            <div className={`px-4 pb-4 pt-2 ${theme === 'light' ? 'border-t border-rose-100' : 'border-t border-rose-500/10'} animate-in fade-in duration-200`}>
              <p className="text-xs text-slate-500 mb-4 pt-1">
                Esta ação é irreversível. Todos os seus dados, transações e metas serão permanentemente apagados.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 text-xs font-semibold hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Apagar minha conta
                </button>
              ) : (
                <div className={`p-4 rounded-xl border animate-in fade-in zoom-in-95 duration-200 ${
                  theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <p className="text-xs font-semibold text-rose-500 mb-3">
                    Tem certeza absoluta? Isso apagará todas as suas transações, metas e dados da conta.
                  </p>
                  {deleteError && <p className="text-xs text-rose-400 mb-3">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsDeletingAccount(true);
                        setDeleteError('');
                        try { await deleteAccount(); }
                        catch (err) {
                          setDeleteError('Erro ao apagar conta. Tente fazer logout e login novamente.');
                          setIsDeletingAccount(false);
                        }
                      }}
                      disabled={isDeletingAccount}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                    >
                      {isDeletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      {isDeletingAccount ? 'Apagando...' : 'Sim, apagar tudo'}
                    </button>
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                        theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="text-center pt-2">
        <p className="text-[10px] text-slate-500">Alívia Finance • Feito com ❤️ para você</p>
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default SettingsTab;
