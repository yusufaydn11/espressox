#!/usr/bin/env node
/** Simulates exact client checkout payload (mapCartItemsForCheckout + preview + create_order). */
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

function nullIfEmpty(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function mapCartItemsForCheckout(cart) {
  return cart
    .map(item => ({
      name: `${item.product.name} — ${item.size.label}${item.milk.id !== 'whole' ? ', ' + item.milk.label : ''}`,
      qty: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      price: Number(item.unitPrice),
      productId: nullIfEmpty(item.product.id),
      sizeModifier: Number(item.size.priceModifier) || 0,
    }))
    .filter(item => item.productId && Number.isFinite(item.price) && item.price > 0);
}

function nullIfEmptyParam(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

async function createOrderService(sb, params) {
  const items = params.items.map(it => ({
    productId: nullIfEmptyParam(it.productId ?? null),
    name: String(it.name ?? ''),
    qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
    price: Number(it.price),
    ...(it.sizeModifier != null ? { sizeModifier: Number(it.sizeModifier) } : {}),
  })).filter(it => it.productId && Number.isFinite(it.price));

  if (items.length === 0) return { error: 'empty_cart (client filter)' };

  const { data, error } = await sb.rpc('create_order', {
    p_items: items,
    p_total: Number(params.total) || 0,
    p_store_id: nullIfEmptyParam(params.storeId ?? null),
    p_store_name: String(params.storeName ?? ''),
    p_order_type: params.orderType,
    p_payment_method: params.paymentMethod ?? 'cash',
    p_coupon_code: nullIfEmptyParam(params.couponCode ?? null),
    p_benefit_type: nullIfEmptyParam(params.benefitType ?? null),
    p_benefit_id: nullIfEmptyParam(params.benefitId ?? null),
  });

  if (error) return { error: [error.message, error.details, error.hint].filter(Boolean).join(' — ') };
  if (data?.error) return { error: data.detail ? `${data.error}: ${data.detail}` : data.error };
  return { orderNumber: data.order_number };
}

async function testRole(label, email, password) {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const login = await sb.auth.signInWithPassword({ email, password });
  if (login.error) {
    console.log(`✗ ${label} login:`, login.error.message);
    return;
  }

  const { data: products, error: pErr } = await sb.from('products').select('*').eq('in_stock', true).limit(3);
  if (pErr || !products?.length) {
    console.log(`✗ ${label} products:`, pErr?.message ?? 'none');
    return;
  }

  const { data: stores, error: sErr } = await sb.from('stores').select('*').order('name').limit(1);
  if (sErr || !stores?.length) {
    console.log(`✗ ${label} stores:`, sErr?.message ?? 'none');
    return;
  }

  const p = products[0];
  const sizes = p.sizes ?? [{ id: 'medium', label: 'Orta', priceModifier: 0 }];
  const milks = p.milks ?? [{ id: 'whole', label: 'Tam Yağlı', priceModifier: 0 }];
  const size = sizes.find(s => s.label === 'Büyük') ?? sizes[sizes.length - 1] ?? { label: 'Orta', priceModifier: 0 };
  const milk = milks[0] ?? { id: 'whole', label: 'Tam Yağlı', priceModifier: 0 };

  const unitPrice = Number(p.price) + Number(size.priceModifier ?? 0) + Number(milk.priceModifier ?? 0);
  const cart = [{
    id: `${p.id}-${Date.now()}-test`,
    product: p,
    size,
    milk,
    syrup: null,
    topping: null,
    temperature: { id: 'hot', label: 'Sıcak', priceModifier: 0 },
    iceLevel: 'Buz Yok',
    extraEspresso: 0,
    notes: '',
    quantity: 2,
    unitPrice,
  }];

  const items = mapCartItemsForCheckout(cart);
  console.log(`\n${label}:`);
  console.log('  product:', p.id, p.name, 'unitPrice:', unitPrice);
  console.log('  mapped items:', JSON.stringify(items));

  if (items.length === 0) {
    console.log(`✗ ${label}: mapCartItemsForCheckout returned empty (THIS IS THE BUG)`);
    return;
  }

  const store = stores[0];
  const prev = await sb.rpc('preview_checkout', {
    p_items: items,
    p_store_id: store.id,
    p_coupon_code: null,
    p_benefit_type: null,
    p_benefit_id: null,
  });
  if (prev.error || prev.data?.error) {
    console.log(`✗ ${label} preview:`, prev.error?.message ?? prev.data?.error, prev.data?.detail ?? '');
    return;
  }
  console.log('  preview:', `sub=${prev.data.subtotal} disc=${prev.data.discount} total=${prev.data.total}`);

  const ord = await createOrderService(sb, {
    items,
    total: prev.data.total,
    storeId: store.id,
    storeName: store.name,
    orderType: 'pickup',
    paymentMethod: 'cash',
    couponCode: null,
    benefitType: null,
    benefitId: null,
  });
  if (ord.error) {
    console.log(`✗ ${label} create_order:`, ord.error);
    return;
  }
  console.log(`✓ ${label} order:`, ord.orderNumber);
}

async function main() {
  const roles = [
    ['franchise', process.env.SMOKE_FRANCHISE_EMAIL, process.env.SMOKE_FRANCHISE_PASSWORD],
    ['admin', process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD],
    ['super_admin', process.env.SMOKE_SUPER_ADMIN_EMAIL, process.env.SMOKE_SUPER_ADMIN_PASSWORD],
  ];
  for (const [label, email, password] of roles) {
    if (email && password) await testRole(label, email, password);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
