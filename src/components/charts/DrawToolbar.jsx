import React from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import {
    MousePointer2, TrendingUp, Minus, Type, Ruler, Eye, EyeOff, Trash2,
} from 'lucide-react';

// ── Barra de ferramentas do gráfico ─────────────────────────────────
// Coluna à esquerda, como no TradingView. Só entram ferramentas que de fato
// funcionam no CandleChart: cursor, linha de tendência, linha horizontal,
// texto e régua — mais os dois comandos de anotação (ocultar / apagar).

const TOOLS = [
    { id: 'cursor', icon: MousePointer2, key: 'charts.toolCursor' },
    { id: 'trend', icon: TrendingUp, key: 'charts.toolTrend' },
    { id: 'hline', icon: Minus, key: 'charts.toolHLine' },
    { id: 'text', icon: Type, key: 'charts.toolText' },
    { id: 'ruler', icon: Ruler, key: 'charts.toolRuler' },
];

export default function DrawToolbar({ isDark, tool, onTool, showDrawings, onToggleDrawings, onClear, hasDrawings }) {
    const { t } = useI18n();
    const base = 'w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95';
    const off = isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';
    const on = isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-500/15 text-emerald-600';

    return (
        <div className={`flex flex-col items-center gap-1 py-2 px-1.5 border-r shrink-0 ${isDark ? 'border-white/[0.07] bg-[#0d1117]' : 'border-slate-200 bg-slate-50'}`}>
            {TOOLS.map(x => {
                const Icon = x.icon;
                const active = tool === x.id;
                return (
                    <button key={x.id} type="button" title={t(x.key)} aria-label={t(x.key)} aria-pressed={active}
                        onClick={() => onTool(x.id)} className={`${base} ${active ? on : off}`}>
                        <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                    </button>
                );
            })}

            <span className={`w-6 h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

            <button type="button" title={t(showDrawings ? 'charts.toolHide' : 'charts.toolShow')}
                aria-label={t(showDrawings ? 'charts.toolHide' : 'charts.toolShow')}
                onClick={onToggleDrawings} className={`${base} ${off}`}>
                {showDrawings ? <Eye className="w-[18px] h-[18px]" strokeWidth={2} /> : <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} />}
            </button>
            <button type="button" title={t('charts.toolClear')} aria-label={t('charts.toolClear')}
                onClick={onClear} disabled={!hasDrawings}
                className={`${base} ${hasDrawings ? (isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50') : 'opacity-30 cursor-default'}`}>
                <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
        </div>
    );
}
