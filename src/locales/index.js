import pt from './pt';
import en from './en';
import es from './es';

// ── Idiomas suportados ──────────────────────────────────────────────
// Cada idioma traz: dicionário (dict), código de locale (Intl) e moeda.
// Os valores monetários continuam em BRL — só a formatação muda com o locale,
// porque o app é de finanças pessoais no Brasil (não convertemos câmbio aqui).
export const LANGUAGES = [
    { id: 'pt', label: 'Português', native: 'Português (Brasil)', flag: '🇧🇷', locale: 'pt-BR', dict: pt },
    { id: 'en', label: 'English', native: 'English (US)', flag: '🇺🇸', locale: 'en-US', dict: en },
    { id: 'es', label: 'Español', native: 'Español', flag: '🇪🇸', locale: 'es-ES', dict: es },
];

export const DEFAULT_LANG = 'pt';
export const langMeta = (id) => LANGUAGES.find(l => l.id === id) || LANGUAGES[0];

// Detecta o idioma do navegador quando a pessoa ainda não escolheu.
export const detectLang = () => {
    try {
        const nav = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
        if (nav.startsWith('en')) return 'en';
        if (nav.startsWith('es')) return 'es';
    } catch { /* SSR / navegador sem API */ }
    return DEFAULT_LANG;
};

export { pt, en, es };
