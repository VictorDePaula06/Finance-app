import React, { useState, useCallback } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UNITS, parseNum, itemTotal } from '../../utils/market';
import { toast } from '../ui/Toaster';
import QrScanner from './QrScanner';
import PhotoCapture from './PhotoCapture';
import {
    X, QrCode, KeyRound, Camera, PencilLine, Plus, Trash2, ChevronRight, Loader2, ArrowLeft,
    CheckCircle2, AlertTriangle,
} from 'lucide-react';

// ── Lançar nova compra ──────────────────────────────────────────────
// Dois passos: primeiro COMO lançar, depois o lançamento em si.
//
// O QR Code lê o cupom pela câmera, consulta a SEFAZ e CAI NO MESMO
// formulário manual, já preenchido — a pessoa confere e corrige antes de
// salvar. Importar direto, sem conferência, esconderia erro de leitura.
//
// A foto com IA assume cupom longo: várias fotos em sequência, juntadas
// pela sobreposição, e a soma conferida contra o total impresso no papel.
//
// A chave de acesso ainda não está implementada.

const METODOS = [
    { id: 'qrcode', icon: QrCode, key: 'mkt.byQrCode', descKey: 'mkt.byQrCodeDesc', pronto: true },
    { id: 'chave', icon: KeyRound, key: 'mkt.byKey', descKey: 'mkt.byKeyDesc', pronto: false },
    { id: 'foto', icon: Camera, key: 'mkt.byPhoto', descKey: 'mkt.byPhotoDesc', pronto: true },
    { id: 'manual', icon: PencilLine, key: 'mkt.byManual', descKey: 'mkt.byManualDesc', pronto: true },
];

// Mensagem por causa, para a pessoa saber o que fazer — não um "erro".
const MOTIVO = {
    host_not_allowed: 'mkt.qrErrNotNfce',
    invalid_key: 'mkt.qrErrNotNfce',
    invalid_url: 'mkt.qrErrNotNfce',
    missing_url: 'mkt.qrErrNotNfce',
    no_items: 'mkt.qrErrNoItems',
    sefaz_captcha: 'mkt.qrErrCaptcha',
    sefaz_blocked: 'mkt.qrErrBlocked',
    sefaz_ip: 'mkt.qrErrIp',
    rate_limited: 'mkt.qrErrBusy',
};

const linhaVazia = () => ({ key: Math.random().toString(36).slice(2), name: '', qty: '1', unit: 'un', unitPrice: '' });

