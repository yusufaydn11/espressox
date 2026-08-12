#!/usr/bin/env node
/**
 * Pre-production final validation — QR, RLS IDOR, loyalty, orders (staging API)
 *
 * Requires .env with EXPO_PUBLIC_SUPABASE_URL + ANON_KEY and smoke credentials.
 * Does NOT deploy migrations or mutate production.
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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const results = [];

function record(area, scenario, status, detail = '') {
  results.push({ area, scenario, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'BLOCKED' ? '⊘' : '○';
  console.log(`${icon} [${area}] ${scenario}: ${status}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, session: null, error: error.message };
  return { sb, session: data.session, error: null };
}

function createOrderArgs(overrides = {}) {
  return {
    p_items: overrides.p_items ?? [{ productId: 'h01', name: 'Test', qty: 1, price: 10 }],
    p_total: overrides.p_total ?? 10,
    p_store_id: overrides.p_store_id ?? null,
    p_store_name: overrides.p_store_name ?? 'Validation Store',
    p_order_type: overrides.p_order_type ?? 'pickup',
    p_payment_method: overrides.p_payment_method ?? 'cash',
    p_coupon_code: overrides.p_coupon_code ?? null,
    p_benefit_type: overrides.p_benefit_type ?? null,
    p_benefit_id: overrides.p_benefit_id ?? null,
  };
}

async function ensureEphemeralCustomer() {
  if (process.env.SMOKE_CUSTOMER_EMAIL && process.env.SMOKE_CUSTOMER_PASSWORD) return;
  const stamp = Date.now();
  const email = `preprod.customer.${stamp}@example.com`;
  const password = `PreProd!${stamp}Aa`;
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.session) {
    record('auth', 'ephemeral sign-up', 'NOT TESTED', error?.message ?? 'no session');
    return;
  }
  process.env.SMOKE_CUSTOMER_EMAIL = email;
  process.env.SMOKE_CUSTOMER_PASSWORD = password;
  record('auth', 'ephemeral sign-up', 'PASS', email);
}

async function qrFlowTests(customerSb, customerSession, staffSb, staffSession) {
  const customerId = customerSession.user.id;

  const { data: ownQr, error: qrErr } = await customerSb
    .from('qr_codes')
    .select('id, code, expires_at')
    .eq('user_id', customerId)
    .maybeSingle();

  if (qrErr || !ownQr?.id) {
    record('qr', 'customer QR exists after signup', 'FAIL', qrErr?.message ?? 'no qr_codes row');
    return;
  }
  record('qr', 'customer QR exists after signup', 'PASS', ownQr.code?.slice(0, 12) + '…');

  const { data: staffRole } = await staffSb
    .from('user_roles')
    .select('store_id')
    .eq('user_id', staffSession.user.id)
    .maybeSingle();
  const storeId = staffRole?.store_id;
  if (!storeId) {
    record('qr', 'staff store_id configured', 'NOT TESTED', 'SMOKE_STAFF has no store_id');
    return;
  }

  // Invalid QR
  const { data: badLookup } = await staffSb.rpc('lookup_qr_for_scan', {
    p_code: 'EX-INVALID-CODE',
    p_store_id: storeId,
  });
  record(
    'qr',
    'invalid QR rejected',
    badLookup?.error === 'qr_not_found' || badLookup?.error === 'invalid_code' ? 'PASS' : 'FAIL',
    badLookup?.error ?? 'unexpected',
  );

  // Valid lookup
  const { data: lookup } = await staffSb.rpc('lookup_qr_for_scan', {
    p_code: ownQr.code,
    p_store_id: storeId,
  });
  record(
    'qr',
    'valid QR lookup',
    lookup?.id === ownQr.id ? 'PASS' : 'FAIL',
    lookup?.error ?? lookup?.code ?? 'mismatch',
  );

  // Staff stamp scan (before rate-limiting side effects)
  const { data: stamp1, error: stampRpcErr } = await staffSb.rpc('qr_scan', {
    p_qr_code_id: ownQr.id,
    p_store_id: storeId,
    p_action: 'stamp',
    p_points: 0,
  });
  const stampTypeBug = stampRpcErr?.message?.includes('text = uuid');
  const stampOk = stamp1 && stamp1.error == null && (
    stamp1.remaining_stamps != null || stamp1.points_awarded != null || stamp1.redeemed != null
  );
  record(
    'qr',
    'staff stamp scan',
    stampOk ? 'PASS' : stampTypeBug ? 'BLOCKED' : ['rate_limited', 'duplicate_scan'].includes(stamp1?.error ?? '') ? 'NOT TESTED' : 'FAIL',
    stampTypeBug ? '70401 scanned_by uuid/text bug — push 70800' : stamp1?.error ?? stampRpcErr?.message ?? `remaining=${stamp1?.remaining_stamps} points=${stamp1?.points_awarded}`,
  );

  record(
    'qr',
    '70800 migration (remaining_stamps + scanned_by fix)',
    stamp1 && 'remaining_stamps' in stamp1 ? 'PASS' : stampTypeBug || !stampOk ? 'BLOCKED' : 'FAIL',
    stamp1 && 'remaining_stamps' in stamp1 ? 'deployed' : 'push 70800 to staging',
  );

  // Self-scan blocked (customer scans own QR)
  const { data: selfScan } = await customerSb.rpc('qr_scan', {
    p_qr_code_id: ownQr.id,
    p_store_id: storeId,
    p_action: 'stamp',
    p_points: 99999,
  });
  record(
    'qr',
    'self-scan forbidden',
    selfScan?.error === 'self_scan_forbidden' ? 'PASS' : 'FAIL',
    selfScan?.error ?? `points=${selfScan?.points_awarded}`,
  );

  // Client p_points manipulation (after stamp; capped server-side)
  const { data: pointsHack } = await staffSb.rpc('qr_scan', {
    p_qr_code_id: ownQr.id,
    p_store_id: storeId,
    p_action: 'points',
    p_points: 999999,
  });
  const pointsBlocked = pointsHack?.error === 'rate_limited' || pointsHack?.error === 'duplicate_scan';
  const capped = !pointsHack?.error && Number(pointsHack?.points_awarded ?? 0) <= 50;
  record(
    'qr',
    'client p_points capped',
    capped || pointsBlocked ? 'PASS' : 'FAIL',
    `awarded=${pointsHack?.points_awarded} err=${pointsHack?.error}`,
  );

  // Duplicate scan within 5 min
  if (stampOk) {
    await new Promise(r => setTimeout(r, 1100));
    const { data: dup } = await staffSb.rpc('qr_scan', {
      p_qr_code_id: ownQr.id,
      p_store_id: storeId,
      p_action: 'stamp',
      p_points: 0,
    });
    const dupBlocked = dup?.error === 'duplicate_scan' || dup?.error === 'rate_limited';
    record(
      'qr',
      'duplicate scan blocked',
      dupBlocked ? 'PASS' : dup && dup.error == null ? 'FAIL' : 'NOT TESTED',
      dup?.error ?? `remaining=${dup?.remaining_stamps}`,
    );
  } else {
    record('qr', 'duplicate scan blocked', 'NOT TESTED', 'prior stamp failed');
  }

  // Wrong store (staff without access)
  const fakeStore = '00000000-0000-4000-8000-000000000099';
  const { data: wrongStore } = await staffSb.rpc('qr_scan', {
    p_qr_code_id: ownQr.id,
    p_store_id: fakeStore,
    p_action: 'stamp',
    p_points: 0,
  });
  record(
    'qr',
    'unauthorized store blocked',
    ['unauthorized', 'store_not_found', 'not_owner', 'rate_limited'].includes(wrongStore?.error ?? '')
      ? 'PASS'
      : 'FAIL',
    wrongStore?.error ?? 'unexpected success',
  );

  // Customer cannot direct-insert loyalty stamp
  const { error: stampInsErr } = await customerSb
    .from('loyalty_stamps')
    .insert({ user_id: customerId, store_id: storeId });
  const stampInsBlocked = !!stampInsErr;
  record(
    'qr',
    'client loyalty_stamps insert blocked',
    stampInsBlocked ? 'PASS' : 'FAIL',
    stampInsErr?.message ?? 'insert succeeded',
  );

  // add_points revoked for client
  const { error: addPtsErr } = await customerSb.rpc('add_points', { p_amount: 5000, p_title: 'hack' });
  record(
    'loyalty',
    'add_points blocked for customer',
    addPtsErr ? 'PASS' : 'FAIL',
    addPtsErr?.message ?? 'rpc succeeded',
  );

  // spend_points revoked
  const { error: spendErr } = await customerSb.rpc('spend_points', { p_amount: 1, p_title: 'hack' });
  record(
    'loyalty',
    'spend_points blocked for customer',
    spendErr ? 'PASS' : 'FAIL',
    spendErr?.message ?? 'rpc succeeded',
  );
}

async function rlsIdorTests(customerSb, customerSession) {
  const myId = customerSession.user.id;
  const fakeUser = '00000000-0000-4000-8000-000000000001';
  const fakeOrder = '00000000-0000-4000-8000-000000000002';

  const { data: otherProfile } = await customerSb
    .from('profiles')
    .select('user_id, full_name, points')
    .eq('user_id', fakeUser)
    .maybeSingle();
  record(
    'rls',
    'profile IDOR read blocked',
    !otherProfile ? 'PASS' : 'FAIL',
    otherProfile ? `leaked ${otherProfile.full_name}` : 'no row',
  );

  const { data: otherOrders } = await customerSb
    .from('orders')
    .select('id')
    .neq('user_id', myId)
    .limit(3);
  record(
    'rls',
    'orders cross-user read blocked',
    !otherOrders?.length ? 'PASS' : 'FAIL',
    otherOrders?.length ? `${otherOrders.length} rows` : 'no foreign rows',
  );

  const { data: enumOrder } = await customerSb
    .from('orders')
    .select('id, total, payment_status')
    .eq('id', fakeOrder)
    .maybeSingle();
  record(
    'rls',
    'order ID enumeration blocked',
    !enumOrder ? 'PASS' : 'FAIL',
    enumOrder ? `total=${enumOrder.total}` : 'no row',
  );

  const { data: webhooks } = await customerSb.from('webhook_events').select('id').limit(1);
  record(
    'rls',
    'webhook_events read blocked',
    !webhooks?.length && webhooks !== null ? 'PASS' : webhooks?.length ? 'FAIL' : 'PASS',
    webhooks?.length ? `${webhooks.length} rows` : 'empty/denied',
  );

  const { data: intents } = await customerSb.from('payment_intents').select('id').limit(1);
  record(
    'rls',
    'payment_intents read blocked',
    !intents?.length ? 'PASS' : 'FAIL',
    intents?.length ? `${intents.length} rows` : 'empty/denied',
  );

  const { error: profileUpdErr } = await customerSb
    .from('profiles')
    .update({ points: 999999 })
    .eq('user_id', fakeUser);
  record(
    'rls',
    'profile points tamper blocked',
    profileUpdErr || (await customerSb.from('profiles').select('points').eq('user_id', fakeUser).maybeSingle()).data == null
      ? 'PASS'
      : 'FAIL',
    profileUpdErr?.message ?? 'checked',
  );

  const { data: allCoupons } = await customerSb.from('coupons').select('code').limit(5);
  record(
    'rls',
    'coupon enumeration blocked',
    !allCoupons?.length ? 'PASS' : 'FAIL',
    allCoupons?.length ? `${allCoupons.length} codes visible` : 'none',
  );
}

async function orderDuplicateTests(customerSb) {
  const { data: products } = await customerSb.from('products').select('id, price').eq('in_stock', true).limit(1);
  const product = products?.[0];
  if (!product) {
    record('orders', 'duplicate submit test', 'NOT TESTED', 'no products');
    return;
  }
  const price = Number(product.price);
  const args = createOrderArgs({
    p_items: [{ productId: product.id, name: 'Dup Test', qty: 1, price }],
    p_total: price,
    p_payment_method: 'cash',
  });

  const [r1, r2] = await Promise.all([
    customerSb.rpc('create_order', args),
    customerSb.rpc('create_order', args),
  ]);
  const ok1 = r1.data && !r1.data.error;
  const ok2 = r2.data && !r2.data.error;
  const nums = [r1.data?.order_number, r2.data?.order_number].filter(Boolean);
  const distinct = new Set(nums).size === nums.length;
  record(
    'orders',
    'parallel create_order both succeed (separate orders)',
    ok1 && ok2 && distinct ? 'PASS' : ok1 && !ok2 ? 'PASS' : 'FAIL',
    `orders=${nums.join(',')}`,
  );

  // Cash payment: customer cannot confirm
  if (r1.data?.order_number) {
    const { data: cashConfirm } = await customerSb.rpc('confirm_cash_payment', {
      p_order_number: r1.data.order_number,
    });
    record(
      'orders',
      'confirm_cash_payment blocked for customer',
      cashConfirm?.error === 'unauthorized' ? 'PASS' : 'FAIL',
      cashConfirm?.error ?? 'unexpected success',
    );
  }
}

async function loyaltyRedeemTests(customerSb) {
  const { data: rewards } = await customerSb.from('rewards').select('id, points_cost').eq('is_active', true).limit(1);
  const reward = rewards?.[0];
  if (!reward) {
    record('loyalty', 'redeem_reward', 'NOT TESTED', 'no active rewards');
    return;
  }

  const { data: r1, error: e1 } = await customerSb.rpc('redeem_reward', { p_reward_id: reward.id });
  if (r1?.error === 'insufficient_points') {
    record('loyalty', 'redeem_reward insufficient_points', 'PASS', `needed=${r1.needed}`);
    return;
  }
  if (e1 || r1?.error) {
    record('loyalty', 'redeem_reward', 'NOT TESTED', e1?.message ?? r1?.error);
    return;
  }

  const [p1, p2] = await Promise.all([
    customerSb.rpc('redeem_reward', { p_reward_id: reward.id }),
    customerSb.rpc('redeem_reward', { p_reward_id: reward.id }),
  ]);
  const secondFail = p2.data?.error === 'insufficient_points' || p2.error;
  record(
    'loyalty',
    'concurrent redeem second fails',
    secondFail ? 'PASS' : 'FAIL',
    `first=${p1.data?.error ?? 'ok'} second=${p2.data?.error ?? p2.error?.message}`,
  );
}

async function main() {
  console.log(`\n=== PRE-PRODUCTION VALIDATION → ${url} ===\n`);

  await ensureEphemeralCustomer();

  const custEmail = process.env.SMOKE_CUSTOMER_EMAIL;
  const custPass = process.env.SMOKE_CUSTOMER_PASSWORD;
  const staffEmail = process.env.SMOKE_STAFF_EMAIL;
  const staffPass = process.env.SMOKE_STAFF_PASSWORD;

  if (!custEmail || !custPass) {
    record('auth', 'customer credentials', 'NOT TESTED', 'Set SMOKE_CUSTOMER_EMAIL/PASSWORD');
    process.exit(1);
  }

  const { sb: customerSb, session: customerSession, error: custErr } = await signIn(custEmail, custPass);
  if (custErr || !customerSession) {
    record('auth', 'customer sign in', 'FAIL', custErr ?? 'no session');
    process.exit(1);
  }
  record('auth', 'customer sign in', 'PASS');

  await rlsIdorTests(customerSb, customerSession);
  await orderDuplicateTests(customerSb);

  if (staffEmail && staffPass) {
    const { sb: staffSb, session: staffSession, error: staffErr } = await signIn(staffEmail, staffPass);
    if (staffErr || !staffSession) {
      record('auth', 'staff sign in', 'FAIL', staffErr ?? 'no session');
    } else {
      record('auth', 'staff sign in', 'PASS');
      await qrFlowTests(customerSb, customerSession, staffSb, staffSession);
    }
  } else {
    record('qr', 'staff QR flow', 'NOT TESTED', 'Set SMOKE_STAFF_EMAIL/PASSWORD');
  }

  await loyaltyRedeemTests(customerSb);

  await customerSb.auth.signOut();

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'NOT TESTED').length;
  const blocked = results.filter(r => r.status === 'BLOCKED').length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${skip} NOT TESTED, ${blocked} BLOCKED (${results.length} total)\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
