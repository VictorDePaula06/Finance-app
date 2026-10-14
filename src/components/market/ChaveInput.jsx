import React, { useMemo, useState } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { lerChave, formataChave, formataCnpj, digitosDaChave, urlDeConsulta } from '../../utils/chaveNfce';
import { KeyRound, Check, CheckCircle2, AlertCircle } from 'lucide-react';

// ── Digitar a chave de acesso ───────────────────────────────────────
// São 44 dígitos impressos no rodapé do cupom. Digitar isso à mão erra fácil,
// então a tela trabalha a favor:
//
//  · o campo formata em blocos de 4, igual ao papel, para a pessoa conseguir
//    acompanhar com o dedo onde parou;
//  · o 44º dígito confere os outros 43 (módulo 11), então erro de digitação
//    aparece NA HORA — sem rede, sem espera, sem "não encontrada";
//  · quando a chave fecha, a tela mostra o que ela diz (estado, mês, número
//    da nota, CNPJ) para a pessoa confirmar que é a nota certa antes de
//    gastar uma consulta.
//
// O que a chave NÃO diz são os produtos: isso só existe no portal da SEFAZ.
// Por isso o botão busca, mas o aviso embaixo é honesto sobre o que acontece
// quando o portal não responde.

const MOTIVO = {
    curta: 'mkt.keyErrShort',
    longa: 'mkt.keyErrLong',
    dv: 'mkt.keyErrDv',
    uf: 'mkt.keyErrUf',
    data: 'mkt.keyErrDate',
};

export default function ChaveInput({ isDark, onConsultar, erro }) {
    const { t } = useI18n();
    const [texto, setTexto] = useState('');

    const digitos = digitosDaChave(texto);
    const info = useMemo(() => lerChave(digitos), [digitos]);
    const vazio = digitos.length === 0;

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    // Mostra o aviso só quando a chave está completa: reclamar de "curta"
    // enquanto a pessoa ainda digita é implicar com quem está no meio do caminho.
    const mostrarErro = !info.ok && digitos.length >= 44;

    const enviar = (e) => {
        e?.preventDefault();
        if (info.ok) onConsultar(urlDeConsulta(info), info);
    };

    return (
        <form onSubmit={enviar} className="px-5 py-4">
            <label htmlFor="mkt-chave" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                {t('mkt.keyLabel')}
            </label>

            <div className="relative">
                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
                <input
                    id="mkt-chave"
                    value={formataChave(texto)}
                    onChange={(e) => setTexto(digitosDaChave(e.target.value).slice(0, 44))}
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    className={`w-full pl-9 pr-16 py-3 rounded-xl border text-[14px] font-semibold tabular-nums tracking-wide outline-none transition ${
                        mostrarErro ? 'border-rose-500/60 focus:border-rose-500'
                            : info.ok ? 'border-emerald-500/60 focus:border-emerald-500'
                                : (isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-emerald-500')
                    } ${mostrarErro || info.ok ? (isDark ? 'bg-white/5 text-white' : 'bg-white text-slate-800') : ''}`}
                />
                {/* Contador: 44 dígitos sem referência é fácil de perder a conta. */}
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black tabular-nums ${
                    info.ok ? 'text-emerald-500' : mostrarErro ? 'text-rose-500' : muted}`}>
                    {digitos.length}/44
                </span>
            </div>

            <p className={`text-[11.5px] mt-1.5 ${muted}`}>{t('mkt.keyWhere')}</p>

            {mostrarErro && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-rose-500 font-semibold mt-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                    {t(MOTIVO[info.erro] || 'mkt.keyErrDv')}
                </p>
            )}

            {/* A nota que a chave descreve — confirma antes de consultar que é
                mesmo a compra que a pessoa tem na mão. */}
            {info.ok && (
                <div className={`mt-3 rounded-xl border px-3.5 py-3 ${isDark ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-emerald-200 bg-emerald-50/70'}`}>
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('mkt.keyValid')}
                    </p>
                    <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-[12.5px] ${ink}`}>
                        <Dado isDark={isDark} rotulo={t('mkt.keyState')} valor={info.uf} />
                        <Dado isDark={isDark} rotulo={t('mkt.keyIssued')} valor={`${String(info.mes).padStart(2, '0')}/${info.ano}`} />
                        <Dado isDark={isDark} rotulo={t('mkt.keyNumber')} valor={`nº ${info.numero}`} />
                        <Dado isDark={isDark} rotulo={t('mkt.keyIssuer')} valor={formataCnpj(info.cnpj)} />
                    </div>
                    {!info.ehNfce && (
                        <p className="text-[11.5px] text-amber-500 font-semibold mt-2">{t('mkt.keyNotNfce')}</p>
                    )}
                </div>
            )}

            {erro && <p className="text-[12.5px] text-rose-500 font-semibold mt-2.5">{erro}</p>}

            <button type="submit" disabled={!info.ok}
                className="w-full mt-3.5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-35 disabled:cursor-not-allowed text-white text-[13.5px] font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]">
                <Check className="w-4 h-4" strokeWidth={3} /> {t('mkt.keyFetch')}
            </button>

            {/* Honestidade sobre o que vem depois: o QR impresso carrega uma
                assinatura que a chave digitada não tem, e alguns portais
                recusam a consulta sem ela. Melhor dizer antes do que parecer
                defeito depois. */}
            {!vazio && (
                <p className={`text-[11.5px] mt-2.5 leading-relaxed ${muted}`}>{t('mkt.keyFallbackNote')}</p>
            )}
        </form>
    );
}

function Dado({ isDark, rotulo, valor }) {
    return (
        <span className="min-w-0">
            <span className={`block text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{rotulo}</span>
            <span className="block font-bold tabular-nums truncate">{valor}</span>
        </span>
    );
}
