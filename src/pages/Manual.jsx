import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import {
    BookOpen, LayoutDashboard, ArrowLeftRight, Repeat, CreditCard, PiggyBank,
    Landmark, BarChart3, Sparkles, Rocket, Lightbulb, ShieldCheck, Settings,
    Target, ClipboardList, Lock, Compass, CalendarClock, Check, TrendingUp, Languages, Eye,
} from 'lucide-react';

// Guia de uso do sistema. Aba "Manual".
// Atualizado em 25/09/2026 (v1.3) — menu reorganizado: Extrato (só consulta),
// Contas a receber (nova) e Contas a pagar (era Recorrentes, sem cartão).
const ATUALIZADO_EM = '25/09/2026';

// O fluxo do Alívia, na ordem em que a pessoa deve fazer.
const PASSOS = [
    { t: 'Cadastre a base do seu mês', d: 'Em Configurações e Cadastros › Cadastros, cadastre suas entradas e despesas recorrentes (salário, aluguel, internet…), seus cartões de crédito e, se quiser, um teto de gasto por categoria.' },
    { t: 'Conecte o WhatsApp', d: 'Em Configurações e Cadastros › WhatsApp, vincule seu número. A partir daí você registra gastos e consulta tudo por mensagem ou áudio com a Alívia.' },
    { t: 'Todo mês, dê baixa nas contas', d: 'Em Contas a pagar, a aba A pagar mostra as contas do mês em cards. Pagou? Toque em Dar baixa — o valor sai do saldo e o card vai para Pago.' },
    { t: 'Confirme o que entrou', d: 'Em Contas a receber, confirme o recebimento do salário e das outras entradas cadastradas. Precisa de algo fora do cadastro? Use "Lançar entrada".' },
    { t: 'Lance o dia a dia', d: 'Despesas avulsas (mercado, lanche, uber) entram por "Lançar despesa", em Contas a pagar — ou direto pelo WhatsApp, falando com a Alívia.' },
    { t: 'Cuide do cartão em Meu cartão', d: 'Compras no crédito, assinaturas e parcelamentos vivem na fatura. Quando ela fechar, pague por lá e o total é debitado da conta.' },
    { t: 'Acompanhe', d: 'O Dashboard resume o mês e avisa quando uma categoria se aproxima do teto. Em Análises você aprofunda com relatórios.' },
];

const SECOES = [
    {
        icon: LayoutDashboard, color: '#10b981', title: 'Dashboard',
        desc: 'Sua visão geral: ganhos, gastos, custo mensal, fatura do cartão, reserva e patrimônio. O saldo disponível fica na barra do topo, visível em qualquer aba. Se alguma categoria com teto passar de 80% (ou estourar), a Alívia avisa aqui, com quanto ainda cabe no mês.',
    },
    {
        icon: ArrowLeftRight, color: '#06b6d4', title: 'Extrato',
        desc: 'O histórico da conta: tudo que entrou e saiu no mês, agrupado por dia, com filtros por tipo, origem e prioridade. É só consulta — para registrar algo, use Contas a receber ou Contas a pagar. Um lançamento já existente pode ser editado ou excluído por aqui.',
    },
    {
        icon: TrendingUp, color: '#10b981', title: 'Contas a receber',
        desc: 'Suas entradas cadastradas numa lista só, recebidas e pendentes juntas, na ordem do dia. Quando o dinheiro cair, toque em Receber — vira um lançamento e soma no saldo; a linha fica no mesmo lugar e passa a mostrar Recebido. O botão "Lançar entrada avulsa" registra algo fora do cadastro. O cadastro das entradas fixas fica em Cadastros (engrenagem da barra do topo).',
    },
    {
        icon: Repeat, color: '#f59e0b', title: 'Contas a pagar',
        desc: 'As despesas cadastradas numa lista só, pagas e pendentes juntas, na ordem do vencimento — atrasadas em âmbar. Pagou? Toque em Dar baixa (ou Na fatura, se a conta é paga no cartão). O botão "Lançar despesa avulsa" registra um gasto fora do cadastro. Parcelamentos e assinaturas do cartão não aparecem aqui — eles vivem em Meu cartão.',
    },
    {
        icon: CreditCard, color: '#a855f7', title: 'Meu cartão',
        desc: 'Fatura atual, assinaturas, parcelamentos, melhor dia de compra e uso do limite. Aqui você lança compras e paga a fatura. O cadastro, a edição e a exclusão dos cartões ficam em Cadastros › Cartões. Ao digitar o banco, o cartão ganha o logo real da marca na frente.',
    },
    {
        icon: PiggyBank, color: '#ec4899', title: 'Reservas',
        desc: 'Separe dinheiro para objetivos e para a reserva de emergência. Mostra quanto você já guardou, quantos meses de cobertura tem e quanto falta para a meta.',
    },
    {
        icon: Landmark, color: '#3b82f6', title: 'Patrimônio',
        desc: 'Seus investimentos e ativos, com valor atual, rentabilidade e lucro. Dá para alternar entre R$ e US$.',
    },
    {
        icon: BarChart3, color: '#8b5cf6', title: 'Análises/Relatórios',
        desc: 'Relatórios das suas finanças: gastos por categoria, teto por categoria, evolução mês a mês, cartão e mais. Antes de gerar, você escolhe o período e se inclui a fatura em aberto. Dá para exportar em PDF.',
    },
    {
        icon: Settings, color: '#64748b', title: 'Configurações',
        desc: 'Fica no rodapé do menu, acima do seu nome. Reúne quatro abas: Geral (perfil, foto, senha, tema, idioma e conta), WhatsApp (conexão, forma de pagamento padrão e notificações), Assinatura (seu plano) e Dados e Privacidade (exportar dados, LGPD).',
    },
    {
        icon: ClipboardList, color: '#8b5cf6', title: 'Cadastros',
        desc: 'Abre pela engrenagem da barra do topo, por cima da tela — você não perde de vista onde estava. Quatro abas, todas em lista: Recorrentes (entradas e despesas que se repetem), Cartões, Tetos (limite mensal por categoria) e Mercado. Clicar fora não fecha: fechar é no X, para não perder um formulário meio preenchido.',
    },
    {
        icon: Eye, color: '#06b6d4', title: 'Barra do topo',
        desc: 'Acompanha você em qualquer aba: a marca, o nome da aba atual, o saldo disponível, o atalho do WhatsApp e a engrenagem que abre Cadastros. O olho ao lado do saldo apaga TODOS os valores da tela de uma vez — útil quando tem gente olhando.',
    },
];

