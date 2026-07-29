import type { Config } from 'tailwindcss';
import { tailwindExtend } from '../shared/design/tokens';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: tailwindExtend as Config['theme'] extends { extend?: infer E } ? E : never,
  },
  plugins: [],
} satisfies Config;
