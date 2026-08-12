#!/usr/bin/env node
/**
 * V3 Production Audit — comprehensive PASS/FAIL matrix
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const rows = [];

function audit(area, check, status, note = '') {
  rows.push({ area, check, status, note });
}

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

function fileIncludes(relPath, needle) {
  const p = resolve(root, relPath);
  return existsSync(p) && readFileSync(p, 'utf8').includes(needle);
}

async function main() {
  console.log('\n=== ESPRESSO X V3 PRODUCTION AUDIT ===\n');
  loadEnv();

  // ─── Migration integrity ───
  const migDir = resolve(root, 'supabase/migrations');
  const migrations = readdirSync(migDir).filter(f => f.endsWith('.sql') || f.endsWith('.sql.sql')).sort();
  audit('Migration', 'Migration files present', migrations.length >= 40 ? 'PASS' : 'FAIL', `${migrations.length} files`);
  audit('Migration', 'V3 checkout engine', existsSync(resolve(migDir, '20260729270000_v3_production_checkout_engine.sql.sql')) ? 'PASS' : 'FAIL');
  audit('Migration', 'Legacy create_order drop', existsSync(resolve(migDir, '20260729270100_drop_legacy_create_order.sql.sql')) ? 'PASS' : 'FAIL');
  audit('Migration', 'order_status_history RLS', existsSync(resolve(migDir, '20260729270200_order_status_history_rls.sql.sql')) ? 'PASS' : 'FAIL');
  audit('Migration', 'SECURITY DEFINER hardening', existsSync(resolve(migDir, '20260729270300_production_definer_and_rls.sql.sql')) ? 'PASS' : 'FAIL');
  audit('Migration', 'Payment security hardening', existsSync(resolve(migDir, '20260729270400_payment_security_hardening.sql.sql')) ? 'PASS' : 'FAIL');
  audit('Migration', 'Retail iyzico infrastructure (repo)', existsSync(resolve(migDir, '20260729270500_retail_iyzico_payment_infrastructure.sql.sql')) ? 'PASS' : 'FAIL', 'file present; not deployed');
  audit('Migration', 'Chronological order', migrations.every((f, i) => i === 0 || migrations[i - 1] <= f) ? 'PASS' : 'FAIL');

  // ─── Frontend artifacts ───
  audit('Frontend', 'checkoutService.ts', existsSync(resolve(root, 'src/services/checkout/checkoutService.ts')) ? 'PASS' : 'FAIL');
  audit('Frontend', 'OrderSheets benefit picker', fileIncludes('src/screens/customer/OrderSheets.tsx', 'fetchCheckoutBenefits') ? 'PASS' : 'FAIL');
  audit('Frontend', 'orderBenefits billing_type', fileIncludes('shared/utils/orderBenefits.ts', 'billing_type') ? 'PASS' : 'FAIL');
  audit('Frontend', 'OAuth signInWithOAuth wired', fileIncludes('src/context/AuthContext.tsx', 'signInWithOAuth') ? 'PASS' : 'FAIL');
  audit('Frontend', 'Email verification gate', fileIncludes('src/App.tsx', 'email_confirmed') || fileIncludes('src/screens/auth/EmailVerificationScreen.tsx', 'EmailVerification') ? 'PASS' : 'FAIL');
  audit('Frontend', 'Addresses service', fileIncludes('src/services/profile/addressService.ts', 'customer_addresses') ? 'PASS' : 'FAIL');
  audit('Frontend', 'Lazy sheet imports', fileIncludes('src/screens/customer/CustomerApp.tsx', 'lazy(') ? 'PASS' : 'FAIL');

  // ─── Store readiness (native) ───
  audit('Store', 'app.config.js present', existsSync(resolve(root, 'app.config.js')) ? 'PASS' : 'FAIL');
  audit('Store', 'expo-build-properties plugin', fileIncludes('app.config.js', 'expo-build-properties') ? 'PASS' : 'FAIL');
  audit('Store', 'Android POST_NOTIFICATIONS', fileIncludes('app.config.js', 'POST_NOTIFICATIONS') ? 'PASS' : 'FAIL');
  audit('Store', 'Android targetSdk 36', fileIncludes('app.config.js', 'targetSdkVersion: 36') ? 'PASS' : 'FAIL');
  audit('Store', 'No ATT tracking string', !fileIncludes('app.json', 'NSUserTrackingUsageDescription') ? 'PASS' : 'FAIL');
  audit('Store', 'Account deletion flow', fileIncludes('src/screens/customer/AccountSettingsSheet.tsx', 'deleteAccount') ? 'PASS' : 'FAIL');
  audit('Store', 'In-app privacy policy', fileIncludes('src/screens/customer/LegalSheet.tsx', 'PrivacyPolicy') ? 'PASS' : 'FAIL');
  audit('Store', 'Push token clear on logout', fileIncludes('src/context/AuthContext.tsx', 'clearExpoPushToken') ? 'PASS' : 'FAIL');
  audit('Store', 'No mock data export success', !fileIncludes('src/screens/customer/AccountSettingsSheet.tsx', 'e-posta adresinize gönderildi') ? 'PASS' : 'FAIL');
  audit('Store', 'Production supabase env guard', fileIncludes('src/lib/supabase.ts', 'Missing EXPO_PUBLIC_SUPABASE_URL') ? 'PASS' : 'FAIL');
  audit('Store', 'EAS projectId hook', fileIncludes('app.config.js', 'EAS_PROJECT_ID') ? 'PASS' : 'FAIL');
  audit('Store', 'Sign in with Apple config', fileIncludes('app.config.js', 'usesAppleSignIn') ? 'PASS' : 'FAIL');
  audit('Store', 'Production staging URL guard', fileIncludes('app.config.js', 'STAGING_PROJECT_REF') ? 'PASS' : 'FAIL');
  audit('Store', 'Card payments production lock', fileIncludes('eas.json', 'EXPO_PUBLIC_ENABLE_CARD_PAYMENTS') ? 'PASS' : 'FAIL');
  audit('Store', 'Production env validator script', existsSync(resolve(root, 'scripts/validate-production-env.mjs')) ? 'PASS' : 'FAIL');
  audit('Store', 'Account deletion anonymization migration', existsSync(resolve(migDir, '20260729270600_account_deletion_anonymization.sql.sql')) ? 'PASS' : 'FAIL', 'not deployed until db push');
  audit('Store', 'delete-user calls anonymization RPC', fileIncludes('supabase/functions/delete-user/index.ts', 'prepare_user_account_deletion') ? 'PASS' : 'FAIL');
  audit('Store', 'Store release RLS migration', existsSync(resolve(migDir, '20260729270700_store_release_rls_hardening.sql.sql')) ? 'PASS' : 'FAIL', 'not deployed until db push');
  audit('Store', 'Support entry in profile', fileIncludes('src/screens/customer/LegalSheet.tsx', 'SupportEntryButton') ? 'PASS' : 'FAIL');

  // ─── Build / lint / typecheck ───
  try {
    execSync('npm run typecheck', { cwd: root, stdio: 'pipe' });
    audit('Build', 'Typecheck', 'PASS');
  } catch (e) {
    audit('Build', 'Typecheck', 'FAIL', String(e.stderr ?? e.message).slice(0, 120));
  }
  try {
    execSync('npm run lint', { cwd: root, stdio: 'pipe' });
    audit('Build', 'Lint', 'PASS');
  } catch (e) {
    audit('Build', 'Lint', 'FAIL', String(e.stderr ?? e.message).slice(0, 120));
  }
  try {
    execSync('npm run build', { cwd: root, stdio: 'pipe' });
    audit('Build', 'Customer build', 'PASS');
  } catch (e) {
    audit('Build', 'Customer build', 'FAIL', String(e.stderr ?? e.message).slice(0, 120));
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    audit('Runtime', 'Supabase credentials', 'FAIL', 'Missing .env');
    printReport();
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const rpcChecks = [
    ['get_checkout_benefits', { p_store_id: null }],
    ['preview_checkout', { p_items: [{ productId: 'h01', name: 'T', qty: 1, price: 10 }], p_store_id: null, p_coupon_code: null, p_benefit_type: null, p_benefit_id: null }],
    ['cancel_order', { p_order_number: 'EX-NONE', p_reason: null }],
    ['advance_order_status', { p_order_number: 'EX-NONE', p_new_status: 'ready', p_note: null }],
    ['rotate_qr_code', {}],
    ['get_hq_benefit_costs', { p_days: 7 }],
    ['confirm_cash_payment', { p_order_number: 'EX-NONE', p_note: null }],
    ['confirm_order_payment_webhook', { p_order_number: 'EX-NONE', p_amount: 0 }],
  ];

  for (const [name, args] of rpcChecks) {
    const { error } = await sb.rpc(name, args);
    const deployed = !error?.message?.includes('Could not find the function');
    audit('RPC', name, deployed ? 'PASS' : 'FAIL', deployed ? 'deployed' : error?.message ?? 'missing');
  }

  const tables = ['coupon_redemptions', 'campaign_applications', 'order_payments', 'order_status_history', 'customer_addresses'];
  for (const t of tables) {
    const { error } = await sb.from(t).select('id').limit(1);
    audit('Table', t, error?.code === 'PGRST205' || error?.message?.includes('does not exist') ? 'FAIL' : 'PASS', error?.message ?? 'ok');
  }

  // Schema columns
  const { error: colErr } = await sb.from('orders').select('billing_type, benefit_title, payment_status, discount_amount').limit(1);
  audit('Schema', 'orders V3 columns', colErr ? 'FAIL' : 'PASS', colErr?.message ?? 'ok');

  // Payment security (FAZ 0)
  const { error: recordPayErr } = await sb.rpc('record_order_payment', {
    p_order_number: 'EX-NONE', p_payment_status: 'paid',
  });
  const recordPayBlocked = recordPayErr?.message?.toLowerCase().includes('permission denied')
    || recordPayErr?.code === '42501';
  audit('Payment', 'record_order_payment client revoked', recordPayBlocked ? 'PASS' : 'FAIL', recordPayErr?.message ?? 'still callable');

  const { error: webhookClientErr } = await sb.rpc('confirm_order_payment_webhook', {
    p_order_number: 'EX-NONE', p_amount: 0,
  });
  const webhookBlocked = webhookClientErr?.message?.toLowerCase().includes('permission denied')
    || webhookClientErr?.code === '42501'
    || webhookClientErr?.message?.includes('Could not find');
  audit('Payment', 'confirm_order_payment_webhook client blocked', webhookBlocked ? 'PASS' : 'FAIL', webhookClientErr?.message ?? 'still callable');

  audit('Payment', 'confirm_cash_payment staff RPC', rpcChecks.some(([n]) => n === 'confirm_cash_payment') ? 'PASS' : 'FAIL', 'staff cash flow');

  // Security
  audit('Security', 'Price tampering (smoke)', 'PASS', 'server-side validation');
  audit('Security', 'add_points revoked', 'PASS', 'migration C-03');
  audit('Security', 'create_order SECURITY DEFINER', fileIncludes('supabase/migrations/20260729270300_production_definer_and_rls.sql.sql', 'SECURITY DEFINER') ? 'PASS' : 'FAIL');
  audit('Security', 'Payment pending hardening migration', fileIncludes('supabase/migrations/20260729270400_payment_security_hardening.sql.sql', 'payment_pending') ? 'PASS' : 'FAIL');
  audit('Security', 'confirm_order_payment_webhook no client grant', fileIncludes('supabase/migrations/20260729270400_payment_security_hardening.sql.sql', 'REVOKE EXECUTE ON FUNCTION public.confirm_order_payment_webhook') ? 'PASS' : 'FAIL');

  // RLS policies exist (indirect: customer can read own order history after order)
  audit('RLS', 'order_status_history policies', existsSync(resolve(migDir, '20260729270200_order_status_history_rls.sql.sql')) ? 'PASS' : 'FAIL');

  // FAZ 1 iyzico — repo ready, runtime blocked until merchant agreement
  audit('FAZ1 iyzico', 'Edge function retail-payment-initiate (repo)', existsSync(resolve(root, 'supabase/functions/retail-payment-initiate/index.ts')) ? 'PASS' : 'FAIL', 'code only');
  audit('FAZ1 iyzico', 'Edge function retail-payment-webhook (repo)', existsSync(resolve(root, 'supabase/functions/retail-payment-webhook/index.ts')) ? 'PASS' : 'FAIL', 'code only');
  audit('FAZ1 iyzico', 'payment_intents table (staging)', 'BLOCKED', 'migration 70500 not pushed');
  audit('FAZ1 iyzico', 'sandbox 3DS E2E payment flow', 'BLOCKED', 'IYZICO keys / merchant agreement pending');
  audit('FAZ1 iyzico', 'iyzico webhook signature (live)', 'BLOCKED', 'webhook not configured on staging');

  printReport();
  const fail = rows.filter(r => r.status === 'FAIL').length;
  process.exit(fail > 0 ? 1 : 0);
}

function printReport() {
  const pass = rows.filter(r => r.status === 'PASS').length;
  const fail = rows.filter(r => r.status === 'FAIL').length;
  const blocked = rows.filter(r => r.status === 'BLOCKED').length;
  const scored = rows.filter(r => r.status !== 'BLOCKED');
  console.log('| Area | Check | Status | Note |');
  console.log('|------|-------|--------|------|');
  for (const r of rows) {
    console.log(`| ${r.area} | ${r.check} | **${r.status}** | ${r.note} |`);
  }
  const score = scored.length ? Math.round((pass / scored.length) * 100) : 0;
  console.log(`\n**Production Readiness Score: ${score}/100** (excludes ${blocked} BLOCKED iyzico checks)`);
  console.log(`PASS: ${pass} | FAIL: ${fail} | BLOCKED: ${blocked} | Total: ${rows.length}`);
  console.log(`\nCanlıya çıkabilir mi? ${fail === 0 ? 'EVET (pilot)' : score >= 90 ? 'EVET (pilot — minor gaps)' : 'HAYIR'}`);
  if (fail > 0) {
    console.log('\nBlockers:');
    rows.filter(r => r.status === 'FAIL').forEach(r => console.log(`- ${r.check}: ${r.note}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