// Onde cada coisa é feita — referência rápida.
const ONDE = [
    ['Cadastrar / editar / excluir entrada ou despesa recorrente', 'Cadastros › Recorrentes'],
    ['Cadastrar / editar / excluir cartão de crédito', 'Cadastros › Cartões'],
    ['Definir teto de gasto por categoria', 'Cadastros › Tetos'],
    ['Ativar e configurar o Mercado', 'Cadastros › Mercado'],
    ['Abrir Cadastros', 'Engrenagem na barra do topo'],
    ['Esconder todos os valores da tela', 'Olho na barra do topo'],
    ['Ver o número de WhatsApp vinculado', 'Ícone do WhatsApp na barra do topo'],
    ['Dar baixa numa conta do mês', 'Contas a pagar'],
    ['Confirmar recebimento do salário', 'Contas a receber'],
    ['Lançar uma entrada avulsa', 'Contas a receber › Lançar entrada avulsa'],
    ['Lançar uma despesa avulsa', 'Contas a pagar › Lançar despesa avulsa'],
    ['Ver o histórico da conta', 'Extrato'],
    ['Lançar compra, assinatura ou parcelamento no cartão', 'Meu cartão'],
    ['Pagar a fatura', 'Meu cartão'],
    ['Conectar o WhatsApp / escolher notificações', 'Configurações › WhatsApp'],
    ['Ver ou mudar o plano', 'Configurações › Assinatura'],
    ['Trocar tema, foto, senha ou idioma', 'Configurações › Geral'],
];

const NOVIDADES = [
    'Barra fixa no topo: marca, aba atual, saldo disponível, WhatsApp e Cadastros — em qualquer tela.',
    'O olho ao lado do saldo apaga TODOS os valores da tela, não só o saldo.',
    'Cadastros virou uma janela que abre pela engrenagem da barra, por cima do app: Recorrentes, Cartões, Tetos e Mercado, cada um numa aba.',
    '"Configurações e Cadastros" agora é só Configurações — Cadastros saiu de dentro dela.',
    'Contas a receber e Contas a pagar perderam as sub-abas: é uma lista só, com pagas e pendentes juntas. Dar baixa não tira a linha do lugar.',
    'Correção: duas entradas com o mesmo nome — só a primeira somava na conta. Agora cada uma tem a sua baixa.',
    'Dashboard: Ganhos, Gastos e Custo mensal. O saldo mudou para a barra do topo.',
    'Meu cartão: o logo do banco agora aparece na frente do cartão.',
    'Escuro em preto esverdeado e claro em branco esverdeado, com a mesma aurora verde ao fundo nos dois.',
];

