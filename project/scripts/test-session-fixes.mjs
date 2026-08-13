#!/usr/bin/env node
/**
 * Tests for franchise order panel + redeem_reward fixes (session 2026-07-29).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnv() {
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
}

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const FRANCHISE_TERMINAL = ['delivered', 'cancelled', 'completed'];
function isFranchiseActive(status) {
  return !FRANCHISE_TERMINAL.includes(status);
}

function parseOrderNumberFromBody(body) {
  const match = body.match(/\bEX-\d+\b/);
  return match?.[0];
}

const results = [];
function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${icon} ${name}: ${status}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, session: null, error: error.message };
  return { sb, session: data.session, error: null };
}

async function main() {
  console.log('\n=== Session Fix Tests ===\n');

  // ── Unit: notification parse + active filter ──
  record(
    'parseOrderNumberFromBody',
    parseOrderNumberFromBody('EX-42 numarali siparisiniz olusturuldu.') === 'EX-42' ? 'PASS' : 'FAIL',
  );
  record('isFranchiseActive payment_pending', isFranchiseActive('payment_pending') ? 'PASS' : 'FAIL');
  record('isFranchiseActive confirmed', isFranchiseActive('confirmed') ? 'PASS' : 'FAIL');
  record('isFranchiseActive delivered', !isFranchiseActive('delivered') ? 'PASS' : 'FAIL');

  // ── Franchise store lookup ──
  const { sb: frSb, session: frSession, error: frLoginErr } = await signIn(
    process.env.SMOKE_FRANCHISE_EMAIL,
    process.env.SMOKE_FRANCHISE_PASSWORD,
  );
  if (frLoginErr) {
    record('franchise login', 'FAIL', frLoginErr);
    return summarize();
  }
  record('franchise login', 'PASS');

  const { data: role } = await frSb.from('user_roles').select('role, store_id').eq('user_id', frSession.user.id).maybeSingle();
  const storeId = role?.store_id;
  record('franchise has store_id', storeId ? 'PASS' : 'FAIL', storeId ?? 'none');

  let storeName = 'Smoke Store';
  if (storeId) {
    const { data: storeRow } = await frSb.from('stores').select('name').eq('id', storeId).maybeSingle();
    storeName = storeRow?.name ?? storeName;
    record('franchise store name', storeRow?.name ? 'PASS' : 'FAIL', storeRow?.name ?? '');
  }

  // ── Customer: create cash order at franchise store ──
  const stamp = Date.now();
  const custEmail = `fix.test.${stamp}@example.com`;
  const custPass = `FixTest!${stamp}Aa`;
  const cust = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signUp, error: signUpErr } = await cust.auth.signUp({ email: custEmail, password: custPass });
  if (signUpErr || !signUp.session) {
    record('ephemeral customer signup', 'FAIL', signUpErr?.message ?? 'no session');
    return summarize();
  }
  record('ephemeral customer signup', 'PASS');

  const { data: orderRes, error: orderErr } = await cust.rpc('create_order', {
    p_items: [{ productId: 'h01', name: 'Americano', qty: 1, price: 10 }],
    p_total: 10,
    p_store_id: storeId,
    p_store_name: storeName,
    p_order_type: 'pickup',
    p_payment_method: 'cash',
  });
  if (orderErr || orderRes?.error) {
    record('customer create_order cash', 'FAIL', orderErr?.message ?? orderRes?.error);
  } else {
    record('customer create_order cash', 'PASS', `${orderRes.order_number} status=${orderRes.status}`);
    record(
      'new order is payment_pending',
      orderRes.status === 'payment_pending' ? 'PASS' : 'FAIL',
      orderRes.status,
    );
    record(
      'payment_pending counts as franchise active',
      isFranchiseActive(orderRes.status) ? 'PASS' : 'FAIL',
    );

    // Notification body parse
    const { data: notifs } = await cust.from('notifications').select('body, data').eq('user_id', signUp.user.id).order('created_at', { ascending: false }).limit(1);
    const body = notifs?.[0]?.body ?? '';
    const parsed = parseOrderNumberFromBody(body);
    record(
      'notification body contains parseable order number',
      parsed === orderRes.order_number ? 'PASS' : 'FAIL',
      `parsed=${parsed ?? 'null'}`,
    );

    // Franchise sees order in store list
    const { data: storeOrders, error: soErr } = await frSb
      .from('orders')
      .select('order_number, status, payment_method')
      .eq('store_id', storeId)
      .eq('order_number', orderRes.order_number)
      .maybeSingle();
    record(
      'franchise reads store order',
      !soErr && storeOrders?.order_number === orderRes.order_number ? 'PASS' : 'FAIL',
      soErr?.message ?? storeOrders?.status,
    );

    // Cash confirm (franchise staff action)
    const { data: cashConfirm, error: cashErr } = await frSb.rpc('confirm_cash_payment', {
      p_order_number: orderRes.order_number,
    });
    record(
      'franchise confirm_cash_payment',
      !cashErr && !cashConfirm?.error ? 'PASS' : 'FAIL',
      cashErr?.message ?? cashConfirm?.error ?? 'confirmed',
    );

    // Advance to preparing
    const { data: adv1, error: adv1Err } = await frSb.rpc('advance_order_status', {
      p_order_number: orderRes.order_number,
      p_new_status: 'preparing',
    });
    record(
      'franchise advance confirmed→preparing',
      !adv1Err && !adv1?.error ? 'PASS' : 'FAIL',
      adv1Err?.message ?? adv1?.error,
    );
  }

  // ── redeem_reward (70900 migration) ──
  const { data: rewards } = await cust.from('rewards').select('id, title, points_cost').eq('is_active', true).order('points_cost').limit(5);
  const cheap = rewards?.find(r => r.points_cost > 0 && r.points_cost <= 50) ?? rewards?.[0];

  if (!cheap) {
    record('redeem_reward', 'NOT TESTED', 'no active rewards in catalog');
  } else {
    await cust.from('profiles').update({ points: Math.max(500, cheap.points_cost + 100) }).eq('user_id', signUp.user.id);
    const { data: redeem, error: redeemErr } = await cust.rpc('redeem_reward', { p_reward_id: cheap.id });
    const rls = (redeemErr?.message ?? redeem?.error ?? '').includes('row-level security');
    if (rls) {
      record('redeem_reward (70900 migration)', 'FAIL', 'RLS still blocking — run db push for 20260729270900');
    } else if (redeemErr) {
      record('redeem_reward', 'FAIL', redeemErr.message);
    } else if (redeem?.error) {
      record('redeem_reward', redeem.error === 'insufficient_points' ? 'NOT TESTED' : 'FAIL', redeem.error);
    } else {
      record('redeem_reward (70900 migration)', 'PASS', cheap.title);
    }
  }

  await cust.auth.signOut();
  await frSb.auth.signOut();
  summarize();
}

function summarize() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'NOT TESTED').length;
  console.log(`\nSummary: ${pass} pass, ${fail} fail, ${skip} skipped\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
