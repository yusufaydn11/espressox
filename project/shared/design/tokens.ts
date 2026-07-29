/**
 * Espresso X V2 — Design tokens (source of truth for Tailwind + runtime)
 * Do not remove legacy keys; extend only.
 */

export const colors = {
  brand: {
    primary: '#C8102E',
    primaryDark: '#A00D24',
    primaryLight: '#E11D38',
    primaryMuted: '#FDF2F4',
  },
  ex: {
    red: '#C8102E',
    redDark: '#A00D24',
    redLight: '#E11D38',
    red50: '#FDF2F4',
    /** @deprecated use red50 — kept for existing class names (bg-ex-100) */
    100: '#FDF2F4',
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
    400: '#D4D0C6',
  },
  gold: {
    50: '#FBF8EE',
    100: '#F5EFD6',
    200: '#EBDCAA',
    300: '#DFC87A',
    400: '#D4AF37',
    500: '#C9A227',
    600: '#A8851E',
    700: '#7A6116',
  },
  espresso: {
    50: '#F7F7F8',
    100: '#EFEFF1',
    200: '#E0E0E4',
    300: '#6E6E78',
    400: '#525258',
    500: '#3D3D42',
    600: '#27272A',
    700: '#18181B',
    800: '#18181B',
    900: '#0C0C0E',
    950: '#0C0C0E',
  },
  semantic: {
    success: '#15803D',
    successMuted: '#DCFCE7',
    warning: '#B45309',
    warningMuted: '#FEF3C7',
    error: '#C8102E',
    errorMuted: '#FDF2F4',
    info: '#2563EB',
    infoMuted: '#DBEAFE',
  },
  surface: {
    canvas: '#FAF9F6',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    overlay: 'rgba(12, 12, 14, 0.45)',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
    display: ['"Fraunces"', '"Inter"', 'serif'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    'display-1': ['clamp(2.25rem, 6vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
    'display-2': ['clamp(1.75rem, 4.5vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const radii = {
  none: '0',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const;

export const shadows = {
  card: '0 1px 2px rgba(12,12,14,0.04)',
  soft: '0 2px 8px rgba(12,12,14,0.05)',
  lifted: '0 12px 32px -12px rgba(12,12,14,0.12)',
  premium: '0 20px 60px -20px rgba(12,12,14,0.18)',
  red: '0 8px 24px -8px rgba(200,16,46,0.28)',
  gold: '0 8px 24px -8px rgba(201,162,39,0.25)',
  innerLine: 'inset 0 0 0 1px rgba(12,12,14,0.06)',
} as const;

export const gradients = {
  red: 'linear-gradient(135deg, #C8102E 0%, #A00D24 100%)',
  cream: 'linear-gradient(168deg, #FAF9F6 0%, #F5F3EF 100%)',
  espresso: 'linear-gradient(160deg, #18181B 0%, #27272A 100%)',
  gold: 'linear-gradient(135deg, #D4AF37 0%, #A8851E 100%)',
  shimmer: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.5) 50%, transparent 75%)',
} as const;

export const motion = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  easing: {
    smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
  },
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  toast: 1300,
  tooltip: 1400,
} as const;

/** Tailwind `theme.extend` fragment — consumed by mobile + admin-web */
export const tailwindExtend = {
  colors: {
    ex: colors.ex,
    ink: colors.ink,
    cream: colors.cream,
    gold: colors.gold,
    espresso: colors.espresso,
    brand: colors.brand,
    semantic: colors.semantic,
    surface: colors.surface,
  },
  fontFamily: typography.fontFamily,
  fontSize: typography.fontSize,
  boxShadow: {
    card: shadows.card,
    soft: shadows.soft,
    lifted: shadows.lifted,
    premium: shadows.premium,
    red: shadows.red,
    gold: shadows.gold,
    'inner-line': shadows.innerLine,
  },
  backgroundImage: {
    'red-gradient': gradients.red,
    'cream-gradient': gradients.cream,
    'espresso-gradient': gradients.espresso,
    'gold-gradient': gradients.gold,
    shimmer: gradients.shimmer,
  },
  borderRadius: radii,
  transitionTimingFunction: {
    spring: motion.easing.spring,
    smooth: motion.easing.smooth,
  },
  animation: {
    'fade-in': 'fadeIn 0.4s ease forwards',
    'fade-up': 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
    'fade-down': 'fadeDown 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
    'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
    'scale-in': 'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
    'scale-spring': 'scaleSpring 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
    'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
    shimmer: 'shimmer 2s linear infinite',
    pop: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
  },
  keyframes: {
    fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
    fadeUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
    fadeDown: { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
    slideUp: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
    scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
    scaleSpring: { '0%': { opacity: '0', transform: 'scale(0.85)' }, '60%': { transform: 'scale(1.03)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
    pulseSoft: { '0%,100%': { opacity: '0.3' }, '50%': { opacity: '0.5' } },
    shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
    pop: { '0%': { transform: 'scale(0.5)', opacity: '0' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
  },
} as const;

export type BrandColor = keyof typeof colors.brand;
export type SemanticColor = keyof typeof colors.semantic;
