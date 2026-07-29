import { tailwindExtend } from './shared/design/tokens';

/** @type {import('tailwindcss').Config} */
export default {
  // nativewind preset is CommonJS-only
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require('nativewind/preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: tailwindExtend,
  },
  plugins: [],
};
