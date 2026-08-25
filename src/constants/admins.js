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
    'felipe.lopestecnologia11@gmail.com', // Felipe Lopes — único admin
];

// Normaliza e-mail p/ comparação: minúsculo e, no Gmail, remove os pontos do
// local-part (Gmail trata "a.b@gmail" == "ab@gmail"). Assim a checagem não
// depende da grafia exata (com/sem pontos) usada no cadastro.
export const normalizeEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    const [local, domain] = email.trim().toLowerCase().split('@');
    if (!domain) return email.trim().toLowerCase();
    const isGmail = domain === 'gmail.com' || domain === 'googlemail.com';
    return `${isGmail ? local.replace(/\./g, '') : local}@${domain}`;
};

// E-mails com acesso vitalício (subconjunto/sobreposto com ADMIN_EMAILS).
// Mantido separado pra permitir lifetime sem ser admin no futuro, se preciso.
export const LIFETIME_EMAILS = [
    'felipe.lopestecnologia11@gmail.com', // Felipe Lopes — acesso vitalício
    'lopes.felipe365@outlook.com', // conta de revisão (Google Play) — acesso Premium full
];

const ADMIN_SET = ADMIN_EMAILS.map(normalizeEmail);
const LIFETIME_SET = LIFETIME_EMAILS.map(normalizeEmail);

export const isAdminEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return ADMIN_SET.includes(normalizeEmail(email));
};

export const isLifetimeEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return LIFETIME_SET.includes(normalizeEmail(email));
};
