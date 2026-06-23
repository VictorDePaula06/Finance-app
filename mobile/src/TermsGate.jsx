import React, { useState } from 'react';
import { ShieldCheck, FileText, Globe, Mail, ArrowRight, LogOut } from 'lucide-react';
import { useStore } from './store.jsx';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_DATE } from './lib/terms.js';

const SITE_TERMS = 'https://soualivia.com.br/termos';

const Section = ({ icon: Icon, title, children }) => (
  <div>
    <h3 className="text-[14px] font-bold flex items-center gap-2 text-fg"><Icon className="w-4 h-4 text-pos" /> {title}</h3>
    <p className="text-[12.5px] text-fg/60 leading-relaxed mt-1">{children}</p>
  </div>
);

// Tela de aceite dos Termos (LGPD) — bloqueia o app até o usuário aceitar,
// igual ao site. Grava versão, data e hora do aceite.
export default function TermsGate() {
  const { acceptTerms, logout } = useStore();
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    setAccepting(true);
    try { await acceptTerms(); } catch (e) { console.error(e); setAccepting(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-fg/[0.06]">
        <span className="w-12 h-12 rounded-2xl bg-emerald-500/12 flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6 text-pos" /></span>
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight">Termos de Uso e Privacidade</h1>
          <p className="text-[11px] text-fg/45 font-semibold">Versão {CURRENT_TERMS_VERSION} · {CURRENT_TERMS_DATE}</p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 space-y-4">
        <Section icon={FileText} title="1. Aceitação dos Termos">Ao usar a Alívia, você concorda integralmente com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não utilize o serviço.</Section>
        <Section icon={FileText} title="2. Finalidade do Serviço">A Alívia é uma ferramenta de organização financeira pessoal. Os dados são inseridos por você e o app não substitui aconselhamento profissional. Decisões financeiras são de sua responsabilidade.</Section>
        <Section icon={FileText} title="3. Inteligência Artificial">A IA Alívia (Google Gemini) é opcional. As sugestões podem conter imprecisões — sempre revise antes de agir. O processamento só ocorre se você ativar e fornecer sua chave.</Section>
        <Section icon={FileText} title="4. Conta e Responsabilidades">Você é responsável pela veracidade dos dados e pela segurança da sua conta. Uso indevido resulta em suspensão.</Section>
        <Section icon={FileText} title="5. Planos e Pagamentos">O Plano Gratuito é permanente, com limites. Planos pagos são processados pela Stripe e podem ser cancelados a qualquer momento.</Section>
        <Section icon={Globe} title="6. Dados, Privacidade e LGPD">Tratamos seus dados conforme a Lei nº 13.709/2018 (LGPD). Você pode exercer todos os direitos do titular no app ou pelo e-mail do DPO.</Section>
        <Section icon={Mail} title="7. Contato">DPO: dpo.alivia@gmail.com · Suporte: suporte.soualivia@gmail.com</Section>

        <a href={SITE_TERMS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-pos">
          <Globe className="w-3.5 h-3.5" /> Ler os termos completos no site
        </a>
      </div>

      {/* Rodapé */}
      <div className="px-5 py-4 border-t border-fg/[0.06] bg-card/40" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <button onClick={accept} disabled={accepting} className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60">
          {accepting ? 'Salvando…' : `Li e Aceito (versão ${CURRENT_TERMS_VERSION})`}
          {!accepting && <ArrowRight className="w-4 h-4" />}
        </button>
        <p className="text-center text-[10px] text-fg/40 mt-3">Ao aceitar, registramos a versão, data e hora do aceite (LGPD art. 8º).</p>
        <button onClick={logout} className="w-full mt-2 py-2 text-[12px] text-fg/45 font-semibold flex items-center justify-center gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Não concordo — sair
        </button>
      </div>
    </div>
  );
}
