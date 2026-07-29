import { supabase } from '../../lib/supabase';
import { buildB2BInvoicePdfUrl } from '@shared/utils/payments';
import type { B2BInvoice, B2BPayment } from '../../lib/supabase';

/** B2B payments, invoices — HQ admin layer (not retail). */

export async function fetchB2BInvoicesForOrder(orderId: string): Promise<B2BInvoice[]> {
  const { data, error } = await supabase
    .from('b2b_invoices')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as B2BInvoice[];
}

export async function fetchB2BPaymentsForOrder(orderId: string): Promise<B2BPayment[]> {
  const { data, error } = await supabase
    .from('b2b_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as B2BPayment[];
}

export async function confirmB2BPayment(paymentId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('confirm_b2b_payment', { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  return data as { error: string | null };
}

export async function getB2BInvoicePdfUrl(invoiceId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Oturum gerekli');
  return buildB2BInvoicePdfUrl(import.meta.env.VITE_SUPABASE_URL, invoiceId, undefined, session.access_token);
}

export async function getB2BOrderPdfUrl(orderId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Oturum gerekli');
  return buildB2BInvoicePdfUrl(import.meta.env.VITE_SUPABASE_URL, orderId, 'order', session.access_token);
}
