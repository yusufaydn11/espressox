import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);

  const register = useCallback(async () => {
    if (Platform.OS === 'web') return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const projectId = (Constants as unknown as { expoConfig?: { extra?: { eas?: { projectId?: string } } } }).expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

    tokenRef.current = token;

    if (user) {
      await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('user_id', user.id);
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Espresso X Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C8102E',
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void register();
    }
  }, [user, register]);

  return { token: tokenRef.current, register };
}

export { Notifications };
