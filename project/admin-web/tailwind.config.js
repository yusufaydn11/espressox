/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ex: {
          red: '#C8102E',
          redDark: '#A00D24',
          redLight: '#E11D38',
          50: '#FDF2F4',
          100: '#FCE8EC',
        },
        ink: {
          50: '#F7F7F8',
          100: '#EFEFF1',
          200: '#E0E0E4',
          300: '#C4C4CC',
          400: '#9494A0',
          500: '#6E6E78',
          600: '#525258',
          700: '#3D3D42',
          800: '#27272A',
          900: '#18181B',
          950: '#0C0C0E',
        },
        cream: {
          50: '#FAF9F6',
          100: '#F5F3EF',
          200: '#EDEBE5',
          300: '#E2DFD7',
        },
        gold: {
          400: '#D4AF37',
          500: '#C9A227',
          600: '#A8851E',
        },
        espresso: {
          700: '#3D2817',
          800: '#2A1B0F',
          900: '#1A0F08',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Inter', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,12,14,0.04)',
        soft: '0 2px 8px rgba(12,12,14,0.06)',
        lifted: '0 12px 32px -12px rgba(12,12,14,0.14)',
        premium: '0 20px 60px -20px rgba(12,12,14,0.20)',
        red: '0 8px 24px -8px rgba(200,16,46,0.30)',
      },
      backgroundImage: {
        'red-gradient': 'linear-gradient(135deg, #C8102E 0%, #A00D24 100%)',
        'espresso-gradient': 'linear-gradient(160deg, #18181B 0%, #27272A 100%)',
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #A8851E 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideIn: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
