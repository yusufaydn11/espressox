import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, type AdminRole, type UserProfile, type UserRoleRow } from './supabase';
import { pickPrimaryRole } from './roles';

const ADMIN_ROLES: AdminRole[] = ['super_admin', 'admin', 'franchise', 'store_manager', 'staff'];

interface AuthContextValue {
  loading: boolean;
  rolesLoaded: boolean;
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  roles: UserRoleRow[];
  primaryRole: AdminRole | null;
  storeId: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);

  const loadProfileAndRoles = useCallback(async (uid: string) => {
    const [profRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', uid),
    ]);
    if (profRes.data) setProfile(profRes.data as UserProfile);
    if (rolesRes.data) setRoles(rolesRes.data as UserRoleRow[]);
    setRolesLoaded(true);
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setUser(null); setProfile(null); setRoles([]); setRolesLoaded(false);
      return;
    }
    setUser({ id: session.user.id, email: session.user.email ?? '' });
    await loadProfileAndRoles(session.user.id);
  }, [loadProfileAndRoles]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        await loadProfileAndRoles(session.user.id);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!session?.user) {
          setUser(null); setProfile(null); setRoles([]); setRolesLoaded(false);
          return;
        }
        setUser({ id: session.user.id, email: session.user.email ?? '' });
        setRolesLoaded(false);
        await loadProfileAndRoles(session.user.id);
      })();
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [loadProfileAndRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setRoles([]); setRolesLoaded(false);
  }, []);

  const primaryRole: AdminRole | null = pickPrimaryRole(
    roles.filter(r => ADMIN_ROLES.includes(r.role)) as { role: AdminRole }[],
  );
  const storeId = roles.find(r => r.store_id)?.store_id ?? null;
  const isAdmin = primaryRole !== null;

  return (
    <AuthContext.Provider value={{ loading, rolesLoaded, user, profile, roles, primaryRole, storeId, isAdmin, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
