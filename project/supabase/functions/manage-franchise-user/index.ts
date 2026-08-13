import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FranchisePayload {
  action: 'create' | 'update' | 'delete' | 'list' | 'reset_password';
  // create
  email?: string;
  password?: string;
  fullName?: string;
  storeId?: string;
  // update / reset_password
  userId?: string;
  newStoreId?: string;
  newFullName?: string;
  newPassword?: string;
  // delete
}

async function verifyCallerIsHq(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; callerId?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Oturum bulunamadı' };
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: 'Yetki doğrulanamadı' };
  if (!data || (data.role !== 'admin' && data.role !== 'super_admin')) {
    return { ok: false, error: 'Bu işlem için genel merkez yetkisi gerekli' };
  }
  return { ok: true, callerId: user.id };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function genStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const url = Deno.env.get('SUPABASE_URL') ?? '';

    const callerClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const verify = await verifyCallerIsHq(callerClient);
    if (!verify.ok) {
      return json({ error: verify.error }, 403);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as FranchisePayload;
    const action = body.action;

    if (action === 'list') {
      const { data: roles, error: roleErr } = await admin
        .from('user_roles')
        .select('user_id, role, store_id, updated_at')
        .eq('role', 'franchise')
        .order('updated_at', { ascending: false });
      if (roleErr) return json({ error: roleErr.message }, 500);
      const uids = (roles ?? []).map((r: Record<string, unknown>) => r.user_id as string);
      const profileMap = new Map<string, string>();
      if (uids.length > 0) {
        const { data: profs } = await admin
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uids);
        for (const p of (profs ?? []) as Array<{ user_id: string; full_name: string }>) {
          profileMap.set(p.user_id, p.full_name ?? '');
        }
      }
      const emailMap = new Map<string, string>();
      await Promise.all(
        uids.map(async (uid) => {
          const { data, error } = await admin.auth.admin.getUserById(uid);
          if (!error && data?.user?.email) {
            emailMap.set(uid, data.user.email);
          }
        }),
      );
      const rows = (roles ?? []).map((r: Record<string, unknown>) => ({
        userId: r.user_id,
        role: r.role,
        storeId: r.store_id,
        fullName: profileMap.get(r.user_id as string) ?? '',
        email: emailMap.get(r.user_id as string) ?? '',
        updatedAt: r.updated_at,
      }));
      return json({ franchiseUsers: rows });
    }

    if (action === 'create') {
      const email = (body.email ?? '').trim().toLowerCase();
      const password = (body.password ?? '').trim() || genStrongPassword();
      const fullName = (body.fullName ?? '').trim();
      const storeId = (body.storeId ?? '').trim();
      if (!email || !fullName || !storeId) {
        return json({ error: 'E-posta, ad ve şube zorunlu' }, 400);
      }
      const storeCheck = await admin.from('stores').select('id, name').eq('id', storeId).maybeSingle();
      if (storeCheck.error || !storeCheck.data) {
        return json({ error: 'Şube bulunamadı' }, 400);
      }
      const taken = await admin
        .from('user_roles')
        .select('user_id')
        .eq('store_id', storeId)
        .eq('role', 'franchise')
        .maybeSingle();
      if (taken.data) {
        return json({ error: 'Bu şubenin zaten bir franchise yetkilisi var' }, 409);
      }

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const uid = newUser.user.id;

      const { error: roleErr } = await admin
        .from('user_roles')
        .upsert({ user_id: uid, role: 'franchise', store_id: storeId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (roleErr) return json({ error: roleErr.message }, 500);

      const { error: profErr } = await admin
        .from('profiles')
        .upsert({ user_id: uid, full_name: fullName }, { onConflict: 'user_id' });
      if (profErr) return json({ error: profErr.message }, 500);

      await admin.from('audit_logs').insert({
        actor_id: verify.callerId ?? null,
        action: 'create_franchise_user',
        entity_type: 'user',
        entity_id: uid,
        details: { email, store_id: storeId, full_name: fullName },
      });

      const wasAutoGenerated = !(body.password ?? '').trim();
      return json({
        ok: true,
        userId: uid,
        email,
        storeId,
        storeName: storeCheck.data.name,
        ...(wasAutoGenerated ? { password } : {}),
      });
    }

    if (action === 'reset_password') {
      const userId = (body.userId ?? '').trim();
      const customPassword = (body.newPassword ?? '').trim();
      const password = customPassword || genStrongPassword();
      if (!userId) return json({ error: 'Kullanıcı ID zorunlu' }, 400);
      if (password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı' }, 400);

      const roleCheck = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'franchise')
        .maybeSingle();
      if (!roleCheck.data) return json({ error: 'Franchise yetkilisi bulunamadı' }, 404);

      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwdErr) return json({ error: pwdErr.message }, 400);

      await admin.from('audit_logs').insert({
        actor_id: verify.callerId ?? null,
        action: 'reset_franchise_password',
        entity_type: 'user',
        entity_id: userId,
        details: { auto_generated: !customPassword },
      });

      return json({
        ok: true,
        ...(customPassword ? {} : { password }),
      });
    }

    if (action === 'update') {
      const userId = (body.userId ?? '').trim();
      const newStoreId = (body.newStoreId ?? '').trim();
      const newFullName = (body.newFullName ?? '').trim();
      if (!userId) return json({ error: 'Kullanıcı ID zorunlu' }, 400);

      if (newStoreId) {
        const taken = await admin
          .from('user_roles')
          .select('user_id')
          .eq('store_id', newStoreId)
          .eq('role', 'franchise')
          .neq('user_id', userId)
          .maybeSingle();
        if (taken.data) return json({ error: 'Hedef şubenin zaten bir yetkilisi var' }, 409);
        const { error } = await admin
          .from('user_roles')
          .update({ store_id: newStoreId, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('role', 'franchise');
        if (error) return json({ error: error.message }, 500);
      }

      if (newFullName) {
        const { error } = await admin
          .from('profiles')
          .update({ full_name: newFullName })
          .eq('user_id', userId);
        if (error) return json({ error: error.message }, 500);
      }

      await admin.from('audit_logs').insert({
        actor_id: verify.callerId ?? null,
        action: 'update_franchise_user',
        entity_type: 'user',
        entity_id: userId,
        details: { new_store_id: newStoreId, new_full_name: newFullName },
      });

      return json({ ok: true });
    }

    if (action === 'delete') {
      const userId = (body.userId ?? '').trim();
      if (!userId) return json({ error: 'Kullanıcı ID zorunlu' }, 400);

      const { error: roleErr } = await admin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'franchise');
      if (roleErr) return json({ error: roleErr.message }, 500);

      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) return json({ error: delErr.message }, 500);

      await admin.from('audit_logs').insert({
        actor_id: verify.callerId ?? null,
        action: 'delete_franchise_user',
        entity_type: 'user',
        entity_id: userId,
        details: {},
      });

      return json({ ok: true });
    }

    return json({ error: 'Geçersiz işlem' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
    return json({ error: msg }, 500);
  }
});
