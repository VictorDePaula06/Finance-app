import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LANGUAGES, DEFAULT_LANG, detectLang, langMeta } from '../locales';
import { useAuth } from './AuthContext';

// ── Idioma do app ───────────────────────────────────────────────────
// Fonte da verdade: userPrefs.language (Firestore, sincroniza entre aparelhos).
// Espelho local: localStorage — a UI já abre no idioma certo antes do login
// carregar as preferências, sem "piscar" em português.
//
// Uso nos componentes:
//   const { t, lang, setLang, fmtMoney, fmtDate } = useI18n();
//   <h1>{t('dash.hello', { name })}</h1>

const LS_KEY = 'alivia-lang';
const LanguageContext = createContext(null);

export function useI18n() {
    const ctx = useContext(LanguageContext);
    // Fora do provider (testes, páginas isoladas): cai no português, sem quebrar.
    if (!ctx) {
        const dict = langMeta(DEFAULT_LANG).dict;
        return {
            lang: DEFAULT_LANG, setLang: () => {}, languages: LANGUAGES, locale: 'pt-BR',
            t: (k, v) => interpolate(dict[k] ?? k, v),
            fmtMoney: (n) => fmtMoneyIn('pt-BR', n),
            fmtDate: (d, o) => fmtDateIn('pt-BR', d, o),
            fmtMonth: (mk) => fmtMonthIn('pt-BR', mk),
        };
    }
    return ctx;
}

// Substitui {chave} pelos valores passados. Sem valor → mantém o texto.
function interpolate(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}
// Plural simples: "1 item|N itens" → escolhe pelo `count`.
function plural(str, count) {
    if (!String(str).includes('|')) return str;
    const [one, many] = String(str).split('|');
    return Math.abs(Number(count)) === 1 ? one : many;
}

const fmtMoneyIn = (locale, n) => (Number(n) || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateIn = (locale, d, opts) => {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, opts || { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// "2026-09" → "setembro de 2026" / "September 2026" / "septiembre de 2026"
const fmtMonthIn = (locale, mk, opts) => {
    const [y, m] = String(mk || '').split('-').map(Number);
    if (!y || !m) return '';
    return new Date(y, m - 1, 1).toLocaleDateString(locale, opts || { month: 'long', year: 'numeric' });
};

export function LanguageProvider({ children }) {
    const { userPrefs, saveUserPreferences } = useAuth() || {};
    const [lang, setLangState] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_KEY);
            if (saved && LANGUAGES.some(l => l.id === saved)) return saved;
        } catch { /* localStorage bloqueado */ }
        return detectLang();
    });

    const meta = useMemo(() => langMeta(lang), [lang]);

    // Mantém o <html lang> em dia (acessibilidade, leitores de tela, SEO).
    useEffect(() => {
        try {
            localStorage.setItem(LS_KEY, lang);
            document.documentElement.lang = meta.locale;
        } catch { /* ignora */ }
    }, [lang, meta.locale]);

    // Preferência da conta manda (vale em qualquer aparelho); só aplica se diferente.
    const savedLang = userPrefs?.language;
    useEffect(() => {
        if (savedLang && LANGUAGES.some(l => l.id === savedLang) && savedLang !== lang) setLangState(savedLang);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [savedLang]);

    // Troca o idioma e guarda na conta (quando logado).
    const setLang = useCallback((id) => {
        if (!LANGUAGES.some(l => l.id === id)) return;
        setLangState(id);
        saveUserPreferences?.({ language: id })?.catch?.(() => {});
    }, [saveUserPreferences]);

    const t = useCallback((key, vars) => {
        const raw = meta.dict[key] ?? langMeta(DEFAULT_LANG).dict[key] ?? key;
        const withPlural = vars && vars.n != null ? plural(raw, vars.n) : raw;
        return interpolate(withPlural, vars);
    }, [meta]);

    const value = useMemo(() => ({
        lang, setLang, languages: LANGUAGES, locale: meta.locale, langMeta: meta, t,
        fmtMoney: (n) => fmtMoneyIn(meta.locale, n),
        fmtDate: (d, o) => fmtDateIn(meta.locale, d, o),
        fmtMonth: (mk, o) => fmtMonthIn(meta.locale, mk, o),
    }), [lang, setLang, meta, t]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export default LanguageContext;
