import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../components/AppSidebar';
import logo from '../assets/logo.png';
import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import {
    Sparkles, Settings, ClipboardList, Target, Repeat, ArrowLeftRight, CreditCard,
    LayoutDashboard, BookOpen, Sun, Moon, Rocket, CalendarClock, Tag,
} from 'lucide-react';

// ── Notas de atualização (página pública: /novidades) ───────────────
// Abre em nova aba ao clicar na versão (v1.2) na sidebar / topo do mobile.
// Para uma nova versão: adicione um bloco no topo de RELEASES e ajuste
// APP_VERSION em AppSidebar.jsx (e versionName/versionCode no mobile).

const RELEASES = [
    {
        version: '1.2',
        date: '21/09/2026',
        title: 'Cadastros centralizados, tetos por categoria e uma Alívia mais esperta',
        intro: 'Reorganizamos onde cada coisa é feita, deixamos Recorrentes e Meu cartão mais bonitos e a Alívia passou a te avisar quando um gasto se aproxima do teto — no app e no WhatsApp.',
        sections: [
            {
                icon: Settings, color: '#64748b', title: 'Configurações e Cadastros',
                items: [
                    'A antiga "Configurações" virou "Configurações e Cadastros" e fica no rodapé do menu, logo acima do seu nome.',
                    'Cinco abas na horizontal: Geral, Cadastros, WhatsApp, Assinatura e Dados e Privacidade.',
                    'Aparência foi incorporada à aba Geral; WhatsApp e Assinatura saíram do menu principal e viraram abas aqui.',
                ],
            },
            {
                icon: ClipboardList, color: '#10b981', title: 'Cadastros (nova aba)',
                items: [
                    'Entradas e despesas recorrentes em lista: adicionar, editar e excluir num só lugar. O formulário pergunta o tipo, a categoria (de acordo com o tipo), valor, dia, fixo ou variável e forma de pagamento.',
                    'Cartões de crédito passaram a ser cadastrados, editados e excluídos aqui — Meu cartão só usa.',
                    'Ao digitar o banco (Nubank, PicPay, Itaú, Inter, Bradesco, Santander, Caixa, BB, C6 e outros), o cartão ganha o logo real e a cor da marca.',
                ],
            },
            {
                icon: Target, color: '#f59e0b', title: 'Teto por categoria',
                items: [
                    'Defina quanto, no máximo, quer gastar por mês em cada categoria (ex.: até R$ 1.000 em Alimentação).',
                    'O painel mostra os 3 maiores tetos e expande para todas as categorias.',
                    'No Dashboard, a Alívia avisa quando uma categoria passa de 80% do teto ou estoura, com quanto ainda cabe no mês.',
                ],
            },
            {
                icon: Repeat, color: '#f59e0b', title: 'Recorrentes',
                items: [
                    'Agora só despesas, em cards, com o seletor A pagar / Pago no topo e os totais do mês ao lado (Contas a pagar, Na fatura, Total recorrentes).',
                    'Cada card tem o botão Dar baixa (ou Lançar na fatura, para contas pagas no cartão) e mostra se está pendente ou atrasada.',
                    'Parcelamentos e assinaturas do cartão aparecem separados, só para consulta — edições e baixas continuam em Meu cartão.',
                ],
            },
            {
                icon: ArrowLeftRight, color: '#06b6d4', title: 'Lançamentos',
                items: [
                    'Novo lançamento › Entrada abre uma janela com suas entradas recorrentes em cards e o botão Confirmar recebimento.',
                    'O lançamento avulso abre logo abaixo, na mesma janela, pelo botão "Lançar entrada avulsa".',
                ],
            },
            {
                icon: CreditCard, color: '#a855f7', title: 'Meu cartão',
                items: [
                    'Cartão redesenhado com proporção de cartão real, chip e bandeira; fatura atual e métricas alinhadas na mesma altura.',
                    'Seletor de cartões com o logo do banco. Cadastro e edição migraram para Cadastros (botão Gerenciar cartões).',
                ],
            },
            {
                icon: LayoutDashboard, color: '#10b981', title: 'Dashboard',
                items: [
                    'Fatura do cartão soma todos os cartões e, com mais de um, mostra a fatura de cada um com o ícone do banco.',
                    'Ao clicar em Ver fatura, Ver detalhes, Ver patrimônio ou Ver análise completa, aparece a janela "Você será direcionado para…" antes de trocar de tela.',
                    'O botão WhatsApp conectado abre uma janela com o número vinculado e o status, sem sair do Dashboard.',
                ],
            },
            {
                icon: WhatsAppIcon, color: '#25D366', title: 'Alívia no WhatsApp', wa: true,
                items: [
                    'Forma de pagamento padrão: escolha PIX, débito, dinheiro ou cartão de crédito (e qual cartão). Quando você não diz como pagou, a Alívia lança nessa forma.',
                    'A cada gasto, ela informa o acumulado da categoria e, se houver teto, em quantos % você está — avisando quando se aproximar ou passar.',
                    'Ícone oficial do WhatsApp no app; Conexão e Notificações na mesma tela, uma abaixo da outra.',
                ],
            },
            {
                icon: BookOpen, color: '#8b5cf6', title: 'Manual',
                items: ['Reescrito com o fluxo atual, um guia por aba, a explicação do teto por categoria e a tabela "Onde faço cada coisa?".'],
            },
        ],
    },
    {
        version: '1.0',
        date: '2026',
        title: 'Primeira versão do Alívia',
        intro: 'Dashboard, Lançamentos, Recorrentes, Meu cartão, Reservas, Patrimônio, Análises e a Alívia no WhatsApp.',
        sections: [],
    },
];

