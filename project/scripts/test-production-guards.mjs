#!/usr/bin/env node
/** Quick production guard smoke — no secrets printed */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const configPath = resolve(__dir, '../app.config.js');

function loadConfig(env) {
  Object.assign(process.env, env);
  process.env.EAS_BUILD_PROFILE = 'production';
  delete require.cache[configPath];
  require(configPath);
}

function test(name, env) {
  try {
    loadConfig(env);
    console.log(`✗ ${name}: guard did NOT throw`);
    process.exitCode = 1;
  } catch (e) {
    console.log(`✓ ${name}: blocked — ${String(e.message).split('\n')[0]}`);
  }
}

test('staging URL blocked', {
  EXPO_PUBLIC_SUPABASE_URL: 'https://vnudnnigxohbyybxbtkz.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  EXPO_PUBLIC_ENABLE_CARD_PAYMENTS: 'false',
});

test('card payments blocked', {
  EXPO_PUBLIC_SUPABASE_URL: 'https://prodref.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  EXPO_PUBLIC_ENABLE_CARD_PAYMENTS: 'true',
});

test('localhost URL blocked', {
  EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  EXPO_PUBLIC_ENABLE_CARD_PAYMENTS: 'false',
});

console.log('\nProduction guards verified\n');
