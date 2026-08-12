#!/usr/bin/env node
/** Fix Windows backslashes in expo web export index.html (breaks some static servers). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const dir of ['dist', 'dist-preview', 'dist-v3']) {
  const htmlPath = resolve(root, dir, 'index.html');
  if (!existsSync(htmlPath)) continue;
  const fixed = readFileSync(htmlPath, 'utf8').replace(/\\/g, '/');
  writeFileSync(htmlPath, fixed);
  console.log(`✓ Fixed paths in ${dir}/index.html`);
}
