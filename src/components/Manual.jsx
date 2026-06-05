import React, { useState, useEffect } from 'react';
import {
  BookOpen, ArrowLeft, Target, TrendingUp, Wallet, ShieldCheck,
  MessageSquare, CreditCard, Sparkles, Key, Home, BarChart3,
  PiggyBank, Landmark, Check, ArrowUpCircle, TrendingDown,
  AlertTriangle, Zap, Info
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { createPortalSession } from '../services/stripe';
import { Loader2 } from 'lucide-react';

export default function Manual({ onBack, manualConfig, updateManualConfig }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [activeSection, setActiveSection] = useState('intro');

  useEffect(() => {
    const handler = (e) => { if (e.detail) setActiveSection(e.detail); };
    window.addEventListener('manual-section', handler);
    return () => window.removeEventListener('manual-section', handler);
  }, []);

  // ── Nav sections ──
  const sections = [
    { id: 'intro',      label: 'Início',                icon: BookOpen      },
    { id: 'gastos',     label: 'Controle de Gastos',    icon: Wallet        },
    { id: 'patrimonio', label: 'Patrimônio',             icon: Landmark      },
    { id: 'alivia',     label: 'Sua Alívia (IA)',        icon: Sparkles      },
    { id: 'billing',    label: 'Assinatura',             icon: CreditCard    },
  ];

  // ── Style helpers ──
  const card = `p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`;
  const cardTitle = `text-xs font-black mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`;
  const cardText = `text-[11px] text-slate-500 leading-relaxed`;
  const sectionTitle = `text-lg font-black mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`;
  const sectionSub = `text-xs text-slate-500 mb-5 leading-relaxed`;
  const highlight = `p-4 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`;

  const Tag = ({ label, color = 'emerald' }) => {
    const colors = {
      emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
      blue:    isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'          : 'bg-blue-50 text-blue-600 border-blue-100',
      violet:  isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'    : 'bg-violet-50 text-violet-600 border-violet-100',
      amber:   isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'       : 'bg-amber-50 text-amber-600 border-amber-100',
    };
    return (
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${colors[color] || colors.emerald}`}>
        {label}
      </span>
    );
  };

  // ── Section content ──
  const renderIntro = () => (
    <div className="animate-in fade-in duration-200 space-y-5">
      <div>
        <h2 className={sectionTitle}>Bem-vindo ao Alívia 🍃</h2>
        <p className={sectionSub}>
          O Alívia é sua plataforma de inteligência financeira pessoal. Dois módulos principais,
          uma IA dedicada e tudo que você precisa para tomar decisões com clareza.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <p className={cardTitle}>Controle de Gastos</p>
          </div>
          <p className={cardText}>Registre receitas, despesas fixas, lançamentos diários e gerencie seus cartões em um só lugar.</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-4 h-4 text-emerald-400" />
            <p className={cardTitle}>Construção de Patrimônio</p>
          </div>
          <p className={cardText}>Acompanhe investimentos, metas, reserva de emergência e veja sua evolução patrimonial ao longo do tempo.</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <p className={cardTitle}>Sua Alívia (IA)</p>
          </div>
          <p className={cardText}>Assistente financeira com IA real (Google Gemini) que analisa seus dados e responde perguntas em linguagem natural.</p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <p className={cardTitle}>Saúde Financeira</p>
          </div>
          <p className={cardText}>Score de 0 a 100 baseado na regra 50/30/20, sua reserva de emergência e performance mensal.</p>
        </div>
      </div>

      <div className={highlight}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-bold text-emerald-500">Dica de início:</span> Configure sua renda mensal e despesas fixas em{' '}
            <strong>Ajustes → Inteligência Artificial</strong> para que o score e a Alívia funcionem com precisão.
          </p>
        </div>
      </div>
    </div>
  );

  const renderGastos = () => (
    <div className="animate-in fade-in duration-200 space-y-5">
      <div>
        <h2 className={sectionTitle}>Controle de Gastos</h2>
        <p className={sectionSub}>Módulo completo para gerenciar entradas, saídas fixas e variáveis do dia a dia.</p>
      </div>

      <div className="space-y-3">

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
            <p className={cardTitle}>Recebimentos</p>
            <Tag label="Entradas" color="emerald" />
          </div>
          <p className={cardText}>Registre salários, freelances e outras fontes de renda. Use a categoria <strong>Saldo Inicial</strong> uma única vez para calibrar o saldo com o seu banco.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-blue-400" />
            <p className={cardTitle}>Contas Fixas</p>
            <Tag label="Recorrente" color="blue" />
          </div>
          <p className={cardText}>Cadastre aluguel, internet, planos e contas que se repetem todo mês. Marque como paga direto na lista sem precisar lançar manualmente.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <p className={cardTitle}>Lançamentos</p>
            <Tag label="Gastos" color="amber" />
          </div>
          <p className={cardText}>Registre despesas do dia a dia por categoria (Alimentação, Transporte, Lazer etc.). Suporte a parcelamento, recorrência e pagamento por cartão.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-violet-400" />
            <p className={cardTitle}>Cartões</p>
            <Tag label="Fatura" color="violet" />
          </div>
          <p className={cardText}>Gerencie faturas de cartões. Vincule assinaturas (Netflix, Spotify) ao cartão — elas entram na base de gastos sem criar linhas repetitivas no extrato.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <p className={cardTitle}>Análise de Gastos</p>
          </div>
          <p className={cardText}>Gráficos de distribuição por categoria, comparativo mensal e visão da regra 50/30/20 aplicada ao seu perfil real.</p>
        </div>

      </div>
    </div>
  );

  const renderPatrimonio = () => (
    <div className="animate-in fade-in duration-200 space-y-5">
      <div>
        <h2 className={sectionTitle}>Construção de Patrimônio</h2>
        <p className={sectionSub}>Módulo focado em crescimento financeiro de médio e longo prazo.</p>
      </div>

      <div className="space-y-3">

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <p className={cardTitle}>Saúde Financeira</p>
            <Tag label="Score 0-100" color="emerald" />
          </div>
          <p className={cardText}>
            Calculado em três pilares: <strong>Performance</strong> (ganhou mais do que gastou?),{' '}
            <strong>Alocação</strong> (respeita o 50/30/20?) e <strong>Reserva</strong> (tem 6 meses de gastos guardados?).
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <p className={cardTitle}>Reserva de Emergência</p>
          </div>
          <p className={cardText}>Acompanhe o progresso da sua reserva em relação à meta ideal (6 meses de custo de vida). Vinculável a cofrinhos específicos.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <p className={cardTitle}>Investimentos</p>
          </div>
          <p className={cardText}>Registre ações, FIIs, Tesouro Direto, criptomoedas e renda fixa. Para cripto, o preço de mercado é atualizado automaticamente via Mercado Bitcoin.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-amber-400" />
            <p className={cardTitle}>Cofrinhos (Reservas)</p>
          </div>
          <p className={cardText}>Crie cofrinhos temáticos (férias, carro, emergência) com rendimento percentual do CDI. Para depositar, use um lançamento de <strong>Saída → categoria Cofre</strong>.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-rose-400" />
            <p className={cardTitle}>Metas</p>
          </div>
          <p className={cardText}>Defina um objetivo (valor + prazo) e o Alívia calcula quanto economizar por mês. Vincule metas aos seus cofrinhos e investimentos para acompanhamento em tempo real.</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <p className={cardTitle}>Evolução Patrimonial</p>
          </div>
          <p className={cardText}>Gráfico histórico do seu patrimônio total ao longo dos meses — mostra sua curva de crescimento real.</p>
        </div>

      </div>
    </div>
  );

  const renderAlivia = () => (
    <div className="animate-in fade-in duration-200 space-y-5">
      <div>
        <h2 className={sectionTitle}>Sua Alívia</h2>
        <p className={sectionSub}>Assistente financeira com IA real, disponível pelo ícone de chat no canto da tela.</p>
      </div>

      <div className={highlight}>
        <div className="flex items-start gap-3">
          <Key className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-violet-400 mb-1">Chave API necessária</p>
            <p className={cardText}>
              A Alívia usa o Google Gemini. Configure sua chave gratuita em{' '}
              <strong>Ajustes → Inteligência Artificial</strong>.{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                Obter chave gratuita →
              </a>
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          O que você pode perguntar
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Onde estou gastando mais este mês?',
            'Quanto posso economizar sem mudar meu estilo de vida?',
            'Como está meu 50/30/20 atual?',
            'Quanto tempo leva para eu juntar R$ 10.000?',
            'Analise meu histórico dos últimos 3 meses.',
            'Quais gastos eu deveria cortar primeiro?',
          ].map((q, i) => (
            <div key={i} className={`px-3 py-2.5 rounded-xl border text-[11px] ${isDark ? 'bg-white/5 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
              "{q}"
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className={`${cardTitle} mb-1`}>Privacidade</p>
            <p className={cardText}>Sua chave API fica salva apenas localmente. Os dados enviados à IA são apenas valores e categorias — nunca dados pessoais identificáveis.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="animate-in fade-in duration-200 space-y-5">
      <div>
        <h2 className={sectionTitle}>Assinatura e Faturamento</h2>
        <p className={sectionSub}>Gerencie seu plano, pagamentos e cancelamentos.</p>
      </div>

      <BillingManager isDark={isDark} />
    </div>
  );

  const contentMap = {
    intro:      renderIntro,
    gastos:     renderGastos,
    patrimonio: renderPatrimonio,
    alivia:     renderAlivia,
    billing:    renderBilling,
  };

  return (
    <div className={`flex flex-col h-full font-sans transition-colors duration-300 ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
    }`}>

      {/* ── Header ── */}
      <div className={`flex items-center gap-4 px-6 py-4 border-b shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        {onBack && (
          <button
            onClick={onBack}
            className={`p-2 rounded-xl transition-all border ${
              isDark ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Manual do Usuário</h1>
          <p className="text-[10px] text-slate-500">Guia rápido do Alívia Finance</p>
        </div>
      </div>

      {/* ── Body: two columns ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left nav */}
        <aside className={`w-52 shrink-0 border-r flex flex-col p-3 pt-5 ${
          isDark ? 'border-white/[0.06] bg-slate-950/30' : 'border-slate-100 bg-slate-50/60'
        }`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Tópicos
          </p>
          <nav className="space-y-0.5">
            {sections.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                    isActive
                      ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                      : isDark ? 'text-slate-500 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right content */}
        <main className="flex-1 overflow-y-auto p-6">
          {contentMap[activeSection]?.()}
        </main>

      </div>
    </div>
  );
}

function BillingManager({ isDark }) {
  const { isTrial, daysRemaining, planLevel, subType } = useAuth();
  const { currentUser } = useAuth();
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const handleManageBilling = async () => {
    setIsPortalLoading(true);
    try {
      await createPortalSession(currentUser.uid, () => setIsPortalLoading(false));
    } catch (err) {
      console.error(err);
      setIsPortalLoading(false);
    }
  };

  const planLabel = planLevel === 'lifetime' ? 'Vitalício'
    : planLevel === 'premium' ? `Premium ${subType === 'annual' ? '(Anual)' : '(Mensal)'}`
    : planLevel === 'standard' ? `Standard ${subType === 'annual' ? '(Anual)' : '(Mensal)'}`
    : 'Gratuito';

  // "Ativo" reflete um plano pago/vitalício — não o legado isPremium (true p/ todos).
  const isActivePlan = planLevel !== 'free';

  const card = `p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`;

  return (
    <div className="space-y-4">

      {/* Plan status */}
      <div className={`p-4 rounded-xl border-2 ${
        isActivePlan
          ? isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
          : isDark ? 'bg-slate-800 border-white/5' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isActivePlan ? 'text-emerald-500' : 'text-slate-500'}`}>
              Plano Atual
            </p>
            <p className={`text-sm font-black mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{planLabel}</p>
            {isTrial && (
              <p className="text-[10px] text-amber-500 font-semibold mt-0.5">{daysRemaining} dias restantes no período de teste</p>
            )}
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
            isActivePlan
              ? isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-600 border-emerald-200'
              : isDark ? 'bg-slate-700 text-slate-400 border-white/10' : 'bg-white text-slate-500 border-slate-200'
          }`}>
            {isActivePlan ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* Manage button */}
      <button
        onClick={handleManageBilling}
        disabled={isPortalLoading}
        className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
          isDark ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {isPortalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        Gerenciar assinatura e cartão
      </button>
      <p className="text-[10px] text-slate-500 text-center">Você será redirecionado para o ambiente seguro do Stripe.</p>

      {/* FAQ */}
      <div className="space-y-2 pt-2">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          Dúvidas Frequentes
        </p>

        {[
          { q: 'O acesso é bloqueado ao cancelar?', a: 'Não. Você mantém acesso Premium até o fim do período já pago.' },
          { q: 'Há estorno ao cancelar?', a: 'O cancelamento interrompe cobranças futuras. Meses já pagos não são estornados.' },
          { q: 'Posso só remover o cartão?', a: 'Sim. Sem cartão, a renovação não ocorre e o acesso expira na data correta.' },
        ].map((item, i) => (
          <div key={i} className={card}>
            <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.q}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
