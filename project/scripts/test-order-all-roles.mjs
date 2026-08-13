#!/usr/bin/env node
/** Test create_order for all smoke roles with app-realistic cart payload */
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

const ROLES = [
  ['customer-like admin', process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD],
  ['franchise', process.env.SMOKE_FRANCHISE_EMAIL, process.env.SMOKE_FRANCHISE_PASSWORD],
  ['super_admin', process.env.SMOKE_SUPER_ADMIN_EMAIL, process.env.SMOKE_SUPER_ADMIN_PASSWORD],
];

function cartLine(product, sizeLabel, sizeMod) {
  const unit = Number(product.price) + sizeMod;
  return {
    productId: product.id,
    name: `${product.name} — ${sizeLabel}`,
    qty: 1,
    price: unit,
    sizeModifier: sizeMod,
  };
}

async function testRole(label, email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const login = await sb.auth.signInWithPassword({ email, password });
  if (login.error) {
    console.log(`✗ ${label} login:`, login.error.message);
    return;
  }
  const { data: products } = await sb.from('products').select('id,name,price').eq('in_stock', true).limit(1);
  const p = products?.[0];
  if (!p) {
    console.log(`✗ ${label}: no products`);
    return;
  }
  const { data: stores } = await sb.from('stores').select('id,name').limit(1);
  const store = stores?.[0];
  const items = [cartLine(p, 'Büyük', 10)];
  const prev = await sb.rpc('preview_checkout', { p_items: items, p_store_id: store?.id ?? null });
  if (prev.data?.error || prev.error) {
    console.log(`✗ ${label} preview:`, prev.error?.message ?? prev.data?.error);
    return;
  }
  const ord = await sb.rpc('create_order', {
    p_items: items,
    p_total: prev.data.total,
    p_store_id: store?.id ?? null,
    p_store_name: store?.name ?? 'Test',
    p_order_type: 'pickup',
    p_payment_method: 'cash',
  });
  if (ord.error || ord.data?.error) {
    console.log(`✗ ${label} order:`, ord.error?.message ?? ord.data?.error);
    return;
  }
  console.log(`✓ ${label}:`, ord.data.order_number, `(tier preview sub=${prev.data.subtotal})`);
}

async function main() {
  for (const [label, email, password] of ROLES) {
    if (!email || !password) continue;
    await testRole(label, email, password);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
