/** Internal staff / admin roles used across mobile and admin-web. */
export type AdminRole = 'super_admin' | 'admin' | 'franchise' | 'store_manager' | 'staff';

export type UserRole =
  | 'customer'
  | AdminRole;
