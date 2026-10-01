import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { sma, fmtPrice } from '../../utils/marketSeries';

// ── Gráfico de velas ────────────────────────────────────────────────
// SVG próprio, sem dependência nova. Faz o que a tela do TradingView faz:
// velas, média móvel, escala de preço à direita, eixo de tempo embaixo,
// mira (crosshair) com etiquetas nos dois eixos, zoom na roda, arraste para
// navegar e as anotações do usuário (linha de tendência, linha horizontal,
// texto e régua).
//
// As anotações são guardadas em coordenadas de DADOS (timestamp + preço), não
// em pixels — assim sobrevivem a zoom, arraste e troca de janela.

const PAD_RIGHT = 74;   // faixa da escala de preço
const PAD_BOTTOM = 26;  // faixa do eixo de tempo
const PAD_TOP = 12;

const UP = '#26a69a';
const DOWN = '#ef5350';
const MA = '#2962ff';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Escolhe um passo "redondo" para a grade de preço (1, 2, 2.5, 5 × 10^n).
function niceStep(span, target = 8) {
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / mag;
    const step = n >= 7.5 ? 10 : n >= 3.5 ? 5 : n >= 1.5 ? 2 : 1;
    return step * mag;
}

export default function CandleChart({
    candles = [],
    isDark = true,
    locale = 'pt-BR',
    smaPeriod = 60,
    tool = 'cursor',
    drawings = [],
    onDrawingsChange,
    onHover,
    showDrawings = true,
    intervalMs = 0,
    viewSpanMs = Infinity,
    symbol = '',
    loading = false,
    empty = null,
}) {
    const wrapRef = useRef(null);
    const [size, setSize] = useState({ w: 900, h: 520 });
    // Zoom/arraste feitos pela pessoa. Fica marcado com a assinatura da série a
    // que pertence: quando chega outra série, o padrão volta a valer sozinho —
    // sem efeito para "resetar" a janela.
    const [zoom, setZoom] = useState(null);
    const [cursor, setCursor] = useState(null);       // { x, y } em px
    const [pending, setPending] = useState(null);     // anotação em construção
    const [editing, setEditing] = useState(null);     // texto sendo digitado
    const drag = useRef(null);

    const grid = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.07)';
    const axisText = isDark ? '#787b86' : '#64748b';
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
    const crossColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)';
    const tagBg = isDark ? '#2a2e39' : '#334155';

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            const r = e.contentRect;
            setSize({ w: Math.max(320, r.width), h: Math.max(240, r.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Assinatura da série carregada (tamanho + primeiro candle + janela).
    const sig = `${candles.length}:${candles[0]?.t ?? 0}:${viewSpanMs}`;

    // Janela de abertura: exatamente o período do botão escolhido. O que foi
    // buscado antes disso continua carregado — é o que aparece ao arrastar.
    const defaultView = useMemo(() => {
        if (!candles.length) return null;
        if (!viewSpanMs || !isFinite(viewSpanMs)) return { start: 0, end: candles.length };
        const from = candles[candles.length - 1].t - viewSpanMs;
        let start = candles.findIndex(k => k.t >= from);
        if (start < 0) start = 0;
        // Faixa curta demais para o intervalo dos dados: garante o mínimo.
        if (candles.length - start < 12) start = Math.max(0, candles.length - 12);
        return { start, end: candles.length };
    }, [candles, viewSpanMs]);

    const view = useMemo(
        () => (zoom?.sig === sig ? zoom : defaultView),
        [zoom, sig, defaultView]);
    const setView = (next) => setZoom({ sig, ...next });

    const v = useMemo(() => (view && candles.length
        ? { start: clamp(view.start, 0, candles.length - 2), end: clamp(view.end, 2, candles.length) }
        : null), [view, candles.length]);
    const slice = useMemo(() => (v ? candles.slice(v.start, v.end) : []), [v, candles]);

    const plotW = size.w - PAD_RIGHT;
    const plotH = size.h - PAD_BOTTOM;

    const maSeries = useMemo(() => sma(candles, smaPeriod), [candles, smaPeriod]);

    // Escala de preço: mínimo/máximo do trecho visível, com folga.
    const scale = useMemo(() => {
        if (!slice.length) return null;
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < slice.length; i++) {
            if (slice[i].l < lo) lo = slice[i].l;
            if (slice[i].h > hi) hi = slice[i].h;
        }
        for (let i = v.start; i < v.end; i++) {
            const m = maSeries[i];
            if (m != null) { if (m < lo) lo = m; if (m > hi) hi = m; }
        }
        const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.02 || 1;
        lo -= pad; hi += pad;
        return { lo, hi };
    }, [slice, maSeries, v]);

    const n = slice.length;
    const step = n ? plotW / n : 0;
    const bodyW = Math.max(1, Math.min(14, step * 0.68));

    // i é relativo ao trecho visível, não ao array inteiro.
    const xOf = useCallback((i) => (i + 0.5) * step, [step]);
    const yOf = useCallback((p) => {
        if (!scale) return 0;
        const k = (p - scale.lo) / (scale.hi - scale.lo || 1);
        return PAD_TOP + (1 - k) * (plotH - PAD_TOP);
    }, [scale, plotH]);
    const priceOf = useCallback((y) => {
        if (!scale) return 0;
        const k = 1 - (y - PAD_TOP) / (plotH - PAD_TOP || 1);
        return scale.lo + k * (scale.hi - scale.lo);
    }, [scale, plotH]);

    // Timestamp ⇄ x, com interpolação entre candles (para as anotações).
    const xOfTime = useCallback((t) => {
        if (!slice.length) return null;
        if (t <= slice[0].t) return xOf(0);
        if (t >= slice[n - 1].t) return xOf(n - 1);
        let i = 0;
        while (i < n - 1 && slice[i + 1].t <= t) i++;
        const span = slice[i + 1].t - slice[i].t || 1;
        return xOf(i + (t - slice[i].t) / span);
    }, [slice, n, xOf]);
    const timeOfX = useCallback((x) => {
        if (!slice.length) return null;
        const f = clamp(x / step - 0.5, 0, n - 1);
        const i = Math.floor(f);
        const j = Math.min(n - 1, i + 1);
        return slice[i].t + (slice[j].t - slice[i].t) * (f - i);
    }, [slice, n, step]);

    const hoverIndex = cursor && n ? clamp(Math.floor(cursor.x / step), 0, n - 1) : null;
    const hovered = hoverIndex != null ? slice[hoverIndex] : null;

    useEffect(() => { onHover?.(hovered || null); }, [hovered, onHover]);

    // ── Interação ───────────────────────────────────────────────────
    const localPos = (e) => {
        const r = wrapRef.current.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onWheel = (e) => {
        if (!v || !candles.length) return;
        e.preventDefault();
        const p = localPos(e);
        const anchor = clamp(p.x / plotW, 0, 1);
        const len = v.end - v.start;
        const next = clamp(Math.round(len * (e.deltaY > 0 ? 1.15 : 0.87)), 20, candles.length);
        const pivot = v.start + anchor * len;
        let start = Math.round(pivot - anchor * next);
        start = clamp(start, 0, candles.length - next);
        setView({ start, end: start + next });
    };

    const onMouseDown = (e) => {
        const p = localPos(e);
        if (p.x > plotW || p.y > plotH) return;
        if (tool === 'cursor') {
            drag.current = { x: p.x, start: v?.start ?? 0 };
            return;
        }
        const t = timeOfX(p.x);
        const price = priceOf(p.y);
        if (tool === 'hline') {
            commit({ id: crypto.randomUUID(), type: 'hline', price });
            return;
        }
        if (tool === 'text') {
            setEditing({ id: crypto.randomUUID(), type: 'text', t, price, text: '' });
            return;
        }
        // trend e ruler: primeiro clique fixa A, segundo fecha.
        if (!pending) setPending({ id: crypto.randomUUID(), type: tool, t, price, t2: t, price2: price });
        else { commit({ ...pending, t2: t, price2: price }); setPending(null); }
    };

    const onMouseMove = (e) => {
        const p = localPos(e);
        setCursor(p.x <= plotW && p.y <= plotH ? p : null);
        if (drag.current && v) {
            const len = v.end - v.start;
            const moved = Math.round((drag.current.x - p.x) / step);
            let start = clamp(drag.current.start + moved, 0, candles.length - len);
            setView({ start, end: start + len });
            return;
        }
        if (pending) setPending(q => ({ ...q, t2: timeOfX(p.x), price2: priceOf(p.y) }));
    };

    const endDrag = () => { drag.current = null; };
    // Duplo clique reenquadra na janela do botão escolhido.
    const resetView = () => setZoom(null);
    const commit = (d) => onDrawingsChange?.([...drawings, d]);

    // ── Grades e eixos ──────────────────────────────────────────────
    const priceTicks = useMemo(() => {
        if (!scale) return [];
        const st = niceStep(scale.hi - scale.lo);
        const first = Math.ceil(scale.lo / st) * st;
        const out = [];
        // Soma por múltiplo em vez de acumular: acumular arrasta o erro do
        // ponto flutuante e a linha do zero saía como "-0,000000000".
        for (let k = 0; first + k * st <= scale.hi; k++) out.push(+(first + k * st).toPrecision(12));
        return out;
    }, [scale]);

    // Marcas presas a fronteiras de calendário — vira ano, vira mês, vira dia —
    // e não a um passo fixo de índices. É o que dá o "2018 · Jul · 2019 · Jul"
    // em vez de uma fileira de meses aleatórios.
    const timeTicks = useMemo(() => {
        if (!n) return [];
        const MIN_GAP = 74;
        const short = (d, opt) => d.toLocaleDateString(locale, opt).replace('.', '');

        // Nível da fronteira em cada candle: 3 ano · 2 mês · 1 dia · 0 hora.
        const cand = [];
        for (let i = 0; i < n; i++) {
            const d = new Date(slice[i].t);
            const p = i > 0 ? new Date(slice[i - 1].t) : null;
            let level, label;
            if (!p || d.getFullYear() !== p.getFullYear()) { level = 3; label = String(d.getFullYear()); }
            else if (d.getMonth() !== p.getMonth()) { level = 2; label = short(d, { month: 'short' }); }
            else if (d.getDate() !== p.getDate()) { level = 1; label = short(d, { day: '2-digit', month: 'short' }); }
            else { level = 0; label = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
            cand.push({ i, x: xOf(i), level, label });
        }

        // Do nível mais forte para o mais fraco, aceitando só quem cabe.
        const taken = [];
        const fits = (x) => taken.every(t => Math.abs(t.x - x) >= MIN_GAP);
        for (const lv of [3, 2, 1, 0]) {
            for (const c of cand) {
                if (c.level !== lv) continue;
                if (fits(c.x)) taken.push({ x: c.x, label: c.label, strong: lv === 3 });
            }
        }
        return taken.sort((a, b) => a.x - b.x);
    }, [slice, n, xOf, locale]);

    const last = candles[candles.length - 1];
    const lastVisible = slice[n - 1];
    const lastY = lastVisible ? yOf(lastVisible.c) : null;
    const lastUp = lastVisible ? lastVisible.c >= lastVisible.o : true;

    // Contagem regressiva para o fechamento da vela atual (como no TradingView).
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!intervalMs) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [intervalMs]);
    const countdown = useMemo(() => {
        if (!intervalMs || !last) return null;
        const left = last.t + intervalMs - now;
        if (left <= 0 || left > intervalMs) return null;
        const s = Math.floor(left / 1000);
        const pad = (x) => String(x).padStart(2, '0');
        return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }, [intervalMs, last, now]);

    const cursorClass = tool === 'cursor' ? 'cursor-crosshair' : 'cursor-copy';

    return (
        <div ref={wrapRef} className={`relative w-full h-full select-none ${cursorClass}`}
            onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
            onDoubleClick={resetView}
            onMouseUp={endDrag} onMouseLeave={() => { endDrag(); setCursor(null); }}>

            <svg width={size.w} height={size.h} className="block">
                {/* Grade */}
                <g>
                    {priceTicks.map(p => (
                        <line key={`h${p}`} x1={0} x2={plotW} y1={yOf(p)} y2={yOf(p)} stroke={grid} strokeWidth="1" />
                    ))}
                    {timeTicks.map((t, i) => (
                        <line key={`v${i}`} x1={t.x} x2={t.x} y1={PAD_TOP} y2={plotH} stroke={grid} strokeWidth="1" />
                    ))}
                </g>

                {/* Velas */}
                <g>
                    {slice.map((k, i) => {
                        const up = k.c >= k.o;
                        const color = up ? UP : DOWN;
                        const x = xOf(i);
                        const yO = yOf(k.o), yC = yOf(k.c);
                        const top = Math.min(yO, yC);
                        const h = Math.max(1, Math.abs(yC - yO));
                        return (
                            <g key={k.t}>
                                <line x1={x} x2={x} y1={yOf(k.h)} y2={yOf(k.l)} stroke={color} strokeWidth="1" />
                                <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} />
                            </g>
                        );
                    })}
                </g>

                {/* Média móvel */}
                {scale && (
                    <path
                        d={slice.reduce((acc, _k, i) => {
                            const m = maSeries[v.start + i];
                            if (m == null) return acc;
                            return acc + (acc ? ' L ' : 'M ') + `${xOf(i)} ${yOf(m)}`;
                        }, '')}
                        fill="none" stroke={MA} strokeWidth="1.6" strokeLinejoin="round"
                    />
                )}

                {/* Anotações do usuário */}
                {showDrawings && scale && [...drawings, ...(pending ? [pending] : [])].map(d => {
                    if (d.type === 'hline') {
                        const y = yOf(d.price);
                        if (y < PAD_TOP || y > plotH) return null;
                        return <line key={d.id} x1={0} x2={plotW} y1={y} y2={y} stroke="#facc15" strokeWidth="1.4" strokeDasharray="5 3" />;
                    }
                    const x1 = xOfTime(d.t), x2 = xOfTime(d.t2);
                    if (x1 == null || x2 == null) return null;
                    const y1 = yOf(d.price), y2 = yOf(d.price2);
                    if (d.type === 'text') {
                        return (
                            <text key={d.id} x={x1} y={y1} fill={isDark ? '#e2e8f0' : '#1e293b'}
                                fontSize="12" fontWeight="600" style={{ pointerEvents: 'none' }}>{d.text}</text>
                        );
                    }
                    if (d.type === 'ruler') {
                        const delta = ((d.price2 - d.price) / (d.price || 1)) * 100;
                        const good = delta >= 0;
                        return (
                            <g key={d.id}>
                                <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)}
                                    fill={good ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)'} stroke={good ? UP : DOWN} strokeWidth="1" />
                                <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 6} textAnchor="middle"
                                    fill={good ? UP : DOWN} fontSize="11" fontWeight="800">
                                    {`${good ? '+' : ''}${delta.toFixed(2)}%`}
                                </text>
                            </g>
                        );
                    }
                    return <line key={d.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#facc15" strokeWidth="1.6" />;
                })}

                {/* Último preço: linha pontilhada até a escala */}
                {lastY != null && (
                    <line x1={0} x2={plotW} y1={lastY} y2={lastY} stroke={lastUp ? UP : DOWN} strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
                )}

                {/* Mira */}
                {cursor && (
                    <g pointerEvents="none">
                        <line x1={cursor.x} x2={cursor.x} y1={PAD_TOP} y2={plotH} stroke={crossColor} strokeWidth="1" strokeDasharray="3 3" />
                        <line x1={0} x2={plotW} y1={cursor.y} y2={cursor.y} stroke={crossColor} strokeWidth="1" strokeDasharray="3 3" />
                    </g>
                )}

                {/* Eixos */}
                <line x1={plotW} x2={plotW} y1={0} y2={plotH} stroke={border} strokeWidth="1" />
                <line x1={0} x2={size.w} y1={plotH} y2={plotH} stroke={border} strokeWidth="1" />

                {/* Escala de preço */}
                <g>
                    {priceTicks.map(p => (
                        <text key={`t${p}`} x={plotW + 8} y={yOf(p) + 4} fill={axisText} fontSize="11" fontFamily="inherit">
                            {fmtPrice(p, locale)}
                        </text>
                    ))}
                </g>

                {/* Eixo de tempo */}
                <g>
                    {timeTicks.map((t, i) => (
                        <text key={`tt${i}`} x={t.x} y={plotH + 17} textAnchor="middle"
                            fill={axisText} fontSize="11" fontWeight={t.strong ? 700 : 400} fontFamily="inherit">
                            {t.label}
                        </text>
                    ))}
                </g>

                {/* Etiqueta do último preço + contagem regressiva */}
                {lastY != null && (
                    <g>
                        <rect x={plotW + 1} y={lastY - (countdown ? 17 : 10)} width={PAD_RIGHT - 2} height={countdown ? 34 : 20}
                            rx="3" fill={lastUp ? UP : DOWN} />
                        <text x={plotW + 6} y={lastY + (countdown ? -4 : 4)} fill="#fff" fontSize="11" fontWeight="700" fontFamily="inherit">
                            {fmtPrice(lastVisible.c, locale)}
                        </text>
                        {countdown && (
                            <text x={plotW + 6} y={lastY + 11} fill="rgba(255,255,255,0.85)" fontSize="10" fontFamily="inherit">
                                {countdown}
                            </text>
                        )}
                        {symbol && (
                            <>
                                <rect x={plotW - 62} y={lastY - (countdown ? 17 : 10)} width={60} height={countdown ? 34 : 20} rx="3" fill={lastUp ? UP : DOWN} opacity="0.9" />
                                <text x={plotW - 57} y={lastY + (countdown ? -4 : 4)} fill="#fff" fontSize="10" fontWeight="800" fontFamily="inherit">{symbol}</text>
                            </>
                        )}
                    </g>
                )}

                {/* Etiquetas da mira */}
                {cursor && (
                    <g pointerEvents="none">
                        <rect x={plotW + 1} y={cursor.y - 9} width={PAD_RIGHT - 2} height={18} rx="3" fill={tagBg} />
                        <text x={plotW + 6} y={cursor.y + 4} fill="#fff" fontSize="11" fontFamily="inherit">{fmtPrice(priceOf(cursor.y), locale)}</text>
                        {hovered && (
                            <>
                                <rect x={clamp(cursor.x - 52, 0, plotW - 104)} y={plotH + 2} width={104} height={18} rx="3" fill={tagBg} />
                                <text x={clamp(cursor.x, 52, plotW - 52)} y={plotH + 15} textAnchor="middle" fill="#fff" fontSize="11" fontFamily="inherit">
                                    {new Date(hovered.t).toLocaleString(locale, { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')}
                                </text>
                            </>
                        )}
                    </g>
                )}
            </svg>

            {/* Caixa de texto da anotação */}
            {editing && (
                <input
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onBlur={() => { if (editing.text.trim()) commit(editing); setEditing(null); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { if (editing.text.trim()) commit(editing); setEditing(null); }
                        if (e.key === 'Escape') setEditing(null);
                    }}
                    style={{ left: xOfTime(editing.t) ?? 0, top: (yOf(editing.price) || 0) - 10 }}
                    className={`absolute z-10 px-2 py-0.5 text-xs font-semibold rounded border outline-none ${isDark ? 'bg-[#1e222d] border-white/20 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                />
            )}

            {(loading || !candles.length) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {loading
                        ? <span className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Carregando…</span>
                        : empty}
                </div>
            )}
        </div>
    );
}
