export {
  fetchActiveRewards,
  fetchAllRewards,
  createReward,
  updateReward,
  deleteReward,
  fetchPointsHistory,
  fetchLoyaltyStamps,
  fetchRewardRedemptions,
  fetchQrCode,
  fetchQrScans,
  fetchQrScansForAdmin,
  fetchEarnRate,
  redeemReward,
  addPoints,
  spendPoints,
  lookupQrByCode,
  scanQrStamp,
  fetchProfileByUserId,
  countActiveStamps,
} from './loyaltyService';

export type { QrScanRpcResult } from './loyaltyService';
