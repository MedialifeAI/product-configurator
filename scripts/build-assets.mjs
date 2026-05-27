/**
 * Optimize every GLB under public/models → public/models-optimized
 * (Draco geometry, Meshopt vertices, WebP textures, dedupe, prune).
 *
 * Usage: npm run build:assets
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, meshopt, prune, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'models');
const DST = join(root, 'public', 'models-optimized');

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.encoder': MeshoptEncoder,
  });

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.error(`Source directory missing: ${dir}`);
    console.error('Place GLBs under public/models/ then re-run.');
    process.exit(1);
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.glb')) yield p;
  }
}

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const rows = [];

for await (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const dst = join(DST, rel);
  await mkdir(dirname(dst), { recursive: true });

  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    draco({ method: 'edgebreaker', quantizePositionBits: 14 }),
  );
  await io.write(dst, doc);

  const [a, b] = await Promise.all([stat(src), stat(dst)]);
  rows.push({ file: rel, before: a.size, after: b.size });
}

if (rows.length === 0) {
  console.warn('No GLBs found under public/models/');
  process.exit(0);
}

console.table(
  rows.map((r) => ({
    file: r.file,
    before: fmt(r.before),
    after: fmt(r.after),
    delta: `${((1 - r.after / r.before) * 100).toFixed(0)}%`,
  })),
);
