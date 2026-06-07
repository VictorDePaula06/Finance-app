import React, { useState } from 'react';
import {
  Settings, Shield, Moon, Sun, Key, Check, Loader2, Video,
  HelpCircle, Sparkles, Bookmark, X, CreditCard,
  Trash2, AlertTriangle, RefreshCw, Pencil, Download, FileText, Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { validateApiKey } from '../services/gemini';
import { createPortalSession } from '../services/stripe';
import AliviaSettings from './AliviaSettings';
import { downloadUserData } from '../utils/dataExport';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';
import Manual from './Manual';
import UpgradeModal from './UpgradeModal';
import { Sparkles as SparklesIcon } from 'lucide-react';

const SettingsTab = ({ manualConfig, updateManualConfig }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, deleteAccount, planLevel, subType, resetGastosData, resetPatrimonioData, stripeSubId } = useAuth();

  // Assinatura paga (Stripe) — habilita gerenciar/cancelar.
  const isPaidPlan = planLevel === 'standard' || planLevel === 'premium';
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const openBillingPortal = async (cancel = false) => {
    if (isOpeningPortal) return;
    setIsOpeningPortal(true);
    await createPortalSession({
      subscriptionId: stripeSubId,
      cancel,
      onFinish: () => setIsOpeningPortal(false),
    });
  };

  const [activeSection, setActiveSection] = useState('alivia');

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showResetGastosConfirm, setShowResetGastosConfirm] = useState(false);
  const [isResettingGastos, setIsResettingGastos] = useState(false);
  const [showResetPatrimonioConfirm, setShowResetPatrimonioConfirm] = useState(false);
  const [isResettingPatrimonio, setIsResettingPatrimonio] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // LGPD art. 18 V — portabilidade de dados
  const handleExportData = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      await downloadUserData(currentUser);
    } catch (err) {
      setExportError(err?.message || 'Erro ao exportar dados.');
    } finally {
      setIsExporting(false);
    }
  };

  // AI key states
  const [apiKey, setApiKey] = useState(manualConfig.geminiKey || '');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setIsValidating(true);
    setValidationStatus(null);
    const isValid = await validateApiKey(apiKey.trim());
    setIsValidating(false);
    if (isValid) {
      updateManualConfig({ ...manualConfig, geminiKey: apiKey.trim() });
      setValidationStatus('success');
      setIsEditingKey(false);
      setTimeout(() => setValidationStatus(null), 3000);
    } else {
      setValidationStatus('error');
    }
  };

  const handleDeleteApiKey = () => {
    updateManualConfig({ ...manualConfig, geminiKey: '' });
    setApiKey('');
    setIsEditingKey(false);
    setValidationStatus(null);
  };

  const handleCancelEdit = () => {
    setApiKey(manualConfig.geminiKey || '');
    setIsEditingKey(false);
    setValidationStatus(null);
  };

  const changelog = [
    { version: '8.7.x', title: 'Ajustes Reformulados', items: ['Layout duas colunas', 'Navegação lateral', 'Seções separadas por contexto'] },
    { version: '8.6.x', title: 'Painel Administrativo', items: ['Dashboard de usuários', 'Controle de planos e permissões', 'Correções de bugs no Firestore'] },
    { version: '6.7.0', title: 'Gestão de Cartões', items: ['Aba de cartões dedicada', 'Vínculo de assinaturas a cartões', 'Dashboard enriquecido'] },
  ];

  // ── Shared style helpers ──
  const isDark = theme !== 'light';

  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
  }`;

  const rowCard = `flex items-center justify-between px-4 py-3 rounded-xl border ${
    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
  }`;

  // ── Nav items definition ──
  const navItems = [
    { id: 'alivia',       label: 'Configurar Alívia',        icon: Sparkles,      iconColor: 'text-emerald-400', activeColor: 'emerald' },
    { id: 'profile',      label: 'Perfil e Segurança',      icon: Shield,        iconColor: 'text-emerald-500', activeColor: 'emerald' },
    { id: 'subscription', label: 'Sua Assinatura',           icon: CreditCard,    iconColor: 'text-blue-400',    activeColor: 'emerald' },
    { id: 'ai',           label: 'Inteligência Artificial',  icon: Key,           iconColor: 'text-violet-400',  activeColor: 'emerald' },
    { id: 'appearance',   label: 'Aparência',                icon: Settings,      iconColor: 'text-slate-400',   activeColor: 'emerald' },
    { id: 'help',         label: 'Central de Ajuda',         icon: HelpCircle,    iconColor: 'text-amber-400',   activeColor: 'emerald' },
    { id: 'changelog',    label: 'Novidades',                icon: Sparkles,      iconColor: 'text-yellow-400',  activeColor: 'emerald' },
    { id: 'divider' },
    { id: 'reset',        label: 'Zerar Módulos',            icon: RefreshCw,     iconColor: 'text-amber-500',   activeColor: 'amber'   },
    { id: 'danger',       label: 'Zona de Perigo',           icon: AlertTriangle, iconColor: 'text-rose-500',    activeColor: 'rose'    },
  ];

  // ── Section title helper ──
  const SectionTitle = ({ icon: Icon, label, iconColor, badge }) => (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
      <span className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</h3>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  // ── Section content renderers ──

  const renderProfile = () => (
    <div className="animate-in fade-in duration-200 space-y-4">
      <SectionTitle icon={Shield} label="Perfil e Segurança" iconColor="text-emerald-500" />

      {/* Identidade */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl font-black text-emerald-500 shrink-0">
          {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {currentUser?.displayName || 'Usuário Alívia'}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{currentUser?.email}</p>
          <p className={`text-[10px] mt-1.5 font-bold capitalize px-2 py-0.5 rounded-full inline-block ${
            planLevel === 'lifetime' ? 'bg-purple-500/10 text-purple-400'
            : planLevel === 'premium' ? 'bg-emerald-500/10 text-emerald-400'
            : planLevel === 'standard' ? 'bg-blue-500/10 text-blue-400'
            : 'bg-slate-500/10 text-slate-400'
          }`}>
            {planLevel === 'lifetime' ? 'Vitalício' : planLevel === 'premium' ? 'Premium' : planLevel === 'standard' ? 'Standard' : 'Gratuito'}
          </p>
        </div>
      </div>

      {/* Seção LGPD — Direitos do Titular */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/50 border-blue-100'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-blue-500" />
          <h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            Seus Direitos (LGPD)
          </h4>
        </div>
        <p className={`text-[11px] leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Você tem direito de acessar, corrigir, exportar e excluir seus dados a qualquer momento (Lei 13.709/2018, art. 18).
        </p>

        {/* Baixar Meus Dados */}
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className={`w-full px-4 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border mb-2 ${
            isDark
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50'
              : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50'
          }`}
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? 'Preparando arquivo...' : 'Baixar Meus Dados (JSON)'}
        </button>
        {exportError && (
          <p className="text-[10px] text-rose-500 mb-2 ml-1">{exportError}</p>
        )}

        {/* Ver política */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'privacy' }))}
          className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 border ${
            isDark
              ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Ver Política de Privacidade
        </button>

        {/* Contato DPO */}
        <a
          href="mailto:dpo.alivia@gmail.com?subject=LGPD%20-%20Solicitação%20de%20Titular"
          className={`w-full px-4 py-2.5 mt-2 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 border ${
            isDark
              ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Falar com o DPO
        </a>
      </div>
    </div>
  );

  const renderSubscription = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle
        icon={CreditCard}
        label="Sua Assinatura"
        iconColor="text-blue-400"
        badge={planLevel === 'lifetime' ? 'Vitalício' : planLevel === 'premium' ? 'Premium' : planLevel === 'standard' ? 'Standard' : undefined}
      />
      <div className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 mb-4 ${
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
          <h4 className={`text-base font-black capitalize truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {planLevel === 'lifetime' ? 'Premium' : planLevel}{' '}
            <span className="text-xs opacity-50 font-medium">
              ({planLevel === 'lifetime' ? 'Vitalício' : subType === 'annual' ? 'Anual' : 'Mensal'})
            </span>
          </h4>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {(planLevel === 'standard' || planLevel === 'free') && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5"
            >
              <SparklesIcon className="w-3.5 h-3.5" /> {planLevel === 'free' ? 'Assinar' : 'Upgrade'}
            </button>
          )}
          {isPaidPlan && (
            <button
              onClick={() => openBillingPortal(false)}
              disabled={isOpeningPortal}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border disabled:opacity-50 ${
                isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {isOpeningPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />} Gerenciar
            </button>
          )}
        </div>
      </div>

      {/* Cancelar assinatura — apenas para planos pagos (Standard/Premium) */}
      {isPaidPlan && (
        <button
          onClick={() => setShowCancelConfirm(true)}
          disabled={isOpeningPortal}
          className={`w-full mb-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border disabled:opacity-50 ${
            isDark ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-rose-200 text-rose-500 hover:bg-rose-50'
          }`}
        >
          <X className="w-3.5 h-3.5" /> Cancelar assinatura
        </button>
      )}

      <p className="text-[10px] text-slate-500 leading-relaxed text-center italic">
        Gerencie seu plano, faturas e cancelamentos pelo portal seguro do Stripe.
      </p>

      {/* Confirmação de cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowCancelConfirm(false)}>
          <div
            className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-900 border-slate-700/50' : 'bg-white border-slate-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className={`text-lg font-black text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Cancelar assinatura?</h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Você será levado ao portal seguro do Stripe para confirmar o cancelamento. Seu acesso continua até o fim do período já pago.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Voltar
              </button>
              <button
                onClick={() => { setShowCancelConfirm(false); openBillingPortal(true); }}
                disabled={isOpeningPortal}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isOpeningPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAI = () => {
    const keyIsConfigured = !!manualConfig.geminiKey && !isEditingKey;

    return (
      <div className="animate-in fade-in duration-200">
        <SectionTitle icon={Key} label="Inteligência Artificial" iconColor="text-violet-400" />
        <div className="space-y-4">

          {keyIsConfigured ? (
            /* ── Configured state ── */
            <div>
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-500">Chave API configurada</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    {manualConfig.geminiKey.slice(0, 8)}{'•'.repeat(16)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setApiKey(manualConfig.geminiKey); setIsEditingKey(true); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={handleDeleteApiKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed text-center italic">
                Sua Alívia está ativa e pronta para te ajudar com análises financeiras. 🍃
              </p>
            </div>
          ) : (
            /* ── Input state (new or editing) ── */
            <div className="space-y-3">
              {isEditingKey && (
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-500">Editando chave</p>
                  <button
                    onClick={handleCancelEdit}
                    className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  O Alívia utiliza o Google Gemini.{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                    Obtenha sua chave gratuita aqui.
                  </a>
                </p>
                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className="shrink-0 text-[10px] font-semibold text-blue-500 flex items-center gap-1 hover:underline"
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
                  placeholder="Cole sua Gemini API Key (AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={inp}
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={isValidating || !apiKey.trim()}
                  className={`shrink-0 px-4 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 disabled:opacity-50 ${
                    isDark
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </button>
              </div>

              {validationStatus === 'error' && (
                <p className="text-xs text-rose-500 font-medium">Chave inválida. Verifique e tente novamente.</p>
              )}
            </div>
          )}

        </div>
      </div>
    );
  };

  const renderAppearance = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={Settings} label="Aparência" iconColor="text-slate-400" />
      <div className={rowCard}>
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>Tema Escuro</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Melhor para uso noturno e conforto visual</p>
        </div>
        <button
          onClick={toggleTheme}
          className={`p-2.5 rounded-xl border transition-all ${
            isDark
              ? 'bg-slate-800 border-white/10 text-yellow-400 hover:bg-slate-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  const renderHelp = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={HelpCircle} label="Central de Ajuda" iconColor="text-amber-400" />
      <div className="space-y-2">
        <button
          onClick={() => setShowManualModal(true)}
          className={`w-full px-4 py-3.5 rounded-xl border flex items-center justify-between group transition-all ${
            isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-emerald-50 hover:border-emerald-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <Bookmark className="w-4 h-4 text-emerald-500" />
            <div className="text-left">
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Manual do Usuário</p>
              <p className="text-[10px] text-slate-500">Guia completo de uso do Alívia</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Abrir →</span>
        </button>

        <button
          onClick={() => { setActiveSection('ai'); setShowVideo(true); }}
          className={`w-full px-4 py-3.5 rounded-xl border flex items-center justify-between group transition-all ${
            isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-blue-50 hover:border-blue-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <Video className="w-4 h-4 text-blue-500" />
            <div className="text-left">
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Tutorial de Início</p>
              <p className="text-[10px] text-slate-500">Como configurar sua chave de IA</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Abrir →</span>
        </button>

        <button
          onClick={() => {
            setShowManualModal(true);
            setTimeout(() => window.dispatchEvent(new CustomEvent('manual-section', { detail: 'billing' })), 100);
          }}
          className={`w-full px-4 py-3.5 rounded-xl border flex items-center justify-between group transition-all ${
            isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-purple-50 hover:border-purple-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-purple-500" />
            <div className="text-left">
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Assinatura e Faturamento</p>
              <p className="text-[10px] text-slate-500">Dúvidas sobre seu plano e cobrança</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Abrir →</span>
        </button>
      </div>
    </div>
  );

  const renderChangelog = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={Sparkles} label="Novidades" iconColor="text-yellow-400" />
      <div className="space-y-5">
        {changelog.map((entry, idx) => (
          <div key={idx} className="relative pl-5 border-l-2 border-emerald-500/20">
            <div className="absolute left-[-7px] top-0.5 w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40" />
            <p className="text-[10px] font-black text-emerald-500 uppercase mb-0.5">{entry.version}</p>
            <p className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{entry.title}</p>
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
    </div>
  );

  const renderReset = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={RefreshCw} label="Zerar Módulos" iconColor="text-amber-500" />
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
        Apague os dados de um módulo específico e refaça a configuração inicial. Essa ação não pode ser desfeita.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50/50 border-amber-200'}`}>
          <h4 className={`text-xs font-bold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Controle de Gastos</h4>
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
                    isDark ? 'bg-white/10 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50/50 border-amber-200'}`}>
          <h4 className={`text-xs font-bold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Construção de Patrimônio</h4>
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
                    isDark ? 'bg-white/10 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
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
  );

  const renderDanger = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={AlertTriangle} label="Zona de Perigo" iconColor="text-rose-500" />
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
        Esta ação é irreversível. Todos os seus dados, transações e metas serão permanentemente apagados da plataforma.
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
          isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'
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
                isDark ? 'bg-white/10 border-white/10 text-slate-300 hover:bg-white/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderAlivia = () => (
    <div className="animate-in fade-in duration-200">
      <SectionTitle icon={Sparkles} label="Configurar Alívia" iconColor="text-emerald-400" />
      <AliviaSettings config={manualConfig} onSave={updateManualConfig} />
    </div>
  );

  const sectionMap = {
    alivia:       renderAlivia,
    profile:      renderProfile,
    subscription: renderSubscription,
    ai:           renderAI,
    appearance:   renderAppearance,
    help:         renderHelp,
    changelog:    renderChangelog,
    reset:        renderReset,
    danger:       renderDanger,
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* Manual Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
          <div className={`relative w-full max-w-7xl h-[95vh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}>
            <button
              onClick={() => setShowManualModal(false)}
              className={`absolute top-4 right-4 z-10 p-2 rounded-xl transition-colors ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
              }`}
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
      <div className="mb-5">
        <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Ajustes</h2>
        <p className="text-xs text-slate-500 mt-0.5">Personalize sua experiência e gerencie sua conta</p>
      </div>

      {/* ── Two-column layout (empilha no mobile) ── */}
      <div className={`flex flex-col md:flex-row rounded-2xl border overflow-hidden md:min-h-[540px] ${
        isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'
      }`}>

        {/* ── Left Nav Sidebar ── */}
        <aside className={`w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r flex flex-col ${
          isDark ? 'border-white/[0.06] bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'
        }`}>
          <div className="p-3 pt-5">
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-2 ${
              isDark ? 'text-slate-600' : 'text-slate-400'
            }`}>Configurações</p>

            <nav className="space-y-0.5">
              {navItems.map((item, idx) => {
                if (item.id === 'divider') {
                  return (
                    <div
                      key={`div-${idx}`}
                      className={`my-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}
                    />
                  );
                }

                const Icon = item.icon;
                const isActive = activeSection === item.id;

                const activeCls = isActive
                  ? item.activeColor === 'rose'
                    ? isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600'
                    : item.activeColor === 'amber'
                      ? isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                      : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  : isDark
                    ? 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800';

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${activeCls}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? '' : item.iconColor}`} />
                    <span className="text-xs font-bold truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <p className={`text-[10px] text-center ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
              Alívia Finance
            </p>
          </div>
        </aside>

        {/* ── Right Content Panel ── */}
        <div className="flex-1 p-6 overflow-y-auto">
          {sectionMap[activeSection]?.()}
        </div>

      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default SettingsTab;
