import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { marketPrefs } from '../utils/market';
import ListaTab from '../components/market/ListaTab';
import ComprasTab from '../components/market/ComprasTab';
import AnaliseTab from '../components/market/AnaliseTab';
import NovaCompraModal from '../components/market/NovaCompraModal';
import logoMercado from '../assets/logo-mercado.png';
import { ArrowLeft, Sun, Moon, ListChecks, Receipt, PieChart } from 'lucide-react';

// ── /mercado ────────────────────────────────────────────────────────
// Tela própria, em tela cheia, fora do layout do app — como a sala de
// gráficos. Três abas: montar a lista, lançar/ver as compras e analisar.
//
// A ideia que guia o desenho: isto é usado EM PÉ, no corredor do mercado,
// com uma mão. Por isso a lista vem primeiro e os alvos de toque são largos.

const ABAS = [
    { id: 'lista', key: 'mkt.tabList', icon: ListChecks },
    { id: 'compras', key: 'mkt.tabPurchases', icon: Receipt },
    { id: 'analise', key: 'mkt.tabAnalysis', icon: PieChart },
];

const monthKeyNow = () => new Date().toISOString().slice(0, 7);

export default function Mercado() {
    const { currentUser, userPrefs } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { t } = useI18n();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [aba, setAba] = useState('lista');
    const [items, setItems] = useState([]);
    const [listas, setListas] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [nova, setNova] = useState(false);
    // Junções feitas à mão ("filezinho da Sadia é o mesmo da Perdigão").
    // Um documento por pessoa: é mapa, não lista, e muda junto.
    const [apelidos, setApelidos] = useState({ mapa: {}, rotulos: {} });

    const prefs = useMemo(() => marketPrefs(userPrefs), [userPrefs]);

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const subs = [
            onSnapshot(q('market_items'), (s) => setItems(
                s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))), () => { }),
            onSnapshot(q('market_lists'), (s) => setListas(
                s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))), () => { }),
            onSnapshot(q('market_purchases'), (s) => setPurchases(
                s.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))), () => { }),
            // Consulta, não leitura direta do documento: as regras negam ler um
            // documento que ainda NÃO existe (resource == null), e quem nunca
            // juntou nada não tem documento. Com `where`, o conjunto vazio
            // volta sem erro — e o listener continua vivo para quando a
            // primeira junção criar o documento.
            onSnapshot(query(collection(db, 'market_aliases'), where('userId', '==', uid)), (s) => {
                const d = s.docs[0]?.data();
                setApelidos({ mapa: d?.mapa || {}, rotulos: d?.rotulos || {} });
            }, () => { }),
        ];
        return () => subs.forEach(u => u());
    }, [uid]);

    const bg = isDark ? 'bg-[#050a08]' : 'bg-white';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    const faltando = items.filter(i => !i.done).length;

    return (
        <div className={`min-h-[100dvh] w-full flex flex-col ${bg}`}>
            {/* Cabeçalho da marca */}
            <header className={`sticky top-0 z-20 border-b ${line} ${isDark ? 'bg-[#050a08]/95' : 'bg-white/95'} backdrop-blur px-4 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3`}>
                <a href="/app/configuracoes?tab=cadastros" title={t('mkt.backToApp')}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                    <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
                </a>

                <img src={logoMercado} alt="" aria-hidden="true" className="w-9 h-9 object-contain shrink-0" />
                <div className="min-w-0">
                    <h1 className="text-[15px] font-black tracking-tight leading-none">
                        <span className="text-emerald-500">Alívia</span>
                        <span className={`ml-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${muted}`}>Finanças</span>
                    </h1>
                    <p className={`text-[11px] font-black uppercase tracking-[0.22em] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('mkt.brandSuffix')}
                    </p>
                </div>

                <button onClick={toggleTheme} aria-label={t(isDark ? 'charts.themeLight' : 'charts.themeDark')}
                    title={t(isDark ? 'charts.themeLight' : 'charts.themeDark')}
                    className={`ml-auto w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.07]' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'}`}>
                    {isDark ? <Sun className="w-4 h-4" strokeWidth={2.2} /> : <Moon className="w-4 h-4" strokeWidth={2.2} />}
                </button>
            </header>

            {/* Corpo: coluna de abas à esquerda, conteúdo à direita.
                No celular a coluna sairia roubando largura de uma tela que já
                é estreita, e esta tela é usada EM PÉ no corredor, com uma mão
                — lá as abas continuam embaixo, ao alcance do polegar. */}
            <div className="flex-1 flex min-h-0">
                <nav className={`hidden sm:flex flex-col shrink-0 w-[190px] border-r ${line} py-4 px-2.5 gap-1`}
                    role="tablist" aria-label={t('mkt.title')}>
                    {ABAS.map(x => {
                        const Icon = x.icon;
                        const on = aba === x.id;
                        return (
                            <button key={x.id} role="tab" aria-selected={on} onClick={() => setAba(x.id)}
                                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-bold text-left transition ${on
                                    ? (isDark ? 'bg-emerald-500/[0.12] text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                    : `${muted} ${isDark ? 'hover:text-slate-300 hover:bg-white/[0.04]' : 'hover:text-slate-600 hover:bg-slate-100'}`}`}>
                                {/* A luz verde na aba ativa, como no resto do app. */}
                                {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-emerald-500" />}
                                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={on ? 2.5 : 2.2} />
                                <span className="truncate">{t(x.key)}</span>
                                {x.id === 'lista' && faltando > 0 && (
                                    <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">{faltando}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <main className="flex-1 min-w-0 px-4 sm:px-6 py-4 sm:py-7 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] sm:pb-7">
                    {aba === 'lista' && (
                        <ListaTab isDark={isDark} uid={uid} items={items} listas={listas}
                            purchases={purchases} apelidos={apelidos} />
                    )}
                    {aba === 'compras' && <ComprasTab isDark={isDark} purchases={purchases} onNova={() => setNova(true)} />}
                    {aba === 'analise' && (
                        <AnaliseTab isDark={isDark} uid={uid} purchases={purchases} mk={monthKeyNow()}
                            ceiling={prefs.ceiling} apelidos={apelidos} />
                    )}
                </main>
            </div>

            <footer className={`hidden sm:block border-t ${line} px-4 sm:px-6 py-2.5`}>
                <p className={`text-[11px] ${muted}`}>
                    <span className={ink}>{t('mkt.brand')}</span> · {t('mkt.brandSuffix')}
                </p>
            </footer>

            {/* Abas no rodapé (celular): alvo largo e ao alcance do polegar. */}
            <nav role="tablist" aria-label={t('mkt.title')}
                className={`sm:hidden fixed bottom-0 inset-x-0 z-20 border-t ${line} ${isDark ? 'bg-[#050a08]/95' : 'bg-white/95'} backdrop-blur flex`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {ABAS.map(x => {
                    const Icon = x.icon;
                    const on = aba === x.id;
                    return (
                        <button key={x.id} role="tab" aria-selected={on} onClick={() => setAba(x.id)}
                            className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${on ? 'text-emerald-500' : muted}`}>
                            <span className="relative">
                                <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.5 : 2} />
                                {x.id === 'lista' && faltando > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                                        {faltando}
                                    </span>
                                )}
                            </span>
                            {t(x.key)}
                        </button>
                    );
                })}
            </nav>

            {nova && <NovaCompraModal isDark={isDark} uid={uid} onClose={() => setNova(false)} />}
        </div>
    );
}
