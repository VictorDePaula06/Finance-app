import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { juntarLotes, conferir, totalDosLotes, cabecalhoDosLotes } from '../../utils/receiptMerge';
import { Camera, ImagePlus, FileText, X, Loader2, ScanLine } from 'lucide-react';

// ── Cupom por foto ou PDF, lido com IA ──────────────────────────────
// Compra grande não cabe numa foto, então a tela assume vários pedaços
// desde o começo: a pessoa fotografa de cima para baixo, sobrepondo um
// pouco, e o app junta (src/utils/receiptMerge.js).
//
// O PDF resolve isso de outro jeito: ele é o cupom inteiro numa peça só, sem
// emenda e sem risco de pular linha na junção. Quando existe PDF, é o
// caminho melhor — e por isso ele entra aqui ao lado da foto.
//
// A foto é comprimida antes de subir (cupom de perto sai com vários MB, e
// isso só faria a leitura demorar). O PDF sobe como está: comprimir seria
// redesenhá-lo como imagem e perder as páginas seguintes.

const MAX_LADO = 1600;
const QUALIDADE = 0.82;
// Teto do PDF: a Vercel corta corpo de requisição em ~4,5 MB e base64 infla
// 33%. Avisar aqui é melhor do que deixar a requisição morrer no caminho.
const MAX_PDF = 3 * 1024 * 1024;
const ehPdf = (f) => f?.type === 'application/pdf' || /\.pdf$/i.test(f?.name || '');

const base64De = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
});

/** O PDF vai inteiro; a foto, comprimida. Os dois saem no mesmo formato. */
async function preparar(file) {
    if (ehPdf(file)) {
        if (file.size > MAX_PDF) throw new Error('pdf_grande');
        return { base64: await base64De(file), mime: 'application/pdf', nome: file.name || 'documento.pdf', url: null };
    }
    return { ...(await comprimir(file)), mime: 'image/jpeg', nome: null };
}

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
    return { base64: await base64De(blob), url: URL.createObjectURL(blob) };
}

const MOTIVO = {
    unauthenticated: 'mkt.fotoErrAuth',
    invalid_token: 'mkt.fotoErrAuth',
    rate_limited: 'mkt.fotoErrBusy',
    image_too_large: 'mkt.fotoErrBig',
    pdf_too_large: 'mkt.fotoErrPdfBig',
    bad_mime: 'mkt.fotoErrType',
    unreadable: 'mkt.fotoErrUnreadable',
    no_items: 'mkt.fotoErrUnreadable',
};

