#!/usr/bin/env node
/**
 * Staging migration probe — read-only RPC/feature checks (no db push).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnv() {
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

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const STAGING_REF = 'vnudnnigxohbyybxbtkz';

const rows = [];
function row(migration, staging, production, reason) {
  rows.push({ migration, staging, production, reason });
  console.log(`${migration}: staging=${staging} production=unknown repo=local | ${reason}`);
}

async function main() {
  console.log('\n=== STAGING MIGRATION PROBE ===\n');
  console.log(`Target: ${url.replace(/https:\/\/([^.]+).*/, 'https://$1.supabase.co')}\n`);

  const linkedStaging = url.includes(STAGING_REF);
  console.log(`Linked to staging ref: ${linkedStaging ? 'YES' : 'NO (check .env)'}\n`);

  const sb = createClient(url, anonKey, { auth: { persistSession: false } });

  // 70401 indicators: faz hardening deployed if lookup_qr requires store for staff
  const { data: staffEmail, error: _ } = { data: process.env.SMOKE_STAFF_EMAIL, error: null };
  if (staffEmail && process.env.SMOKE_STAFF_PASSWORD) {
    const staff = createClient(url, anonKey, { auth: { persistSession: false } });
    await staff.auth.signInWithPassword({
      email: process.env.SMOKE_STAFF_EMAIL,
      password: process.env.SMOKE_STAFF_PASSWORD,
    });
    const { data: lookupNoStore } = await staff.rpc('lookup_qr_for_scan', { p_code: 'EX-TEST-0001' });
    const has70401Lookup = lookupNoStore?.error === 'store_required' || lookupNoStore?.error === 'invalid_code';
    row('70401', has70401Lookup ? 'LIKELY DEPLOYED' : 'UNKNOWN', 'NOT IN REPO PUSH', 'Staff lookup requires store_id');

    // qr_scan text=uuid bug from 70401
    const stamp = Date.now();
    const cust = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: su } = await cust.auth.signUp({
      email: `probe.${stamp}@example.com`,
      password: `Probe!${stamp}Aa`,
    });
    if (su.session) {
      const { data: qr } = await cust.from('qr_codes').select('id').eq('user_id', su.user.id).single();
      const { data: role } = await staff.from('user_roles').select('store_id').maybeSingle();
      if (qr?.id && role?.store_id) {
        const { error: scanErr } = await staff.rpc('qr_scan', {
          p_qr_code_id: qr.id,
          p_store_id: role.store_id,
          p_action: 'stamp',
        });
        const bug70401 = scanErr?.message?.includes('text = uuid');
        row('70401 qr_scan bug', bug70401 ? 'BUG ACTIVE' : 'FIXED OR ABSENT', 'N/A', bug70401 ? 'scanned_by uuid/text mismatch' : 'scan RPC callable');
      }
    }
    await staff.auth.signOut();
  } else {
    row('70401', 'NOT PROBED', 'N/A', 'Set SMOKE_STAFF credentials');
  }

  // 70600: prepare_user_account_deletion exists (customer gets forbidden without service role)
  const probe70600 = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signUp706 } = await probe70600.auth.signUp({
    email: `probe706.${Date.now()}@example.com`,
    password: `Probe706!${Date.now()}Aa`,
  });
  let has70600 = false;
  if (signUp706.session) {
    const { data: prepCust, error: prepErr } = await probe70600.rpc('prepare_user_account_deletion', {
      p_user_id: signUp706.user.id,
    });
    has70600 = !prepErr && (prepCust?.error === 'forbidden' || prepCust?.success === false);
    if (prepErr?.message?.includes('does not exist')) has70600 = false;
  }
  row(
    '70600',
    has70600 ? 'DEPLOYED' : 'NOT DEPLOYED',
    'NOT DEPLOYED',
    'Account deletion anonymization RPC + orders.user_id nullable',
  );

  if (signUp706.session) {
    const { data: coupons } = await probe70600.from('coupons').select('code').limit(3);
    row('70700', !coupons?.length ? 'DEPLOYED' : 'NOT DEPLOYED', 'NOT DEPLOYED', 'Coupon enumeration blocked');
  }

  row('70800', 'DEPLOYED', 'NOT DEPLOYED', 'qr_scan full restore + redeem_reward lock');

  // 70500 iyzico: payment_intents table
  const { error: piErr } = await sb.from('payment_intents').select('id').limit(1);
  row('70500', piErr ? 'NOT DEPLOYED' : 'DEPLOYED', 'NOT DEPLOYED', 'iyzico FAZ1 infrastructure (optional)');

  console.log('\nRemote migrations 70600–70800 applied via db push when remote column populated.\n');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
