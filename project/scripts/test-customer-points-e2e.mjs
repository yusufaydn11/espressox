#!/usr/bin/env node
/** E2E: create order as customer, franchise confirms+delivers, verify profile points */
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

async function getPoints(sb, uid) {
  const { data } = await sb.from('profiles').select('points,lifetime_points,tier').eq('user_id', uid).single();
  return data;
}

async function main() {
  const franchiseEmail = process.env.SMOKE_FRANCHISE_EMAIL;
  const franchisePass = process.env.SMOKE_FRANCHISE_PASSWORD;
  if (!franchiseEmail) throw new Error('SMOKE_FRANCHISE_EMAIL missing');

  const customer = await login(franchiseEmail, franchisePass);
  const { data: { user } } = await customer.auth.getUser();
  const before = await getPoints(customer, user.id);
  console.log('BEFORE', before);

  const { data: store } = await customer.from('stores').select('id,name').limit(1).single();
  const { data: product } = await customer.from('products').select('id,price').eq('in_stock', true).limit(1).single();
  const items = [{ productId: product.id, name: 'Test', qty: 1, price: Number(product.price), sizeModifier: 0 }];
  const prev = await customer.rpc('preview_checkout', { p_items: items, p_store_id: store.id });
  const ord = await customer.rpc('create_order', {
    p_items: items, p_total: prev.data.total, p_store_id: store.id, p_store_name: store.name,
    p_order_type: 'pickup', p_payment_method: 'cash',
  });
  const orderNo = ord.data.order_number;
  const expectedPts = ord.data.points_earned;
  console.log('ORDER', orderNo, 'expectedPts', expectedPts, 'create status', ord.data.status);

  const afterCreate = await getPoints(customer, user.id);
  console.log('AFTER CREATE', afterCreate, 'delta', afterCreate.points - before.points);

  const { data: orderAfterCreate } = await customer.from('orders').select('status,payment_status,points_earned,points_credited').eq('order_number', orderNo).single();
  console.log('ORDER ROW after create', orderAfterCreate);

  const staff = await login(franchiseEmail, franchisePass);
  const confirm = await staff.rpc('confirm_cash_payment', { p_order_number: orderNo });
  console.log('CONFIRM', confirm.data?.error ?? confirm.error?.message ?? 'OK', confirm.data);

  const afterConfirm = await getPoints(customer, user.id);
  const { data: orderAfterConfirm } = await customer.from('orders').select('status,payment_status,points_earned,points_credited').eq('order_number', orderNo).single();
  console.log('AFTER CONFIRM profile', afterConfirm, 'delta', afterConfirm.points - before.points);
  console.log('ORDER ROW after confirm', orderAfterConfirm);

  const prep = await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'preparing' });
  console.log('PREPARING', prep.data?.error ?? 'OK');
  const afterPrep = await getPoints(customer, user.id);
  const { data: orderAfterPrep } = await customer.from('orders').select('status,points_credited').eq('order_number', orderNo).single();
  console.log('AFTER PREP profile', afterPrep, 'order', orderAfterPrep);

  await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'ready' });
  await staff.rpc('advance_order_status', { p_order_number: orderNo, p_new_status: 'picked-up' });
  const afterPickup = await getPoints(customer, user.id);
  const { data: orderFinal } = await customer.from('orders').select('status,points_earned,points_credited').eq('order_number', orderNo).single();
  console.log('AFTER PICKUP profile', afterPickup, 'delta total', afterPickup.points - before.points);
  console.log('ORDER FINAL', orderFinal);

  const { data: history } = await customer.from('points_history').select('title,points,type,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3);
  console.log('POINTS HISTORY', history);

  const ok = afterPickup.points >= before.points + expectedPts;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
