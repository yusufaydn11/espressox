import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AnalyticsPayload {
  scope: 'hq' | 'store';
  storeId?: string;
  startDate?: string;
  endDate?: string;
}

interface RoleInfo {
  role: string;
  storeId: string | null;
}

async function getCallerRole(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; info?: RoleInfo; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Oturum bulunamadı' };
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, store_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: 'Yetki doğrulanamadı' };
  if (!data) return { ok: false, error: 'Rol bulunamadı' };
  return { ok: true, info: { role: data.role, storeId: data.store_id } };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function dateRange(start?: string, end?: string): { start: string; end: string } {
  const now = new Date();
  const endD = end ? new Date(end) : now;
  endD.setHours(23, 59, 59, 999);
  const startD = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  startD.setHours(0, 0, 0, 0);
  return { start: startD.toISOString(), end: endD.toISOString() };
}

function truncate(d: Date, unit: 'day' | 'week' | 'month' | 'year'): Date {
  const r = new Date(d);
  if (unit === 'day') r.setHours(0, 0, 0, 0);
  else if (unit === 'week') { r.setHours(0, 0, 0, 0); r.setDate(r.getDate() - r.getDay()); }
  else if (unit === 'month') { r.setDate(1); r.setHours(0, 0, 0, 0); }
  else if (unit === 'year') { r.setMonth(0, 1); r.setHours(0, 0, 0, 0); }
  return r;
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
    const roleCheck = await getCallerRole(callerClient);
    if (!roleCheck.ok || !roleCheck.info) {
      return json({ error: roleCheck.error ?? 'Yetkisiz' }, 403);
    }
    const info = roleCheck.info;
    const isAdmin = info.role === 'admin' || info.role === 'super_admin';
    const isFranchise = info.role === 'franchise';

    const body = (await req.json()) as AnalyticsPayload;
    const { start, end } = dateRange(body.startDate, body.endDate);

    // Determine effective store scope
    let scopeStoreId: string | null = null;
    if (body.scope === 'store') {
      if (isFranchise) scopeStoreId = info.storeId;
      else if (isAdmin && body.storeId) scopeStoreId = body.storeId;
      else return json({ error: 'Şube belirtilmedi' }, 400);
    } else {
      if (isFranchise) scopeStoreId = info.storeId;
    }
    if (!isAdmin && !isFranchise) {
      return json({ error: 'Bu raporlara erişim yetkiniz yok' }, 403);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const storeFilter = scopeStoreId ? `eq.${scopeStoreId}` : null;
    const periodFilter = `gte.${start},lte.${end}`;

    // --- 1. Stamp cards completed ---
    let stampCardsQ = admin.from('stamp_cards').select('id, user_id, store_id, completed_at, reward_claimed');
    if (scopeStoreId) stampCardsQ = stampCardsQ.eq('store_id', scopeStoreId);
    const { data: stampCards } = await stampCardsQ.gte('completed_at', start).lte('completed_at', end);

    // --- 2. Free coffee redemptions ---
    let fcrQ = admin.from('free_coffee_redemptions').select('id, user_id, store_id, product_id, product_name, redeemed_by, redeemed_at');
    if (scopeStoreId) fcrQ = fcrQ.eq('store_id', scopeStoreId);
    const { data: freeCoffees } = await fcrQ.gte('redeemed_at', start).lte('redeemed_at', end);

    // --- 3. Points history (earn/redeem) ---
    let phQ = admin.from('points_history').select('id, user_id, store_id, points, type, created_at, title');
    if (scopeStoreId) phQ = phQ.eq('store_id', scopeStoreId);
    const { data: pointsHistory } = await phQ.gte('created_at', start).lte('created_at', end);

    // --- 4. Orders ---
    let ordersQ = admin.from('orders').select('id, store_id, total, status, created_at, points_earned');
    if (scopeStoreId) ordersQ = ordersQ.eq('store_id', scopeStoreId);
    const { data: orders } = await ordersQ.gte('created_at', start).lte('created_at', end);

    // --- 5. Profiles (customers) ---
    const { data: profiles } = await admin.from('profiles').select('id, user_id, full_name, created_at, points, lifetime_points');

    // --- 6. Suspicious activity ---
    let suspQ = admin.from('suspicious_activity').select('id, type, user_id, store_id, actor_id, severity, description, metadata, detected_at, resolved');
    if (scopeStoreId) suspQ = suspQ.eq('store_id', scopeStoreId);
    const { data: suspicious } = await suspQ.gte('detected_at', start).lte('detected_at', end).order('detected_at', { ascending: false }).limit(100);

    // --- 7. QR scans (for rapid-repeat detection) ---
    let scansQ = admin.from('qr_scans').select('id, user_id, store_id, scanned_at, scanned_by, action, dedup_token');
    if (scopeStoreId) scansQ = scansQ.eq('store_id', scopeStoreId);
    const { data: scans } = await scansQ.gte('scanned_at', start).lte('scanned_at', end).order('scanned_at', { ascending: false }).limit(500);

    // --- 8. Stores list (for HQ comparison) ---
    const { data: stores } = await admin.from('stores').select('id, name');

    // ============ AGGREGATE ============
    const sCards = (stampCards ?? []) as Array<{ user_id: string; store_id: string | null; completed_at: string; reward_claimed: boolean }>;
    const fcs = (freeCoffees ?? []) as Array<{ user_id: string; store_id: string | null; product_id: string | null; product_name: string; redeemed_at: string; redeemed_by: string | null }>;
    const phRows = (pointsHistory ?? []) as Array<{ user_id: string; store_id: string | null; points: number; type: string; created_at: string; title: string }>;
    const orderRows = (orders ?? []) as Array<{ id: string; store_id: string | null; total: string; status: string; created_at: string; points_earned: number }>;
    const profileRows = (profiles ?? []) as Array<{ id: string; user_id: string; full_name: string; created_at: string; points: number; lifetime_points: number }>;
    const suspRows = (suspicious ?? []) as Array<{ id: string; type: string; user_id: string | null; store_id: string | null; actor_id: string | null; severity: string; description: string; metadata: Record<string, unknown>; detected_at: string; resolved: boolean }>;
    const scanRows = (scans ?? []) as Array<{ user_id: string; store_id: string | null; scanned_at: string; scanned_by: string | null; action: string; dedup_token: string }>;
    const storeRows = (stores ?? []) as Array<{ id: string; name: string }>;

    // Totals
    const totalStampCardsCompleted = sCards.length;
    const activeStampCards = sCards.filter(s => !s.reward_claimed).length;
    const totalFreeCoffees = fcs.length;
    const pointsEarned = phRows.filter(p => p.type === 'earn' || p.type === 'bonus').reduce((s, p) => s + p.points, 0);
    const pointsRedeemed = phRows.filter(p => p.type === 'redeem').reduce((s, p) => s + Math.abs(p.points), 0);
    const totalOrders = orderRows.length;
    const totalRevenue = orderRows.reduce((s, o) => s + Number(o.total), 0);

    // Customer stats
    const scopedProfileIds = scopeStoreId
      ? new Set(orderRows.map(o => o.store_id === scopeStoreId ? o.id : null).filter(Boolean))
      : new Set(profileRows.map(p => p.user_id));
    const inRangeUsers = new Set([...phRows.map(p => p.user_id), ...orderRows.map(o => (o as { user_id?: string }).user_id ?? '').filter(Boolean), ...sCards.map(s => s.user_id), ...fcs.map(f => f.user_id)]);
    const totalCustomers = scopeStoreId ? inRangeUsers.size : profileRows.length;
    const newMembers = profileRows.filter(p => new Date(p.created_at) >= new Date(start) && new Date(p.created_at) <= new Date(end)).length;
    const activeUsers = inRangeUsers.size;

    // Free coffee product breakdown
    const productMap = new Map<string, number>();
    for (const f of fcs) {
      const key = f.product_name || 'Bilinmeyen';
      productMap.set(key, (productMap.get(key) ?? 0) + 1);
    }
    const freeCoffeeByProduct = Array.from(productMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Per-user stamp card completion
    const userCardMap = new Map<string, number>();
    for (const s of sCards) userCardMap.set(s.user_id, (userCardMap.get(s.user_id) ?? 0) + 1);
    const userFullNames = new Map<string, string>();
    for (const p of profileRows) userFullNames.set(p.user_id, p.full_name || 'Müşteri');
    const userStampRanking = Array.from(userCardMap.entries())
      .map(([uid, count]) => ({ userId: uid, fullName: userFullNames.get(uid) ?? 'Müşteri', cardsCompleted: count }))
      .sort((a, b) => b.cardsCompleted - a.cardsCompleted)
      .slice(0, 20);

    // Store comparison (HQ only)
    let storeComparison: Array<{ storeId: string; storeName: string; stampCards: number; freeCoffees: number; pointsEarned: number; pointsRedeemed: number; orders: number; revenue: number }> = [];
    let leaderboard: Array<{ storeId: string; storeName: string; freeCoffees: number }> = [];
    if (!scopeStoreId) {
      const storeNameMap = new Map<string, string>(storeRows.map(s => [s.id, s.name]));
      const byStore = new Map<string, { stampCards: number; freeCoffees: number; pointsEarned: number; pointsRedeemed: number; orders: number; revenue: number }>();
      const ensure = (sid: string) => {
        if (!byStore.has(sid)) byStore.set(sid, { stampCards: 0, freeCoffees: 0, pointsEarned: 0, pointsRedeemed: 0, orders: 0, revenue: 0 });
        return byStore.get(sid)!;
      };
      for (const s of sCards) if (s.store_id) ensure(s.store_id).stampCards++;
      for (const f of fcs) if (f.store_id) ensure(f.store_id).freeCoffees++;
      for (const p of phRows) { if (!p.store_id) continue; const e = ensure(p.store_id); if (p.type === 'earn' || p.type === 'bonus') e.pointsEarned += p.points; else e.pointsRedeemed += Math.abs(p.points); }
      for (const o of orderRows) if (o.store_id) { const e = ensure(o.store_id); e.orders++; e.revenue += Number(o.total); }
      storeComparison = Array.from(byStore.entries()).map(([sid, v]) => ({ storeId: sid, storeName: storeNameMap.get(sid) ?? sid, ...v }));
      leaderboard = storeComparison.map(s => ({ storeId: s.storeId, storeName: s.storeName, freeCoffees: s.freeCoffees })).sort((a, b) => b.freeCoffees - a.freeCoffees);
    }

    // Time series (daily)
    const dayBuckets = new Map<string, { stampCards: number; freeCoffees: number; orders: number; revenue: number; pointsEarned: number; pointsRedeemed: number }>();
    const ensureDay = (key: string) => {
      if (!dayBuckets.has(key)) dayBuckets.set(key, { stampCards: 0, freeCoffees: 0, orders: 0, revenue: 0, pointsEarned: 0, pointsRedeemed: 0 });
      return dayBuckets.get(key)!;
    };
    for (const s of sCards) { const k = truncate(new Date(s.completed_at), 'day').toISOString().slice(0, 10); ensureDay(k).stampCards++; }
    for (const f of fcs) { const k = truncate(new Date(f.redeemed_at), 'day').toISOString().slice(0, 10); ensureDay(k).freeCoffees++; }
    for (const o of orderRows) { const k = truncate(new Date(o.created_at), 'day').toISOString().slice(0, 10); const e = ensureDay(k); e.orders++; e.revenue += Number(o.total); }
    for (const p of phRows) { const k = truncate(new Date(p.created_at), 'day').toISOString().slice(0, 10); const e = ensureDay(k); if (p.type === 'earn' || p.type === 'bonus') e.pointsEarned += p.points; else e.pointsRedeemed += Math.abs(p.points); }
    const timeSeries = Array.from(dayBuckets.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));

    // Live stats (today)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString().slice(0, 10);
    const live = {
      todayOrders: orderRows.filter(o => truncate(new Date(o.created_at), 'day').toISOString().slice(0, 10) === todayStr).length,
      todayRevenue: orderRows.filter(o => truncate(new Date(o.created_at), 'day').toISOString().slice(0, 10) === todayStr).reduce((s, o) => s + Number(o.total), 0),
      todayFreeCoffees: fcs.filter(f => truncate(new Date(f.redeemed_at), 'day').toISOString().slice(0, 10) === todayStr).length,
      todayStampCards: sCards.filter(s => truncate(new Date(s.completed_at), 'day').toISOString().slice(0, 10) === todayStr).length,
      activeUsersToday: new Set([...scanRows.filter(s => truncate(new Date(s.scanned_at), 'day').toISOString().slice(0, 10) === todayStr).map(s => s.user_id), ...orderRows.filter(o => truncate(new Date(o.created_at), 'day').toISOString().slice(0, 10) === todayStr).map(o => (o as { user_id?: string }).user_id ?? '').filter(Boolean)]).size,
      timestamp: new Date().toISOString(),
    };

    // Suspicious activity — detect from scans if table is empty
    const detectedSuspicious: Array<{ type: string; severity: string; description: string; userId: string; storeId: string | null; detectedAt: string; metadata: Record<string, unknown> }> = [];
    // Rapid repeat scans: same user scanned 3+ times in 5 min
    const scansByUser = new Map<string, Array<{ scanned_at: string; store_id: string | null; scanned_by: string | null }>>();
    for (const s of scanRows) {
      if (!scansByUser.has(s.user_id)) scansByUser.set(s.user_id, []);
      scansByUser.get(s.user_id)!.push({ scanned_at: s.scanned_at, store_id: s.store_id, scanned_by: s.scanned_by });
    }
    for (const [uid, userScans] of scansByUser) {
      const sorted = userScans.sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime());
      for (let i = 2; i < sorted.length; i++) {
        const t0 = new Date(sorted[i - 2].scanned_at).getTime();
        const t2 = new Date(sorted[i].scanned_at).getTime();
        if (t2 - t0 < 300000) {
          detectedSuspicious.push({
            type: 'rapid_repeat_scan',
            severity: 'high',
            description: 'Aynı kullanıcı 5 dakika içinde 3+ QR taraması',
            userId: uid,
            storeId: sorted[i].store_id,
            detectedAt: sorted[i].scanned_at,
            metadata: { scan_count: 3, window_seconds: Math.round((t2 - t0) / 1000) },
          });
          break;
        }
      }
      // Self-stamp: scanned_by === user_id
      for (const sc of sorted) {
        if (sc.scanned_by && sc.scanned_by === uid) {
          detectedSuspicious.push({
            type: 'self_stamp',
            severity: 'high',
            description: 'Personel kendi QR kodunu okutarak puan/damga yükledi',
            userId: uid,
            storeId: sc.store_id,
            detectedAt: sc.scanned_at,
            metadata: { scanned_by: sc.scanned_by },
          });
          break;
        }
      }
    }

    // Merge stored + detected
    const allSuspicious = [
      ...suspRows.map(s => ({ id: s.id, type: s.type, severity: s.severity, description: s.description, userId: s.user_id, storeId: s.store_id, detectedAt: s.detected_at, metadata: s.metadata, resolved: s.resolved })),
      ...detectedSuspicious.map((d, i) => ({ id: `detected_${i}`, type: d.type, severity: d.severity, description: d.description, userId: d.userId, storeId: d.storeId, detectedAt: d.detectedAt, metadata: d.metadata, resolved: false })),
    ];

    // Free coffee log with names
    const freeCoffeeLog = fcs.map(f => ({
      id: f.user_id + f.redeemed_at,
      userId: f.user_id,
      fullName: userFullNames.get(f.user_id) ?? 'Müşteri',
      storeId: f.store_id,
      storeName: storeRows.find(s => s.id === f.store_id)?.name ?? '—',
      productName: f.product_name || 'Ücretsiz Kahve',
      redeemedAt: f.redeemed_at,
    })).sort((a, b) => b.redeemedAt.localeCompare(a.redeemed_at));

    return json({
      ok: true,
      scope: scopeStoreId ? 'store' : 'hq',
      storeId: scopeStoreId,
      dateRange: { start, end },
      summary: {
        totalStampCardsCompleted,
        activeStampCards,
        totalFreeCoffees,
        pointsEarned,
        pointsRedeemed,
        totalOrders,
        totalRevenue,
        totalCustomers,
        newMembers,
        activeUsers,
      },
      freeCoffeeByProduct,
      userStampRanking,
      storeComparison,
      leaderboard,
      timeSeries,
      live,
      freeCoffeeLog,
      suspiciousActivity: allSuspicious,
      stores: storeRows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
    return json({ error: msg }, 500);
  }
});
