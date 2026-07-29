#!/usr/bin/env node
/** Lightweight HTTP E2E smoke — no browser required */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadEnv() {
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
loadEnv();

const CUSTOMER_URL = process.env.E2E_CUSTOMER_URL ?? 'http://localhost:8080';
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:4173';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(url, expect = 200) {
  const res = await fetch(url);
  return { ok: res.status === expect, status: res.status, html: await res.text() };
}

async function main() {
  console.log('\nHTTP E2E smoke\n');

  try {
    const c = await check(CUSTOMER_URL);
    record('Customer web loads', c.ok, `status=${c.status}`);
    record('Customer bundle present', c.html.includes('_expo/static') || c.html.includes('Espresso'), c.ok ? 'ok' : 'missing assets');
  } catch (e) {
    record('Customer web loads', false, e.message);
  }

  try {
    const a = await check(ADMIN_URL);
    record('Admin web loads', a.ok, `status=${a.status}`);
    record('Admin login UI', a.html.includes('Panele Giriş') || a.html.includes('Merkez Yönetim'), a.ok ? 'ok' : 'missing');
  } catch (e) {
    record('Admin web loads', false, e.message);
  }

  const fail = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} passed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
