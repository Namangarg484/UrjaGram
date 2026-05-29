/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#1A5C40',
        meadow: '#2E7D52',
        amber: '#D4A017',
        parchment: '#F5F1E8',
        ink: '#1C1C1C',
        muted: '#555555',
        border: '#D4D4D4',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        badge: '20px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        floatin: 'floatin 500ms ease-out forwards',
      },
      keyframes: {
        floatin: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};