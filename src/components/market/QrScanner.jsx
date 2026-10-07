import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { Camera, CameraOff, Loader2, Link2, Check } from 'lucide-react';

// ── Leitor do QR Code da nota ───────────────────────────────────────
// Usa a câmera traseira e o BarcodeDetector do próprio navegador — sem
// biblioteca nova. É o caminho do Chrome no Android, que é onde isto vai
// ser usado (de pé, na saída do mercado).
//
// Onde o detector não existe (Safari do iPhone, por exemplo), a tela não
// finge: mostra o campo para colar o link do QR, que dá no mesmo resultado.

// A chave de acesso tem 44 dígitos. Cada portal estadual a escreve de um
// jeito — no parâmetro `p` (padrão nacional), em `chNFe`, ou solta no meio
// da URL. Em vez de exigir um formato, procuramos a chave onde ela estiver:
// quem valida host e conteúdo é o servidor.
const CHAVE_44 = /(?<![0-9])([0-9]{44})(?![0-9])/;

const ehQrDeNota = (texto) => {
    try {
        const u = new URL(String(texto).trim());
        if (!/^https?:$/.test(u.protocol)) return null;
        return CHAVE_44.test(decodeURIComponent(u.href)) ? u.toString() : null;
    } catch {
        return null;
    }
};

export default function QrScanner({ isDark, onLido, erro }) {
    const { t } = useI18n();
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const lidoRef = useRef(false);

    const [estado, setEstado] = useState('iniciando');   // iniciando|lendo|semCamera|semSuporte
    const [manual, setManual] = useState('');

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    useEffect(() => {
        let parar = false;
        let timer = null;

        const encerrar = () => {
            clearInterval(timer);
            streamRef.current?.getTracks().forEach(tr => tr.stop());
            streamRef.current = null;
        };

        const comecar = async () => {
            if (!('BarcodeDetector' in window)) { setEstado('semSuporte'); return; }
            let detector;
            try {
                const formatos = await window.BarcodeDetector.getSupportedFormats();
                if (!formatos.includes('qr_code')) { setEstado('semSuporte'); return; }
                detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            } catch {
                setEstado('semSuporte'); return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                });
                if (parar) { stream.getTracks().forEach(tr => tr.stop()); return; }
                streamRef.current = stream;
                const v = videoRef.current;
                if (!v) return;
                v.srcObject = stream;
                await v.play();
                setEstado('lendo');
            } catch {
                setEstado('semCamera'); return;
            }

            // Varredura por temporizador, não por quadro de vídeo: aba em
            // segundo plano congela o quadro e o leitor pararia sozinho.
            timer = setInterval(async () => {
                const v = videoRef.current;
                if (!v || v.readyState < 2 || lidoRef.current) return;
                try {
                    const achados = await detector.detect(v);
                    for (const a of achados) {
                        const url = ehQrDeNota(a.rawValue);
                        if (url) { lidoRef.current = true; encerrar(); onLido(url); return; }
                    }
                } catch { /* quadro ruim: tenta no próximo */ }
            }, 250);
        };

        comecar();
        return () => { parar = true; encerrar(); };
    }, [onLido]);

    const [erroManual, setErroManual] = useState('');

    // Botão desabilitado sem explicação é o pior resultado: a pessoa fica
    // sem saber o que está errado. Aceita o clique e diz o motivo.
    const enviarManual = (e) => {
        e?.preventDefault();
        const url = ehQrDeNota(manual);
        if (!url) { setErroManual(t('mkt.qrErrNotNfce')); return; }
        setErroManual('');
        onLido(url);
    };

    return (
        <div className="px-5 py-4">
            {estado === 'lendo' || estado === 'iniciando' ? (
                <>
                    <div className={`relative rounded-2xl overflow-hidden border aspect-[4/3] ${isDark ? 'border-white/10 bg-black' : 'border-slate-200 bg-slate-900'}`}>
                        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />

                        {/* Mira — ajuda a enquadrar o QR sem pensar. */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="relative w-44 h-44">
                                {['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                                ].map(c => <span key={c} className={`absolute w-9 h-9 border-emerald-400 ${c}`} />)}
                            </div>
                        </div>

                        {estado === 'iniciando' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <Loader2 className="w-6 h-6 animate-spin text-white/80" />
                            </div>
                        )}
                    </div>
                    <p className={`text-[12.5px] text-center mt-3 flex items-center justify-center gap-1.5 ${muted}`}>
                        <Camera className="w-3.5 h-3.5" /> {t('mkt.qrAim')}
                    </p>
                </>
            ) : (
                <div className={`rounded-2xl border border-dashed px-5 py-6 text-center ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <CameraOff className={`w-7 h-7 mx-auto ${muted}`} strokeWidth={1.8} />
                    <p className={`text-[13.5px] font-bold mt-2 ${ink}`}>
                        {t(estado === 'semCamera' ? 'mkt.qrNoCamera' : 'mkt.qrNoSupport')}
                    </p>
                    <p className={`text-[12px] mt-1 ${muted}`}>
                        {t(estado === 'semCamera' ? 'mkt.qrNoCameraDesc' : 'mkt.qrNoSupportDesc')}
                    </p>
                </div>
            )}

            {erro && (
                <p className="text-[12.5px] text-rose-500 font-semibold text-center mt-3">{erro}</p>
            )}

            {/* Colar o link do QR — serve de saída quando a câmera não rola. */}
            <form onSubmit={enviarManual} className="mt-4">
                <label htmlFor="mkt-qr-link" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                    {t('mkt.qrPasteLabel')}
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Link2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
                        <input id="mkt-qr-link" value={manual} onChange={(e) => setManual(e.target.value)}
                            placeholder="https://www4.fazenda.rj.gov.br/consultaNFCe/QRCode?p=…"
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-[13px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`} />
                    </div>
                    <button type="submit" disabled={!manual.trim()} aria-label={t('mkt.qrPasteGo')}
                        className="px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-35 text-white transition active:scale-95 shrink-0">
                        <Check className="w-4 h-4" strokeWidth={3} />
                    </button>
                </div>
                {erroManual && <p className="text-[12px] text-rose-500 font-semibold mt-2">{erroManual}</p>}
            </form>
        </div>
    );
}
