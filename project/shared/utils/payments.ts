import {
  B2B_INVOICE_STATUS_UI_LABELS,
  B2B_BALANCE_LABELS,
} from '../constants/payments';
import { B2B_INVOICE_STATUS_LABELS, B2B_PAYMENT_STATUS_LABELS } from '../constants/b2b';
import { formatTRYDecimal } from './format';

/** B2B monetary display — 2 decimal places (canonical for payments/invoices). */
export function formatB2BPaymentAmount(amount: number): string {
  return formatTRYDecimal(amount);
}

export function buildB2BInvoicePdfUrl(
  baseUrl: string,
  id: string,
  type?: 'order',
  accessToken?: string,
): string {
  const params = new URLSearchParams({ id });
  if (type === 'order') params.set('type', 'order');
  if (accessToken) params.set('access_token', accessToken);
  return `${baseUrl}/functions/v1/b2b-invoice-pdf?${params.toString()}`;
}

export function buildB2BPaymentEdgeUrl(baseUrl: string): string {
  return `${baseUrl}/functions/v1/b2b-payment`;
}

export function getBalanceLabel(balance: number): string {
  if (balance > 0) return B2B_BALANCE_LABELS.debtor;
  if (balance < 0) return B2B_BALANCE_LABELS.creditor;
  return B2B_BALANCE_LABELS.settled;
}

export function getInvoiceStatusUiLabel(status: string): string {
  return B2B_INVOICE_STATUS_UI_LABELS[status] ?? B2B_INVOICE_STATUS_LABELS[status] ?? status;
}

export function getPaymentStatusLabel(status: string): string {
  return B2B_PAYMENT_STATUS_LABELS[status] ?? status;
}

export function sumSuccessfulPaymentAmount(
  payments: { status: string; amount: number }[],
): number {
  return payments
    .filter(p => p.status === 'success')
    .reduce((sum, p) => sum + p.amount, 0);
}

export function hasPendingPayment(
  payments: { status: string }[],
): boolean {
  return payments.some(p => p.status === 'pending');
}
