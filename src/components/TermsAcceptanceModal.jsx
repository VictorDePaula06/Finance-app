import React from 'react';
import { ShieldCheck, ArrowRight, FileText } from 'lucide-react';

export default function TermsAcceptanceModal({ onAccept, theme, isAccepting }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden ${
        theme === 'light' ? 'bg-white' : 'bg-slate-900'
      }`}>
        <div className={`p-6 sm:p-8 border-b flex-shrink-0 ${theme === 'light' ? 'border-slate-100' : 'border-white/10'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 sm:p-4 bg-emerald-500/10 rounded-2xl">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                Termos de Uso e Privacidade
              </h2>
              <p className={`text-xs sm:text-sm font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Por favor, leia e aceite para continuar
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 text-sm">
          <div className={`prose prose-sm max-w-none ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 1. Aceitação
            </h3>
            <p>Ao acessar a Alívia, você concorda com nossos termos. A Alívia é uma ferramenta de gestão financeira e não substitui aconselhamento profissional especializado.</p>
            
            <h3 className={`text-lg font-bold flex items-center gap-2 mt-6 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 2. Inteligência Artificial (IA)
            </h3>
            <p>Nossas sugestões via IA podem conter imprecisões. Toda e qualquer decisão financeira tomada com base nas sugestões do app é de sua inteira responsabilidade.</p>
            
            <h3 className={`text-lg font-bold flex items-center gap-2 mt-6 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 3. Dados e Privacidade
            </h3>
            <p>Seus dados são armazenados de forma segura e utilizados estritamente para o funcionamento do app e geração de insights personalizados. O uso indevido do sistema resultará no banimento imediato da plataforma.</p>
          </div>
        </div>

        <div className={`p-6 sm:p-8 border-t flex-shrink-0 ${theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className={`w-full py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              isAccepting 
                ? 'bg-emerald-500/50 text-white cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
            }`}
          >
            {isAccepting ? 'Salvando...' : 'Li e Aceito os Termos'}
            {!isAccepting && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-4 font-medium">
            Ao clicar em aceitar, você concorda legalmente com nossas políticas.
          </p>
        </div>
      </div>
    </div>
  );
}
