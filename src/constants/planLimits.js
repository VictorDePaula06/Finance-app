// Limites de ativos do módulo Patrimônio por plano. O módulo é Premium; Gratuito e
// Standard têm apenas uma amostra limitada (mesmos números), enquanto Premium,
// Vitalício e Admin são ilimitados. Estes valores espelham os limites já aplicados
// nas abas (InvestmentsTab, EmergencyReserveTab, BensImoveisTab).
export const PATRIMONY_ASSET_LIMITS = {
    investments: 3,
    reserves: 1,
    bens: 2,
};

// True quando o plano deve ter os ativos do Patrimônio limitados.
export const isPatrimonyAssetLimited = (planLevel, isAdmin) =>
    !isAdmin && (planLevel === 'free' || planLevel === 'standard');
