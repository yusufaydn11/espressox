#!/usr/bin/env node
/** Test full franchise order lifecycle: confirm cash + advance to preparing + ready */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function login(email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const r = await sb.auth.signInWithPassword({ email, password });
  if (r.error) throw new Error(`login ${email}: ${r.error.message}`);
  return sb;
}

async function createTestOrder(sb) {
  const { data: store } = await sb.from('stores').select('id,name').limit(1).single();
  const { data: product } = await sb.from('products').select('id,price').eq('in_stock', true).limit(1).single();
  const items = [{ productId: product.id, name: 'Test', qty: 1, price: Number(product.price), sizeModifier: 0 }];
  const prev = await sb.rpc('preview_checkout', { p_items: items, p_store_id: store.id });
  const ord = await sb.rpc('create_order', {
    p_items: items, p_total: prev.data.total, p_store_id: store.id, p_store_name: store.name,
    p_order_type: 'pickup', p_payment_method: 'cash',
  });
  if (ord.data?.error || ord.error) throw new Error('create: ' + (ord.error?.message ?? ord.data?.error));
  return { orderNo: ord.data.order_number, storeId: store.id };
}

async function testRole(label, email, password) {
  console.log(`\n=== ${label} ===`);
  const customer = await login(email, password);
  const { orderNo } = await createTestOrder(customer);
  console.log('created', orderNo);

  const staff = await login(email, password);
  const confirm = await staff.rpc('confirm_cash_payment', { p_order_number: orderNo });
  console.log('confirm_cash', confirm.error?.message ?? confirm.data?.error ?? 'OK', confirm.data?.status);

  const prep = await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'preparing' });
  console.log('preparing', prep.error?.message ?? prep.data?.error ?? 'OK', prep.data?.status);

  const ready = await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'ready' });
  console.log('ready', ready.error?.message ?? ready.data?.error ?? 'OK', ready.data?.status);

  const pickup = await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'picked-up' });
  console.log('picked-up', pickup.error?.message ?? pickup.data?.error ?? 'OK', pickup.data?.status);

  if (prep.data?.error || prep.error) return false;
  return true;
}

async function main() {
  const roles = [
    ['franchise', process.env.SMOKE_FRANCHISE_EMAIL, process.env.SMOKE_FRANCHISE_PASSWORD],
    ['admin', process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD],
  ];
  let ok = true;
  for (const [label, email, pass] of roles) {
    if (!email) continue;
    try {
      const passRole = await testRole(label, email, pass);
      if (!passRole) ok = false;
    } catch (e) {
      console.log('ERROR', e.message);
      ok = false;
    }
  }
  process.exit(ok ? 0 : 1);
}

main();
