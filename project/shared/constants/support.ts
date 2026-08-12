/** Store / support contact — no secrets. */
export const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'destek@espressox.com';

export const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || '';

export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || '';

export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || '';

export function supportMailtoUrl(subject = 'Espresso X Destek'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
