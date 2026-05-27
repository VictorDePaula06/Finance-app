import React, { useState } from 'react';
import { Lock, Sparkles, ArrowRight, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import UpgradeModal from './UpgradeModal';

/**
 * Paywall reutilizável para features Premium-only.
 *
 * Aparece como "card de bloqueio" no lugar onde a feature apareceria,
 * com botão que abre o UpgradeModal.
 *
 * Props:
 *   title         — Nome da feature (ex: "Evolução Patrimonial")
 *   description   — Linha curta explicando o que essa feature faz
 *   features      — Array de strings com os benefícios desbloqueáveis
 *   icon          — Componente lucide (opcional) — ícone da feature
 *   compact       — Versão menor (pra inline/preview), sem max-w
 */
export default function PremiumPaywall({
    title = 'Recurso Premium',
    description = 'Esta funcionalidade está disponível apenas no plano Premium.',
    features = [],
    icon: Icon = Sparkles,
    compact = false,
}) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const [showUpgrade, setShowUpgrade] = useState(false);

    return (
        <>
            <div className={`relative overflow-hidden rounded-[2.5rem] border p-8 md:p-12 animate-in fade-in zoom-in-95 duration-500 ${
                isDark ? 'bg-gradient-to-br from-emerald-950/30 to-slate-900 border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
            } ${compact ? '' : 'max-w-2xl mx-auto'}`}>

                {/* Background glow */}
                <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-emerald-500/20 blur-[60px] pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center gap-6">
                    {/* Lock icon with sparkle */}
                    <div className="relative">
                        <div className={`p-5 rounded-3xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
                            <Icon className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 shadow-lg">
                            <Lock className="w-3 h-3 text-white" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black tracking-widest uppercase">
                            <Sparkles className="w-3 h-3" /> Exclusivo Premium
                        </div>
                        <h3 className={`text-2xl md:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {title}
                        </h3>
                        <p className={`text-sm leading-relaxed max-w-md ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {description}
                        </p>
                    </div>

                    {/* Features unlocked */}
                    {features.length > 0 && (
                        <ul className={`w-full max-w-md space-y-2.5 text-left p-5 rounded-2xl border ${
                            isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'
                        }`}>
                            {features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {feat}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* CTA */}
                    <button
                        onClick={() => setShowUpgrade(true)}
                        className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-3"
                    >
                        <Sparkles className="w-4 h-4" />
                        Fazer Upgrade Premium
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        A partir de R$ 19,90/mês · cancele quando quiser
                    </p>
                </div>
            </div>

            <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </>
    );
}
