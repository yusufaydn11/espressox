import { tailwindExtend } from './shared/design/tokens';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('nativewind/preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: tailwindExtend,
  },
  plugins: [],
};
