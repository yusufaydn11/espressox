#!/usr/bin/env node
/**
 * Checkout benefit / campaign smoke tests — preview_checkout scenarios
 *
 * Usage: node scripts/smoke-checkout-benefits.mjs
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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const results = [];

function record(scenario, status, detail = '') {
  results.push({ scenario, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${icon} ${scenario}: ${status}${detail ? ` — ${detail}` : ''}`);
}

function approx(a, b, tol = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

async function callPreview(sb, items, opts = {}) {
  const { data, error } = await sb.rpc('preview_checkout', {
    p_items: items,
    p_store_id: opts.storeId ?? null,
    p_coupon_code: opts.couponCode ?? null,
    p_benefit_type: opts.benefitType ?? null,
    p_benefit_id: opts.benefitId ?? null,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: String(data.error) };
  return { data };
}

async function main() {
  if (!url || !anonKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  let email = process.env.SMOKE_CUSTOMER_EMAIL ?? process.env.SMOKE_SUPER_ADMIN_EMAIL;
  let password = process.env.SMOKE_CUSTOMER_PASSWORD ?? process.env.SMOKE_SUPER_ADMIN_PASSWORD;

  console.log(`\nCheckout benefit tests → ${url}\n`);

  const sb = createClient(url, anonKey, { auth: { persistSession: false } });

  if (!email || !password) {
    const stamp = Date.now();
    email = `smoke.checkout.${stamp}@example.com`;
    password = `Smoke!${stamp}Aa`;
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error || !data.session) {
      console.error('Sign-up failed:', error?.message ?? 'no session');
      process.exit(1);
    }
    record('ephemeral sign-up', 'PASS', email);
  }

  const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
  if (signErr) {
    console.error('Sign in failed:', signErr.message);
    process.exit(1);
  }
  record('sign in', 'PASS', email);

  const { data: profile } = await sb.from('profiles').select('tier').single();
  const tier = profile?.tier ?? 'Bronz';
  record('profile tier', 'PASS', tier);

  const { data: { user } } = await sb.auth.getUser();
  const userId = user?.id;

  const tierHasSizePerk = /gümüş|gumus|altın|altin|siyah|vip|silver|gold|black|platinum/i.test(tier);

  const { data: p1row } = await sb.from('products').select('id, name, price').eq('in_stock', true).order('price', { ascending: false }).limit(1).maybeSingle();
  if (!p1row?.id) {
    record('product catalog', 'FAIL', 'stokta ürün yok');
    process.exit(1);
  }
  const p1 = p1row;
  const basePrice = Number(p1.price);
  const largePrice = basePrice + 10;

  const probe = await callPreview(sb, [{
    productId: p1.id, name: 'Probe', qty: 1, price: largePrice, sizeModifier: 10,
  }]);
  if (probe.error || Number(probe.data?.subtotal) <= 0) {
    record('migrations deployed', 'FAIL', probe.error ?? `subtotal=${probe.data?.subtotal}`);
    process.exit(1);
  }
  record('migrations deployed', 'PASS');

  // 1. Size upgrade auto
  {
    const items = [{ productId: p1.id, name: 'Test — Büyük', qty: 1, price: largePrice, sizeModifier: 10 }];
    const { data, error } = await callPreview(sb, items);
    const sub = Number(data?.subtotal);
    const disc = Number(data?.discount);
    const total = Number(data?.total);
    const expectDisc = tierHasSizePerk ? 10 : 0;
    const ok = !error && approx(sub, largePrice) && approx(disc, expectDisc) && approx(total, largePrice - expectDisc);
    record('boy yükseltme otomatik', ok ? 'PASS' : 'FAIL', error ?? `sub=${sub} disc=${disc} total=${total} expectDisc=${expectDisc}`);
  }

  // 2. Küçük boy — tier_perk = 0
  {
    const items = [{ productId: p1.id, name: 'Test — Küçük', qty: 1, price: basePrice, sizeModifier: 0 }];
    const { data, error } = await callPreview(sb, items, { benefitType: 'tier_perk', benefitId: 'tier_size_upgrade' });
    const ok = !error && Number(data.discount) === 0;
    record('Küçük boy indirim yok', ok ? 'PASS' : 'FAIL', error ?? `disc=${data?.discount}`);
  }

  // 3. tier_perk manual Büyük
  {
    const items = [{ productId: p1.id, name: 'Test — Büyük', qty: 1, price: largePrice, sizeModifier: 10 }];
    const { data, error } = await callPreview(sb, items, { benefitType: 'tier_perk', benefitId: 'tier_size_upgrade' });
    const expectDisc = tierHasSizePerk ? 10 : 0;
    const ok = !error && approx(data.discount, expectDisc);
    record('tier_perk manuel', ok ? 'PASS' : 'FAIL', error ?? `disc=${data?.discount}`);
  }

  // 4. Campaigns
  const { data: campaigns } = await sb.from('campaigns').select('id, title, discount_type, discount_value').eq('status', 'active').limit(5);
  if (!campaigns?.length) {
    record('kampanyalar', 'SKIP', 'aktif kampanya yok');
  } else {
    for (const c of campaigns) {
      const sub = basePrice * 2;
      const items = [{ productId: p1.id, name: 'Test', qty: 2, price: basePrice }];
      const { data, error } = await callPreview(sb, items, { benefitType: 'campaign', benefitId: c.id });
      let expected = 0;
      if (c.discount_type === 'percent' || c.discount_type === 'happy_hour') {
        expected = Math.round(sub * Number(c.discount_value ?? 0) / 100 * 100) / 100;
      } else if (c.discount_type === 'bogo') {
        expected = Math.round(sub * 0.5 * 100) / 100;
      } else {
        expected = Math.min(Number(c.discount_value ?? 0), sub);
      }
      const ok = !error && approx(data.discount, expected);
      record(`kampanya ${c.discount_type}`, ok ? 'PASS' : 'FAIL', error ?? `disc=${data?.discount} exp=${expected} (${c.title})`);
    }
  }

  // 5. Coupons
  const { data: coupons } = await sb.from('coupons').select('code, type, value').eq('is_active', true).limit(3);
  if (!coupons?.length) {
    record('kuponlar', 'SKIP', 'aktif kupon yok');
  } else {
    for (const cp of coupons) {
      const items = [{ productId: p1.id, name: 'Test', qty: 1, price: basePrice }];
      const { data, error } = await callPreview(sb, items, { couponCode: cp.code });
      if (error?.includes('limit') || error?.includes('min')) {
        record(`kupon ${cp.code}`, 'SKIP', error);
        continue;
      }
      let expected = cp.type === 'percent'
        ? Math.round(basePrice * Math.min(Number(cp.value), 100) / 100 * 100) / 100
        : Math.min(Number(cp.value), basePrice);
      const ok = !error && approx(data.discount, expected);
      record(`kupon ${cp.type}`, ok ? 'PASS' : 'FAIL', error ?? `disc=${data?.discount} (${cp.code})`);
    }
  }

  // 6. Pending rewards
  const { data: redemptions } = await sb
    .from('reward_redemptions')
    .select('id, reward_id, user_id, rewards(id, title, category)')
    .eq('user_id', userId)
    .is('order_id', null)
    .limit(5);
  if (!redemptions?.length) {
    record('ödül redemption', 'SKIP', 'bekleyen ödül yok');
  } else {
    for (const rr of redemptions) {
      const rid = rr.rewards?.id ?? rr.reward_id;
      const items = [{ productId: p1.id, name: 'Test — Büyük', qty: 1, price: largePrice, sizeModifier: rid === 'r6' ? 10 : 0 }];
      const cat = rr.rewards?.category ?? '';
      const benefitType = cat === 'birthday' ? 'birthday' : ['vip', 'exclusive'].includes(cat) ? 'vip_benefit' : 'reward';
      const { data, error } = await callPreview(sb, items, { benefitType, benefitId: rr.id });
      let ok = !error;
      const disc = Number(data?.discount ?? 0);
      if (ok && rid === 'r6') ok = approx(disc, 10);
      else if (ok && rid === 'r3') ok = approx(disc, largePrice * 0.25);
      else if (ok && rid === 'r7') ok = approx(disc, 0);
      else if (ok && (rid === 'r1' || rid === 'r2')) ok = disc > 0 && disc <= largePrice;
      record(`ödül ${rid}`, ok ? 'PASS' : 'FAIL', error ?? `disc=${disc}`);
    }
  }

  // 7. get_checkout_benefits
  {
    const { data, error } = await sb.rpc('get_checkout_benefits', { p_store_id: null });
    const benefits = data?.benefits ?? [];
    const ok = !error && benefits.every(b => b.discount_type != null);
    record('get_checkout_benefits', ok ? 'PASS' : 'FAIL', error?.message ?? `${benefits.length} benefits`);
  }

  // 8. create_order smoke (cash, no benefit)
  {
    const { data: stores } = await sb.from('stores').select('id, name').limit(1);
    const store = stores?.[0];
    const items = [{ productId: p1.id, name: 'Smoke Order — Büyük', qty: 1, price: largePrice, sizeModifier: 10 }];
    const prev = await callPreview(sb, items, { storeId: store?.id });
    if (!store || prev.error) {
      record('create_order', 'SKIP', prev.error ?? 'mağaza yok');
    } else {
      const { data, error } = await sb.rpc('create_order', {
        p_items: items,
        p_total: prev.data.total,
        p_store_id: store.id,
        p_store_name: store.name,
        p_order_type: 'pickup',
        p_payment_method: 'cash',
      });
      const ok = !error && data?.order_number && !data?.error;
      record('create_order', ok ? 'PASS' : 'FAIL', error?.message ?? data?.error ?? data?.order_number);
    }
  }

  const fail = results.filter(r => r.status === 'FAIL').length;
  const pass = results.filter(r => r.status === 'PASS').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${skip} SKIP\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
