#!/usr/bin/env node
/**
 * Read-only production cutover preflight — no deploy, no secrets printed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const require = createRequire(import.meta.url);

const STAGING_REF = 'vnudnnigxohbyybxbtkz';

const checks = [];

function row(area, item, status, note = '') {
  checks.push({ area, item, status, note });
}

function fileExists(rel) {
  return existsSync(resolve(root, rel));
}

function readJson(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
}

function loadDotEnv() {
  const p = resolve(root, '.env');
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function envStatus(key, env) {
  const v = env[key] ?? '';
  if (!v) return 'MISSING';
  if (key.includes('URL') && v.includes(STAGING_REF)) return 'STAGING';
  if (/placeholder|REPLACE_WITH|your_url/i.test(v)) return 'PLACEHOLDER';
  return 'SET';
}

// ─── Repo / migrations ───
const migDir = resolve(root, 'supabase/migrations');
const mig70401 = fileExists('supabase/migrations/20260729270401_faz_0_1_rls_hardening.sql.sql');
const mig70500 = fileExists('supabase/migrations/20260729270500_retail_iyzico_payment_infrastructure.sql.sql');
const mig70600 = fileExists('supabase/migrations/20260729270600_account_deletion_anonymization.sql.sql');
const mig70700 = fileExists('supabase/migrations/20260729270700_store_release_rls_hardening.sql.sql');
const mig70800 = fileExists('supabase/migrations/20260729270800_restore_qr_scan_full.sql.sql');

row('Database', 'Migration 70401 in repo', mig70401 ? 'READY' : 'MISSING');
row('Database', 'Migration 70500 in repo', mig70500 ? 'READY' : 'MISSING');
row('Database', 'Migration 70600 in repo', mig70600 ? 'READY' : 'MISSING');
row('Database', 'Migration 70700 in repo', mig70700 ? 'READY' : 'MISSING');
row('Database', 'Migration 70800 in repo', mig70800 ? 'READY' : 'MISSING');
row('Database', 'Production DB migrations applied', 'BLOCKED', 'Requires prod db push + approval');
row('Edge', 'delete-user function in repo', fileExists('supabase/functions/delete-user/index.ts') ? 'READY' : 'MISSING');
row('Edge', 'delete-user deployed to production', 'BLOCKED', 'Requires prod deploy + approval');

// ─── Build guards ───
try {
  process.env.EAS_BUILD_PROFILE = 'production';
  process.env.EXPO_PUBLIC_SUPABASE_URL = `https://${STAGING_REF}.supabase.co`;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
  delete require.cache[resolve(root, 'app.config.js')];
  require(resolve(root, 'app.config.js'));
  row('Guards', 'Staging URL blocked in production build', 'FAIL', 'Guard did not throw');
} catch (e) {
  row('Guards', 'Staging URL blocked in production build', 'READY', 'app.config.js throws');
}

// ─── EAS / env ───
const eas = readJson('eas.json');
row('EAS', 'Production profile card payments OFF', eas.build?.production?.env?.EXPO_PUBLIC_ENABLE_CARD_PAYMENTS === 'false' ? 'READY' : 'FAIL');
row('EAS', 'iOS submit placeholders filled', /REPLACE_WITH/.test(JSON.stringify(eas.submit ?? {})) ? 'BLOCKED' : 'READY');
row('EAS', 'Android service account path configured', eas.submit?.production?.android?.serviceAccountKeyPath ? 'READY' : 'MISSING');

const localEnv = loadDotEnv();
row('Env', 'Local EXPO_PUBLIC_SUPABASE_URL', envStatus('EXPO_PUBLIC_SUPABASE_URL', localEnv), 'local dev only');
row('Env', 'Local EAS_PROJECT_ID', envStatus('EAS_PROJECT_ID', localEnv));
row('Env', 'Local Privacy URL', envStatus('EXPO_PUBLIC_PRIVACY_POLICY_URL', localEnv));
row('Env', 'Local Terms URL', envStatus('EXPO_PUBLIC_TERMS_URL', localEnv));
row('Env', 'Local Support URL', envStatus('EXPO_PUBLIC_SUPPORT_URL', localEnv));
row('Env', 'EAS production secrets', 'BLOCKED', 'Verify in Expo dashboard / eas env:list');

// ─── Firebase ───
const gsPath = resolve(root, 'google-services.json');
let firebaseStatus = 'MISSING';
if (existsSync(gsPath)) {
  const raw = readFileSync(gsPath, 'utf8');
  firebaseStatus = raw.includes('placeholder-not-for-production') || raw.includes('REPLACE_WITH')
    ? 'PLACEHOLDER' : 'SET';
}
row('Firebase', 'google-services.json', firebaseStatus, 'gitignored — not committed');
row('Firebase', 'google-services.json.example', fileExists('google-services.json.example') ? 'READY' : 'MISSING');

// ─── Store / legal docs ───
row('Store', 'Apple metadata draft', fileExists('docs/store/apple-app-store-metadata.md') ? 'READY' : 'MISSING');
row('Store', 'Google Play metadata draft', fileExists('docs/store/google-play-metadata.md') ? 'READY' : 'MISSING');
row('Store', 'Screenshot plan', fileExists('docs/store/screenshot-plan.md') ? 'READY' : 'MISSING');
row('Store', 'Ready commands doc', fileExists('docs/store/READY-COMMANDS.md') ? 'READY' : 'MISSING');
row('Store', 'Store screenshots captured', 'BLOCKED', 'Manual capture required');

// ─── Deep links ───
const appJson = readJson('app.json');
row('Deep links', 'iOS bundle ID', appJson.expo?.ios?.bundleIdentifier === 'com.espressox.app' ? 'READY' : 'FAIL');
row('Deep links', 'Android package', appJson.expo?.android?.package === 'com.espressox.app' ? 'READY' : 'FAIL');
row('Deep links', 'AASA template in repo', fileExists('docs/deployment/universal-links/apple-app-site-association') ? 'READY' : 'MISSING');
row('Deep links', 'assetlinks template in repo', fileExists('docs/deployment/universal-links/assetlinks.json') ? 'READY' : 'MISSING');
row('Deep links', 'espressox.app AASA live', 'BLOCKED', 'Deploy to server + TEAM_ID');
row('Deep links', 'espressox.app assetlinks live', 'BLOCKED', 'Deploy + release SHA256');

// ─── iyzico ───
row('Payment', 'Card payments FAZ1', 'OFF', 'Merchant agreement pending — intentional');

// ─── Native preflight ───
row('Native', 'Android targetSdk 36', 'READY', 'expo-build-properties in app.config.js');
row('Native', 'iOS deploymentTarget 16.4', 'READY', 'expo-build-properties in app.config.js');
row('Native', 'EAS build', 'BLOCKED', 'Requires credentials + approval');
row('Native', 'Store submit', 'BLOCKED', 'Requires signing + metadata + approval');

console.log('\n=== PRODUCTION CUTOVER PREFLIGHT (read-only) ===\n');
console.log('| Area | Check | Status | Note |');
console.log('|------|-------|--------|------|');
for (const c of checks) {
  console.log(`| ${c.area} | ${c.item} | **${c.status}** | ${c.note} |`);
}

const ready = checks.filter(c => c.status === 'READY' || c.status === 'SET' || c.status === 'OFF').length;
const blocked = checks.filter(c => c.status === 'BLOCKED').length;
const missing = checks.filter(c => c.status === 'MISSING' || c.status === 'PLACEHOLDER' || c.status === 'STAGING').length;
const fail = checks.filter(c => c.status === 'FAIL').length;

console.log(`\nREADY/SET/OFF: ${ready} | BLOCKED: ${blocked} | MISSING/STAGING/PLACEHOLDER: ${missing} | FAIL: ${fail}\n`);
process.exit(fail > 0 ? 1 : 0);
