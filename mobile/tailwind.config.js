/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Tokens temáticos (claro/escuro) via variáveis CSS.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        ink: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        card2: 'rgb(var(--card2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
