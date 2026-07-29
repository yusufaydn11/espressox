import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCustomers } from '../lib/api';
import { fetchTierBreakdown } from '../lib/analytics';
import type { UserProfile } from '../lib/supabase';
import { VIP_TIER_FILTER } from '@shared/constants/loyalty';

export type CrmSegment = 'all' | 'vip' | 'new' | 'inactive';

export type CrmSummary = {
  total: number;
  vip: number;
  newThisMonth: number;
  blocked: number;
  tierBreakdown: { label: string; value: number }[];
};

function computeSummary(customers: UserProfile[], tiers: { label: string; value: number }[]): CrmSummary {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    total: customers.length,
    vip: customers.filter(c => VIP_TIER_FILTER.includes(c.tier as typeof VIP_TIER_FILTER[number])).length,
    newThisMonth: customers.filter(c => new Date(c.created_at) >= monthStart).length,
    blocked: customers.filter(c => c.is_blocked).length,
    tierBreakdown: tiers,
  };
}

export function useCrmCustomers(segment: CrmSegment) {
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCustomers(segment === 'all' ? undefined : segment);
      setCustomers(rows);
      if (segment === 'all') {
        const tiers = await fetchTierBreakdown();
        setSummary(computeSummary(rows, tiers));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Müşteriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => { void load(); }, [load]);

  return { customers, summary, loading, error, reload: load };
}

export function useCustomerSearch(customers: UserProfile[], query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.full_name?.toLowerCase().includes(q)) ||
      (c.phone?.includes(q)) ||
      (c.tier?.toLowerCase().includes(q)),
    );
  }, [customers, query]);
}
