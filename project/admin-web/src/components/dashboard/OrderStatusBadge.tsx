const map: Record<string, { tone: string; label: string }> = {
  pending: { tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400', label: 'Yeni' },
  preparing: { tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400', label: 'Hazırlanıyor' },
  ready: { tone: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400', label: 'Hazır' },
  'picked-up': { tone: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', label: 'Teslim Alındı' },
  delivered: { tone: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', label: 'Teslim Edildi' },
  cancelled: { tone: 'bg-ex-100 text-ex-red dark:bg-red-950 dark:text-red-400', label: 'İptal' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = map[status] ?? { tone: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', label: status };
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}
