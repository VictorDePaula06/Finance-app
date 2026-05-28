/**
 * Lista canônica de e-mails com privilégios de administrador.
 *
 * IMPORTANTE: esta lista DEVE ser idêntica à lista em `firestore.rules`
 * (função `isAdmin()`). Quando adicionar/remover, atualize os DOIS lugares.
 *
 * Antes existiam menções espalhadas em vários arquivos (AuthContext, Sidebar,
 * AdminPanel, SubscriptionBlock) — com variações de digitação e risco de
 * desincronização. Agora há fonte única de verdade no client.
 */

export const ADMIN_EMAILS = [
    'financealivia@gmail.com',
    'j.17jvictor@gmail.com',
    'matheusphelipe7@gmail.com',
    'felipedb.clopes@gmail.com',
];

// E-mails com acesso vitalício (subconjunto/sobreposto com ADMIN_EMAILS).
// Mantido separado pra permitir lifetime sem ser admin no futuro, se preciso.
export const LIFETIME_EMAILS = [
    'financealivia@gmail.com',
    'j.17jvictor@gmail.com',
];

export const isAdminEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const isLifetimeEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return LIFETIME_EMAILS.includes(email.toLowerCase());
};
