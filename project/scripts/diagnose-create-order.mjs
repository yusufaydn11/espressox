#!/usr/bin/env node
/** Diagnose create_order failures with app-realistic payloads */
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
const sb = createClient(url, anonKey, { auth: { persistSession: false } });

function mapCartItem(product, sizeLabel, sizeMod, unitPrice) {
  return {
    productId: product.id,
    name: `${product.name} — ${sizeLabel}`,
    qty: 1,
    price: unitPrice,
    sizeModifier: sizeMod,
  };
}

async function tryOrder(label, items, opts = {}) {
  const { data: stores } = await sb.from('stores').select('id, name').limit(1);
  const store = stores?.[0];
  if (!store) {
    console.log(`✗ ${label}: no store`);
    return;
  }
  const prev = await sb.rpc('preview_checkout', {
    p_items: items,
    p_store_id: store.id,
    p_coupon_code: opts.couponCode ?? null,
    p_benefit_type: opts.benefitType ?? null,
    p_benefit_id: opts.benefitId ?? null,
  });
  if (prev.error) {
    console.log(`✗ ${label} preview RPC:`, prev.error.message);
    return;
  }
  if (prev.data?.error) {
    console.log(`✗ ${label} preview:`, prev.data.error);
    return;
  }
  const ord = await sb.rpc('create_order', {
    p_items: items,
    p_total: prev.data.total,
    p_store_id: store.id,
    p_store_name: store.name,
    p_order_type: opts.orderType ?? 'pickup',
    p_payment_method: opts.paymentMethod ?? 'cash',
    p_coupon_code: opts.couponCode ?? null,
    p_benefit_type: opts.benefitType ?? null,
    p_benefit_id: opts.benefitId ?? null,
  });
  if (ord.error) {
    console.log(`✗ ${label} RPC:`, ord.error.message);
    return;
  }
  if (ord.data?.error) {
    console.log(`✗ ${label}:`, ord.data.error);
    return;
  }
  console.log(`✓ ${label}:`, ord.data.order_number);
}

async function main() {
  const email = process.env.SMOKE_CUSTOMER_EMAIL ?? process.env.SMOKE_SUPER_ADMIN_EMAIL;
  const password = process.env.SMOKE_CUSTOMER_PASSWORD ?? process.env.SMOKE_SUPER_ADMIN_PASSWORD;
  await sb.auth.signInWithPassword({ email, password });

  const { data: products } = await sb.from('products').select('id,name,price,sizes').eq('in_stock', true).limit(5);
  console.log('Products:', products?.map(p => `${p.id} ${p.name} ${p.price}`).join(', '));

  const p = products?.[0];
  if (!p) {
    console.log('No products');
    process.exit(1);
  }

  const largeMod = 10;
  const unitLarge = Number(p.price) + largeMod;

  await tryOrder('basic large', [mapCartItem(p, 'Büyük', largeMod, unitLarge)]);
  await tryOrder('delivery', [mapCartItem(p, 'Büyük', largeMod, unitLarge)], { orderType: 'delivery' });
  await tryOrder('bad coupon', [mapCartItem(p, 'Küçük', 0, Number(p.price))], { couponCode: 'INVALID999' });
  await tryOrder('tier_perk bronz', [mapCartItem(p, 'Büyük', largeMod, unitLarge)], {
    benefitType: 'tier_perk',
    benefitId: 'tier_size_upgrade',
  });

  const { data: benefits } = await sb.rpc('get_checkout_benefits', { p_store_id: null });
  console.log('Benefits:', JSON.stringify(benefits?.benefits ?? []));

  for (const b of benefits?.benefits ?? []) {
    await tryOrder(`benefit ${b.type}/${b.id}`, [mapCartItem(p, 'Büyük', largeMod, unitLarge)], {
      benefitType: b.type,
      benefitId: b.id,
    });
  }

  // Coffee bag 500g if exists
  const bag = products?.find(x => Array.isArray(x.sizes) && x.sizes.some(s => s.priceModifier > 100));
  if (bag) {
    const big = bag.sizes.find(s => s.priceModifier > 100);
    const price = Number(bag.price) + Number(big.priceModifier);
    await tryOrder('high modifier product', [{
      productId: bag.id,
      name: `${bag.name} — ${big.label}`,
      qty: 1,
      price,
      sizeModifier: big.priceModifier,
    }]);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
