/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Paleta do Manual de Identidade Visual. Os nomes são os do
            // manual de propósito: `bg-alv-paz` diz o papel da cor, não o
            // tom dela. Para texto e ação prefira `emerald-*`, que muda
            // com o tema — estas aqui são fixas.
            colors: {
                'alv-leveza': '#E6F7F5',
                'alv-paz': '#B2DFDB',
                'alv-harmonia': '#54978B',
                'alv-alivio': '#2A6257',
                'alv-reflexo': '#9ECCC6',
                'alv-celeste': '#D9F0F6',
                'alv-acqua': '#9CDAD8',
                'alv-terracota': '#D9A88D',
                'alv-profundo': '#3B5966',
                'alv-areia': '#E8DCC8',
            },
            fontFamily: {
                'quicksand': ['Quicksand', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
