import React, { useState } from 'react';
import { Settings, Shield, Moon, Sun, Key, Check, Loader2, Video, HelpCircle, Sparkles, ChevronRight, Bookmark, X, CreditCard, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
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

  const card = `p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`;
  const sectionLabel = `text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-4 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`;
  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
    theme === 'light' ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
  }`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

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
        <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Ajustes</h2>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Personalize sua experiência e gerencie sua conta</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Profile */}
          <section className={card}>
            <h3 className={sectionLabel}><Shield className="w-4 h-4" /> Perfil e Segurança</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl font-black text-emerald-500 shrink-0">
                {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className={`text-base font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  {currentUser?.displayName || 'Usuário Alívia'}
                </p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
              </div>
            </div>
          </section>

          {/* Subscription */}
          <section className={card}>
            <h3 className={sectionLabel}><CreditCard className="w-4 h-4" /> Sua Assinatura</h3>
            <div className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${
              planLevel === 'lifetime' ? 'border-purple-500 bg-purple-500/5'
              : planLevel === 'premium'  ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-blue-500 bg-blue-500/5'
            }`}>
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest ${
                  planLevel === 'lifetime' ? 'text-purple-500'
                  : planLevel === 'premium' ? 'text-emerald-500'
                  : 'text-blue-500'
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
            <p className="mt-4 text-[10px] text-slate-500 leading-relaxed text-center italic">
              Gerencie seu plano, faturas e cancelamentos através do seu e-mail ou fale com nosso suporte.
            </p>
          </section>

          {/* AI Settings */}
          <section className={card}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                <Key className="w-4 h-4" /> Inteligência Artificial
              </h3>
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="text-[10px] font-semibold text-blue-500 flex items-center gap-1 hover:underline"
              >
                <Video className="w-3 h-3" /> Ver Tutorial
              </button>
            </div>
            {showVideo && (
              <div className="mb-4 rounded-xl overflow-hidden border border-white/5 bg-black animate-in zoom-in duration-300">
                <video src={tutorialVideo} controls className="w-full h-auto" />
              </div>
            )}
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                O Alívia utiliza o Google Gemini.{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                  Clique aqui para obter sua chave gratuita.
                </a>
              </p>
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
          </section>

          {/* Appearance */}
          <section className={card}>
            <h3 className={sectionLabel}><Settings className="w-4 h-4" /> Aparência</h3>
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
          </section>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Help Center */}
          <section className={card}>
            <h3 className={sectionLabel}><HelpCircle className="w-4 h-4" /> Central de Ajuda</h3>
            <div className="space-y-2">
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
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setShowVideo(true)}
                className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between group transition-all ${
                  theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-blue-50 hover:border-blue-100' : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-blue-500" />
                  <span className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Tutorial de Início</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </section>

          {/* Changelog */}
          <section className={card}>
            <h3 className={sectionLabel}><Sparkles className="w-4 h-4 text-yellow-500" /> Novidades</h3>
            <div className="space-y-5">
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
          </section>
        </div>

        {/* ── FULL WIDTH: Reset Modules ── */}
        <div className="col-span-full">
          <section className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-900 border-amber-500/20'}`}>
            <h3 className="text-xs font-black uppercase tracking-widest mb-1.5 flex items-center gap-2 text-amber-500">
              <RefreshCw className="w-4 h-4" /> Zerar Módulos
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Apague os dados de um módulo específico e refaça a configuração inicial. Essa ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Gastos Reset */}
              <div className={`p-5 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'}`}>
                <h4 className={`text-sm font-bold mb-1.5 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Controle de Gastos</h4>
                <p className="text-xs text-slate-500 mb-4">Zera transações, cartões, despesas fixas e assinaturas.</p>
                {!showResetGastosConfirm ? (
                  <button
                    onClick={() => setShowResetGastosConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 text-amber-600 text-xs font-semibold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Zerar Gastos
                  </button>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs font-semibold text-rose-500">Tem certeza? Os dados não poderão ser recuperados.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setIsResettingGastos(true);
                          try { await resetGastosData(currentUser.uid); window.location.reload(); }
                          catch (e) { console.error(e); setIsResettingGastos(false); }
                        }}
                        disabled={isResettingGastos}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                      >
                        {isResettingGastos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setShowResetGastosConfirm(false)}
                        disabled={isResettingGastos}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                          theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Patrimônio Reset */}
              <div className={`p-5 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-500/5 border-amber-500/30'}`}>
                <h4 className={`text-sm font-bold mb-1.5 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Construção de Patrimônio</h4>
                <p className="text-xs text-slate-500 mb-4">Zera investimentos, metas e reserva de emergência.</p>
                {!showResetPatrimonioConfirm ? (
                  <button
                    onClick={() => setShowResetPatrimonioConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 text-amber-600 text-xs font-semibold hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Zerar Patrimônio
                  </button>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs font-semibold text-rose-500">Tem certeza? Os dados não poderão ser recuperados.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setIsResettingPatrimonio(true);
                          try { await resetPatrimonioData(currentUser.uid); window.location.reload(); }
                          catch (e) { console.error(e); setIsResettingPatrimonio(false); }
                        }}
                        disabled={isResettingPatrimonio}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                      >
                        {isResettingPatrimonio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setShowResetPatrimonioConfirm(false)}
                        disabled={isResettingPatrimonio}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                          theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ── FULL WIDTH: Danger Zone ── */}
        <div className="col-span-full">
          <section className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-rose-100 shadow-sm' : 'bg-slate-900 border-rose-500/20'}`}>
            <h3 className="text-xs font-black uppercase tracking-widest mb-1.5 flex items-center gap-2 text-rose-500">
              <AlertTriangle className="w-4 h-4" /> Zona de Perigo
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Esta ação é irreversível. Todos os seus dados, transações e metas serão permanentemente apagados.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 text-xs font-semibold hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Apagar minha conta
              </button>
            ) : (
              <div className={`p-5 rounded-xl border animate-in fade-in zoom-in-95 duration-200 ${
                theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/30'
              }`}>
                <p className="text-sm font-semibold text-rose-500 mb-4">
                  Tem certeza absoluta? Isso apagará todas as suas transações, metas e dados da conta.
                </p>
                {deleteError && <p className="text-xs text-rose-400 mb-3">{deleteError}</p>}
                <div className="flex gap-3">
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all disabled:opacity-60"
                  >
                    {isDeletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {isDeletingAccount ? 'Apagando...' : 'Sim, apagar tudo'}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="col-span-full text-center pt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alívia Finance • Feito com ❤️ para você</p>
        </div>

      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default SettingsTab;
