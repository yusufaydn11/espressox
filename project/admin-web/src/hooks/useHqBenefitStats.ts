import { useCallback, useEffect, useState } from 'react';
import { fetchDailyBenefitStats } from '../services/loyalty/operationDataService';
import type { BenefitUsageDailyStats } from '@shared/types/operations';

export function useHqBenefitStats() {
  const [stats, setStats] = useState<BenefitUsageDailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchDailyBenefitStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { stats, loading, error, reload };
}