// Rótulo de seção (ícone + texto em caixa alta).
function Label({ isDark, icon: Icon, color = 'text-emerald-500', children }) {
    return (
        <p className={`text-[13px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Icon className={`w-4 h-4 ${color}`} /> {children}
        </p>
    );
}

export default function Manual() {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const body = isDark ? 'text-slate-300' : 'text-slate-700';
    const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    return (
        <div className="max-w-4xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                    <BookOpen className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Manual</h1>
                    <p className={`text-sm mt-0.5 ${muted}`}>Um guia rápido para usar o Alívia no dia a dia.</p>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    <CalendarClock className="w-3.5 h-3.5" /> Atualizado em {ATUALIZADO_EM}
                </span>
            </div>

            {/* Boas-vindas */}
            <div className={`rounded-2xl border p-5 mb-5 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-[15px] font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Sparkles className="w-4 h-4 text-emerald-500" /> Bem-vindo(a) ao Alívia
                </p>
                <p className={`text-[13px] mt-1.5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    O Alívia organiza seu dinheiro em um só lugar: o que entra, o que sai, o cartão, as reservas e os investimentos.
                    A lógica é simples — <b>cadastre uma vez</b> o que se repete, <b>confirme mês a mês</b> o que pagou e recebeu, e deixe o app
                    (e a Alívia no WhatsApp) cuidar das contas. Comece pelos passos abaixo.
                </p>
            </div>

            {/* O fluxo, passo a passo */}
            <div className={`${cardCls} mb-6`}>
                <Label isDark={isDark} icon={Rocket}>Comece por aqui — o fluxo do Alívia</Label>
                <ol className="space-y-4">
                    {PASSOS.map((p, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 text-[12px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <div>
                                <p className={`text-[13.5px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{p.t}</p>
                                <p className={`text-[13px] leading-relaxed mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{p.d}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {/* Guia por aba */}
            <p className={`text-[13px] font-black uppercase tracking-widest mb-3 ${muted}`}>Conhecendo cada aba</p>
            <div className="grid sm:grid-cols-2 gap-4">
                {SECOES.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.title} className={cardCls}>
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}1f`, color: s.color }}>
                                    <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
                                </span>
                                <p className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.title}</p>
                            </div>
                            <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{s.desc}</p>
                        </div>
                    );
                })}
                {/* Alívia no WhatsApp — com o logo oficial */}
                <div className={cardCls}>
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D3661f', color: '#25D366' }}>
                            <WhatsAppIcon className="w-4.5 h-4.5" />
                        </span>
                        <p className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Alívia no WhatsApp</p>
                    </div>
                    <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Registre gastos, dê baixa em contas, importe extratos e peça relatórios por mensagem ou áudio. Gastos óbvios ("padaria 10", "uber 23") entram direto na categoria certa — só quando não dá pra saber ela pergunta (e "trocar" corrige). Ao enviar um arquivo, ela pergunta se é fatura de cartão ou extrato bancário: em fatura, crédito é estorno e abate o valor, nunca vira entrada. A cada gasto lançado,
                        ela mostra o acumulado da categoria no mês e, se houver teto, em quantos % você está — avisando quando se aproximar ou passar.
                        Conecte em Configurações e Cadastros › WhatsApp.
                    </p>
                </div>
            </div>

            {/* Cadastros + Teto por categoria — destaque */}
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <div className={cardCls}>
                    <Label isDark={isDark} icon={ClipboardList}>Cadastros: a base de tudo</Label>
                    <ul className="space-y-2.5">
                        {[
                            'Entradas e despesas recorrentes: nome, tipo, categoria, valor, dia, fixa ou variável e forma de pagamento (se for cartão, qual).',
                            'Cartões de crédito: nome, banco, bandeira, final, limite, dia de fechamento e vencimento. Digite o banco e o cartão já ganha o logo e a cor.',
                            'Teto por categoria: o limite mensal que você quer respeitar em cada categoria de gasto.',
                            'Tudo que está aqui aparece automaticamente em Recorrentes, Lançamentos, Meu cartão e Dashboard.',
                        ].map((d, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={3} />
                                <span className={`text-[13px] leading-relaxed ${body}`}>{d}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className={`rounded-2xl border p-5 ${isDark ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-amber-200 bg-amber-50/70'}`}>
                    <Label isDark={isDark} icon={Target} color="text-amber-500">Teto por categoria</Label>
                    <p className={`text-[13px] leading-relaxed ${body}`}>
                        Exemplo: você define <b>R$ 1.000</b> para <b>Alimentação</b>. Conforme os gastos do mês nessa categoria vão sendo lançados
                        (na conta ou no cartão), o Alívia compara com o teto:
                    </p>
                    <ul className="mt-3 space-y-2">
                        {[
                            ['Até 79%', 'tudo certo — no WhatsApp a Alívia só mostra o % usado.', 'text-emerald-500'],
                            ['De 80% a 99%', 'perto do teto: aviso no Dashboard e no WhatsApp, com quanto ainda cabe.', 'text-amber-500'],
                            ['100% ou mais', 'passou do teto: alerta em vermelho com o valor que excedeu.', 'text-rose-500'],
                        ].map(([k, v, c], i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className={`text-[12px] font-black shrink-0 w-24 ${c}`}>{k}</span>
                                <span className={`text-[12.5px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{v}</span>
                            </li>
                        ))}
                    </ul>
                    <p className={`text-[12px] mt-3 ${muted}`}>Recolhido, o painel mostra os 3 maiores tetos; toque em "Ver todas as categorias" para definir os demais.</p>
                </div>
            </div>

            {/* Idioma */}
            <div className={`${cardCls} mt-6`}>
                <Label isDark={isDark} icon={Languages} color="text-violet-500">Idioma do app</Label>
                <p className={`text-[13px] leading-relaxed ${body}`}>
                    Em <b>Configurações e Cadastros › Geral › Idioma</b> você escolhe entre <b>Português</b>, <b>English</b> e <b>Español</b>.
                    A troca vale na hora, em todas as telas, e fica salva na sua conta — abrindo em outro aparelho, já vem no idioma escolhido.
                    Números e datas acompanham o idioma; os valores continuam em real (R$).
                </p>
            </div>

            {/* Onde faço cada coisa? */}
            <div className={`${cardCls} mt-6`}>
                <Label isDark={isDark} icon={Compass}>Onde faço cada coisa?</Label>
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    {ONDE.map(([acao, onde], i) => (
                        <div key={i} className={`grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-2.5 text-[13px] ${i > 0 ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''} ${i % 2 ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50/70') : ''}`}>
                            <span className={body}>{acao}</span>
                            <span className="font-bold text-emerald-500 sm:text-right">{onde}</span>
                        </div>
                    ))}
                </div>
                <p className={`text-[12px] mt-3 flex items-center gap-1.5 ${muted}`}>
                    <Lock className="w-3.5 h-3.5" /> Assinaturas e parcelamentos do cartão não são editados em Recorrentes — só em Meu cartão.
                </p>
            </div>

            {/* Dicas rápidas */}
            <div className={`${cardCls} mt-6`}>
                <Label isDark={isDark} icon={Lightbulb} color="text-amber-500">Dicas para tirar o máximo</Label>
                <ul className="space-y-2.5">
                    {[
                        'Cadastre primeiro, lance depois: com a base montada, o mês vira só "confirmar" — dar baixa e confirmar recebimento.',
                        'Lance os gastos no mesmo dia (pelo app ou pelo WhatsApp) — vira hábito e seus números ficam sempre certos.',
                        'Marque cada despesa como Essencial, Conforto ou Supérfluo para enxergar onde dá para economizar.',
                        'Defina teto nas categorias que mais pesam (alimentação, lazer, compras). A Alívia avisa antes de estourar.',
                        'Compras no crédito ficam na fatura; só pague quando fechar e o app debita da conta automaticamente.',
                        'Use as Análises no fim do mês para comparar com o mês anterior e ajustar o rumo.',
                    ].map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className={`text-[13px] leading-relaxed ${body}`}>{d}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Novidades */}
            <div className={`${cardCls} mt-6`}>
                <Label isDark={isDark} icon={Sparkles}>Novidades de {ATUALIZADO_EM}</Label>
                <ul className="space-y-2.5">
                    {NOVIDADES.map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                            <span className={`text-[13px] leading-relaxed ${body}`}>{d}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <WhatsAppIcon className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Ficou com dúvida em algo? Fale com a <span className="font-bold text-emerald-500">Alívia no WhatsApp</span> — ela ajuda com base nos seus próprios números, por mensagem ou áudio.</span>
            </div>
        </div>
    );
}