export default function Novidades() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const body = isDark ? 'text-slate-300' : 'text-slate-600';

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0e0f12] text-white' : 'bg-slate-50 text-slate-800'}`}
            style={isDark ? { backgroundImage: 'radial-gradient(1100px 520px at 10% -10%, rgba(16,185,129,0.16), transparent 60%)' } : undefined}>
            <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
                {/* Topo */}
                <div className="flex items-center gap-3 mb-8">
                    <img src={logo} alt="Alívia" className="w-12 h-12 object-cover object-top rounded-xl" />
                    <div className="min-w-0">
                        <p className="text-[20px] font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500">Alívia</p>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mt-1 ${muted}`}>Notas de atualização</p>
                    </div>
                    <button onClick={toggleTheme} aria-label="Alternar tema"
                        className={`ml-auto w-9 h-9 rounded-xl flex items-center justify-center transition ${isDark ? 'bg-white/5 text-amber-300 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>

                {RELEASES.map((r, idx) => {
                    const current = r.version === APP_VERSION;
                    return (
                        <article key={r.version} className={`rounded-3xl border overflow-hidden mb-6 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
                            {/* Cabeçalho da versão */}
                            <div className={`px-6 sm:px-8 py-6 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'} ${current ? (isDark ? 'bg-emerald-500/[0.06]' : 'bg-emerald-50/70') : ''}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-black px-2.5 py-1 rounded-full ${current ? 'bg-emerald-500 text-white' : (isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-600')}`}>
                                        <Tag className="w-3.5 h-3.5" /> v{r.version}
                                    </span>
                                    {current && <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-500`}><Sparkles className="w-3 h-3" /> Versão atual</span>}
                                    <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${muted}`}><CalendarClock className="w-3.5 h-3.5" /> {r.date}</span>
                                </div>
                                <h1 className={`text-2xl sm:text-[26px] font-black tracking-tight mt-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.title}</h1>
                                <p className={`text-[14px] leading-relaxed mt-2 ${body}`}>{r.intro}</p>
                            </div>

                            {r.sections.length > 0 && (
                                <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
                                    {r.sections.map(sec => {
                                        const Icon = sec.icon;
                                        return (
                                            <section key={sec.title} className="px-6 sm:px-8 py-5">
                                                <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sec.color}1f`, color: sec.color }}>
                                                        <Icon className="w-4 h-4" strokeWidth={2.2} />
                                                    </span>
                                                    {sec.title}
                                                </h2>
                                                <ul className="space-y-2 pl-1">
                                                    {sec.items.map((it, i) => (
                                                        <li key={i} className="flex items-start gap-2.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                                                            <span className={`text-[13.5px] leading-relaxed ${body}`}>{it}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}
                            {idx === 0 && (
                                <div className={`px-6 sm:px-8 py-4 border-t flex items-center gap-2.5 text-[12.5px] ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                                    <Rocket className="w-4 h-4 text-emerald-500 shrink-0" />
                                    Dúvidas sobre alguma novidade? O <b className="mx-1">Manual</b> dentro do app explica cada tela passo a passo.
                                </div>
                            )}
                        </article>
                    );
                })}

                <p className={`text-center text-[12px] mt-8 ${muted}`}>© 2026 Alívia · Você pode fechar esta aba e voltar ao app.</p>
            </div>
        </div>
    );
}
