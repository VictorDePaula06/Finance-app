// Nível de plano do usuário — MESMA lógica do site (src/contexts/AuthContext.jsx):
// lifetime (admins/lifetime/status) > premium/standard (assinatura Stripe ativa
// com price_id na allowlist) > free. Preço fora da allowlist NÃO concede pago.

export const ADMIN_EMAILS = [
  'financealivia@gmail.com',
  'j.17jvictor@gmail.com',
  'matheusphelipe7@gmail.com',
  'felipedb.clopes@gmail.com',
];
export const LIFETIME_EMAILS = ['financealivia@gmail.com', 'j.17jvictor@gmail.com', 'lopes.felipe365@outlook.com'];

const env = import.meta.env;
export const STANDARD_PRICES = [
  env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY,
  env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY,
  'price_1TdDzSKAwb86obAGI0gTmdWL',
  'price_1TdE0LKAwb86obAGcpMPLgWw',
].filter(Boolean);
export const PREMIUM_PRICES = [
  env.VITE_STRIPE_PRICE_ID_MONTHLY,
  env.VITE_STRIPE_PRICE_ID_YEARLY,
  'price_1TdDwDKAwb86obAGnRhLwlIa',
  'price_1TdE1VKAwb86obAGh2h7m4o6',
].filter(Boolean);

const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : '');
export const isLifetimeEmail = (email) => LIFETIME_EMAILS.includes(lower(email));
export const isAdminEmail = (email) => ADMIN_EMAILS.includes(lower(email));

// Calcula o nível do plano. `stripeSubs` = docs de customers/{uid}/subscriptions.
export function computePlanLevel({ email, userDoc, stripeSubs = [] } = {}) {
  const isLifetime = isLifetimeEmail(email) || isAdminEmail(email)
    || userDoc?.subscription?.status === 'lifetime';
  if (isLifetime) return 'lifetime';

  const active = (stripeSubs || []).find(s => s?.status === 'active' || s?.status === 'trialing');
  if (active) {
    const priceId = active?.items?.[0]?.plan?.id;
    if (PREMIUM_PRICES.includes(priceId)) return 'premium';
    if (STANDARD_PRICES.includes(priceId)) return 'standard';
    // Preço não reconhecido → não concede pago (anti-fraude, igual ao site).
  }
  return 'free';
}

export const isPremiumLevel = (level) => level === 'premium' || level === 'lifetime';

export const PLAN_LABEL = {
  free: 'Gratuito',
  standard: 'Standard',
  premium: 'Premium',
  lifetime: 'Vitalício',
};