export default function NovaCompraModal({ isDark, uid, onClose }) {
    const { t, fmtMoney: money } = useI18n();
    const [metodo, setMetodo] = useState(null);
    const [consultando, setConsultando] = useState(false);
    const [erroQr, setErroQr] = useState('');
    const [daNota, setDaNota] = useState(null);     // o que a SEFAZ devolveu

    const consultar = useCallback(async (url) => {
        setErroQr(''); setConsultando(true);
        try {
            const r = await fetch(`/api/market-import?url=${encodeURIComponent(url)}`);
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.items?.length) {
                setErroQr(t(MOTIVO[d.error] || 'mkt.qrErrSefaz'));
                setConsultando(false);
                return;
            }
            setDaNota(d);
            setMetodo('manual');          // cai na conferência, já preenchido
        } catch {
            setErroQr(t('mkt.qrErrSefaz'));
        }
        setConsultando(false);
    }, [t]);

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[8vh] animate-in fade-in duration-150"
            role="dialog" aria-modal="true" aria-label={t('mkt.newPurchase')}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#111614] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center justify-between px-5 py-3.5 border-b ${line}`}>
                    <span className="flex items-center gap-2 min-w-0">
                        {metodo && (
                            <button onClick={() => { setMetodo(null); setDaNota(null); setErroQr(''); }}
                                aria-label={t('common.cancel')}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                                <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
                            </button>
                        )}
                        <h2 className={`text-[15px] font-black tracking-tight truncate ${ink}`}>
                            {metodo === 'manual' ? (daNota ? t('mkt.qrReview') : t('mkt.newPurchase'))
                                : metodo === 'qrcode' ? t('mkt.byQrCode')
                                    : metodo === 'foto' ? t('mkt.byPhoto') : t('mkt.howToAdd')}
                        </h2>
                    </span>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                </div>

                {metodo === 'manual' ? (
                    <FormManual isDark={isDark} uid={uid} money={money} inicial={daNota}
                        onVoltar={() => { setMetodo(null); setDaNota(null); }} onPronto={onClose} />
                ) : metodo === 'foto' ? (
                    <PhotoCapture isDark={isDark} onLido={(d) => { setDaNota(d); setMetodo('manual'); }} />
                ) : metodo === 'qrcode' ? (
                    consultando ? (
                        <div className="px-5 py-14 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                            <p className={`text-[13px] font-bold mt-3 ${ink}`}>{t('mkt.qrChecking')}</p>
                            <p className={`text-[12px] mt-1 ${muted}`}>{t('mkt.qrCheckingDesc')}</p>
                        </div>
                    ) : (
                        <QrScanner isDark={isDark} onLido={consultar} erro={erroQr} />
                    )
                ) : (
                        <div className="p-4 grid sm:grid-cols-2 gap-2.5">
                            {METODOS.map(m => {
                                const Icon = m.icon;
                                return (
                                    <button key={m.id} type="button" disabled={!m.pronto}
                                        onClick={() => m.pronto && setMetodo(m.id)}
                                        className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${m.pronto
                                            ? (isDark ? 'border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.04] active:scale-[0.99]' : 'border-slate-200 hover:border-emerald-500/40 hover:bg-slate-50 active:scale-[0.99]')
                                            : `${line} opacity-55 cursor-not-allowed`}`}>
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.pronto ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>
                                            <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`flex items-center gap-1.5 text-[13.5px] font-black ${ink}`}>
                                                {t(m.key)}
                                                {!m.pronto && (
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                                                        {t('mkt.soon')}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={`block text-[11.5px] mt-0.5 ${muted}`}>{t(m.descKey)}</span>
                                        </span>
                                        {m.pronto && <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${muted}`} />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
            </div>
        </div>
    );
}

// ── Conferência da leitura ──────────────────────────────────────────
// O cupom traz o próprio total impresso. Comparar a soma dos itens com ele
// é o que permite dizer "confere" em vez de torcer para ter lido certo —
// e, quando não bate, dizer exatamente o que provavelmente aconteceu.
function Conferencia({ isDark, dados, money }) {
    const { t } = useI18n();
    const c = dados.conferencia;
    const bate = c.estado === 'bate';
    const semTotal = c.estado === 'semTotal';

    const tom = bate ? 'emerald' : semTotal ? 'slate' : 'amber';
    const cls = {
        emerald: isDark ? 'bg-emerald-500/[0.08] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200',
        amber: isDark ? 'bg-amber-500/[0.08] border-amber-500/25' : 'bg-amber-50 border-amber-200',
        slate: isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-200',
    }[tom];
    const cor = { emerald: 'text-emerald-500', amber: 'text-amber-500', slate: isDark ? 'text-slate-400' : 'text-slate-500' }[tom];
    const Icon = bate ? CheckCircle2 : AlertTriangle;

    const chave = { bate: 'mkt.confOk', sobra: 'mkt.confOver', falta: 'mkt.confUnder', semTotal: 'mkt.confNoTotal' }[c.estado];

    return (
        <div className={`mx-5 mt-4 rounded-xl border px-3.5 py-3 ${cls}`}>
            <p className={`text-[12.5px] font-bold flex items-start gap-2 ${cor}`}>
                <Icon className="w-4 h-4 shrink-0 mt-px" strokeWidth={2.4} />
                <span>{t(chave)}</span>
            </p>
            <p className={`text-[11.5px] mt-1.5 pl-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('mkt.confSum')} <strong>R$ {money(c.soma)}</strong>
                {c.total ? <> · {t('mkt.confPrinted')} <strong>R$ {money(c.total)}</strong></> : null}
                {dados.fotos > 1 ? <> · {t('mkt.confPhotos', { n: dados.fotos })}</> : null}
                {dados.sobrepostos > 0 ? <> · {t('mkt.confMerged', { n: dados.sobrepostos })}</> : null}
            </p>
        </div>
    );
}

// ── Lançamento manual ───────────────────────────────────────────────
function FormManual({ isDark, uid, money, inicial, onVoltar, onPronto }) {
    const { t } = useI18n();
    const [store, setStore] = useState(inicial?.store || '');
    const [date, setDate] = useState(() => inicial?.date || new Date().toISOString().slice(0, 10));
    // Inicializador preguiçoso: linhaVazia() sorteia uma chave, e sortear
    // durante a renderização é efeito colateral.
    const [linhas, setLinhas] = useState(() => (inicial?.items?.length
        ? inicial.items.map(i => ({
            ...linhaVazia(),
            name: i.name || '',
            qty: String(i.qty ?? 1).replace('.', ','),
            unit: UNITS.includes(i.unit) ? i.unit : 'un',
            unitPrice: String(i.unitPrice ?? '').replace('.', ','),
        }))
        : [linhaVazia()]));
    const [saving, setSaving] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const inputCls = `px-2.5 py-2 rounded-lg border text-[13px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const mudar = (key, campo, valor) => setLinhas(ls => ls.map(l => (l.key === key ? { ...l, [campo]: valor } : l)));
    const total = linhas.reduce((a, l) => a + itemTotal(l), 0);
    const validas = linhas.filter(l => l.name.trim() && parseNum(l.qty) > 0);

    const salvar = async (e) => {
        e?.preventDefault();
        if (!validas.length || !uid || saving) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'market_purchases'), {
                userId: uid,
                store: store.trim() || null,
                date,
                month: date.slice(0, 7),
                source: inicial?.conferencia ? 'foto' : inicial ? 'qrcode' : 'manual',
                ...(inicial?.key ? { nfceKey: inicial.key } : {}),
                items: validas.map(l => ({
                    name: l.name.trim(),
                    qty: parseNum(l.qty),
                    unit: l.unit,
                    unitPrice: parseNum(l.unitPrice),
                })),
                total: Math.round(validas.reduce((a, l) => a + itemTotal(l), 0) * 100) / 100,
                // Carimbo do servidor: o relógio do aparelho pode estar errado,
                // e isto é registro de dinheiro.
                createdAt: serverTimestamp(),
            });
            toast.success(t('mkt.saved'));
            onPronto();
        } catch (e) {
            console.error(e);
            toast.error('Não foi possível salvar. Tente de novo.');
            setSaving(false);
        }
    };

    return (
        <>
            {inicial?.conferencia && <Conferencia isDark={isDark} dados={inicial} money={money} />}

            <div className="px-5 pt-4 grid sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor="mkt-loja" className={`block text-[11px] font-black uppercase tracking-wider mb-1 ${muted}`}>{t('mkt.store')}</label>
                    <input id="mkt-loja" value={store} onChange={(e) => setStore(e.target.value)}
                        placeholder={t('mkt.storePlaceholder')} className={`w-full ${inputCls}`} />
                </div>
                <div>
                    <label htmlFor="mkt-data" className={`block text-[11px] font-black uppercase tracking-wider mb-1 ${muted}`}>{t('mkt.date')}</label>
                    <input id="mkt-data" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className={`w-full ${inputCls}`} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
                </div>
            </div>

            <div className="px-5 pt-4 max-h-[42vh] overflow-y-auto">
                <div className={`hidden sm:grid grid-cols-[1fr_72px_80px_104px_32px] gap-2 text-[10.5px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                    <span>{t('mkt.itemName')}</span>
                    <span>{t('mkt.qty')}</span>
                    <span>{t('mkt.unit')}</span>
                    <span className="text-right">{t('mkt.unitPrice')}</span>
                    <span />
                </div>

                {linhas.map(l => (
                    <div key={l.key} className="grid grid-cols-[1fr_60px_68px_92px_32px] sm:grid-cols-[1fr_72px_80px_104px_32px] gap-2 mb-2 items-center">
                        <input value={l.name} onChange={(e) => mudar(l.key, 'name', e.target.value)}
                            placeholder={t('mkt.itemNamePlaceholder')} aria-label={t('mkt.itemName')} className={inputCls} />
                        <input inputMode="decimal" value={l.qty} aria-label={t('mkt.qty')}
                            onChange={(e) => mudar(l.key, 'qty', e.target.value.replace(/[^\d.,]/g, ''))} className={inputCls} />
                        <select value={l.unit} onChange={(e) => mudar(l.key, 'unit', e.target.value)}
                            aria-label={t('mkt.unit')} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input inputMode="decimal" value={l.unitPrice} aria-label={t('mkt.unitPrice')}
                            onChange={(e) => mudar(l.key, 'unitPrice', e.target.value.replace(/[^\d.,]/g, ''))}
                            placeholder="0,00" className={`${inputCls} text-right tabular-nums`} />
                        <button onClick={() => setLinhas(ls => (ls.length > 1 ? ls.filter(x => x.key !== l.key) : ls))}
                            disabled={linhas.length === 1} aria-label={t('common.delete')}
                            className={`p-2 rounded-lg transition disabled:opacity-25 ${muted} hover:text-rose-500`}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                <button onClick={() => setLinhas(ls => [...ls, linhaVazia()])}
                    className={`mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-bold transition ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-600'}`}>
                    <Plus className="w-3.5 h-3.5" strokeWidth={3} /> {t('mkt.addProduct')}
                </button>
            </div>

            <div className={`px-5 py-3.5 mt-3 border-t ${line} flex items-center gap-3 flex-wrap`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${muted}`}>{t('mkt.purchaseTotal')}</span>
                <span className="text-[18px] font-black tabular-nums text-emerald-500">R$ {money(total)}</span>
                <span className={`text-[11.5px] ${muted}`}>
                    {validas.length} {t('mkt.products', { n: validas.length })}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={onVoltar}
                        className={`px-3.5 py-2 rounded-xl text-[12.5px] font-bold transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                        {t('common.cancel')}
                    </button>
                    <button onClick={salvar} disabled={!validas.length || saving}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[12.5px] font-black transition active:scale-95">
                        {t('mkt.save')}
                    </button>
                </div>
            </div>
        </>
    );
}
