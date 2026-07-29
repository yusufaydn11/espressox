/**
 * Espresso X V2 — shared component variant specs (mobile + admin-web)
 */
import { colors } from './tokens';

export const buttonVariants = {
  primary: {
    bg: colors.brand.primary,
    bgHover: colors.brand.primaryDark,
    text: '#FFFFFF',
    shadow: 'red',
  },
  secondary: {
    bg: colors.cream[100],
    bgHover: colors.cream[200],
    text: colors.ink[900],
    border: colors.ink[200],
  },
  outline: {
    bg: 'transparent',
    border: colors.ink[300],
    text: colors.ink[800],
  },
  ghost: {
    bg: 'transparent',
    text: colors.ink[600],
  },
  danger: {
    bg: colors.semantic.error,
    text: '#FFFFFF',
  },
  gold: {
    bg: colors.gold[500],
    text: colors.ink[950],
  },
} as const;

export const cardVariants = {
  default: {
    bg: colors.surface.card,
    border: colors.ink[100],
    radius: '2xl',
    shadow: 'card',
  },
  elevated: {
    bg: colors.surface.elevated,
    border: 'transparent',
    radius: '2xl',
    shadow: 'lifted',
  },
  premium: {
    bg: colors.surface.card,
    border: colors.ink[100],
    radius: '3xl',
    shadow: 'premium',
  },
  loyalty: {
    bg: colors.brand.primary,
    text: '#FFFFFF',
    radius: '3xl',
    shadow: 'red',
  },
} as const;

export const inputVariants = {
  default: {
    bg: colors.surface.card,
    border: colors.ink[200],
    borderFocus: colors.brand.primary,
    text: colors.ink[900],
    placeholder: colors.ink[400],
    radius: 'xl',
  },
} as const;

export const toastVariants = {
  success: { bg: colors.semantic.successMuted, text: colors.semantic.success, icon: 'success' },
  error: { bg: colors.semantic.errorMuted, text: colors.semantic.error, icon: 'error' },
  warning: { bg: colors.semantic.warningMuted, text: colors.semantic.warning, icon: 'warning' },
  info: { bg: colors.semantic.infoMuted, text: colors.semantic.info, icon: 'info' },
} as const;

export const emptyStateVariants = {
  default: {
    iconColor: colors.ink[300],
    titleColor: colors.ink[800],
    subtitleColor: colors.ink[500],
  },
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type CardVariant = keyof typeof cardVariants;
export type ToastVariant = keyof typeof toastVariants;
