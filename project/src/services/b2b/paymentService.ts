// ─── Payment & Ledger Service ──────────────────────────────

import { supabase } from '@/lib/supabase';
import { B2BService } from './base';
import { buildB2BInvoicePdfUrl, buildB2BPaymentEdgeUrl } from '@shared/utils/payments';
import type { B2BPayment, B2BLedgerEntry, B2BInvoice, RpcResult } from './types';

interface PaymentResult {
  success: boolean;
  pending?: boolean;
  message?: string;
  payment_id?: string;
  invoice_id?: string;
  error?: string;
}

class PaymentService extends B2BService<B2BPayment> {
  constructor() {
    super('b2b_payments');
  }

  async getRecent(limit = 100): Promise<B2BPayment[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BPayment[];
  }

  async getForOrder(orderId: string): Promise<B2BPayment | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as B2BPayment | null;
  }

  async getAllForOrder(orderId: string): Promise<B2BPayment[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BPayment[];
  }

  async record(orderId: string, provider: string, amount: number, method: string): Promise<RpcResult> {
    return this.rpc<RpcResult>('record_b2b_payment', {
      p_order_id: orderId,
      p_provider: provider,
      p_amount: amount,
      p_provider_ref: '',
      p_method: method,
    });
  }

  async confirm(paymentId: string): Promise<RpcResult> {
    return this.rpc<RpcResult>('confirm_b2b_payment', { p_payment_id: paymentId });
  }

  // ── Initiate payment via edge function (iyzico/Ödeal ready) ──
  async initiate(orderId: string, provider: string, method: string): Promise<PaymentResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Oturum açmanız gerekli');

      if (provider === 'manual' || provider === 'bank_transfer') {
        const result = await this.record(orderId, provider, 0, method);
        if (result.error) return { success: false, error: result.error };
        return {
          success: true,
          payment_id: result.payment_id as string | undefined,
          invoice_id: result.invoice_id as string | undefined,
        };
      }

      const fnUrl = buildB2BPaymentEdgeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'initiate',
          order_id: orderId,
          provider,
          method,
        }),
      });

      if (!res.ok) throw new Error(`Ödeme başlatılamadı (${res.status})`);
      const data = await res.json();
      if (data.error) return { success: false, error: data.error };
      return data as PaymentResult;
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Ödeme başlatılamadı' };
    }
  }
}

class LedgerService extends B2BService<B2BLedgerEntry> {
  constructor() {
    super('b2b_ledger');
  }

  async getRecent(limit = 100): Promise<B2BLedgerEntry[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BLedgerEntry[];
  }
}

class InvoiceService extends B2BService<B2BInvoice> {
  constructor() {
    super('b2b_invoices');
  }

  async getForOrder(orderId: string): Promise<B2BInvoice | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as B2BInvoice | null;
  }

  async getRecent(limit = 100): Promise<B2BInvoice[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BInvoice[];
  }

  // ── Generate invoice PDF URL (edge function, session-scoped token) ──
  async getInvoicePdfUrl(invoiceId: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Oturum açmanız gerekli');
    return buildB2BInvoicePdfUrl(
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      invoiceId,
      undefined,
      session.access_token,
    );
  }

  async getOrderPdfUrl(orderId: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Oturum açmanız gerekli');
    return buildB2BInvoicePdfUrl(
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      orderId,
      'order',
      session.access_token,
    );
  }
}

export const paymentService = new PaymentService();
export const ledgerService = new LedgerService();
export const invoiceService = new InvoiceService();
