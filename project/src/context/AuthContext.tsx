import {
  createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';
import { getPasswordResetRedirectUrl, applyRecoveryHash, clearRecoveryHashFromUrl } from '@/lib/authRedirect';

WebBrowser.maybeCompleteAuthSession();

const AUTH_BOOTSTRAP_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('bootstrap_timeout')), ms);
    }),
  ]);
}

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  isAdmin: boolean;
  isFranchise: boolean;
  isStoreManager: boolean;
  isStaff: boolean;
  isInternal: boolean;
  storeId: string | null;
  role: 'customer' | 'staff' | 'store_manager' | 'admin' | 'super_admin' | 'franchise';
  franchiseId: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  pendingPasswordReset: boolean;
  completePasswordReset: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [franchiseIdState, setFranchiseIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const loadGenRef = useRef(0);
  const deletingRef = useRef(false);
  const bootstrapAttemptRef = useRef(0);

  const applyRecoveryFromUrl = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const tokenSource = hash.includes('access_token') ? hash : search.includes('access_token') ? search : '';
      if (!tokenSource) return false;
      const ok = await applyRecoveryHash(tokenSource, async (accessToken, refreshToken) => {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      });
      if (ok) {
        clearRecoveryHashFromUrl();
        setPendingPasswordReset(true);
        return true;
      }
    }
    return false;
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const gen = ++loadGenRef.current;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (gen !== loadGenRef.current) return;
    if (error) return;
    setProfile(data as Profile);
  }, []);

  const loadRole = useCallback(async (uid: string) => {
    const gen = ++loadGenRef.current;
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (gen !== loadGenRef.current) return;
    if (error) return;
    setUserRole(data as UserRole);
  }, []);

  const bootstrapUserData = useCallback(async (uid: string) => {
    await withTimeout(
      Promise.all([loadProfile(uid), loadRole(uid)]),
      AUTH_BOOTSTRAP_TIMEOUT_MS,
    );
  }, [loadProfile, loadRole]);

  useEffect(() => {
    let mounted = true;
    const attempt = ++bootstrapAttemptRef.current;

    void (async () => {
      setBootstrapError(null);
      await applyRecoveryFromUrl();

      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted || attempt !== bootstrapAttemptRef.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          await bootstrapUserData(s.user.id);
        } catch {
          if (mounted && attempt === bootstrapAttemptRef.current) {
            setBootstrapError('Hesap bilgileri yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
          }
        }
      }
      if (mounted && attempt === bootstrapAttemptRef.current) setLoading(false);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPendingPasswordReset(true);
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setBootstrapError(null);
        void (async () => {
          try {
            await bootstrapUserData(s.user.id);
          } catch {
            if (mounted) {
              setBootstrapError('Hesap bilgileri yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
            }
          }
          if (mounted) setLoading(false);
        })();
      } else {
        loadGenRef.current += 1;
        setProfile(null);
        setUserRole(null);
        setFranchiseIdState(null);
        setBootstrapError(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [bootstrapUserData, applyRecoveryFromUrl]);

  const retryBootstrap = useCallback(() => {
    bootstrapAttemptRef.current += 1;
    setLoading(true);
    setBootstrapError(null);
    void (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          await bootstrapUserData(s.user.id);
          setBootstrapError(null);
        } catch {
          setBootstrapError('Hesap bilgileri yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
        }
      }
      setLoading(false);
    })();
  }, [bootstrapUserData]);

  const completePasswordReset = useCallback(() => {
    setPendingPasswordReset(false);
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: translateError(error.message) };
    if (data.user) {
      await Promise.all([loadProfile(data.user.id), loadRole(data.user.id)]);
    }
    return { error: null };
  }, [loadProfile, loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };
    if (data.user) {
      await Promise.all([loadProfile(data.user.id), loadRole(data.user.id)]);
    }
    return { error: null };
  }, [loadProfile, loadRole]);

  const signInWithOAuthProvider = useCallback(async (provider: 'google' | 'apple') => {
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : Linking.createURL('');

    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      return { error: error ? translateError(error.message) : null };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      return { error: translateError(error?.message ?? 'Giriş başlatılamadı') };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      return { error: result.type === 'cancel' ? 'Giriş iptal edildi' : 'Giriş tamamlanamadı' };
    }

    const tokenSource = result.url.includes('#')
      ? result.url.split('#')[1] ?? ''
      : result.url.split('?').slice(1).join('?');
    const ok = await applyRecoveryHash(tokenSource, async (accessToken, refreshToken) => {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    });
    if (!ok) return { error: 'Oturum oluşturulamadı' };

    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      await Promise.all([loadProfile(s.user.id), loadRole(s.user.id)]);
    }
    return { error: null };
  }, [loadProfile, loadRole]);

  const signInWithGoogle = useCallback(
    () => signInWithOAuthProvider('google'),
    [signInWithOAuthProvider],
  );

  const signInWithApple = useCallback(
    () => signInWithOAuthProvider('apple'),
    [signInWithOAuthProvider],
  );

  const signOut = useCallback(async () => {
    if (user) {
      try {
        const { clearExpoPushToken } = await import('@/services/notifications');
        await clearExpoPushToken(user.id);
      } catch {
        /* best-effort */
      }
    }
    loadGenRef.current += 1;
    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
    setUser(null);
    setSession(null);
  }, [user]);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = getPasswordResetRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);
    if (error) return { error: translateError(error.message) };
    await refreshProfile();
    return { error: null };
  }, [user, refreshProfile]);

  const deleteAccount = useCallback(async () => {
    if (deletingRef.current) return { error: 'Silme işlemi devam ediyor' };
    if (!user || !session) return { error: 'Oturum açık değil' };

    deletingRef.current = true;
    try {
      try {
        const { clearExpoPushToken } = await import('@/services/notifications');
        await clearExpoPushToken(user.id);
      } catch {
        /* best-effort */
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        return { error: translateError(body.error ?? 'Hesap silinemedi') };
      }

      loadGenRef.current += 1;
      await supabase.auth.signOut();
      setProfile(null);
      setUserRole(null);
      setUser(null);
      setSession(null);
      return { error: null };
    } catch {
      return { error: 'Hesap silinemedi. Lütfen tekrar deneyin.' };
    } finally {
      deletingRef.current = false;
    }
  }, [user, session]);

  const role = userRole?.role ?? 'customer';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isFranchise = role === 'franchise';
  const isStoreManager = role === 'store_manager';
  const isStaff = role === 'staff';
  const isInternal = isFranchise || isStoreManager || isStaff || isAdmin;
  const storeId = userRole?.store_id ?? null;

  useEffect(() => {
    if (!storeId) { setFranchiseIdState(null); return; }
    supabase.from('stores').select('franchise_id').eq('id', storeId).maybeSingle()
      .then(({ data }) => {
        setFranchiseIdState((data as { franchise_id: string | null })?.franchise_id ?? null);
      });
  }, [storeId]);

  const value: AuthState = {
    user, session, profile, loading, bootstrapError, retryBootstrap, isAdmin, isFranchise, isStoreManager, isStaff, isInternal, storeId, role, franchiseId: franchiseIdState,
    signUp, signIn, signInWithGoogle, signInWithApple,
    signOut, resetPassword, updatePassword, pendingPasswordReset, completePasswordReset,
    refreshProfile, updateProfile, deleteAccount,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

function translateError(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-posta veya şifre hatalı',
    'User already registered': 'Bu e-posta adresi zaten kayıtlı',
    'Email not confirmed': 'E-posta adresinizi doğrulayın',
    'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalı',
    'Unable to validate email address': 'Geçersiz e-posta adresi',
    'Email rate limit exceeded': 'Çok fazla deneme yaptınız, lütfen bekleyin',
    'User is blocked': 'Hesabınız engellenmiştir. Lütfen destekle iletişime geçin.',
    'deletion_incomplete_contact_support': 'Hesap silme tamamlanamadı. Lütfen destekle iletişime geçin.',
    'unauthorized': 'Oturum geçersiz',
    'forbidden': 'Bu işlem için yetkiniz yok',
  };
  return map[msg] ?? msg;
}
