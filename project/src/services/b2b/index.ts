// ─── B2B Service Layer — Barrel Export ─────────────────────
// All domain services are exported from here. Screens import
// from '@/services/b2b' and never touch supabase directly.

// Types
export type {
  B2BOrderStatus, B2BInvoiceStatus, B2BPaymentStatus,
  B2BLedgerType, B2BRiskStatus,
  B2BProduct, B2BProductStock, B2BWarehouse,
  B2BOrder, B2BOrderItem, B2BInvoice, B2BPayment,
  B2BLedgerEntry, B2BOrderTemplate, B2BFranchiseCredit,
  B2BNotification, B2BDashboardData, B2BAccountSummary,
  B2BCartItem, PaginatedResult, QueryOptions, RpcResult,
  B2BModuleId, B2BModuleDef,
} from './types';

// Base helpers & formatters
export {
  b2bFormatTRY, b2bFormatDate, b2bFormatDateTime, b2bTimeAgo,
  B2B_ORDER_STATUS_LABELS, B2B_INVOICE_STATUS_LABELS,
  B2B_PAYMENT_STATUS_LABELS, B2B_RISK_LABELS,
  B2B_ORDER_STATUS_TONES, B2B_INVOICE_STATUS_TONES,
  B2B_PAYMENT_STATUS_TONES, B2B_RISK_TONES, B2B_TIMELINE_LABELS,
  getEffectivePrice, hasActiveCampaign,
} from './base';

// Domain services
export { productService } from './productService';
export { orderService } from './orderService';
export { paymentService, ledgerService, invoiceService } from './paymentService';
export { dashboardService, accountService } from './accountService';
export { templateService, notificationService } from './templateService';
export { cartService } from './cartService';
