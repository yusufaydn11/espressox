import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AdminLayout } from './screens/AdminLayout';
import { LoginScreen } from './screens/LoginScreen';
import { Spinner } from './lib/ui';
import { Dashboard } from './screens/Dashboard';
import { OrdersScreen } from './screens/OrdersScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { CampaignsScreen } from './screens/CampaignsScreen';
import { CouponsScreen } from './screens/CouponsScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { LoyaltyScreen } from './screens/LoyaltyScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { StoresScreen } from './screens/StoresScreen';
import { FranchisesScreen } from './screens/FranchisesScreen';
import { EmployeesScreen } from './screens/EmployeesScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { B2BOrdersScreen } from './screens/B2BOrdersScreen';
import { B2BOrderDetailScreen } from './screens/B2BOrderDetailScreen';
import { B2BProductsScreen } from './screens/B2BProductsScreen';
import type { AdminRole } from './lib/supabase';
import { HQ_ROLES } from './lib/roles';

const ALLOWED_ROLES: AdminRole[] = ['super_admin', 'admin', 'franchise', 'store_manager', 'staff'];

function UnauthorizedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-ink-950 p-4">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-100">Yetkisiz Erişim</h1>
        <p className="text-sm text-ink-400 mt-2">Bu panel sadece yönetici hesapları içindir. Müşteri hesabınızla giriş yaptınız.</p>
        <button
          type="button"
          onClick={() => { void signOut(); }}
          className="mt-4 text-sm text-ex-red font-medium"
        >
          Çıkış yap
        </button>
      </div>
    </div>
  );
}

function Protected({ roles, children }: { roles?: AdminRole[]; children: React.ReactNode }) {
  const { loading, rolesLoaded, primaryRole } = useAuth();
  if (loading || !rolesLoaded) return <Spinner label="Yükleniyor…" />;
  if (roles && primaryRole && !roles.includes(primaryRole)) return <Navigate to="/" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function B2BOrderDetailWrapper() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  if (!orderId) return <Navigate to="/b2b-orders" replace />;
  return <B2BOrderDetailScreen orderId={orderId} onBack={() => navigate('/b2b-orders')} />;
}

export default function App() {
  const { loading, rolesLoaded, user, primaryRole } = useAuth();

  if (loading) return <Spinner label="Yükleniyor…" />;
  if (!user) return <LoginScreen />;
  if (!rolesLoaded) return <Spinner label="Yetkiler yükleniyor…" />;

  if (!primaryRole || !ALLOWED_ROLES.includes(primaryRole)) {
    return <UnauthorizedScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/orders" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager', 'staff']}><OrdersScreen /></Protected>} />
      <Route path="/products" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><ProductsScreen /></Protected>} />
      <Route path="/categories" element={<Protected roles={[...HQ_ROLES]}><CategoriesScreen /></Protected>} />
      <Route path="/campaigns" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><CampaignsScreen /></Protected>} />
      <Route path="/coupons" element={<Protected roles={[...HQ_ROLES]}><CouponsScreen /></Protected>} />
      <Route path="/rewards" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><RewardsScreen /></Protected>} />
      <Route path="/loyalty" element={<Protected roles={[...HQ_ROLES]}><LoyaltyScreen /></Protected>} />
      <Route path="/customers" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><CustomersScreen /></Protected>} />
      <Route path="/notifications" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><NotificationsScreen /></Protected>} />
      <Route path="/stores" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><StoresScreen /></Protected>} />
      <Route path="/franchises" element={<Protected roles={[...HQ_ROLES]}><FranchisesScreen /></Protected>} />
      <Route path="/employees" element={<Protected roles={['super_admin', 'admin', 'franchise', 'store_manager']}><EmployeesScreen /></Protected>} />
      <Route path="/inventory" element={<Protected roles={['super_admin', 'admin', 'store_manager', 'staff']}><InventoryScreen /></Protected>} />
      <Route path="/b2b-orders" element={<Protected roles={[...HQ_ROLES]}><B2BOrdersScreen onOpenOrder={(id) => window.location.href = `/b2b-orders/${id}`} /></Protected>} />
      <Route path="/b2b-orders/:orderId" element={<Protected roles={[...HQ_ROLES]}><B2BOrderDetailWrapper /></Protected>} />
      <Route path="/b2b-products" element={<Protected roles={[...HQ_ROLES]}><B2BProductsScreen /></Protected>} />
      <Route path="/analytics" element={<Protected roles={['super_admin', 'admin', 'franchise']}><AnalyticsScreen /></Protected>} />
      <Route path="/reports" element={<Protected roles={['super_admin', 'admin', 'franchise']}><ReportsScreen /></Protected>} />
      <Route path="/settings" element={<Protected roles={[...HQ_ROLES]}><SettingsScreen /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
