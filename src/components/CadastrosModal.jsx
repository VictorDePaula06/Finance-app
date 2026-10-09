import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { RecorrentesRegistry } from './CadastrosTab';
import CardsRegistry from './CardsRegistry';
import CategoryCeilings from './CategoryCeilings';
import MarketSection from './MarketSection';
import { Repeat, CreditCard, Target, ShoppingCart, ClipboardList, X } from 'lucide-react';

// ── Cadastros, numa janela ──────────────────────────────────────────
// Mesmas quatro seções da aba "Cadastros" de Configurações — as MESMAS
// componentes, não cópias: o que mudar lá muda aqui. A diferença é só a
// apresentação: em Configurações elas vêm empilhadas, aqui vêm uma por aba.
//
// Cada seção já traz o próprio cabeçalho (título, descrição e o botão de
// adicionar) e já lista em tabela. Por isso a janela não repete nada disso:
// ela entrega a moldura, a barra de abas, e sai da frente.

const ABAS = [
    { id: 'recorrentes', label: 'reg.tabRecurring', icon: Repeat,       Secao: RecorrentesRegistry },
    { id: 'cartoes',     label: 'reg.tabCards',     icon: CreditCard,   Secao: CardsRegistry },
    { id: 'tetos',       label: 'reg.tabCeilings',  icon: Target,       Secao: CategoryCeilings },
    { id: 'mercado',     label: 'mkt.title',        icon: ShoppingCart, Secao: MarketSection },
];

export default function CadastrosModal({ onClose, abaInicial = 'recorrentes' }) {
    const { theme } = useTheme();
    const { t } = useI18n();
    const isDark = theme !== 'light';
    const [aba, setAba] = useState(abaInicial);

    // A página atrás para de rolar enquanto a janela está aberta — sem isso a
    // roda do mouse arrasta o conteúdo por baixo do overlay.
    //
    // Esc NÃO fecha, de propósito: a janela guarda formulários meio
    // preenchidos, e Esc é tecla fácil de esbarrar. Fechar é só no X.
    useEffect(() => {
        const antes = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = antes; };
    }, []);

    const atual = ABAS.find(x => x.id === aba) || ABAS[0];
    const Secao = atual.Secao;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    // Portal no <body>: a janela precisa ficar na frente do sistema inteiro,
    // e qualquer ancestral com transform ou filter prenderia um `fixed` dentro
    // de si — foi por isso que ela não nasceu dentro da barra superior.
    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
            role="dialog" aria-modal="true" aria-label={t('settings.tabRegistry')}>
            {/* Só escurece. Não fecha no clique e, por estar por cima, também
                impede que o clique chegue na tela de trás. */}
            <div className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150" />

            {/* Altura FIXA, não "até": as abas têm conteúdos de tamanhos bem
                diferentes, e com altura elástica o X e os botões pulavam de
                lugar a cada troca. Quem se ajusta é o corpo, rolando. */}
            <div className={`relative w-full max-w-5xl h-[min(760px,90vh)] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-[#0b100e] border-white/10' : 'bg-slate-50 border-slate-200'}`}>

                {/* Cabeçalho */}
                <div className={`flex items-center gap-3 px-5 sm:px-6 py-4 border-b shrink-0 ${isDark ? 'border-white/[0.07]' : 'border-slate-200 bg-white'}`}>
                    <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-[18px] h-[18px]" />
                    </span>
                    <div className="min-w-0">
                        <h2 className={`text-[16px] font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {t('settings.tabRegistry')}
                        </h2>
                        <p className={`text-[12px] truncate ${muted}`}>{t('reg.modalDesc')}</p>
                    </div>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`ml-auto w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition active:scale-95 ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-[18px] h-[18px]" strokeWidth={2.4} />
                    </button>
                </div>

                {/* Abas */}
                <div className={`flex items-center gap-1 px-3 sm:px-4 py-2 border-b shrink-0 overflow-x-auto no-scrollbar ${isDark ? 'border-white/[0.07]' : 'border-slate-200 bg-white'}`}>
                    {ABAS.map(({ id, label, icon: Icon }) => {
                        const on = aba === id;
                        return (
                            <button key={id} onClick={() => setAba(id)} aria-current={on ? 'page' : undefined}
                                className={`relative shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-[12px] sm:text-[13px] transition ${on
                                    ? (isDark ? 'font-bold text-white' : 'font-bold bg-emerald-50 text-emerald-800')
                                    : (isDark ? 'font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.045]' : 'font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}
                                style={on && isDark ? {
                                    backgroundImage: 'linear-gradient(90deg, rgba(36,219,146,0.17), rgba(36,219,146,0.07))',
                                    boxShadow: '0 0 22px -6px rgba(36,219,146,0.35)',
                                } : undefined}>
                                <Icon className={`w-4 h-4 shrink-0 hidden sm:block ${on ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : ''}`} strokeWidth={on ? 2.3 : 2} />
                                {t(label)}
                            </button>
                        );
                    })}
                </div>

                {/* Conteúdo — a seção escolhida, inteira, do jeito que ela já é */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    <Secao isDark={isDark} />
                </div>
            </div>
        </div>,
        document.body,
    );
}
