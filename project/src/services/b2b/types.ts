// ─── B2B Domain Types ──────────────────────────────────────
// Centralized type definitions for the entire B2B module.
// Future modules (warehouse, production, accounting, etc.) should
// add their types in their own domain files and re-export here.

// ── Order Lifecycle ──

export type B2BOrderStatus =
  | 'draft' | 'awaiting_payment' | 'paid' | 'confirmed'
  | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export type B2BInvoiceStatus = 'issued' | 'paid' | 'partial' | 'cancelled';
export type B2BPaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
export type B2BLedgerType = 'debit' | 'credit';
export type B2BRiskStatus = 'normal' | 'warning' | 'blocked';

// ── Entities ──

export interface B2BProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  unit: string;
  price: number;
  vat_rate: number;
  min_order_qty: number;
  is_active: boolean;
  campaign_label: string;
  campaign_price: number | null;
  campaign_ends: string | null;
  default_warehouse_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface B2BProductStock {
  id: string;
  product_id: string;
  warehouse_id: string;
  stock_qty: number;
  reserved_qty: number;
}

export interface B2BWarehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  is_active: boolean;
  is_default: boolean;
}

export interface B2BOrder {
  id: string;
  order_number: string;
  store_id: string | null;
  franchise_id: string | null;
  warehouse_id: string | null;
  status: B2BOrderStatus;
  subtotal: number;
  vat_total: number;
  total: number;
  notes: string;
  carrier_company: string;
  tracking_number: string;
  tracking_url: string;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  cancel_reason: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface B2BOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  image_url?: string;
}

export interface B2BInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  store_id: string | null;
  franchise_id: string | null;
  status: B2BInvoiceStatus;
  subtotal: number;
  vat_total: number;
  total: number;
  paid_amount: number;
  due_date: string | null;
  pdf_url: string;
  e_invoice_status: string;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface B2BPayment {
  id: string;
  payment_number: string;
  order_id: string;
  store_id: string | null;
  franchise_id: string | null;
  amount: number;
  status: B2BPaymentStatus;
  provider: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
}

export interface B2BLedgerEntry {
  id: string;
  entry_number: string;
  franchise_id: string;
  store_id: string | null;
  type: B2BLedgerType;
  amount: number;
  description: string;
  ref_type: string;
  ref_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface B2BOrderTemplate {
  id: string;
  name: string;
  store_id: string | null;
  franchise_id: string | null;
  source_order_id: string | null;
  items: Array<{ product_id: string; quantity: number }>;
  is_favorite: boolean;
  created_at: string;
}

export interface B2BFranchiseCredit {
  id: string;
  franchise_id: string;
  credit_limit: number;
  current_balance: number;
  risk_status: B2BRiskStatus;
  payment_terms_days: number;
}

export interface B2BNotification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  type: string;
  data: { order_id?: string; order_number?: string; status?: string; source?: string; [key: string]: unknown } | null;
  created_at: string;
}

// ── Aggregated / RPC Result Types ──

export interface B2BDashboardData {
  balance: number;
  last_payment: { payment_number: string; amount: number; paid_at: string } | null;
  order_counts: {
    awaiting_payment: number; paid: number; confirmed: number;
    preparing: number; shipped: number; delivered: number; draft: number;
  };
  last_order: { order_number: string; total: number; created_at: string } | null;
  open_invoice_total: number;
  recent_movements: Array<{
    entry_number: string; type: B2BLedgerType;
    amount: number; description: string; created_at: string;
  }>;
}

export interface B2BAccountSummary {
  balance: number;
  total_debit: number;
  total_credit: number;
  open_invoices: Array<{
    id: string; invoice_number: string; total: number;
    paid_amount: number; status: string; due_date: string | null; created_at: string;
  }>;
  recent_movements: Array<{
    entry_number: string; type: B2BLedgerType;
    amount: number; description: string; created_at: string;
  }>;
  credit: {
    credit_limit: number; current_balance: number;
    risk_status: B2BRiskStatus; payment_terms_days: number;
  } | null;
}

// ── Cart ──

export interface B2BCartItem {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  quantity: number;
}

// ── Pagination ──

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface QueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: Record<string, string>;
  orderBy?: string;
  ascending?: boolean;
}

// ── RPC Result ──

export interface RpcResult {
  error: string | null;
  [key: string]: unknown;
}

// ── Module Registry Types (for future expansion) ──

export type B2BModuleId =
  | 'supply' | 'warehouse' | 'purchasing' | 'supplier' | 'transfer'
  | 'inventory' | 'production' | 'recipe' | 'material' | 'shelflife'
  | 'lot' | 'barcode' | 'shipping' | 'accounting' | 'finance'
  | 'ledger' | 'campaign' | 'contract' | 'commission' | 'reporting';

export interface B2BModuleDef {
  id: B2BModuleId;
  label: string;
  icon: string; // lucide icon name
  group: string;
  roles: string[];
  enabled: boolean;
  sort_order: number;
}
