#!/usr/bin/env node
/**
 * Pre-flight check for EAS production builds.
 * Fails if staging Supabase is wired, card payments enabled, or required vars missing.
 *
 * Usage:
 *   EAS_BUILD_PROFILE=production EXPO_PUBLIC_SUPABASE_URL=... node scripts/validate-production-env.mjs
 *   npm run validate:production-env -- --profile production
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

/** Known staging project ref — production builds must not use this. */
const STAGING_PROJECT_REF = 'vnudnnigxohbyybxbtkz';

const LOCALHOST_PATTERNS = ['localhost', '127.0.0.1', '192.168.', '10.0.2.2'];
const PLACEHOLDER_URL_PATTERNS = ['example.com', 'your_url', 'placeholder', 'todo', 'replace_with'];

function isPlaceholderUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return PLACEHOLDER_URL_PATTERNS.some(p => lower.includes(p));
}

function checkPublicUrls(isProduction) {
  if (!isProduction) return;
  for (const [name, value] of [
    ['EXPO_PUBLIC_PRIVACY_POLICY_URL', process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? ''],
    ['EXPO_PUBLIC_SUPPORT_URL', process.env.EXPO_PUBLIC_SUPPORT_URL ?? ''],
    ['EXPO_PUBLIC_TERMS_URL', process.env.EXPO_PUBLIC_TERMS_URL ?? ''],
  ]) {
    if (!value) continue;
    if (isPlaceholderUrl(value)) {
      fail(`${name} contains placeholder value — set a real HTTPS URL in EAS production secrets.`);
    }
    for (const p of LOCALHOST_PATTERNS) {
      if (value.includes(p)) {
        fail(`${name} must not contain "${p}" in production builds.`);
      }
    }
    if (!value.startsWith('https://')) {
      warn(`${name} should use HTTPS for store compliance.`);
    }
  }
}

function loadDotEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let profile = process.env.EAS_BUILD_PROFILE ?? '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) profile = args[++i];
  }
  return profile;
}

function fail(msg) {
  console.error(`\n❌ Production env validation FAILED:\n   ${msg}\n`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

loadDotEnv();
const profile = parseArgs();
const isProduction = profile === 'production';

console.log(`\n=== Production Env Validation (profile: ${profile || 'local'}) ===\n`);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const cardPayments = process.env.EXPO_PUBLIC_ENABLE_CARD_PAYMENTS ?? 'false';
const easProjectId = process.env.EAS_PROJECT_ID ?? '';
const maintenance = process.env.EXPO_PUBLIC_MAINTENANCE_MODE ?? 'false';

if (cardPayments === 'true') {
  fail('EXPO_PUBLIC_ENABLE_CARD_PAYMENTS must not be "true" for store release (iyzico FAZ1 blocked).');
}
pass('Card payments disabled (EXPO_PUBLIC_ENABLE_CARD_PAYMENTS != true)');

if (isProduction) {
  if (!supabaseUrl) {
    fail('EXPO_PUBLIC_SUPABASE_URL is required for production builds. Set via EAS environment secrets.');
  }
  if (!anonKey) {
    fail('EXPO_PUBLIC_SUPABASE_ANON_KEY is required for production builds. Set via EAS environment secrets.');
  }
  if (supabaseUrl.includes(STAGING_PROJECT_REF)) {
    fail('Production build blocked: EXPO_PUBLIC_SUPABASE_URL points to staging Supabase project.');
  }
  for (const p of LOCALHOST_PATTERNS) {
    if (supabaseUrl.includes(p)) {
      fail(`Production build blocked: EXPO_PUBLIC_SUPABASE_URL contains "${p}".`);
    }
  }
  pass('Supabase URL present and not staging/localhost');

  if (!easProjectId) {
    warn('EAS_PROJECT_ID not set — push token registration will be skipped until configured.');
  } else {
    pass('EAS_PROJECT_ID configured');
  }

  if (maintenance === 'true') {
    warn('EXPO_PUBLIC_MAINTENANCE_MODE is true — production users will see maintenance screen.');
  }

  for (const smokeKey of Object.keys(process.env).filter(k => k.startsWith('SMOKE_'))) {
    if (process.env[smokeKey]) {
      fail(`Production build blocked: ${smokeKey} must not be set in production environment.`);
    }
  }

  for (const iyzicoKey of ['IYZICO_API_KEY', 'IYZICO_SECRET_KEY']) {
    if (process.env[iyzicoKey]) {
      fail(`Production build blocked: ${iyzicoKey} must only exist in Supabase Edge secrets, not client env.`);
    }
  }

  for (const [name, value] of [
    ['EXPO_PUBLIC_PRIVACY_POLICY_URL', process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? ''],
    ['EXPO_PUBLIC_TERMS_URL', process.env.EXPO_PUBLIC_TERMS_URL ?? ''],
  ]) {
    if (!value) {
      warn(`${name} not set — store submission requires hosted HTTPS URL in EAS production secrets.`);
    }
  }

  checkPublicUrls(true);
} else {
  if (supabaseUrl.includes(STAGING_PROJECT_REF)) {
    pass('Non-production profile may use staging Supabase');
  } else if (supabaseUrl) {
    pass('Supabase URL configured');
  } else {
    warn('EXPO_PUBLIC_SUPABASE_URL not set (OK for local dev without backend)');
  }
}

console.log('\n✅ Production env validation passed.\n');
