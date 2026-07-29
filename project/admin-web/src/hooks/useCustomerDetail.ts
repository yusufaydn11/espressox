import { useCallback, useEffect, useState } from 'react';
import { fetchCustomers, fetchCustomerOrders } from '../lib/api';
import type { UserProfile, OrderRow } from '../lib/supabase';

export function useCustomerDetail(userId: string | undefined) {
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setError('Müşteri bulunamadı');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allCustomers, orderRows] = await Promise.all([
        fetchCustomers(),
        fetchCustomerOrders(userId),
      ]);
      const found = allCustomers.find(c => c.user_id === userId) ?? null;
      if (!found) {
        setError('Müşteri bulunamadı');
        setCustomer(null);
        setOrders([]);
        return;
      }
      setCustomer(found);
      setOrders(orderRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Müşteri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { customer, orders, loading, error, reload: load };
}
