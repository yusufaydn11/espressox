import { supabase } from '@/lib/supabase';
import type { B2BNotification } from './notificationService';
import type { B2BOrder } from '@/services/b2b/types';

/** Realtime: new B2B notification rows. */
export function subscribeB2BNotifications(
  onNew: (notif: B2BNotification) => void,
): () => void {
  const channel = supabase
    .channel('b2b-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'type=eq.order' },
      (payload) => {
        const row = payload.new as B2BNotification;
        if (row.data?.source && String(row.data.source).startsWith('b2b')) {
          onNew(row);
        }
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/** Realtime: B2B order status changes for a store. */
export function subscribeB2BOrderChanges(
  storeId: string,
  onChange: (order: B2BOrder) => void,
): () => void {
  const channel = supabase
    .channel(`b2b-orders-${storeId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'b2b_orders', filter: `store_id=eq.${storeId}` },
      (payload) => {
        onChange(payload.new as B2BOrder);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
