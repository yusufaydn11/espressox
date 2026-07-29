import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@espressox/customer_onboarding_v1';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}/${userId}`;
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(storageKey(userId));
    return value === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), '1');
}
