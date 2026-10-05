import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { juntarLotes, conferir, totalDosLotes, cabecalhoDosLotes } from '../../utils/receiptMerge';
import { Camera, ImagePlus, X, Loader2, ScanLine } from 'lucide-react';

// ── Foto do cupom com IA ────────────────────────────────────────────
// Compra grande não cabe numa foto, então a tela assume vários pedaços
// desde o começo: a pessoa fotografa de cima para baixo, sobrepondo um
// pouco, e o app junta (src/utils/receiptMerge.js).
//
// Cada foto é comprimida aqui antes de subir — cupom fotografado de perto
// sai com vários MB, e isso só faria a leitura demorar.

const MAX_LADO = 1600;
const QUALIDADE = 0.82;

async function comprimir(file) {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALIDADE));
    const base64 = await new Promise(res => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.readAsDataURL(blob);
    });
    return { base64, url: URL.createObjectURL(blob) };
}

const MOTIVO = {
    unauthenticated: 'mkt.fotoErrAuth',
    invalid_token: 'mkt.fotoErrAuth',
    rate_limited: 'mkt.fotoErrBusy',
    image_too_large: 'mkt.fotoErrBig',
    unreadable: 'mkt.fotoErrUnreadable',
    no_items: 'mkt.fotoErrUnreadable',
};

export default function PhotoCapture({ isDark, onLido }) {
    const { t } = useI18n();
    const { currentUser } = useAuth();
    const [fotos, setFotos] = useState([]);          // { id, base64, url }
    const [lendo, setLendo] = useState(0);           // 0 = parado; senão, nº da foto
    const [erro, setErro] = useState('');
    const inputRef = useRef(null);

    // As miniaturas usam URLs de objeto: solta ao sair, senão vaza memória.
    useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.url)), [fotos]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/10' : 'border-slate-200';

    const escolher = async (e) => {
        const arquivos = [...(e.target.files || [])];
        e.target.value = '';                          // permite repetir o mesmo arquivo
        if (!arquivos.length) return;
        setErro('');
        try {
            const novas = [];
            for (const f of arquivos) novas.push({ id: `${Date.now()}-${novas.length}`, ...(await comprimir(f)) });
            setFotos(l => [...l, ...novas]);
        } catch {
            setErro(t('mkt.fotoErrRead'));
        }
    };

    const tirar = (f) => setFotos(l => {
        const alvo = l.find(x => x.id === f.id);
        if (alvo) URL.revokeObjectURL(alvo.url);
        return l.filter(x => x.id !== f.id);
    });

    const ler = async () => {
        if (!fotos.length || lendo) return;
        setErro('');
        let token;
        try {
            token = await currentUser.getIdToken();
        } catch {
            setErro(t('mkt.fotoErrAuth'));
            return;
        }

        const lotes = [];
        for (let i = 0; i < fotos.length; i++) {
            setLendo(i + 1);
            try {
                const r = await fetch('/api/market-photo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ image: fotos[i].base64, mime: 'image/jpeg' }),
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) {
                    // Uma foto ilegível no meio não deve jogar fora as outras.
                    if (MOTIVO[d.error] && fotos.length === 1) { setErro(t(MOTIVO[d.error])); setLendo(0); return; }
                    continue;
                }
                lotes.push(d);
            } catch {
                setErro(t('mkt.fotoErrNet'));
                setLendo(0);
                return;
            }
        }
        setLendo(0);

        if (!lotes.length) { setErro(t('mkt.fotoErrUnreadable')); return; }

        const { items, sobrepostos } = juntarLotes(lotes);
        const cab = cabecalhoDosLotes(lotes);
        const total = totalDosLotes(lotes);
        onLido({ ...cab, total, items, conferencia: conferir(items, total), sobrepostos, fotos: lotes.length });
    };

    return (
        <div className="px-5 py-4">
            <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple
                onChange={escolher} className="sr-only" />

            {fotos.length === 0 ? (
                <button onClick={() => inputRef.current?.click()}
                    className={`w-full rounded-2xl border border-dashed px-5 py-10 text-center transition ${isDark ? 'border-white/15 hover:border-emerald-500/40 hover:bg-white/[0.03]' : 'border-slate-300 hover:border-emerald-500/40 hover:bg-slate-50'}`}>
                    <Camera className="w-8 h-8 mx-auto text-emerald-500" strokeWidth={1.8} />
                    <p className={`text-[14px] font-black mt-2.5 ${ink}`}>{t('mkt.fotoTake')}</p>
                    <p className={`text-[12px] mt-1 ${muted}`}>{t('mkt.fotoHint')}</p>
                </button>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        {fotos.map((f, i) => (
                            <div key={f.id} className={`relative rounded-xl overflow-hidden border aspect-[3/4] ${line}`}>
                                <img src={f.url} alt="" className="w-full h-full object-cover" />
                                <span className="absolute top-1 left-1 w-5 h-5 rounded-md bg-black/65 text-white text-[10px] font-black flex items-center justify-center">
                                    {i + 1}
                                </span>
                                {!lendo && (
                                    <button onClick={() => tirar(f)} aria-label={t('common.delete')}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/65 text-white flex items-center justify-center active:scale-90">
                                        <X className="w-3 h-3" strokeWidth={3} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {!lendo && (
                            <button onClick={() => inputRef.current?.click()} aria-label={t('mkt.fotoAdd')}
                                className={`rounded-xl border border-dashed aspect-[3/4] flex flex-col items-center justify-center gap-1 transition ${isDark ? 'border-white/15 text-slate-500 hover:border-emerald-500/40' : 'border-slate-300 text-slate-400 hover:border-emerald-500/40'}`}>
                                <ImagePlus className="w-5 h-5" />
                                <span className="text-[10px] font-bold">{t('mkt.fotoAdd')}</span>
                            </button>
                        )}
                    </div>

                    <p className={`text-[11.5px] mt-2.5 ${muted}`}>{t('mkt.fotoOrder')}</p>

                    <button onClick={ler} disabled={!!lendo}
                        className="mt-4 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[15px] font-black transition active:scale-[0.98] inline-flex items-center justify-center gap-2">
                        {lendo ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> {t('mkt.fotoReading', { n: lendo, total: fotos.length })}</>
                        ) : (
                            <><ScanLine className="w-5 h-5" strokeWidth={2.4} /> {t('mkt.fotoRead')}</>
                        )}
                    </button>
                </>
            )}

            {erro && <p className="text-[12.5px] text-rose-500 font-semibold text-center mt-3">{erro}</p>}
        </div>
    );
}
