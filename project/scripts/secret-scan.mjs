#!/usr/bin/env node
/**
 * Scan tracked source files for accidental secret patterns.
 * Does not read .env, google-services.json, credentials/, or dist/.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-new', 'dist-v3', '.git', 'credentials',
  '.temp', '.expo',
]);

const SKIP_FILES = new Set([
  '.env', 'google-services.json', 'secret-scan.mjs',
]);

const SKIP_PATH_PARTS = ['admin-web/.env.production', '.env.example'];

const PATTERNS = [
  { name: 'JWT token', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
  { name: 'service_role key label', re: /service_role['"]?\s*[:=]\s*['"]?[A-Za-z0-9+/=]{20,}/i },
  { name: 'Supabase service role env assignment', re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/ },
  { name: 'Iyzico secret assignment', re: /IYZICO_(API|SECRET)_KEY\s*=\s*(?!['"]?\s*$|<|\{)[^\s#]+/i },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (SKIP_DIRS.has(name)) continue;
    if (SKIP_PATH_PARTS.some(p => rel.includes(p))) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (SKIP_FILES.has(name)) continue;
    if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|mp4|zip|pdf)$/i.test(name)) continue;
    out.push(full);
  }
  return out;
}

const hits = [];

for (const file of walk(root)) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(root, file).replace(/\\/g, '/');
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      hits.push({ file: rel, pattern: name });
    }
  }
}

console.log('\n=== SECRET SCAN (tracked source only) ===\n');

if (hits.length === 0) {
  console.log('✅ No secret patterns detected in scanned files.\n');
  process.exit(0);
}

for (const h of hits) {
  console.log(`✗ ${h.file} — possible ${h.pattern}`);
}
console.log(`\n${hits.length} finding(s). Review before commit.\n`);
process.exit(1);
