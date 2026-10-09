import React, { useState } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import CadastrosModal from '../CadastrosModal';
import { ClipboardList, ChevronRight } from 'lucide-react';

// ── Caminho do cadastro ─────────────────────────────────────────────
// Em Contas a pagar / Contas a receber a pessoa só dá baixa e lança avulsos;
// o cadastro das contas e entradas FIXAS mora em Cadastros.
//
// Antes esta linha navegava para a aba Cadastros da página de Configurações.
// Essa aba não existe mais — Cadastros virou a janela que abre pela
// engrenagem da barra. Então o atalho abre a MESMA janela, já na aba certa,
// e a pessoa volta para onde estava ao fechar, sem trocar de tela.
export default function RegistryHint({ isDark, label, aba = 'recorrentes' }) {
    const { t } = useI18n();
    const [aberto, setAberto] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className={`group mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] rounded-lg px-2 py-1 -ml-2 transition ${isDark
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
                <span className={`font-bold ${isDark ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-500 group-hover:text-emerald-600'}`}>
                    {t('settings.tabRegistry')}
                </span>
                <ChevronRight className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
            </button>
            {aberto && <CadastrosModal abaInicial={aba} onClose={() => setAberto(false)} />}
        </>
    );
}
