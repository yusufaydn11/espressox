// ─── B2B Module Registry ───────────────────────────────────
// Central registry of all B2B modules and their screens.
// New modules (warehouse, production, accounting, etc.) are added
// here without touching FranchiseApp or existing screens.
//
// To add a new module:
// 1. Create its screens in src/screens/b2b/
// 2. Add a B2BModuleDef entry in MODULE_REGISTRY below
// 3. Add its screen entries in SCREEN_REGISTRY below
// That's it — FranchiseApp reads from these registries automatically.

import type { B2BModuleDef } from '@/services/b2b/types';

export interface B2BScreenDef {
  id: string;
  label: string;
  moduleId: string;
  group: string;
  roles: string[];
  icon: string; // lucide icon name — resolved in FranchiseApp
  sort_order: number;
  enabled: boolean;
}

// ─── Module Definitions ─────────────────────────────────────
// Future modules are listed here with enabled: false.
// When implemented, flip enabled to true and add screen defs.

export const MODULE_REGISTRY: B2BModuleDef[] = [
  // ── Active modules ──
  { id: 'supply', label: 'B2B Tedarik', icon: 'Package', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], enabled: true, sort_order: 10 },
  { id: 'finance', label: 'B2B Finans', icon: 'Wallet', group: 'B2B Finans', roles: ['franchise'], enabled: true, sort_order: 20 },

  // ── Future modules (architecture ready, not yet implemented) ──
  { id: 'warehouse', label: 'Depo Yönetimi', icon: 'Warehouse', group: 'Operasyon', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 30 },
  { id: 'purchasing', label: 'Satın Alma', icon: 'ShoppingCart', group: 'Operasyon', roles: ['super_admin'], enabled: false, sort_order: 31 },
  { id: 'supplier', label: 'Tedarikçi Yönetimi', icon: 'Truck', group: 'Operasyon', roles: ['super_admin'], enabled: false, sort_order: 32 },
  { id: 'transfer', label: 'Transferler', icon: 'ArrowLeftRight', group: 'Operasyon', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 33 },
  { id: 'inventory', label: 'Sayım', icon: 'ClipboardCheck', group: 'Operasyon', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 34 },
  { id: 'production', label: 'Üretim', icon: 'Coffee', group: 'Üretim', roles: ['super_admin'], enabled: false, sort_order: 40 },
  { id: 'recipe', label: 'Reçete', icon: 'FileText', group: 'Üretim', roles: ['super_admin'], enabled: false, sort_order: 41 },
  { id: 'material', label: 'Hammaddeler', icon: 'Boxes', group: 'Üretim', roles: ['super_admin'], enabled: false, sort_order: 42 },
  { id: 'shelflife', label: 'Raf Ömrü & SKT', icon: 'Calendar', group: 'Üretim', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 43 },
  { id: 'lot', label: 'Parti (Lot) Takibi', icon: 'Hash', group: 'Üretim', roles: ['super_admin'], enabled: false, sort_order: 44 },
  { id: 'barcode', label: 'Barkod & QR', icon: 'ScanLine', group: 'Üretim', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 45 },
  { id: 'shipping', label: 'Kargo Yönetimi', icon: 'Truck', group: 'Lojistik', roles: ['super_admin'], enabled: false, sort_order: 50 },
  { id: 'accounting', label: 'Muhasebe', icon: 'Calculator', group: 'Finans', roles: ['super_admin'], enabled: false, sort_order: 60 },
  { id: 'ledger', label: 'Cari Hesap Yönetimi', icon: 'BookOpen', group: 'Finans', roles: ['super_admin'], enabled: false, sort_order: 61 },
  { id: 'campaign', label: 'Kampanyalar', icon: 'Megaphone', group: 'Pazarlama', roles: ['super_admin'], enabled: false, sort_order: 70 },
  { id: 'contract', label: 'Franchise Sözleşmeleri', icon: 'FileSignature', group: 'Pazarlama', roles: ['super_admin'], enabled: false, sort_order: 71 },
  { id: 'commission', label: 'Prim Sistemi', icon: 'Award', group: 'Pazarlama', roles: ['super_admin'], enabled: false, sort_order: 72 },
  { id: 'reporting', label: 'Raporlama', icon: 'BarChart3', group: 'Raporlama', roles: ['franchise', 'store_manager', 'super_admin'], enabled: false, sort_order: 80 },
];

// ─── Screen Definitions ─────────────────────────────────────
// Each screen belongs to a module. FranchiseApp renders screens
// based on the user's role and the screen's roles array.

export const SCREEN_REGISTRY: B2BScreenDef[] = [
  // ── Supply module ──
  { id: 'b2b_dashboard', label: 'Tedarik Dashboard', moduleId: 'supply', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], icon: 'LayoutDashboard', sort_order: 1, enabled: true },
  { id: 'b2b_products', label: 'Tedarik Ürünleri', moduleId: 'supply', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], icon: 'Package', sort_order: 2, enabled: true },
  { id: 'b2b_cart', label: 'Sepet', moduleId: 'supply', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], icon: 'ShoppingCart', sort_order: 3, enabled: true },
  { id: 'b2b_orders', label: 'Siparişlerim', moduleId: 'supply', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], icon: 'PackageCheck', sort_order: 4, enabled: true },
  { id: 'b2b_templates', label: 'Favori Siparişler', moduleId: 'supply', group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], icon: 'Boxes', sort_order: 5, enabled: true },

  // ── Finance module ──
  { id: 'b2b_account', label: 'Cari Hesap', moduleId: 'finance', group: 'B2B Finans', roles: ['franchise'], icon: 'BookOpen', sort_order: 1, enabled: true },
  { id: 'b2b_invoices', label: 'Faturalar', moduleId: 'finance', group: 'B2B Finans', roles: ['franchise'], icon: 'Receipt', sort_order: 2, enabled: true },
  { id: 'b2b_payments', label: 'Ödemeler', moduleId: 'finance', group: 'B2B Finans', roles: ['franchise'], icon: 'Wallet', sort_order: 3, enabled: true },

  // ── Future screens (add here when implemented) ──
  // Example:
  // { id: 'wh_dashboard', label: 'Depo Dashboard', moduleId: 'warehouse', group: 'Depo Yönetimi', roles: ['store_manager', 'super_admin'], icon: 'Warehouse', sort_order: 1, enabled: false },
];

// ─── Helper: Get visible screens for a role ──────────────────

export function getVisibleScreens(role: string): B2BScreenDef[] {
  const enabledModules = new Set<string>(
    MODULE_REGISTRY.filter(m => m.enabled).map(m => m.id as string),
  );
  return SCREEN_REGISTRY
    .filter(s => s.enabled && enabledModules.has(s.moduleId as string) && s.roles.includes(role))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getVisibleGroups(role: string): string[] {
  const screens = getVisibleScreens(role);
  return Array.from(new Set(screens.map(s => s.group)));
}
