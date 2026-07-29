export type OrderBenefitKind =
  | 'paid'
  | 'stamp_card'
  | 'points_reward'
  | 'birthday'
  | 'vip'
  | 'campaign'
  | 'coupon'
  | 'free_unknown';

export type OrderBenefitInfo = {
  kind: OrderBenefitKind;
  label: string;
  detail: string;
  pointsEarned?: number;
  pointsSpent?: number;
  badgeTone: 'default' | 'green' | 'gold' | 'red';
};

export type LoyaltyTimelineItem = {
  id: string;
  at: string;
  category: 'points' | 'stamp' | 'reward' | 'free_coffee' | 'qr' | 'campaign' | 'coupon' | 'payment';
  title: string;
  subtitle: string;
  delta?: number;
};

export type BenefitUsageDailyStats = {
  freeOrders: number;
  stampRedemptions: number;
  rewardRedemptions: number;
  campaignNotifications: number;
  pointsRedeemed: number;
};
