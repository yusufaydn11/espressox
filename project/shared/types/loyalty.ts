export type Tier = 'Bronz' | 'Gümüş' | 'Altın' | 'Siyah' | 'VIP';

export interface TierInfo {
  name: Tier;
  minPoints: number;
  color: string;
  perks: string[];
}

export type RedeemRpcPayload = {
  error: string | null;
  needed?: number;
};
