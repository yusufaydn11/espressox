#!/usr/bin/env node
/** Inspect staging product option shape — detect NaN unitPrice bugs */
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

const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: process.env.SMOKE_SUPER_ADMIN_EMAIL,
  password: process.env.SMOKE_SUPER_ADMIN_PASSWORD,
});

const { data: products } = await sb.from('products').select('id,name,price,sizes,milks,syrups,temperature').eq('in_stock', true).limit(10);
for (const p of products ?? []) {
  const size = p.sizes?.[0];
  const milk = p.milks?.[0];
  const syrup = p.syrups?.[0];
  const temp = p.temperature?.[0];
  const unit = Number(p.price)
    + Number(size?.priceModifier ?? size?.price_modifier ?? 0)
    + Number(milk?.priceModifier ?? milk?.price_modifier ?? 0)
    + Number(syrup?.priceModifier ?? syrup?.price_modifier ?? 0)
    + Number(temp?.priceModifier ?? temp?.price_modifier ?? 0);
  const bad = !Number.isFinite(unit) || unit <= 0;
  console.log(p.id, p.name, 'size keys:', size ? Object.keys(size).join(',') : 'NONE', 'unit=', unit, bad ? 'BAD' : 'OK');
}
