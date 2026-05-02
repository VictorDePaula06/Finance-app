import React, { useState } from 'react';
import { Settings, Shield, Moon, Sun, Key, Check, AlertCircle, Loader2, Video, HelpCircle, Sparkles, ChevronRight, Bookmark, X, CreditCard, Calculator, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { validateApiKey } from '../services/gemini';
import tutorialVideo from '../assets/tutorial-gemini-key.mp4';
import Manual from './Manual';

const SettingsTab = ({ manualConfig, updateManualConfig }) => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, deleteAccount, logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [apiKey, setApiKey] = useState(manualConfig.geminiKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null); // 'success' | 'error'
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

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Manual Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
          <div className={`relative w-full max-w-7xl h-[95vh] rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 ${
            theme === 'light' ? 'bg-white' : 'bg-slate-900'
          }`}>
            <button 
              onClick={() => setShowManualModal(false)}
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="h-full overflow-y-auto">
              <Manual manualConfig={manualConfig} updateManualConfig={updateManualConfig} />
            </div>
          </div>
        </div>
      )}



      {/* Left Column */}
      <div className="space-y-8">
        {/* Profile Section */}
        <section className={`p-8 rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Shield className="w-4 h-4" /> Perfil e Segurança
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-3xl font-black text-emerald-500">
              {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
            </div>
            <div>
              <p className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{currentUser?.displayName || 'Usuário Alívia'}</p>
              <p className="text-sm text-slate-500">{currentUser?.email}</p>
            </div>
          </div>
        </section>

        {/* AI Settings Section */}
        <section className={`p-8 rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
              <Key className="w-4 h-4" /> Inteligência Artificial
            </h3>
            <button 
              onClick={() => setShowVideo(!showVideo)}
              className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1 hover:underline"
            >
              <Video className="w-3 h-3" /> Ver Tutorial
            </button>
          </div>

          {showVideo && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-white/5 bg-black animate-in zoom-in duration-300">
               <video src={tutorialVideo} controls className="w-full h-auto" />
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              O Alívia utiliza o Google Gemini. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">Clique aqui para obter sua chave gratuita.</a>
            </p>
            <div className="flex gap-3">
              <input
                type="password"
                placeholder="Sua Gemini API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={`flex-1 p-4 rounded-2xl border transition-all ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={isValidating}
                className={`px-6 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${
                  validationStatus === 'success' 
                    ? 'bg-emerald-500 text-white' 
                    : (theme === 'light' ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-white text-slate-900 hover:bg-slate-100')
                }`}
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : (validationStatus === 'success' ? <Check className="w-4 h-4" /> : 'Salvar')}
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className={`p-8 rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Settings className="w-4 h-4" /> Aparência
          </h3>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-500/5 border border-white/5">
            <div>
              <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Tema Escuro</p>
              <p className="text-[10px] text-slate-500">Melhor para uso noturno</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-xl border transition-all ${
                theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-800 border-white/10 text-yellow-400'
              }`}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </section>
      </div>

      {/* Right Column */}
      <div className="space-y-8">
        {/* Help & Manual */}
        <section className={`p-8 rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
            <HelpCircle className="w-4 h-4" /> Central de Ajuda
          </h3>
          <div className="space-y-3">
             <button 
              onClick={() => setShowManualModal(true)}
              className={`w-full p-4 rounded-2xl border flex items-center justify-between group transition-all ${
               theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-emerald-50' : 'bg-white/5 border-white/5 hover:bg-white/10'
             }`}>
                <div className="flex items-center gap-3">
                  <Bookmark className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Manual do Usuário</span>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
             <button 
              onClick={() => setShowVideo(true)}
              className={`w-full p-4 rounded-2xl border flex items-center justify-between group transition-all ${
               theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-blue-50' : 'bg-white/5 border-white/5 hover:bg-white/10'
             }`}>
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Tutorial de Início</span>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
             <button 
              onClick={() => {
                setShowManualModal(true);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('manual-section', { detail: 'billing' }));
                }, 100);
              }}
              className={`w-full p-4 rounded-2xl border flex items-center justify-between group transition-all ${
               theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-purple-50' : 'bg-white/5 border-white/5 hover:bg-white/10'
             }`}>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-black uppercase tracking-widest">Assinatura e Faturamento</span>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </section>

        {/* Novidades */}
        <section className={`p-8 rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <h3 className={`text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Sparkles className="w-4 h-4 text-yellow-500" /> Novidades
          </h3>
          <div className="space-y-6">
            {changelog.map((entry, idx) => (
              <div key={idx} className="relative pl-6 border-l-2 border-emerald-500/20">
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"></div>
                <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">{entry.version}</p>
                <p className={`text-sm font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{entry.title}</p>
                <ul className="space-y-1">
                  {entry.items.map((item, i) => (
                    <li key={i} className="text-[10px] text-slate-500 flex items-center gap-2">
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Danger Zone */}
      <div className="col-span-full">
        <section className={`p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-rose-100 shadow-sm' : 'bg-slate-900 border-rose-500/20'}`}>
          <h3 className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2 text-rose-500">
            <AlertTriangle className="w-4 h-4" /> Zona de Perigo
          </h3>
          <p className="text-xs text-slate-500 mb-6">Esta ação é irreversível. Todos os seus dados, transações e metas serão permanentemente apagados.</p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-rose-500/30 text-rose-500 text-xs font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
            >
              <Trash2 className="w-4 h-4" /> Apagar minha conta
            </button>
          ) : (
            <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/30'}`}>
              <p className="text-sm font-black text-rose-500 mb-4">Tem certeza absoluta? Isso apagará todas as suas transações, metas e dados da conta.</p>
              {deleteError && <p className="text-xs text-rose-400 mb-3">{deleteError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setIsDeletingAccount(true);
                    setDeleteError('');
                    try {
                      await deleteAccount();
                    } catch (err) {
                      setDeleteError('Erro ao apagar conta. Tente fazer logout e login novamente.');
                      setIsDeletingAccount(false);
                    }
                  }}
                  disabled={isDeletingAccount}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-60"
                >
                  {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeletingAccount ? 'Apagando...' : 'Sim, apagar tudo'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                  className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="col-span-full text-center">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alívia Finance • Feito com ❤️ para você</p>
      </div>
    </div>
  );
};

export default SettingsTab;
