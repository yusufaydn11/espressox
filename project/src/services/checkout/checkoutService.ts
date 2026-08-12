import { supabase } from '@/lib/supabase';
import type { CreateOrderItem } from '@/services/orders/orderService';
import { buildRetailPaymentInitiateUrl } from '@shared/utils/retailPayments';

export type PaymentCardInput = {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
};

export type RetailPaymentInitResult = {
  paymentIntentId?: string;
  sessionToken?: string;
  threeDSPageUrl?: string;
  error: string | null;
};

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

/** Staff-only: confirm cash payment at store (FAZ 0 — customers cannot confirm payments). */
export async function confirmCashPayment(
  orderNumber: string,
  note?: string | null,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('confirm_cash_payment', {
    p_order_number: orderNumber,
    p_note: note ?? null,
  });
  if (error) return { error: error.message };
  const r = data as { error?: string | null };
  return { error: r.error ?? null };
}

/** Start iyzico 3DS payment for a payment_pending order (FAZ 1 — server sets amount). */
export async function initiateRetailPayment(
  orderNumber: string,
  paymentCard: PaymentCardInput,
): Promise<RetailPaymentInitResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: 'unauthenticated' };

    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const res = await fetch(buildRetailPaymentInitiateUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({
        order_number: orderNumber,
        payment_card: paymentCard,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok || data.error) {
      return { error: String(data.error ?? data.detail ?? `payment_init_failed_${res.status}`) };
    }

    return {
      paymentIntentId: data.payment_intent_id as string | undefined,
      sessionToken: data.session_token as string | undefined,
      threeDSPageUrl: data.three_ds_page_url as string | undefined,
      error: null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'payment_init_failed' };
  }
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
