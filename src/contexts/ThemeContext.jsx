import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    // Default to 'light' (Alívia)
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('alivia-theme');
        return savedTheme || 'light';
    });

    useEffect(() => {
        localStorage.setItem('alivia-theme', theme);
        // Apply class to document element for global CSS targeting
        const root = window.document.documentElement;
        root.classList.remove('theme-light', 'theme-dark', 'dark');
        root.classList.add(`theme-${theme}`);
        if (theme === 'dark') root.classList.add('dark');

        // Diz ao navegador QUAL tema a página está usando. Sem isso o Chrome
        // do Android considera a página "sem tema" e aplica o escurecimento
        // automático dele por cima do nosso.
        root.style.colorScheme = theme;

        // Barra de status do app instalado acompanha o fundo do tema.
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
