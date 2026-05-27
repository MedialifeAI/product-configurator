/**
 * GLB → USDZ for iOS Quick Look via Docker (leon/usd-from-gltf).
 * Strips skins/animations first — rigged GLBs trigger ASSERT(parent_ujoint_i) in the converter.
 * Usage: node scripts/build-usdz.mjs [src.glb] [out.usdz]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawSrc = path.resolve(root, process.argv[2] ?? 'public/models/full_watch/watch_full_ar.glb');
const out = path.resolve(root, process.argv[3] ?? 'public/models/full_watch/watch_full_ar.usdz');
const prepOut = path.join(root, '.cache-compress', 'watch_full_ar_usdz.glb');

if (!fs.existsSync(rawSrc)) {
  console.error('Source not found:', rawSrc);
  console.error('Run `npm run compress:ar` first to create watch_full_ar.glb');
  process.exit(1);
}

const prep = spawnSync(
  process.execPath,
  ['scripts/prepare-ar-usdz-source.mjs', rawSrc, prepOut],
  { stdio: 'inherit', cwd: root },
);
if (prep.status !== 0) {
  process.exit(prep.status ?? 1);
}

const src = prepOut;

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
