import type { AdminRole } from '../types/roles';

/** HQ roles with full back-office access. */
export const HQ_ROLES: AdminRole[] = ['super_admin', 'admin'];

export const ROLE_PRIORITY: AdminRole[] = [
  'super_admin',
  'admin',
  'franchise',
  'store_manager',
  'staff',
];

export function pickPrimaryRole(roles: { role: AdminRole }[]): AdminRole | null {
  for (const r of ROLE_PRIORITY) {
    if (roles.some(row => row.role === r)) return r;
  }
  return null;
}

export function includesRole(allowed: AdminRole[], role: AdminRole): boolean {
  return allowed.includes(role);
}

export function isHqRole(role: AdminRole | null): boolean {
  return role !== null && HQ_ROLES.includes(role);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Süper Admin',
  admin: 'Admin',
  franchise: 'Franchise Admin',
  store_manager: 'Mağaza Müdürü',
  staff: 'Personel',
};
