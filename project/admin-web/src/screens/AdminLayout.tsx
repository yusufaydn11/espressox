import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, PackageOpen, FolderTree, Megaphone, Ticket,
  Crown, Users, Bell, Store, Building2, UserCog, Boxes, BarChart3, Settings,
  LogOut, Menu, X, ChevronDown, Coffee, Sun, Moon, PackageCheck, PackageSearch, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import type { AdminRole } from '../lib/supabase';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: AdminRole[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Genel',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'franchise', 'store_manager', 'staff'] },
      { to: '/orders', label: 'Sipariş Yönetimi', icon: ShoppingBag, roles: ['super_admin', 'franchise', 'store_manager', 'staff'] },
      { to: '/products', label: 'Ürün Yönetimi', icon: PackageOpen, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/categories', label: 'Kategori Yönetimi', icon: FolderTree, roles: ['super_admin'] },
    ],
  },
  {
    section: 'Pazarlama',
    items: [
      { to: '/campaigns', label: 'Kampanya Yönetimi', icon: Megaphone, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/coupons', label: 'Kupon Yönetimi', icon: Ticket, roles: ['super_admin'] },
      { to: '/rewards', label: 'Ödüller', icon: Crown, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/loyalty', label: 'Sadakat Sistemi', icon: Crown, roles: ['super_admin'] },
      { to: '/customers', label: 'Müşteri Yönetimi', icon: Users, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/notifications', label: 'Bildirim Yönetimi', icon: Bell, roles: ['super_admin', 'franchise', 'store_manager'] },
    ],
  },
  {
    section: 'Operasyon',
    items: [
      { to: '/stores', label: 'Şube Yönetimi', icon: Store, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/franchises', label: 'Franchise Yönetimi', icon: Building2, roles: ['super_admin'] },
      { to: '/employees', label: 'Personel Yönetimi', icon: UserCog, roles: ['super_admin', 'franchise', 'store_manager'] },
      { to: '/inventory', label: 'Stok Yönetimi', icon: Boxes, roles: ['super_admin', 'store_manager', 'staff'] },
      { to: '/b2b-orders', label: 'B2B Siparişleri', icon: PackageCheck, roles: ['super_admin'] },
      { to: '/b2b-products', label: 'B2B Ürün Yönetimi', icon: PackageSearch, roles: ['super_admin'] },
    ],
  },
  {
    section: 'Sistem',
    items: [
      { to: '/analytics', label: 'Analitik', icon: BarChart3, roles: ['super_admin', 'franchise'] },
      { to: '/reports', label: 'Raporlar', icon: BarChart3, roles: ['super_admin', 'franchise'] },
      { to: '/settings', label: 'Ayarlar', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

const roleLabels: Record<AdminRole, string> = {
  super_admin: 'Süper Admin',
  franchise: 'Franchise Admin',
  store_manager: 'Mağaza Müdürü',
  staff: 'Personel',
};

export function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, primaryRole, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const role = primaryRole ?? 'staff';

  const visibleNav = NAV.map(g => ({
    ...g,
    items: g.items.filter(i => i.roles.includes(role)),
  })).filter(g => g.items.length > 0);

  const Sidebar = (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-ink-800 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-ex-red flex items-center justify-center shadow-red">
          <Coffee size={18} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Espresso X</p>
          <p className="text-[10px] text-ink-400 mt-1">Merkez Yönetim</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleNav.map(group => (
          <div key={group.section}>
            <p className="px-3 text-[10px] font-bold text-ink-500 uppercase tracking-widest mb-2">{group.section}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      isActive ? 'bg-ex-red text-white shadow-red' : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                    )}
                  >
                    <Icon size={18} color="currentColor" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-800 p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-ink-800 cursor-pointer" onClick={() => setUserMenu(v => !v)}>
          <div className="h-9 w-9 rounded-xl bg-gold-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(profile?.full_name ?? 'A').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{profile?.full_name ?? 'Yönetici'}</p>
            <p className="text-[10px] text-ink-400">{roleLabels[role]}</p>
          </div>
          <ChevronDown size={14} className={cn('text-ink-400 transition-transform', userMenu && 'rotate-180')} />
        </div>
        {userMenu && (
          <button
            onClick={() => signOut()}
            className="mt-1.5 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-ink-300 hover:bg-ink-800 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Çıkış Yap
          </button>
        )}
      </div>
    </div>
  );

  const pageTitle = NAV.flatMap(g => g.items).find(i => i.to === location.pathname)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-ink-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-30">
        {Sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full animate-slide-in">{Sidebar}</div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800 sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden h-10 w-10 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center" onClick={() => setMobileOpen(true)}>
              <Menu size={20} className="text-ink-700 dark:text-ink-300" />
            </button>
            <h2 className="text-base font-bold text-ink-900 dark:text-ink-100 hidden sm:block">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="h-9 w-9 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-300 transition-colors"
              aria-label="Tema değiştir"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-100 dark:bg-ink-800">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-ink-600 dark:text-ink-300">Sistem Aktif</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-gold-gradient flex items-center justify-center text-xs font-bold text-white">
              {(profile?.full_name ?? 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {mobileOpen && (
        <button className="lg:hidden fixed top-4 right-4 z-[60] h-10 w-10 rounded-xl bg-white shadow-soft flex items-center justify-center" onClick={() => setMobileOpen(false)}>
          <X size={20} className="text-ink-700" />
        </button>
      )}
    </div>
  );
}
