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
