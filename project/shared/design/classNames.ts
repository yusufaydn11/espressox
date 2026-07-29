/**
 * Espresso X — Tailwind class maps
 */

export const buttonClasses = {
  primary: 'bg-ex-red text-white active:bg-ex-redDark shadow-red rounded-full',
  secondary: 'bg-white text-ink-800 border border-ink-200 active:bg-cream-50 rounded-full',
  gold: 'bg-red-gradient text-white font-semibold shadow-red active:opacity-90 rounded-full',
  dark: 'bg-ink-900 text-white active:bg-ink-800 rounded-full',
  outline: 'border border-ink-200 text-ink-800 bg-white active:border-ex-red/40 active:bg-ex-red/5 rounded-full',
  ghost: 'text-ink-500 active:bg-ink-100 rounded-full',
  subtle: 'bg-cream-100 text-ink-600 active:bg-cream-200 rounded-full',
  danger: 'bg-semantic-error text-white active:opacity-90 rounded-full',
} as const;

export const cardClasses = {
  default: 'rounded-2xl bg-white shadow-soft border border-cream-100',
  elevated: 'rounded-2xl bg-white shadow-lifted border border-cream-100',
  premium: 'rounded-[1.25rem] bg-white shadow-premium border border-cream-200',
  loyalty: 'rounded-[1.25rem] bg-white shadow-lifted border border-cream-200',
  bare: 'rounded-2xl bg-white',
} as const;

export const toastClasses = {
  success: 'bg-semantic-successMuted',
  error: 'bg-semantic-errorMuted',
  warning: 'bg-semantic-warningMuted',
  info: 'bg-semantic-infoMuted',
  default: 'bg-ink-900',
} as const;

export type ButtonClassVariant = keyof typeof buttonClasses;
export type CardClassVariant = keyof typeof cardClasses;
export type ToastClassVariant = keyof typeof toastClasses;
