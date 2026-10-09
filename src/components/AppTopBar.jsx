import React from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { useSaldoConta } from '../hooks/useSaldoConta';
import WhatsAppStatusButton from './WhatsAppStatusButton';
import { APP_VERSION, RELEASE_NOTES_URL } from './AppSidebar';

// ── Barra superior ──────────────────────────────────────────────────
// Formato da referência: marca à esquerda, e à direita um bloco de dado
// "cru" (rótulo minúsculo em caixa alta + valor), seguido dos atalhos.
//
// O saldo entra assim de propósito — SEM caixa e SEM cor. Ele aparece em
// todas as abas, então precisa informar sem competir com o conteúdo; a
// cor fica reservada para o que exige ação. Quem quiser o saldo com
// destaque tem o cartão do dashboard.

const OCULTAR_KEY = 'aliviaTopBarOcultarSaldo';

export default function AppTopBar({ titulo, onSettings, onWhatsApp }) {
    const { theme } = useTheme();
    const { t, fmtMoney } = useI18n();
    const isDark = theme !== 'light';
    const { saldo, carregando } = useSaldoConta();

    // O saldo fica à vista numa barra fixa; quem usa o app em público
    // precisa poder apagá-lo, e a escolha tem que sobreviver ao recarregar.
    const [oculto, setOculto] = React.useState(() => {
        try { return localStorage.getItem(OCULTAR_KEY) === '1'; } catch { return false; }
    });
    const alternar = () => setOculto(v => {
        try { localStorage.setItem(OCULTAR_KEY, v ? '0' : '1'); } catch { /* modo privado */ }
        return !v;
    });

    const rotulo = isDark ? 'text-slate-500' : 'text-slate-400';
    const valor = isDark ? 'text-white' : 'text-slate-800';
    const icone = `w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95 ${isDark
        ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`;

    return (
        <header className={`hidden lg:flex sticky top-0 z-30 items-center gap-4 h-14 px-5 shrink-0 border-b ${isDark ? 'border-white/[0.06] bg-[#060a08]/80' : 'border-slate-100 bg-white/80'} backdrop-blur`}>
            {/* Onde a pessoa está. A marca fica no topo da lateral, colada nesta
                mesma linha — repeti-la aqui seria a segunda marca do mesmo canto. */}
            <div className="flex items-center gap-2 min-w-0">
                <h1 className={`text-[14px] font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</h1>
                <a href={RELEASE_NOTES_URL} target="_blank" rel="noopener noreferrer" title={t('nav.releaseNotesTitle')}
                    className={`text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md transition shrink-0 ${isDark ? 'bg-white/5 text-slate-400 hover:text-emerald-400' : 'bg-slate-100 text-slate-500 hover:text-emerald-600'}`}>
                    v{APP_VERSION}
                </a>
            </div>

            <div className="flex-1" />

            {/* Saldo — dado cru, sem caixa e sem cor */}
            <div className="flex items-center gap-2 shrink-0">
                <div className="text-right leading-tight">
                    <p className={`text-[9.5px] font-bold uppercase tracking-[0.18em] ${rotulo}`}>{t('dash.balance')}</p>
                    <p className={`text-[15px] font-black tabular-nums ${valor} ${oculto ? 'select-none' : ''}`}>
                        {carregando ? '—' : oculto ? 'R$ ••••' : `R$ ${fmtMoney(saldo)}`}
                    </p>
                </div>
                <button type="button" onClick={alternar} className={icone}
                    title={t(oculto ? 'common.show' : 'common.hide')} aria-label={t(oculto ? 'common.show' : 'common.hide')}>
                    {oculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            <span className={`w-px h-6 shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Atalhos */}
            <div className="flex items-center gap-1.5 shrink-0">
                <WhatsAppStatusButton isDark={isDark} compact onOpen={onWhatsApp} ringColor={isDark ? 'ring-[#060a08]' : 'ring-white'} />
                <button type="button" onClick={onSettings} className={icone}
                    title={t('nav.settings')} aria-label={t('nav.settings')}>
                    <Settings className="w-[18px] h-[18px]" />
                </button>
            </div>
        </header>
    );
}