export default function PhotoCapture({ isDark, onLido }) {
    const { t } = useI18n();
    const { currentUser } = useAuth();
    const [fotos, setFotos] = useState([]);          // { id, base64, url }
    const [lendo, setLendo] = useState(0);           // 0 = parado; senão, nº da foto
    const [erro, setErro] = useState('');
    // Código cru do servidor. Não traduzo: serve para quem vai consertar,
    // e sem ele um erro de servidor se disfarça de cupom ilegível.
    const [detalhe, setDetalhe] = useState('');
    const inputRef = useRef(null);
    const cameraRef = useRef(null);

    // As miniaturas usam URLs de objeto: solta ao sair, senão vaza memória.
    useEffect(() => () => fotos.forEach(f => f.url && URL.revokeObjectURL(f.url)), [fotos]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/10' : 'border-slate-200';

    const escolher = async (e) => {
        const arquivos = [...(e.target.files || [])];
        e.target.value = '';                          // permite repetir o mesmo arquivo
        if (!arquivos.length) return;
        setErro(''); setDetalhe('');
        try {
            const novas = [];
            for (const f of arquivos) novas.push({ id: `${Date.now()}-${novas.length}`, ...(await preparar(f)) });
            setFotos(l => [...l, ...novas]);
        } catch (err) {
            setErro(t(err?.message === 'pdf_grande' ? 'mkt.fotoErrPdfBig' : 'mkt.fotoErrRead'));
        }
    };

    const tirar = (f) => setFotos(l => {
        const alvo = l.find(x => x.id === f.id);
        if (alvo?.url) URL.revokeObjectURL(alvo.url);
        return l.filter(x => x.id !== f.id);
    });

    const ler = async () => {
        if (!fotos.length || lendo) return;
        setErro(''); setDetalhe('');

        // Sem usuário é o único caso em que "entre de novo" é verdade.
        if (!currentUser) { setErro(t('mkt.fotoErrAuth')); return; }

        let token;
        try {
            token = await currentUser.getIdToken();
        } catch (e) {
            // A causa muda a saída: token revogado pede login, queda de rede
            // pede só tentar de novo. Dizer sempre "sessão expirou" manda a
            // pessoa fazer login a toa e esconde o erro de quem conserta.
            console.error('[cupom] token:', e);
            const rede = e?.code === 'auth/network-request-failed';
            setErro(t(rede ? 'mkt.fotoErrNet' : 'mkt.fotoErrAuth'));
            setDetalhe(e?.code || e?.message || '');
            return;
        }

        const lotes = [];
        let recusa = '';                                 // código da 1ª falha do servidor
        for (let i = 0; i < fotos.length; i++) {
            setLendo(i + 1);
            try {
                const r = await fetch('/api/market-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ image: fotos[i].base64, mime: fotos[i].mime || 'image/jpeg' }),
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) {
                    // Uma foto ilegível no meio não deve jogar fora as outras.
                    if (MOTIVO[d.error] && fotos.length === 1) {
                        setErro(t(MOTIVO[d.error])); setDetalhe(d.error); setLendo(0); return;
                    }
                    if (!recusa) recusa = d.error || `http_${r.status}`;
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

        // Nada voltou: se o servidor recusou, o problema é lá, não no cupom.
        // Mandar "aproxime mais e evite sombra" nesse caso é mentira útil
        // para ninguém — a pessoa refotografa dez vezes sem chance de dar certo.
        if (!lotes.length) {
            setErro(t(recusa ? 'mkt.fotoErrServer' : 'mkt.fotoErrUnreadable'));
            setDetalhe(recusa);
            return;
        }

        const { items, sobrepostos } = juntarLotes(lotes);
        const cab = cabecalhoDosLotes(lotes);
        const total = totalDosLotes(lotes);
        onLido({ ...cab, total, items, conferencia: conferir(items, total), sobrepostos, fotos: lotes.length });
    };

    return (
        <div className="px-5 py-4">
            {/* Dois seletores de propósito: `capture` abre a câmera direto no
                celular, e é o caminho de quem está na saída do mercado. O outro
                é para quem já tem o cupom salvo — imagem ou PDF. */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
                onChange={escolher} className="sr-only" />
            <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple
                onChange={escolher} className="sr-only" />

            {fotos.length === 0 ? (
                <>
                    <button onClick={() => cameraRef.current?.click()}
                        className={`w-full rounded-2xl border border-dashed px-5 py-10 text-center transition ${isDark ? 'border-white/15 hover:border-emerald-500/40 hover:bg-white/[0.03]' : 'border-slate-300 hover:border-emerald-500/40 hover:bg-slate-50'}`}>
                        <Camera className="w-8 h-8 mx-auto text-emerald-500" strokeWidth={1.8} />
                        <p className={`text-[14px] font-black mt-2.5 ${ink}`}>{t('mkt.fotoTake')}</p>
                        <p className={`text-[12px] mt-1 ${muted}`}>{t('mkt.fotoHint')}</p>
                    </button>
                    {/* O PDF vem do e-mail da nota ou do site da SEFAZ, e é o
                        caminho melhor quando existe: o cupom inteiro de uma vez,
                        sem emenda entre fotos. */}
                    <button onClick={() => inputRef.current?.click()}
                        className={`w-full mt-2.5 rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition ${isDark ? 'border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.03]' : 'border-slate-200 hover:border-emerald-500/40 hover:bg-slate-50'}`}>
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <FileText className="w-[18px] h-[18px]" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                            <span className={`block text-[13.5px] font-black ${ink}`}>{t('mkt.fotoSendFile')}</span>
                            <span className={`block text-[11.5px] ${muted}`}>{t('mkt.fotoSendFileHint')}</span>
                        </span>
                    </button>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        {fotos.map((f, i) => (
                            <div key={f.id} className={`relative rounded-xl overflow-hidden border aspect-[3/4] ${line}`}>
                                {f.url ? (
                                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className={`w-full h-full flex flex-col items-center justify-center gap-1 px-1 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                                        <FileText className="w-6 h-6 text-emerald-500" strokeWidth={1.8} />
                                        <span className={`text-[9px] font-bold text-center leading-tight ${muted}`}>{f.nome}</span>
                                    </span>
                                )}
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

            {erro && (
                <div className="mt-3 text-center">
                    <p className="text-[12.5px] text-rose-500 font-semibold">{erro}</p>
                    {detalhe && <p className={`text-[10.5px] font-mono mt-1 ${muted}`}>{detalhe}</p>}
                </div>
            )}
        </div>
    );
}
