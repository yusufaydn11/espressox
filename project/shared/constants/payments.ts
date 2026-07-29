/** UI-facing invoice status badges (mobile + admin — preserves existing copy). */
export const B2B_INVOICE_STATUS_UI_LABELS: Record<string, string> = {
  paid: 'Ödendi',
  issued: 'Açık',
  partial: 'Kısmi Ödeme',
  cancelled: 'İptal',
};

export const B2B_INVOICE_STATUS_UI_TONES: Record<string, 'green' | 'amber' | 'neutral' | 'red'> = {
  paid: 'green',
  issued: 'amber',
  partial: 'amber',
  cancelled: 'red',
};

export const B2B_PAYMENT_STATUS_UI_TONES: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  success: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'neutral',
};

export const B2B_BALANCE_LABELS = {
  debtor: 'Borçlu',
  creditor: 'Alacaklı',
  settled: 'Kapalı',
} as const;

export const B2B_PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Havale / EFT', desc: 'Banka transferi ile öde' },
  { id: 'card', label: 'Kredi Kartı', desc: 'İyzico ile öde (yakında)' },
] as const;

export const B2B_PAYMENT_EDGE_ACTIONS = {
  initiate: 'initiate',
  webhook: 'webhook',
} as const;
