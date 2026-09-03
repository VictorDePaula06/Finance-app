import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
    BookOpen, LayoutDashboard, ArrowLeftRight, Repeat, CreditCard, PiggyBank,
    Landmark, BarChart3, Sparkles, Rocket, Lightbulb, ShieldCheck, MessageCircle,
} from 'lucide-react';

// Guia rápido de uso do sistema. Aba "Manual".
const PASSOS = [
    'Cadastre suas entradas do mês em Lançamentos (salário, vendas, reembolsos).',
    'Registre as despesas conforme forem acontecendo — o saldo em conta se ajusta sozinho.',
    'Coloque as contas que se repetem todo mês em Recorrentes (aluguel, internet, academia).',
    'Cadastre seu cartão em Meu cartão e lance as compras no crédito por lá.',
    'Acompanhe tudo no Dashboard e aprofunde nos relatórios em Análises.',
];

const SECOES = [
    {
        icon: LayoutDashboard, color: '#10b981', title: 'Dashboard',
        desc: 'Sua visão geral do mês: ganhos, gastos, saldo disponível e um resumo de para onde o dinheiro está indo. É a primeira tela que você vê.',
    },
    {
        icon: ArrowLeftRight, color: '#06b6d4', title: 'Lançamentos',
        desc: 'Registre entradas e despesas avulsas. Cada despesa desconta do saldo em conta. Se um lançamento for deixar a conta negativa, o app avisa antes para você conferir.',
    },
    {
        icon: Repeat, color: '#f59e0b', title: 'Recorrentes',
        desc: 'Contas fixas que se repetem todo mês (aluguel, streaming, mensalidades). Cadastre uma vez e dê baixa quando pagar — vira um lançamento no seu extrato.',
    },
    {
        icon: CreditCard, color: '#a855f7', title: 'Meu cartão',
        desc: 'Cadastre seu cartão e lance compras no crédito, assinaturas e parcelamentos. Elas entram na fatura (não saem do saldo na hora). Ao pagar a fatura, o total é debitado da conta.',
    },
    {
        icon: PiggyBank, color: '#ec4899', title: 'Reservas',
        desc: 'Separe dinheiro para objetivos e para a reserva de emergência. Ajuda a enxergar quanto você já guardou e quanto falta para a sua meta.',
    },
    {
        icon: Landmark, color: '#3b82f6', title: 'Patrimônio',
        desc: 'Acompanhe seus investimentos e ativos. Veja quanto tem aplicado e a rentabilidade ao longo do tempo.',
    },
    {
        icon: BarChart3, color: '#8b5cf6', title: 'Análises',
        desc: 'Relatórios das suas finanças (gastos por categoria, evolução, cartão e mais). Antes de gerar cada um, você escolhe filtros como o período e se inclui a fatura em aberto do cartão.',
    },
    {
        icon: MessageCircle, color: '#25D366', title: 'Alívia no WhatsApp',
        desc: 'Fale com a Alívia direto no seu WhatsApp: registre gastos, dê baixa em contas, importe extratos e peça relatórios — por mensagem ou áudio. Configure em Configurações › WhatsApp.',
    },
];

export default function Manual() {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cardCls = `rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`;

    return (
        <div className="max-w-4xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 mb-6">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                    <BookOpen className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <div>
                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Manual</h1>
                    <p className={`text-sm mt-0.5 ${muted}`}>Um guia rápido para usar o Alívia no dia a dia.</p>
                </div>
            </div>

            {/* Boas-vindas */}
            <div className={`rounded-2xl border p-5 mb-5 ${isDark ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-[15px] font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Sparkles className="w-4 h-4 text-emerald-500" /> Bem-vindo(a) ao Alívia
                </p>
                <p className={`text-[13px] mt-1.5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    O Alívia organiza seu dinheiro em um só lugar: o que entra, o que sai, o cartão, as reservas e os investimentos.
                    A ideia é simples — registre suas movimentações e deixe o app cuidar das contas para você. Não precisa ser expert:
                    comece pelos passos abaixo.
                </p>
            </div>

            {/* Primeiros passos */}
            <div className={`${cardCls} mb-6`}>
                <p className={`text-[13px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${muted}`}>
                    <Rocket className="w-4 h-4 text-emerald-500" /> Primeiros passos
                </p>
                <ol className="space-y-3">
                    {PASSOS.map((p, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 text-[12px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{p}</span>
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
            </div>

            {/* Dicas rápidas */}
            <div className={`${cardCls} mt-6`}>
                <p className={`text-[13px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${muted}`}>
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Dicas para tirar o máximo
                </p>
                <ul className="space-y-2.5">
                    {[
                        'Lance os gastos no mesmo dia — vira hábito e seus números ficam sempre certos.',
                        'Classifique cada despesa como Essencial, Conforto ou Supérfluo para ver onde dá para economizar.',
                        'Compras no crédito ficam na fatura; só pague quando fechar e o app debita da conta automaticamente.',
                        'Use as Análises no fim do mês para comparar com o mês anterior e ajustar o rumo.',
                    ].map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{d}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <MessageCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                Ficou com dúvida em algo? Fale com a <span className="font-bold text-emerald-500">Alívia no WhatsApp</span> — ela ajuda com base nos seus próprios números, por mensagem ou áudio.
            </div>
        </div>
    );
}
