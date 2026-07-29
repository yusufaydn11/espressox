import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** Şifre sıfırlama e-postasındaki link hedefi — web'de tarayıcı, mobilde deep link */
export function getPasswordResetRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return Linking.createURL('reset');
}

/** URL hash veya query'deki recovery token'ını oturuma çevirir */
export async function applyRecoveryHash(
  hash: string,
  setSession: (accessToken: string, refreshToken: string) => Promise<void>,
): Promise<boolean> {
  if (!hash) return false;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash.startsWith('?') ? hash.slice(1) : hash;
  if (!raw.includes('access_token')) return false;
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return false;
  await setSession(accessToken, refreshToken);
  return true;
}

export function clearRecoveryHashFromUrl(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
