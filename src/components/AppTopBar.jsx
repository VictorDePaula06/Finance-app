import React from 'react';
import { ClipboardList, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { useSaldoConta } from '../hooks/useSaldoConta';
import { usePrivacy } from '../contexts/PrivacyContext';
import { useCadastroPendente } from '../hooks/useCadastroPendente';
import WhatsAppStatusButton from './WhatsAppStatusButton';
import WhatsAppStatusModal from './WhatsAppStatusModal';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';
import { APP_VERSION, RELEASE_NOTES_URL } from './AppSidebar';

// ── Barra superior ──────────────────────────────────────────────────
// Formato da referência: marca à esquerda, e à direita um bloco de dado
// "cru" (rótulo minúsculo em caixa alta + valor), seguido dos atalhos.
//
// O saldo entra assim de propósito — SEM caixa e SEM cor. Ele aparece em
// todas as abas, então precisa informar sem competir com o conteúdo; a
// cor fica reservada para o que exige ação. Quem quiser o saldo com
// destaque tem o cartão do dashboard.

export default function AppTopBar({ titulo, onWhatsApp, onCadastros }) {
    const { theme } = useTheme();
    const { t, fmtMoney } = useI18n();
    const isDark = theme !== 'light';
    const { saldo, carregando } = useSaldoConta();
    const wa = useWhatsAppStatus();
    const { oculto, alternar } = usePrivacy();
    const { pendente } = useCadastroPendente();
    const [waAberto, setWaAberto] = React.useState(false);

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
                    v{APP_VERSION} <span className="hidden xl:inline font-bold opacity-80">· {t('nav.releaseNotes')}</span>
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
                {/* Um olho para a tela inteira: apaga este saldo e todo valor
                    da área de conteúdo, não só o número daqui. */}
                <button type="button" onClick={alternar} className={icone} aria-pressed={oculto}
                    title={t(oculto ? 'privacy.show' : 'privacy.hide')} aria-label={t(oculto ? 'privacy.show' : 'privacy.hide')}>
                    {oculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            <span className={`w-px h-6 shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

            {/* Atalhos */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Conectado: mostra o número numa janela. Sem número não há o
                    que informar, então o clique vai direto para a configuração. */}
                <WhatsAppStatusButton isDark={isDark} compact ringColor={isDark ? 'ring-[#060a08]' : 'ring-white'}
                    onOpen={() => (wa.connected ? setWaAberto(true) : onWhatsApp())} />
                {/* Com a palavra escrita: um ícone sozinho aqui era lido como
                    "ajustes do sistema", e ninguém procurava o cadastro do
                    salário atrás dele. */}
                <button type="button" onClick={onCadastros}
                    title={pendente ? t('reg.emptyAlert') : t('settings.tabRegistry')}
                    className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95 ${pendente
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/[0.16]'
                        : (isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.07] hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800')}`}>
                    <ClipboardList className="w-[17px] h-[17px] shrink-0" />
                    <span>{t('settings.tabRegistry')}</span>
                    {pendente && (
                        <span className="absolute -top-1 -right-1 flex w-2.5 h-2.5" aria-hidden>
                            <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-70 animate-ping" />
                            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ${isDark ? 'ring-[#060a08]' : 'ring-white'}`} />
                        </span>
                    )}
                </button>
            </div>
            {waAberto && (
                <WhatsAppStatusModal isDark={isDark} phones={wa.linked.map(l => l.phone)}
                    onClose={() => setWaAberto(false)}
                    onManage={() => { setWaAberto(false); onWhatsApp(); }} />
            )}
        </header>
    );
}
