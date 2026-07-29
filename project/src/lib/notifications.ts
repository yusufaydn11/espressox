import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Constants from 'expo-constants';
import { resolvePushNotificationOrderId } from '@shared/constants/notifications';
import { saveExpoPushToken } from '@/services/notifications';
import { useAuth } from '@/context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type B2BOrderTapHandler = (orderId: string) => void;

let b2bOrderTapHandler: B2BOrderTapHandler | null = null;

export function setB2BOrderTapHandler(handler: B2BOrderTapHandler | null): void {
  b2bOrderTapHandler = handler;
}

function handleNotificationData(data: Record<string, unknown> | undefined): void {
  const orderId = resolvePushNotificationOrderId(data);
  if (orderId) b2bOrderTapHandler?.(orderId);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);
  const handledColdStartRef = useRef(false);

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
      await saveExpoPushToken(user.id, token);
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

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        handleNotificationData(response.notification.request.content.data as Record<string, unknown> | undefined);
      });
    }

    return () => sub.remove();
  }, []);

  return { token: tokenRef.current, register };
}

export { Notifications };
