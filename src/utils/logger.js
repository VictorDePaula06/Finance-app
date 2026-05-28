/**
 * Logger seguro — `info` e `debug` são silenciados em produção para evitar
 * vazamento de PII (e-mail, uid, dados financeiros) no console do browser.
 *
 * `warn` e `error` continuam sempre ativos para diagnóstico de problemas
 * reais, mas devem ser usados sem PII no payload.
 *
 * Uso:
 *   import { log } from '../utils/logger';
 *   log.info('mensagem só pra dev', objComPII);
 *   log.warn('erro recuperável (sem PII)');
 *   log.error('erro fatal (sem PII)');
 */

const isDev = import.meta.env.DEV === true;

export const log = {
    info:  (...args) => { if (isDev) console.log(...args); },
    debug: (...args) => { if (isDev) console.debug(...args); },
    warn:  (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};

// Helper para mascarar e-mail em logs (jane.doe@example.com → j***@e***.com)
export const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '***';
    const [user, domain] = email.split('@');
    if (!user || !domain) return '***';
    const userMask = user.charAt(0) + '***';
    const domParts = domain.split('.');
    const domMask = domParts[0].charAt(0) + '***.' + domParts.slice(1).join('.');
    return `${userMask}@${domMask}`;
};

// Helper para mascarar UID (firstHash...lastHash)
export const maskUid = (uid) => {
    if (!uid || typeof uid !== 'string' || uid.length < 8) return '***';
    return uid.slice(0, 4) + '...' + uid.slice(-3);
};
