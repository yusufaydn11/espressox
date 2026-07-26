export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatPrice(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

export function tierColor(tier: string) {
  const map: Record<string, string> = {
    Bronz: '#A87F54',
    Gumus: '#9494A0',
    Gümüş: '#9494A0',
    Altin: '#C8102E',
    Altın: '#C8102E',
    Siyah: '#18181B',
    VIP: '#C8102E',
  };
  return map[tier] ?? '#9494A0';
}
