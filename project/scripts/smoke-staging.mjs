#!/usr/bin/env node
/**
 * Staging smoke tests — Sprint 3 Production Hardening
 *
 * Env (from .env or shell):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SMOKE_CUSTOMER_EMAIL / SMOKE_CUSTOMER_PASSWORD
 *   SMOKE_STAFF_EMAIL / SMOKE_STAFF_PASSWORD
 *   SMOKE_FRANCHISE_EMAIL / SMOKE_FRANCHISE_PASSWORD
 *   SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD
 *   SMOKE_SUPER_ADMIN_EMAIL / SMOKE_SUPER_ADMIN_PASSWORD
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnvFile() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const results = [];

function record(role, scenario, status, detail = '') {
  results.push({ role, scenario, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${icon} [${role}] ${scenario}: ${status}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, session: null, error: error.message };
  return { sb, session: data.session, error: null };
}

async function testUnauthenticated() {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('create_order', {
    p_items: [{ productId: 'latte', name: 'Latte', qty: 1, price: 10 }],
    p_total: 99999,
    p_store_id: null,
    p_store_name: '',
    p_order_type: 'pickup',
  });
  const err = data?.error ?? (error ? error.message : null);
  const blocked = err === 'unauthenticated' || (error?.message ?? '').toLowerCase().includes('jwt')
    || (error?.message ?? '').toLowerCase().includes('permission denied');
  record('anonymous', 'create_order without auth', blocked ? 'PASS' : 'FAIL', err ?? 'no error returned');
}

async function ensureEphemeralCustomer() {
  if (process.env.SMOKE_CUSTOMER_EMAIL && process.env.SMOKE_CUSTOMER_PASSWORD) return;
  const stamp = Date.now();
  const email = `smoke.customer.${stamp}@example.com`;
  const password = `Smoke!${stamp}Aa`;
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.session) {
    record('customer', 'ephemeral sign-up', 'NOT TESTED', error?.message ?? 'email confirmation may be required');
    return;
  }
  process.env.SMOKE_CUSTOMER_EMAIL = email;
  process.env.SMOKE_CUSTOMER_PASSWORD = password;
  record('customer', 'ephemeral sign-up', 'PASS', email);
}

async function testRole(role, emailEnv, passEnv, fn) {
  const email = process.env[emailEnv];
  const password = process.env[passEnv];
  if (!email || !password) {
    record(role, 'credentials configured', 'NOT TESTED', `Set ${emailEnv} and ${passEnv}`);
    return null;
  }
  const { sb, session, error } = await signIn(email, password);
  if (error || !session) {
    record(role, 'sign in', 'FAIL', error ?? 'no session');
    return null;
  }
  record(role, 'sign in', 'PASS');
  await fn(sb, session);
  await sb.auth.signOut();
  return sb;
}

async function customerTests(sb) {
  const { data: products } = await sb.from('products').select('id, price').eq('in_stock', true).limit(1);
  const product = products?.[0];
  if (!product) {
    record('customer', 'fetch product', 'FAIL', 'no in_stock products');
    return;
  }
  record('customer', 'fetch product', 'PASS', product.id);

  const legitPrice = Number(product.price);
  const { data: legit, error: legitErr } = await sb.rpc('create_order', {
    p_items: [{ productId: product.id, name: 'Smoke Test', qty: 1, price: legitPrice }],
    p_total: 999999,
    p_store_id: null,
    p_store_name: 'Smoke Store',
    p_order_type: 'pickup',
  });
  if (legit?.error || legitErr) {
    record('customer', 'create_order valid item', 'FAIL', legit?.error ?? legitErr?.message);
    return;
  }
  record('customer', 'create_order valid item', 'PASS', legit.order_number ?? 'ok');

  const serverTotal = Number(legit.total ?? NaN);
  const points = Number(legit.points_earned ?? 0);
  const sprint3Deployed = Number.isFinite(serverTotal) && serverTotal > 0;
  if (!sprint3Deployed) {
    record(
      'customer',
      'Sprint 3 migration deployed',
      'FAIL',
      `RPC still uses client p_total (points=${points}, no server total in response). Run db push.`,
    );
    record('customer', 'create_order ignores inflated p_total', 'NOT TESTED', 'awaiting Sprint 3 migration');
    record('customer', 'create_order rejects price tamper', 'NOT TESTED', 'awaiting Sprint 3 migration');
    return;
  }

  record('customer', 'Sprint 3 migration deployed', 'PASS', `server total=${serverTotal}`);
  const inflatedPoints = points < 999999 * 0.5;
  record(
    'customer',
    'create_order ignores inflated p_total',
    inflatedPoints ? 'PASS' : 'FAIL',
    `total=${serverTotal} points=${points} (client p_total was 999999)`,
  );

  const { data: tamper } = await sb.rpc('create_order', {
    p_items: [{ productId: product.id, name: 'Tamper', qty: 1, price: legitPrice + 500 }],
    p_total: legitPrice,
    p_store_id: null,
    p_store_name: 'Smoke Store',
    p_order_type: 'pickup',
  });
  record(
    'customer',
    'create_order rejects price tamper',
    tamper?.error === 'price_tamper' ? 'PASS' : 'FAIL',
    tamper?.error ?? `allowed total=${tamper?.total}`,
  );

  const { data: ownOrders } = await sb.from('orders').select('id').limit(1);
  record('customer', 'read own orders', ownOrders ? 'PASS' : 'FAIL');
}

function qrScanDetail(data, rpcError) {
  return data?.error ?? rpcError?.message ?? 'no response';
}

async function staffTests(sb, session) {
  const { data: role } = await sb.from('user_roles').select('role, store_id').eq('user_id', session.user.id).maybeSingle();
  record('staff', 'role is staff/store_manager', ['staff', 'store_manager'].includes(role?.role ?? '') ? 'PASS' : 'FAIL', role?.role ?? 'none');

  if (role?.store_id) {
    const { data: orders, error } = await sb.from('orders').select('id').eq('store_id', role.store_id).limit(5);
    record('staff', 'read store orders', !error && orders ? 'PASS' : 'FAIL', error?.message);
  } else {
    record('staff', 'read store orders', 'NOT TESTED', 'no store_id on role');
  }

  record(
    'staff',
    'qr_scan requires store_id',
    'NOT TESTED',
    'staff RLS cannot read customer QR codes; test moved to admin',
  );
}

async function franchiseTests(sb, session) {
  const { data: role } = await sb.from('user_roles').select('role, store_id').eq('user_id', session.user.id).maybeSingle();
  record('franchise', 'role is franchise', role?.role === 'franchise' ? 'PASS' : 'FAIL', role?.role ?? 'none');

  let franchiseId = null;
  let summarySkipReason = null;

  if (!role?.store_id) {
    summarySkipReason = 'no store_id on role';
  } else {
    const { data: store, error: storeErr } = await sb
      .from('stores')
      .select('franchise_id')
      .eq('id', role.store_id)
      .maybeSingle();
    if (storeErr) {
      summarySkipReason = storeErr.message;
    } else if (!store?.franchise_id) {
      summarySkipReason = 'stores.franchise_id is null';
    } else {
      franchiseId = store.franchise_id;
    }
  }

  if (franchiseId) {
    const { data: summary } = await sb.rpc('get_b2b_account_summary', { p_franchise_id: franchiseId });
    const ok = summary && !summary.error;
    record('franchise', 'get_b2b_account_summary own', ok ? 'PASS' : 'FAIL', summary?.error);
  } else {
    record('franchise', 'get_b2b_account_summary own', 'NOT TESTED', summarySkipReason ?? 'unknown');
  }

  const fakeId = '00000000-0000-4000-8000-000000000001';
  const { data: idor } = await sb.rpc('get_b2b_account_summary', { p_franchise_id: fakeId });
  record('franchise', 'get_b2b_account_summary other blocked', idor?.error === 'unauthorized' ? 'PASS' : 'FAIL', idor?.error);
}

function adminDashboardKpisOk(data, error) {
  if (error || !data || typeof data !== 'object') return false;
  if (data.error) return false;
  return (
    'today_sales' in data
    && 'month_revenue' in data
    && 'total_orders' in data
    && 'avg_basket' in data
  );
}

async function adminTests(sb, session) {
  const { data: kpis, error } = await sb.rpc('get_admin_dashboard_kpis');
  record(
    'admin',
    'get_admin_dashboard_kpis RPC',
    adminDashboardKpisOk(kpis, error) ? 'PASS' : 'FAIL',
    error?.message ?? kpis?.error ?? '',
  );

  const { data: roles } = await sb.from('user_roles').select('user_id').limit(3);
  record('admin', 'read user_roles', roles ? 'PASS' : 'FAIL');

  const { data: qr, error: qrErr } = await sb
    .from('qr_codes')
    .select('id')
    .eq('is_active', true)
    .neq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (qrErr || !qr?.id) {
    record('admin', 'qr_scan requires store_id', 'NOT TESTED', qrErr?.message ?? 'no accessible customer QR');
    return;
  }

  const { data: scanNoStore, error: rpcError } = await sb.rpc('qr_scan', {
    p_qr_code_id: qr.id,
    p_store_id: null,
    p_action: 'stamp',
    p_points: 0,
  });
  record(
    'admin',
    'qr_scan requires store_id',
    scanNoStore?.error === 'store_required' ? 'PASS' : 'FAIL',
    qrScanDetail(scanNoStore, rpcError),
  );
}

async function superAdminTests(sb) {
  const { data: kpis, error } = await sb.rpc('get_admin_dashboard_kpis');
  record(
    'super_admin',
    'get_admin_dashboard_kpis RPC',
    adminDashboardKpisOk(kpis, error) ? 'PASS' : 'FAIL',
    error?.message ?? kpis?.error ?? '',
  );

  const { data: series, error: seriesError } = await sb.rpc('get_admin_sales_series', { p_days: 7 });
  const seriesOk = !seriesError && Array.isArray(series);
  record(
    'super_admin',
    'get_admin_sales_series RPC',
    seriesOk ? 'PASS' : 'FAIL',
    seriesError?.message ?? (seriesOk ? `${series.length} days` : 'invalid response'),
  );

  const { data: products } = await sb.from('products').select('id').limit(1);
  record('super_admin', 'read products catalog', products ? 'PASS' : 'FAIL');
}

async function main() {
  console.log(`\nStaging smoke tests → ${url}\n`);

  await testUnauthenticated();
  await ensureEphemeralCustomer();

  await testRole('customer', 'SMOKE_CUSTOMER_EMAIL', 'SMOKE_CUSTOMER_PASSWORD', customerTests);
  await testRole('staff', 'SMOKE_STAFF_EMAIL', 'SMOKE_STAFF_PASSWORD', (sb, s) => staffTests(sb, s));
  await testRole('franchise', 'SMOKE_FRANCHISE_EMAIL', 'SMOKE_FRANCHISE_PASSWORD', (sb, s) => franchiseTests(sb, s));
  await testRole('admin', 'SMOKE_ADMIN_EMAIL', 'SMOKE_ADMIN_PASSWORD', (sb, s) => adminTests(sb, s));
  await testRole('super_admin', 'SMOKE_SUPER_ADMIN_EMAIL', 'SMOKE_SUPER_ADMIN_PASSWORD', (sb) => superAdminTests(sb));

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'NOT TESTED').length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${skip} NOT TESTED (${results.length} total)\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
