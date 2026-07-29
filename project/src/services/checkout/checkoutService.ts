import { supabase } from '@/lib/supabase';
import type { CreateOrderItem } from '@/services/orders/orderService';

export type CheckoutBenefit = {
  type: string;
  id: string;
  title: string;
  detail?: string;
  reward_id?: string;
  discount_type?: string;
};

export type CheckoutPreview = {
  subtotal: number;
  discount: number;
  total: number;
  pointsEarned: number;
  earnMultiplier?: number;
  benefitTitle?: string | null;
  campaignId?: string | null;
};

export async function fetchCheckoutBenefits(
  storeId?: string | null,
): Promise<{ benefits: CheckoutBenefit[]; tier?: string; points?: number; error: string | null }> {
  const { data, error } = await supabase.rpc('get_checkout_benefits', {
    p_store_id: storeId ?? null,
  });
  if (error) return { benefits: [], error: error.message };
  const payload = data as { error?: string | null; benefits?: CheckoutBenefit[]; tier?: string; points?: number };
  if (payload.error) return { benefits: [], error: payload.error };
  return {
    benefits: (payload.benefits ?? []) as CheckoutBenefit[],
    tier: payload.tier,
    points: payload.points,
    error: null,
  };
}

export async function previewCheckout(params: {
  items: CreateOrderItem[];
  storeId?: string | null;
  couponCode?: string | null;
  benefitType?: string | null;
  benefitId?: string | null;
}): Promise<{ preview: CheckoutPreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc('preview_checkout', {
    p_items: params.items.map(it => ({
      productId: it.productId ?? null,
      name: it.name,
      qty: it.qty,
      price: it.price,
    })),
    p_store_id: params.storeId ?? null,
    p_coupon_code: params.couponCode ?? null,
    p_benefit_type: params.benefitType ?? null,
    p_benefit_id: params.benefitId ?? null,
  });
  if (error) return { preview: null, error: error.message };
  const r = data as Record<string, unknown>;
  if (r.error) return { preview: null, error: String(r.error) };
  return {
    preview: {
      subtotal: Number(r.subtotal ?? 0),
      discount: Number(r.discount ?? 0),
      total: Number(r.total ?? 0),
      pointsEarned: Number(r.points_earned ?? 0),
      earnMultiplier: r.earn_multiplier != null ? Number(r.earn_multiplier) : undefined,
      benefitTitle: r.benefit_title != null ? String(r.benefit_title) : null,
      campaignId: r.campaign_id != null ? String(r.campaign_id) : null,
    },
    error: null,
  };
}

export async function cancelOrder(
  orderNumber: string,
  reason?: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_number: orderNumber,
    p_reason: reason ?? null,
  });
  if (error) return { error: error.message };
  const r = data as { error?: string | null };
  return { error: r.error ?? null };
}

export async function recordOrderPayment(
  orderNumber: string,
  paymentStatus: string,
  transactionId?: string | null,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('record_order_payment', {
    p_order_number: orderNumber,
    p_payment_status: paymentStatus,
    p_transaction_id: transactionId ?? null,
    p_gateway: 'internal',
    p_refund_amount: null,
  });
  if (error) return { error: error.message };
  const r = data as { error?: string | null };
  return { error: r.error ?? null };
}

export async function advanceOrderStatus(
  orderNumber: string,
  status: string,
  note?: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('advance_order_status', {
    p_order_number: orderNumber,
    p_new_status: status,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  const r = data as { error?: string | null };
  return { error: r.error ?? null };
}
