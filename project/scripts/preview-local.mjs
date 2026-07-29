#!/usr/bin/env node
/**
 * Production-build preview for local review (no new features).
 * Usage: node scripts/preview-local.mjs
 *
 * Customer web  → http://localhost:8080
 * Admin panel   → http://localhost:4173
 */
import { spawn } from 'node:child_process';
import { existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const adminWeb = join(root, 'admin-web');
const customerOut = join(root, 'dist-preview');

function run(cmd, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  console.log('\n☕ Espresso X — Production Preview Setup\n');

  if (!existsSync(join(adminWeb, '.env')) && existsSync(join(adminWeb, '.env.production'))) {
    copyFileSync(join(adminWeb, '.env.production'), join(adminWeb, '.env'));
    console.log('✓ admin-web/.env created from .env.production');
  }

  if (existsSync(customerOut)) {
    try {
      rmSync(customerOut, { recursive: true, force: true });
    } catch {
      console.warn('⚠ dist-preview temizlenemedi — devam ediliyor');
    }
  }

  console.log('→ Building customer web (expo export)…');
  await run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-preview'], root);

  console.log('→ Building admin panel (vite)…');
  await run('npm', ['run', 'build'], adminWeb);

  console.log('\n✓ Builds complete. Starting preview servers…\n');
  console.log('  Customer (müşteri):  http://localhost:8080');
  console.log('  Admin (HQ panel):    http://localhost:4173');
  console.log('  Ağ (admin):          http://<LAN-IP>:4173\n');
  console.log('Giriş: staging Supabase hesaplarınız (.env içindeki SMOKE_* veya kendi admin hesabınız)\n');
  console.log('Durdurmak için Ctrl+C\n');

  const customer = spawn('npx', ['serve', 'dist-preview', '-l', '8080', '--no-clipboard'], {
    cwd: root, stdio: 'inherit', shell: true,
  });
  const admin = spawn('npm', ['run', 'preview', '--', '--host', '0.0.0.0', '--port', '4173'], {
    cwd: adminWeb, stdio: 'inherit', shell: true,
  });

  const shutdown = () => { customer.kill(); admin.kill(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
