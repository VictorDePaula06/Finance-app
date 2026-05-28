import React from 'react';
import { ShieldCheck, ArrowRight, FileText, Mail, Globe } from 'lucide-react';

// Versão atual dos termos — bumpada quando houver mudança material que
// exige novo aceite dos usuários antigos.
export const CURRENT_TERMS_VERSION = '2.0';
export const CURRENT_TERMS_DATE = '28 de maio de 2026';

export default function TermsAcceptanceModal({ onAccept, theme, isAccepting }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden ${
        theme === 'light' ? 'bg-white' : 'bg-slate-900'
      }`}>

        {/* Header */}
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
                Versão {CURRENT_TERMS_VERSION} · {CURRENT_TERMS_DATE}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-sm">
          <div className={`prose prose-sm max-w-none ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>

            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 1. Aceitação dos Termos
            </h3>
            <p>Ao usar a Alívia, você concorda integralmente com estes Termos de Uso e com nossa Política de Privacidade. Se não concordar, não utilize o serviço.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 2. Finalidade do Serviço
            </h3>
            <p>A Alívia é uma <strong>ferramenta de organização financeira pessoal</strong>. Os dados financeiros são inseridos manualmente por você. O app <strong>não substitui</strong> aconselhamento profissional especializado (contador, planejador financeiro, advogado tributário). Decisões financeiras tomadas com base no app são de sua inteira responsabilidade.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 3. Inteligência Artificial
            </h3>
            <p>A IA Alívia (Google Gemini) é um recurso <strong>opcional</strong> do plano Premium. Suas sugestões podem conter imprecisões. Sempre revise antes de agir. O processamento por IA só ocorre se você ativar e fornecer sua chave de API pessoal.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 4. Conta e Responsabilidades
            </h3>
            <p>Você é responsável pela veracidade dos dados inseridos e por manter a segurança da sua conta. O uso indevido (fraude, abuso, automação não autorizada) resulta em suspensão imediata.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <FileText className="w-4 h-4 text-emerald-500" /> 5. Planos e Pagamentos
            </h3>
            <p>Plano Gratuito é permanente, com limites de uso. Planos pagos (Standard e Premium) são processados pela Stripe. Você pode cancelar a qualquer momento — o acesso permanece até o fim do período já pago.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <Globe className="w-4 h-4 text-emerald-500" /> 6. Dados, Privacidade e LGPD
            </h3>
            <p>Tratamos seus dados pessoais conforme a <strong>Lei nº 13.709/2018 (LGPD)</strong>. Você pode exercer todos os direitos do titular (acesso, correção, eliminação, portabilidade) diretamente no app ou pelo e-mail do DPO. Detalhes completos em nossa Política de Privacidade.</p>

            <h3 className={`text-base font-bold flex items-center gap-2 mt-5 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              <Mail className="w-4 h-4 text-emerald-500" /> 7. Contato e Reclamações
            </h3>
            <p>Encarregado de Dados (DPO): <a href="mailto:dpo.alivia@gmail.com" className="text-emerald-500 underline">dpo.alivia@gmail.com</a><br/>Suporte geral: <a href="mailto:suporte.soualivia@gmail.com" className="text-emerald-500 underline">suporte.soualivia@gmail.com</a></p>
          </div>
        </div>

        {/* Footer */}
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
            {isAccepting ? 'Salvando...' : `Li e Aceito (versão ${CURRENT_TERMS_VERSION})`}
            {!isAccepting && <ArrowRight className="w-4 h-4" />}
          </button>
          <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-4 font-medium">
            Ao aceitar, registramos versão dos termos, data e hora do aceite (LGPD art. 8º).
          </p>
        </div>
      </div>
    </div>
  );
}
