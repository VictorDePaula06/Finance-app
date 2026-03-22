/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'verde-respira': '#69C8B9',
                'azul-ceu': '#5CCEEA',
                'crema-paz': '#FFF08C',
                'ouro-suave': '#FFF09A',
                'cinza-nuvem': '#BACOBA',
            },
            fontFamily: {
                'quicksand': ['Quicksand', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
