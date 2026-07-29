/** Intl-based TRY formatter (admin-web canonical). */
export function formatTRY(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Mobile-friendly price display (rounded, ₺ prefix). */
export function formatPrice(n: number): string {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

/** B2B detail views — two decimal places. */
export function formatTRYDecimal(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(s: string): string {
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}
