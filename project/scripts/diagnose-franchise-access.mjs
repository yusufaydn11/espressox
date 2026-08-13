#!/usr/bin/env node
/** Diagnose franchise store access vs order visibility */
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
  if (r.error) throw new Error(r.error.message);
  return sb;
}

async function main() {
  const email = process.env.SMOKE_FRANCHISE_EMAIL;
  const pass = process.env.SMOKE_FRANCHISE_PASSWORD;
  const sb = await login(email, pass);
  const { data: { user } } = await sb.auth.getUser();

  const { data: profile } = await sb.from('profiles').select('role,store_id,email').eq('id', user.id).single();
  console.log('profile', profile);

  const { data: stores } = await sb.from('stores').select('id,name').limit(5);
  console.log('stores visible', stores?.length, stores?.map(s => s.id));

  const { data: store0 } = await sb.from('stores').select('id,name').limit(1).single();
  const { data: product } = await sb.from('products').select('id,price').eq('in_stock', true).limit(1).single();
  const items = [{ productId: product.id, name: 'Test', qty: 1, price: Number(product.price), sizeModifier: 0 }];
  const prev = await sb.rpc('preview_checkout', { p_items: items, p_store_id: store0.id });
  const ord = await sb.rpc('create_order', {
    p_items: items, p_total: prev.data.total, p_store_id: store0.id, p_store_name: store0.name,
    p_order_type: 'pickup', p_payment_method: 'cash',
  });
  const orderNo = ord.data.order_number;
  console.log('created', orderNo, 'at store', store0.id);

  const { data: direct } = await sb.from('orders').select('id,order_number,store_id,user_id,status').eq('order_number', orderNo).maybeSingle();
  console.log('direct select', direct, direct ? 'OK' : 'BLOCKED');

  await sb.rpc('confirm_cash_payment', { p_order_number: orderNo });

  const { data: afterConfirm } = await sb.from('orders').select('id,order_number,store_id,user_id,status').eq('order_number', orderNo).maybeSingle();
  console.log('after confirm direct select', afterConfirm, afterConfirm ? 'OK' : 'BLOCKED');

  const prep = await sb.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'preparing' });
  console.log('advance', prep.data, prep.error?.message);

  const { data: myStores } = await sb.rpc('my_store_ids');
  console.log('my_store_ids', myStores);

  const { data: access } = await sb.rpc('has_store_access', { p_store_id: store0.id });
  console.log('has_store_access', store0.id, access);
}

main().catch(e => { console.error(e); process.exit(1); });
