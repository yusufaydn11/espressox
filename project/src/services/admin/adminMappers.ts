import type { Coupon as UiCoupon } from '@/context/AdminContext';
import type { Employee as UiEmployee } from '@/types';
import type { Store } from '@/lib/supabase';

export type DbCoupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: 'percent' | 'fixed' | 'free_item' | 'bxgy';
  value: number;
  max_redemptions: number | null;
  redemptions_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type DbEmployee = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: 'manager' | 'shift_lead' | 'barista' | 'cashier' | 'kitchen';
  store_id: string | null;
  is_active: boolean;
  avatar_url: string | null;
  notes: string | null;
};

const ROLE_TO_UI: Record<DbEmployee['role'], string> = {
  manager: 'Mağaza Müdürü',
  shift_lead: 'Vardiya Lideri',
  barista: 'Barista',
  cashier: 'Kasiyer',
  kitchen: 'Mutfak',
};

const ROLE_TO_DB: Record<string, DbEmployee['role']> = {
  'Mağaza Müdürü': 'manager',
  'Vardiya Lideri': 'shift_lead',
  'Baş Barista': 'barista',
  Barista: 'barista',
  Kasiyer: 'cashier',
  'Servis Personeli': 'kitchen',
  Mutfak: 'kitchen',
};

const DEFAULT_AVATAR = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200';

function formatCouponExpires(row: DbCoupon): string {
  if (row.ends_at) {
    return new Date(row.ends_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
  return 'Sürekli';
}

function couponStatus(row: DbCoupon): UiCoupon['status'] {
  const now = Date.now();
  if (!row.is_active) return 'expired';
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return 'scheduled';
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return 'expired';
  return 'active';
}

function couponValueDisplay(row: DbCoupon): string {
  if (row.type === 'percent') return `%${row.value}`;
  if (row.type === 'fixed') return `₺${row.value}`;
  if (row.type === 'bxgy') return '1+1';
  return 'Ücretsiz';
}

function uiTypeToDb(type: UiCoupon['type']): DbCoupon['type'] {
  if (type === 'bogo') return 'bxgy';
  if (type === 'gift') return 'free_item';
  return type === 'fixed' ? 'fixed' : 'percent';
}

function dbTypeToUi(type: DbCoupon['type']): UiCoupon['type'] {
  if (type === 'bxgy') return 'bogo';
  if (type === 'free_item') return 'gift';
  return type;
}

function parseNumericValue(value: string): number {
  const n = Number(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function mapDbCouponToUi(row: DbCoupon): UiCoupon {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    type: dbTypeToUi(row.type),
    value: couponValueDisplay(row),
    redeemed: row.redemptions_count,
    limit: row.max_redemptions ?? 0,
    expires: formatCouponExpires(row),
    status: couponStatus(row),
  };
}

export function mapUiCouponToDb(c: Partial<UiCoupon>): Record<string, unknown> {
  const dbType = uiTypeToDb((c.type ?? 'percent') as UiCoupon['type']);
  return {
    code: c.code?.trim().toUpperCase(),
    title: c.title?.trim(),
    type: dbType,
    value: parseNumericValue(c.value ?? '0'),
    redemptions_count: c.redeemed ?? 0,
    max_redemptions: c.limit && c.limit > 0 ? c.limit : null,
    is_active: c.status !== 'expired',
  };
}

function parseShiftFromNotes(notes: string | null): string {
  if (!notes) return '—';
  const match = notes.match(/^shift:(.+)$/m);
  return match?.[1]?.trim() ?? '—';
}

function parseUiStatusFromNotes(notes: string | null, isActive: boolean): UiEmployee['status'] {
  if (!isActive) return 'off';
  if (notes?.includes('status:break')) return 'break';
  return 'active';
}

export function mapDbEmployeeToUi(row: DbEmployee, stores: Store[]): UiEmployee {
  const storeName = stores.find(s => s.id === row.store_id)?.name ?? row.store_id ?? '—';
  return {
    id: row.id,
    name: row.full_name,
    role: ROLE_TO_UI[row.role] ?? row.role,
    store: storeName,
    status: parseUiStatusFromNotes(row.notes, row.is_active),
    avatar: row.avatar_url ?? DEFAULT_AVATAR,
    shift: parseShiftFromNotes(row.notes),
  };
}

export function mapUiEmployeeToDb(
  e: Partial<UiEmployee>,
  stores: Store[],
): Record<string, unknown> {
  const storeId = stores.find(s => s.name === e.store)?.id ?? null;
  const dbRole = ROLE_TO_DB[e.role ?? ''] ?? 'barista';
  const isActive = e.status !== 'off';
  const statusTag = e.status === 'break' ? 'status:break' : '';
  const shiftNote = e.shift && e.shift !== '—' ? `shift:${e.shift}` : '';
  const notes = [statusTag, shiftNote].filter(Boolean).join('\n') || null;

  return {
    full_name: e.name?.trim(),
    role: dbRole,
    store_id: storeId,
    is_active: isActive,
    avatar_url: e.avatar || null,
    notes,
  };
}
