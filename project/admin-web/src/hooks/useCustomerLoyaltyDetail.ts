import { useCallback, useEffect, useState } from 'react';
import { fetchOperationContextForUser, fetchCouponRedemptionsForUser, fetchCampaignApplicationsForUser, fetchOrderPaymentsForUser } from '../services/loyalty/operationDataService';
import { buildLoyaltyTimeline } from '@shared/utils/loyaltyTimeline';
import type { LoyaltyTimelineItem } from '@shared/types/operations';

export function useCustomerLoyaltyDetail(userId: string | undefined) {
  const [timeline, setTimeline] = useState<LoyaltyTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setTimeline([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [ctx, couponRows, campaignRows, paymentRows] = await Promise.all([
        fetchOperationContextForUser(userId),
        fetchCouponRedemptionsForUser(userId).catch(() => []),
        fetchCampaignApplicationsForUser(userId).catch(() => []),
        fetchOrderPaymentsForUser(userId).catch(() => []),
      ]);
      setTimeline(buildLoyaltyTimeline({
        pointsHistory: ctx.pointsHistory,
        stamps: ctx.stamps,
        redemptions: ctx.redemptions,
        freeCoffees: ctx.freeCoffees,
        notifications: ctx.notifications,
        rewards: ctx.rewards,
        couponRedemptions: couponRows.map((r: { id: string; redeemed_at: string; discount_amount?: number; coupons?: { title?: string } }) => ({
          id: r.id,
          redeemed_at: r.redeemed_at,
          discount_amount: r.discount_amount,
          title: r.coupons?.title,
        })),
        campaignApplications: campaignRows.map((r: { id: string; applied_at: string; discount_amount?: number; campaigns?: { title?: string; name?: string } }) => ({
          id: r.id,
          applied_at: r.applied_at,
          discount_amount: r.discount_amount,
          title: r.campaigns?.title ?? r.campaigns?.name,
        })),
        payments: paymentRows.map((r: { id: string; created_at: string; payment_method?: string; payment_status?: string; orders?: { order_number?: string } }) => ({
          id: r.id,
          created_at: r.created_at,
          payment_method: r.payment_method,
          payment_status: r.payment_status,
          order_number: r.orders?.order_number,
        })),
        limit: 40,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sadakat geçmişi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  return { timeline, loading, error, reload };
}
