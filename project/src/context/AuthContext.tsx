import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isFranchise: boolean;
  storeId: string | null;
  role: 'customer' | 'staff' | 'admin' | 'super_admin' | 'franchise';
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      console.error('Profile load error:', error.message);
      return;
    }
    setProfile(data as Profile);
  }, []);

  const loadRole = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (!error && data) {
      setUserRole(data as UserRole);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        Promise.all([loadProfile(s.user.id), loadRole(s.user.id)]).finally(
          () => mounted && setLoading(false),
        );
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await Promise.all([loadProfile(s.user.id), loadRole(s.user.id)]);
          if (mounted) setLoading(false);
        })();
      } else {
        setProfile(null);
        setUserRole(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile, loadRole]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: translateError(error.message) };
    // Profile, user_roles, notification_preferences, and qr_codes are
    // auto-created by the handle_new_user() database trigger.
    if (data.user) {
      await Promise.all([loadProfile(data.user.id), loadRole(data.user.id)]);
    }
    return { error: null };
  }, [loadProfile, loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    return { error: 'Google ile giriş mobil uygulama üzerinden yakında aktif olacak. Şimdilik e-posta ile giriş yapın.' };
  }, []);

  const signInWithApple = useCallback(async () => {
    return { error: 'Apple ile giriş mobil uygulama üzerinden yakında aktif olacak. Şimdilik e-posta ile giriş yapın.' };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
    setUser(null);
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl = 'espressox://reset';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
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
    if (!user) return { error: 'Oturum açık değil' };

    const { error: profileErr } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);
    if (profileErr) return { error: translateError(profileErr.message) };

    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (e) {
      console.warn('Could not call delete-user edge function:', e);
    }

    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
    setUser(null);
    setSession(null);
    return { error: null };
  }, [user, session]);

  const role = userRole?.role ?? 'customer';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isFranchise = role === 'franchise';
  const storeId = userRole?.store_id ?? null;

  const value: AuthState = {
    user, session, profile, loading, isAdmin, isFranchise, storeId, role,
    signUp, signIn, signInWithGoogle, signInWithApple,
    signOut, resetPassword, refreshProfile, updateProfile, deleteAccount,
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
  };
  return map[msg] ?? msg;
}

function translateOAuthError(msg: string, provider: string): string {
  if (/provider.*not.*enabled|oauth.*not.*configured|provider_not_supported/i.test(msg)) {
    return `${provider} ile giriş henüz aktif edilmemiş. Lütfen e-posta ile kayıt olun veya giriş yapın.`;
  }
  if (/redirect|origin|url/i.test(msg)) {
    return `${provider} giriş yönlendirmesi başarısız. Lütfen e-posta ile deneyin.`;
  }
  return translateError(msg);
}
