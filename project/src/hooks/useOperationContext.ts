import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchOperationContextForUser, type OperationContext } from '@/services/loyalty';

export function useOperationContext() {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<OperationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setCtx(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchOperationContextForUser(user.id);
    if (err) setError(err);
    else setCtx(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  return { ctx, loading, error, reload };
}
