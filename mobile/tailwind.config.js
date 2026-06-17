/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        ink: '#0a0a0b',     // fundo geral (quase preto, como o modelo)
        card: '#161618',    // cartões
        card2: '#1d1d20',   // cartões secundários
      },
    },
  },
  plugins: [],
};
