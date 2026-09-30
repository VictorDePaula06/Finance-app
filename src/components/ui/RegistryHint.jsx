import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../contexts/LanguageContext';
import RedirectOverlay, { useRedirect } from './RedirectOverlay';
import { ClipboardList, ChevronRight } from 'lucide-react';

// ── Caminho do cadastro ─────────────────────────────────────────────
// Em Contas a pagar / Contas a receber a pessoa só dá baixa e lança avulsos;
// o cadastro das contas e entradas FIXAS mora em Configurações e Cadastros.
// Esta linha diz isso e leva direto para a aba certa — discreta, no cabeçalho,
// para não competir com os cards. A troca de tela passa pela janela padrão
// "Você será direcionado para…", como nos outros atalhos do app.
export default function RegistryHint({ isDark, label }) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const { redirect, goTo } = useRedirect();
    const path = t('registry.path');

    return (
        <>
            <button
                type="button"
                // A janela mostra so o nome do destino ("Cadastros"), como nos
                // demais atalhos — o caminho completo quebraria em duas linhas.
                onClick={() => goTo(t('settings.tabRegistry'), () => navigate('/app/configuracoes?tab=cadastros'))}
                className={`group mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] rounded-lg px-2 py-1 -ml-2 transition ${isDark
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
                <span className={`font-bold ${isDark ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-500 group-hover:text-emerald-600'}`}>
                    {path}
                </span>
                <ChevronRight className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
            </button>
            {redirect && <RedirectOverlay isDark={isDark} label={redirect} />}
        </>
    );
}
