/**
 * Espresso X V2 — Tailwind class maps (static strings for NativeWind / admin-web)
 * Keep in sync with shared/design/componentVariants.ts
 */

export const buttonClasses = {
  primary: 'bg-ex-red text-white active:bg-ex-redDark shadow-red active:scale-[0.98]',
  secondary: 'bg-cream-100 text-ink-900 border border-ink-200 active:bg-cream-200 active:scale-[0.98]',
  gold: 'bg-gold-gradient text-ink-950 font-semibold shadow-gold active:opacity-90 active:scale-[0.98]',
  dark: 'bg-ink-900 text-white active:bg-ink-800 active:scale-[0.98]',
  outline: 'border border-ink-200 text-ink-900 bg-white active:border-ink-300 active:bg-cream-50 active:scale-[0.98]',
  ghost: 'text-ink-600 active:bg-ink-100 active:scale-[0.98]',
  subtle: 'bg-ink-100 text-ink-700 active:bg-ink-200 active:scale-[0.98]',
  danger: 'bg-semantic-error text-white active:opacity-90 active:scale-[0.98]',
} as const;

export const cardClasses = {
  default: 'rounded-2xl bg-surface-card border border-ink-100 shadow-card',
  elevated: 'rounded-2xl bg-surface-elevated shadow-lifted',
  premium: 'rounded-3xl bg-surface-card border border-ink-100 shadow-premium',
  loyalty: 'rounded-3xl bg-ex-red shadow-red',
  bare: 'rounded-2xl bg-surface-card border border-ink-100',
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
