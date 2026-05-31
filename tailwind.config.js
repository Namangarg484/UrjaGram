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
        aqua: {
          DEFAULT: '#2563EB',
          light: '#38BDF8',
          deep: '#1E3A8A',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,40,32,0.04), 0 4px 16px rgba(16,40,32,0.06)',
        lift: '0 2px 6px rgba(16,40,32,0.06), 0 12px 32px rgba(16,40,32,0.10)',
        float: '0 8px 24px rgba(16,40,32,0.10), 0 24px 64px rgba(16,40,32,0.14)',
        glow: '0 0 0 4px rgba(46,125,82,0.14)',
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        badge: '20px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        floatin: 'floatin 500ms cubic-bezier(0.22,1,0.36,1) forwards',
        scalein: 'scalein 400ms cubic-bezier(0.22,1,0.36,1) forwards',
        floaty: 'floaty 6s ease-in-out infinite',
      },
      keyframes: {
        floatin: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scalein: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};