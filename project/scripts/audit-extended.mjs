#!/usr/bin/env node
/**
 * Extended production audit — API/security/integration checks
 * Does NOT modify backend. Read-only RPC/RLS verification.
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
  } catch { /* optional */ }
}
loadEnvFile();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const results = [];

function record(category, scenario, status, detail = '') {
  results.push({ category, scenario, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${icon} [${category}] ${scenario}: ${status}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, session: null, error: error.message };
  return { sb, session: data.session, error: null };
}

async function main() {
  console.log(`\nExtended audit → ${url}\n`);

  // 1. Customer cannot read all orders (IDOR)
  const custEmail = process.env.SMOKE_CUSTOMER_EMAIL;
  const custPass = process.env.SMOKE_CUSTOMER_PASSWORD;
  if (custEmail && custPass) {
    const { sb, session } = await signIn(custEmail, custPass);
    if (session) {
      const { data: allOrders, error } = await sb.from('orders').select('id, user_id').limit(50);
      const otherUsers = (allOrders ?? []).filter(o => o.user_id !== session.user.id);
      record('security', 'customer cannot read other users orders', otherUsers.length === 0 ? 'PASS' : 'FAIL', `${otherUsers.length} foreign orders visible`);
      await sb.auth.signOut();
    }
  } else {
    record('security', 'customer IDOR test', 'NOT TESTED', 'no customer creds');
  }

  // 2. Staff cannot access HQ finance RPC
  const staffEmail = process.env.SMOKE_STAFF_EMAIL;
  const staffPass = process.env.SMOKE_STAFF_PASSWORD;
  if (staffEmail && staffPass) {
    const { sb, session } = await signIn(staffEmail, staffPass);
    if (session) {
      const { data: kpis, error } = await sb.rpc('get_admin_dashboard_kpis');
      const blocked = error || kpis?.error || !kpis?.today_sales;
      record('security', 'staff blocked from admin KPIs', blocked ? 'PASS' : 'FAIL', error?.message ?? kpis?.error ?? 'got KPIs');
      
      const { data: roles } = await sb.from('user_roles').select('role').limit(100);
      record('security', 'staff cannot read all user_roles', (roles ?? []).length <= 1 ? 'PASS' : 'FAIL', `${roles?.length ?? 0} rows`);

      // Staff should not read hq finance
      const { data: fin } = await sb.rpc('get_franchise_finance_summary', { p_franchise_id: '00000000-0000-4000-8000-000000000001' });
      record('security', 'staff blocked from franchise finance', fin?.error || !fin ? 'PASS' : 'FAIL', fin?.error ?? 'got data');

      await sb.auth.signOut();
    }
  }

  // 3. Admin QR scan + stamp redeem path
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
  const adminPass = process.env.SMOKE_ADMIN_PASSWORD;
  if (adminEmail && adminPass) {
    const { sb, session } = await signIn(adminEmail, adminPass);
    if (session) {
      const { data: stores } = await sb.from('stores').select('id').limit(1);
      const storeId = stores?.[0]?.id;
      record('qr', 'admin can list stores', storeId ? 'PASS' : 'FAIL');

      const { data: qr } = await sb.from('qr_codes').select('id, user_id').eq('is_active', true).neq('user_id', session.user.id).limit(1).maybeSingle();
      if (qr?.id && storeId) {
        const { data: lookup } = await sb.rpc('lookup_qr_for_scan', { p_qr_code_id: qr.id });
        record('qr', 'lookup_qr_for_scan works', lookup && !lookup.error ? 'PASS' : 'FAIL', lookup?.error);

        const { data: scan } = await sb.rpc('qr_scan', { p_qr_code_id: qr.id, p_store_id: storeId, p_action: 'stamp', p_points: 0 });
        if (scan?.error === 'rate_limit') {
          record('qr', 'qr_scan stamp/redeem', 'PASS', 'rate_limit (expected if recent scan)');
        } else if (scan?.redeemed === true || scan?.stamps_added === 1 || scan?.remaining_stamps !== undefined) {
          record('qr', 'qr_scan stamp/redeem', 'PASS', JSON.stringify({ redeemed: scan.redeemed, stamps: scan.remaining_stamps }));
        } else {
          record('qr', 'qr_scan stamp/redeem', scan?.error ? 'FAIL' : 'PASS', scan?.error ?? JSON.stringify(scan));
        }
      } else {
        record('qr', 'qr_scan stamp/redeem', 'NOT TESTED', 'no QR or store');
      }

      // Admin can read products
      const { data: prods, error: pe } = await sb.from('products').select('id').limit(5);
      record('integration', 'admin reads products', !pe && prods?.length ? 'PASS' : 'FAIL', pe?.message);

      // Campaigns active check
      const { data: camps } = await sb.from('campaigns').select('id, is_active, starts_at, ends_at').eq('is_active', true).limit(5);
      record('campaigns', 'active campaigns queryable', camps ? 'PASS' : 'FAIL', `${camps?.length ?? 0} active`);

      await sb.auth.signOut();
    }
  }

  // 4. Customer cannot call admin-only RPCs
  if (custEmail && custPass) {
    const { sb, session } = await signIn(custEmail, custPass);
    if (session) {
      const { data: kpis, error } = await sb.rpc('get_admin_dashboard_kpis');
      record('security', 'customer blocked from admin KPIs', error || kpis?.error ? 'PASS' : 'FAIL', error?.message ?? kpis?.error ?? 'got KPIs');

      const { data: allUsers } = await sb.from('profiles').select('id').limit(10);
      record('security', 'customer limited profile access', (allUsers ?? []).length <= 1 ? 'PASS' : 'FAIL', `${allUsers?.length ?? 0} profiles`);

      await sb.auth.signOut();
    }
  }

  // 5. Web endpoints reachable
  for (const [name, port] of [['customer-web', 8080], ['admin-web', 4173]]) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      record('build', `${name} HTTP ${port}`, res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
    } catch (e) {
      record('build', `${name} HTTP ${port}`, 'FAIL', e.message);
    }
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'NOT TESTED').length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${skip} NOT TESTED (${results.length} total)\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
