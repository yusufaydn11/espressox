#!/usr/bin/env node
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
for (const [label, email, pass] of [
  ['anon', null, null],
  ['franchise', process.env.SMOKE_FRANCHISE_EMAIL, process.env.SMOKE_FRANCHISE_PASSWORD],
]) {
  if (email) await sb.auth.signInWithPassword({ email, password: pass });
  else await sb.auth.signOut();
  const { data, error } = await sb.from('stores').select('id,name').order('name');
  console.log(label, error?.message ?? `count=${data?.length}`, data?.slice(0, 3).map(s => s.id).join(','));
}
