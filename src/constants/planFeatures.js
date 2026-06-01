// Fonte única de verdade dos recursos por módulo/plano.
// Usada na tela de início (Hub) e no modal de assinatura (UpgradeModal) para
// manter total coerência do que cada plano oferece.

export const PLAN_RANK = { free: 0, standard: 1, premium: 2, lifetime: 2 };

// Cada feature tem o plano mínimo (min) para estar incluída e, opcionalmente,
// `limitedBelow`: incluída mas COM LIMITES enquanto o plano for menor que esse nível.
export const GASTOS_FEATURES = [
    { text: 'Controles de gastos gerais', min: 'free', limitedBelow: 'standard' },
    { text: 'Pontos sobre sua Saúde Financeira', min: 'free' },
    { text: 'Relatórios em PDF', min: 'standard' },
    { text: 'Análises da AI Alívia sobre seus gastos', min: 'standard' },
    { text: 'Lançamentos pela AI Alívia', min: 'standard' },
];

export const PATRIMONIO_FEATURES = [
    { text: 'Reservas, investimentos e bens', min: 'free', limitedBelow: 'premium' },
    { text: 'Saúde Patrimonial', min: 'free' },
    { text: 'Seguros e Proteção', min: 'free' },
    { text: 'Fluxo patrimonial e independência financeira', min: 'premium' },
    { text: 'Evolução patrimonial e benchmarks', min: 'premium' },
    { text: 'Metas financeiras', min: 'premium' },
    { text: 'Análises da AI Alívia sobre seu patrimônio', min: 'premium' },
];

// Estado de uma feature para um determinado nível de plano (rank numérico).
export function featureState(feat, userRank) {
    const included = userRank >= (PLAN_RANK[feat.min] ?? 0);
    const limited = included && feat.limitedBelow && userRank < (PLAN_RANK[feat.limitedBelow] ?? 0);
    const tag = feat.min === 'premium' ? 'Premium' : feat.min === 'standard' ? 'Standard' : null;
    return { included, limited, tag };
}
