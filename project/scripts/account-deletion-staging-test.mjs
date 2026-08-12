#!/usr/bin/env node
/**
 * Account deletion — staging test plan + pre-flight checks
 *
 * DOES NOT delete users or push migrations without explicit operator approval.
 * Run after migrations 70600 + 70700 and delete-user edge function are deployed to STAGING.
 *
 * Usage:
 *   node scripts/account-deletion-staging-test.mjs           # pre-flight only
 *   node scripts/account-deletion-staging-test.mjs --execute   # full E2E (requires APPROVE_ACCOUNT_DELETE=1)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const execute = process.argv.includes('--execute');

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const checks = [];

function record(step, status, detail = '') {
  checks.push({ step, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'BLOCKED' ? '⊘' : '○';
  console.log(`${icon} ${step}: ${status}${detail ? ` — ${detail}` : ''}`);
}

const SCENARIOS = `
ACCOUNT DELETION STAGING TEST SCENARIOS
======================================

Prerequisites (NEEDS APPROVAL before running):
  1. supabase db push — migrations 70600 + 70700 on STAGING only
  2. supabase functions deploy delete-user — STAGING only
  3. Set APPROVE_ACCOUNT_DELETE=1 when running --execute

Test user setup:
  A. Create test user via signUp (email: deletion.test.<timestamp>@example.com)
  B. Verify profile + qr_codes + notification_preferences exist (handle_new_user)

Seed data (as test user):
  C. create_order (cash) → note order_number + order id
  D. Earn loyalty: qr_scan stamp OR add_points via service role (staging seed only)
  E. Register push token row in push_tokens / expo_push_tokens if table exists

Deletion flow:
  F. Call delete-user edge function with user's JWT (no body userId)
  G. Expect 200 + success

Post-deletion verification:
  H. auth.admin.getUserById → user NOT FOUND (requires service role read)
  I. profiles row → full_name anonymized, phone/email cleared, is_deleted flag if present
  J. orders row → still exists, user_id IS NULL, notes contain [account_deleted]
  K. order_items / order_payments → unchanged amounts
  L. loyalty_stamps / qr_codes / push_tokens → deleted for user
  M. signInWithPassword → invalid credentials
  N. Attempt JWT refresh with old refresh token → fails

Edge cases:
  O. Double delete → 404 or already_deleted
  P. Delete while order payment_pending → order detached, not cancelled
  Q. Re-signup same email → new auth id, no PII leak from old profile

Manual UI checks:
  R. AccountSettingsSheet → delete confirmation → loading → success toast
  S. After delete, app routes to auth screen
`;

async function probeMigration70600(admin, authedClient, userId) {
  if (authedClient && userId) {
    const { data, error } = await authedClient.rpc('prepare_user_account_deletion', { p_user_id: userId });
    const exists = !error?.message?.includes('does not exist');
    record(
      '70600: prepare_user_account_deletion RPC',
      exists ? 'PASS' : 'BLOCKED',
      exists ? (data?.success === false ? 'callable' : 'ok') : error?.message ?? 'not deployed',
    );
    if (!admin) return exists;
  } else if (!admin) {
    record('70600: prepare_user_account_deletion RPC', 'BLOCKED', 'need authenticated probe user');
    return false;
  }

  if (!admin) return false;

  const { data: col } = await admin
    .from('information_schema.columns')
    .select('is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'orders')
    .eq('column_name', 'user_id')
    .maybeSingle();
  record(
    '70600: orders.user_id nullable',
    col?.is_nullable === 'YES' ? 'PASS' : col ? 'FAIL' : 'BLOCKED',
    col?.is_nullable ?? 'cannot query',
  );
  return exists && col?.is_nullable === 'YES';
}

async function probeDeleteUserFunction() {
  const fnUrl = `${url?.replace(/\/$/, '')}/functions/v1/delete-user`;
  try {
    const res = await fetch(fnUrl, { method: 'OPTIONS' });
    record(
      'delete-user edge function reachable',
      res.ok || res.status === 204 || res.status === 405 ? 'PASS' : 'BLOCKED',
      `HTTP ${res.status}`,
    );
  } catch (e) {
    record('delete-user edge function reachable', 'BLOCKED', e.message);
  }
}

async function executeDeletionE2E() {
  if (process.env.APPROVE_ACCOUNT_DELETE !== '1') {
    record('E2E execution', 'BLOCKED', 'Set APPROVE_ACCOUNT_DELETE=1 to run destructive test');
    return;
  }

  const stamp = Date.now();
  const email = `deletion.test.${stamp}@example.com`;
  const password = `Delete!${stamp}Aa`;
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

  const { data: signUp, error: suErr } = await sb.auth.signUp({ email, password });
  if (suErr || !signUp.session) {
    record('E2E: create test user', 'FAIL', suErr?.message ?? 'no session');
    return;
  }
  const userId = signUp.user.id;
  record('E2E: create test user', 'PASS', userId);

  const { data: product } = await sb.from('products').select('id, price').eq('in_stock', true).limit(1).maybeSingle();
  let orderNumber = null;
  if (product) {
    const { data: order } = await sb.rpc('create_order', {
      p_items: [{ productId: product.id, name: 'Deletion Test', qty: 1, price: Number(product.price) }],
      p_total: Number(product.price),
      p_payment_method: 'cash',
    });
    orderNumber = order?.order_number ?? null;
    record('E2E: seed order', orderNumber ? 'PASS' : 'FAIL', orderNumber ?? order?.error);
  }

  const fnUrl = `${url.replace(/\/$/, '')}/functions/v1/delete-user`;
  const { data: sessionData } = await sb.auth.getSession();
  const jwt = sessionData.session?.access_token;
  const delRes = await fetch(fnUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const delBody = await delRes.json().catch(() => ({}));
  record('E2E: delete-user call', delRes.ok ? 'PASS' : 'FAIL', delBody.error ?? String(delRes.status));

  if (admin) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    record('E2E: auth user removed', !authUser?.user ? 'PASS' : 'FAIL', authUser?.user ? 'still exists' : 'gone');

    const { data: profile } = await admin.from('profiles').select('full_name, user_id').eq('user_id', userId).maybeSingle();
    record(
      'E2E: profile anonymized or removed',
      !profile || (profile.full_name ?? '').includes('deleted') || profile.full_name === '' ? 'PASS' : 'FAIL',
      profile?.full_name ?? 'no row',
    );

    if (orderNumber) {
      const { data: ord } = await admin.from('orders').select('user_id, notes').eq('order_number', orderNumber).maybeSingle();
      record(
        'E2E: order preserved user_id NULL',
        ord && ord.user_id === null ? 'PASS' : 'FAIL',
        ord ? `user_id=${ord.user_id}` : 'order missing',
      );
    }
  } else {
    record('E2E: auth user removed', 'BLOCKED', 'SUPABASE_SERVICE_ROLE_KEY optional — add to .env for full verify');
    record('E2E: profile anonymized or removed', 'BLOCKED', 'service role optional');
    record('E2E: order preserved user_id NULL', orderNumber ? 'BLOCKED' : 'NOT TESTED', 'service role optional');
  }

  const { error: reLoginErr } = await sb.auth.signInWithPassword({ email, password });
  record('E2E: re-login blocked', reLoginErr ? 'PASS' : 'FAIL', reLoginErr?.message ?? 'login succeeded');
}

async function main() {
  console.log('\n=== ACCOUNT DELETION STAGING TEST ===\n');
  console.log(SCENARIOS);

  if (!url || !anonKey) {
    console.error('Missing Supabase URL/anon key');
    process.exit(1);
  }

  const probeClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: probeSignUp } = await probeClient.auth.signUp({
    email: `probe.del.${Date.now()}@example.com`,
    password: `ProbeDel!${Date.now()}Aa`,
  });
  const probeUserId = probeSignUp?.user?.id ?? null;

  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

  const ready = await probeMigration70600(admin, probeClient, probeUserId);
  await probeDeleteUserFunction();

  record(
    'Staging deletion test ready',
    ready ? 'PASS' : 'BLOCKED',
    ready ? 'Migrations appear deployed' : 'Push 70600+70700 to staging first',
  );

  if (execute) {
    console.log('\n--- Executing E2E (destructive) ---\n');
    await executeDeletionE2E();
  } else {
    record('E2E execution', 'BLOCKED', 'Pass --execute + APPROVE_ACCOUNT_DELETE=1 to run');
  }

  const fail = checks.filter(c => c.status === 'FAIL').length;
  console.log(`\n${checks.length} checks, ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
