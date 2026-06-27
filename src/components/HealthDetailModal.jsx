import { createPortal } from 'react-dom';
import { X, Activity, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// Rótulos dos pilares da Saúde Financeira (módulo Gastos).
const FIN_LABEL = { surplus: 'Sobra mensal', reserve: 'Reserva de emergência', superfluous: 'Gastos supérfluos' };

// Descrição "por que" de cada pilar da Saúde Patrimonial, a partir do breakdown.data.
const patrimonyDesc = (key, d = {}) => ({
  diversification: d.invCount > 0
    ? `${d.classCount} classe(s) de ativo · maior peso ${d.maxWeight || 0}%${d.maxWeight > 60 ? ' — concentrado, acima de 60%' : ''}.`
    : 'Cadastre investimentos para diversificar entre classes.',
  profitability: d.invCount > 0
    ? `Retorno real de ${d.realReturnPct || 0}% (já descontada a inflação de ${d.ipcaRef || 4.5}%).`
    : 'Sem investimentos para medir o retorno real.',
  debt: d.totalDebt > 0
    ? `Dívidas em ${d.debtRatio || 0}% do patrimônio — quite-as primeiro.`
    : 'Sem dívidas. Pontuação máxima! 👏',
  protection: (d.protectionTotal > 0)
    ? `${d.protectionCovered || 0} de ${d.protectionTotal} riscos cobertos por seguro (${d.coveragePct || 0}%).`
    : 'Registre seguros para proteger seus principais ativos.',
}[key] || '');

// Dica de melhoria por pilar (patrimônio e gastos).
const TIPS = {
  diversification: 'Diversifique entre classes (renda fixa, ações, FIIs, ETFs) e evite concentrar mais de 60% em um único tipo.',
  profitability: 'Prefira investimentos que rendam acima da inflação para garantir um retorno real positivo.',
  debt: 'Priorize quitar as dívidas — principalmente as mais caras — antes de ampliar investimentos de risco.',
  protection: 'Contrate seguros para seus principais ativos e riscos (vida, residência, veículo).',
  surplus: 'Gaste menos do que ganha para gerar sobra todos os meses.',
  reserve: 'Construa uma reserva que cubra ao menos 6 meses dos seus gastos fixos.',
  superfluous: 'Reduza os gastos supérfluos (desejos) para sobrar e investir mais.',
};

const barColor = (pct) => pct >= 80 ? '#10b981' : pct >= 50 ? '#eab308' : '#f43f5e';

export default function HealthDetailModal({ open, onClose, scoreData, title = 'Saúde Patrimonial' }) {
  const { theme } = useTheme();
  if (!open || !scoreData) return null;
  const isLight = theme === 'light';

  const { score = 0, statusLabel = '', feedback = '', color = 'text-slate-400', breakdown = {} } = scoreData;
  const data = breakdown?.data || {};

  // Normaliza os pilares: patrimônio vem como array; gastos como objeto.
  const pillars = Array.isArray(scoreData.pillars)
    ? scoreData.pillars.map(p => ({ key: p.key, label: p.label, score: p.score || 0, max: p.max || 0, desc: patrimonyDesc(p.key, data) }))
    : Object.entries(scoreData.pillars || {}).map(([k, v]) => ({ key: k, label: FIN_LABEL[k] || k, score: v.score || 0, max: v.max || 0, desc: v.message || v.targetLabel || '' }));

  const C = 2 * Math.PI * 52;
  const ring = statusLabel === 'Sem dados' ? '#64748b' : barColor(score);
  const weak = pillars.filter(p => p.max > 0 && (p.score / p.max) < 0.9);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg max-h-[88vh] overflow-y-auto custom-scrollbar rounded-[2rem] border shadow-2xl animate-in zoom-in-95 duration-300 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 p-6 border-b flex items-center justify-between ${isLight ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/[0.06]'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}><Activity className="w-5 h-5 text-emerald-500" /></div>
            <div>
              <h3 className={`text-base font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{title}</h3>
              <p className="text-[10px] font-bold text-slate-500">Por que esse valor e como melhorar</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Score + feedback */}
          <div className="flex items-center gap-5">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" stroke={isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'} />
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round" stroke={ring} strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{score}</span>
                <span className="text-[9px] font-bold text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-black ${color}`}>{statusLabel}</p>
              <p className={`text-xs leading-snug ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{feedback}</p>
            </div>
          </div>

          {/* Por que esse valor — pilares */}
          {pillars.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5">Por que esse valor?</p>
              <div className="space-y-3">
                {pillars.map(p => {
                  const pct = p.max > 0 ? (p.score / p.max) * 100 : 0;
                  const c = barColor(pct);
                  return (
                    <div key={p.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                          <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>{p.label}</span>
                        </span>
                        <span className={`text-[11px] font-black ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{p.score}<span className="text-slate-500">/{p.max} pts</span></span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                      </div>
                      {p.desc && <p className="text-[10px] mt-1 text-slate-500 leading-snug">{p.desc}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Como melhorar */}
          <div className={`p-4 rounded-2xl border ${isLight ? 'bg-emerald-50/60 border-emerald-100' : 'bg-emerald-500/[0.06] border-emerald-500/15'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Como melhorar</p>
            {weak.length === 0 ? (
              <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Tudo em dia! Continue assim. 👏</p>
            ) : (
              <ul className="space-y-2.5">
                {weak.map(p => (
                  <li key={p.key} className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      <b className={isLight ? 'text-slate-700' : 'text-slate-200'}>{p.label}:</b> {TIPS[p.key] || 'Reforce esta área para elevar seu score.'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
