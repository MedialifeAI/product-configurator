/**
 * GLB → USDZ for iOS Quick Look via Docker (leon/usd-from-gltf).
 * Usage: node scripts/build-usdz.mjs [src.glb] [out.usdz]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, process.argv[2] ?? 'public/models/full_watch/watch_full_ar.glb');
const out = path.resolve(root, process.argv[3] ?? 'public/models/full_watch/watch_full_ar.usdz');

if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  console.error('Run `npm run compress:ar` first to create watch_full_ar.glb');
  process.exit(1);
}

const docker = spawnSync(
  'docker',
  [
    'run', '--rm',
    '-v', `${root}:/work`,
    '-w', '/work',
    'leon/usd-from-gltf:latest',
    path.relative(root, src).replace(/\\/g, '/'),
    path.relative(root, out).replace(/\\/g, '/'),
  ],
  { stdio: 'inherit', cwd: root },
);

if (docker.status !== 0) {
  console.error('\nUSDZ build failed. Install Docker Desktop and retry, or run scripts/build-usdz.sh from WSL.');
  process.exit(docker.status ?? 1);
}

const bytes = fs.statSync(out).size;
console.log(`Wrote ${path.relative(root, out)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
