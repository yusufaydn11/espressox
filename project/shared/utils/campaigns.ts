export type CampaignLike = {
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  store_id?: string | null;
};

/** Client-side visibility until RPC enforces schedule + store scope. */
export function filterVisibleCampaigns<T extends CampaignLike>(
  campaigns: T[],
  opts?: { storeId?: string | null; now?: Date },
): T[] {
  const now = opts?.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  return campaigns.filter(c => {
    if (c.status !== 'active') return false;
    if (c.start_date && String(c.start_date).slice(0, 10) > today) return false;
    if (c.end_date && String(c.end_date).slice(0, 10) < today) return false;
    if (c.store_id) {
      if (!opts?.storeId) return false;
      if (c.store_id !== opts.storeId) return false;
    }
    return true;
  });
}
