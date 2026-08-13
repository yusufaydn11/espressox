#!/usr/bin/env node
/** Verify points are deferred until store confirms cash payment. */
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

async function profilePoints(sb) {
  const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from('profiles').select('points').eq('user_id', user.id).single();
  return data?.points ?? 0;
}

async function main() {
  const customer = createClient(url, anonKey, { auth: { persistSession: false } });
  await customer.auth.signInWithPassword({
    email: process.env.SMOKE_FRANCHISE_EMAIL,
    password: process.env.SMOKE_FRANCHISE_PASSWORD,
  });

  const before = await profilePoints(customer);
  const { data: store } = await customer.from('stores').select('id,name').limit(1).single();
  const { data: product } = await customer.from('products').select('id,price').eq('in_stock', true).limit(1).single();
  const items = [{ productId: product.id, name: 'Test', qty: 1, price: Number(product.price), sizeModifier: 0 }];
  const prev = await customer.rpc('preview_checkout', { p_items: items, p_store_id: store.id });
  const ord = await customer.rpc('create_order', {
    p_items: items,
    p_total: prev.data.total,
    p_store_id: store.id,
    p_store_name: store.name,
    p_order_type: 'pickup',
    p_payment_method: 'cash',
  });
  if (ord.data?.error) throw new Error('create_order: ' + ord.data.error);
  const afterCreate = await profilePoints(customer);
  const orderNo = ord.data.order_number;

  const franchise = createClient(url, anonKey, { auth: { persistSession: false } });
  await franchise.auth.signInWithPassword({
    email: process.env.SMOKE_FRANCHISE_EMAIL,
    password: process.env.SMOKE_FRANCHISE_PASSWORD,
  });
  const confirm = await franchise.rpc('confirm_cash_payment', { p_order_number: orderNo });
  if (confirm.data?.error) throw new Error('confirm: ' + confirm.data.error);
  const afterConfirm = await profilePoints(franchise);

  const expectedPts = prev.data.points_earned ?? 0;
  console.log('order', orderNo, 'expectedPts', expectedPts);
  console.log('before', before, 'afterCreate', afterCreate, 'afterConfirm', afterConfirm);
  if (afterCreate !== before) {
    console.log('FAIL: points changed at create');
    process.exit(1);
  }
  if (expectedPts > 0 && afterConfirm !== before + expectedPts) {
    console.log('FAIL: points not credited after confirm');
    process.exit(1);
  }
  console.log('PASS: points deferred until store confirmation');
}

main().catch(e => { console.error(e); process.exit(1); });
