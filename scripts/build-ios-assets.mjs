// Build iOS-only decimated GLBs.
//
// Reads every .glb under public/models/, runs meshoptimizer's mesh simplifier
// to reduce triangle count, and writes the result to public/models-ios/.
// Originals are untouched — Android and desktop continue to load the
// full-detail assets.
//
// Why decimation (not Draco/Meshopt re-encoding):
//   - Draco / Meshopt only shrink bytes on disk + over the wire.
//   - Once decoded into a BufferGeometry on the GPU, memory is identical.
//   - iOS Safari kills tabs whose process memory exceeds ~250–500 MB.
//   - The actual fix is fewer triangles in memory, not fewer bytes shipped.
//
// Per-file target triangle counts are tuned for iPhone-screen viewing distance
// where >200K triangles per part is already over-rendered.
//
// Run:  node scripts/build-ios-assets.mjs

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const SRC_ROOT = 'public/models';
const DST_ROOT = 'public/models-ios';

// Per-file target triangle counts. Anything not listed defaults to 0.1 ratio.
// Values were picked so visible silhouette/edge detail stays sharp at typical
// iPhone screen-width (~390 CSS px, ~1170 device px) viewing distance.
const TARGETS = {
  'full_watch/watch_full_default.glb': 500_000,
  'full_watch/watch_full_ar.glb':      500_000,
  'movement/movement_rose_gold.glb':   250_000,
  'movement/movement_white_gold.glb':  250_000,
  'movement/movement_yellow_gold.glb': 250_000,
  'case/case_rose_gold.glb':           150_000,
  'case/case_white_gold.glb':          150_000,
  'case/case_yellow_gold.glb':         150_000,
  'case_body/case_body_rose_gold.glb':   100_000,
  'case_body/case_body_white_gold.glb':  100_000,
  'case_body/case_body_yellow_gold.glb': 100_000,
  'dragon/dragon_v1_imperial_rose_gold.glb': 200_000,
  'dragon/dragon_v2_sapphire_sky.glb':       200_000,
  'dragon/dragon_v3_white_gold.glb':         200_000,
  'dragon/dragon_v4_crimson_dragon.glb':     200_000,
  'parts/globe_rose_gold.glb':   30_000,
  'parts/globe_white_gold.glb':  30_000,
  'parts/globe_yellow_gold.glb': 30_000,
  'parts/dial.glb':  20_000,
  'parts/strap.glb': 15_000,
  'parts/globe.glb':  6_000,
  'parts/hand.glb':   2_500,
};

await MeshoptSimplifier.ready;
const decoder = await draco3d.createDecoderModule();
const encoder = await draco3d.createEncoderModule();

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': decoder,
    'draco3d.encoder': encoder,
  });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.toLowerCase().endsWith('.glb')) yield p;
  }
}

function countTriangles(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      if (idx) t += Math.floor(idx.getCount() / 3);
      else if (pos) t += Math.floor(pos.getCount() / 3);
    }
  }
  return t;
}

const fmt = (n) => n.toLocaleString();
const fmtMB = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const rows = [];

for await (const src of walk(SRC_ROOT)) {
  const rel = relative(SRC_ROOT, src).replace(/\\/g, '/');
  const dst = join(DST_ROOT, rel);
  await mkdir(dirname(dst), { recursive: true });

  const doc = await io.read(src);
  const trisBefore = countTriangles(doc);
  const target = TARGETS[rel] ?? Math.max(1000, Math.floor(trisBefore * 0.1));
  const ratio = trisBefore > 0 ? Math.min(1, target / trisBefore) : 1;

  // weld: merge duplicate vertices so simplify can collapse coherent surfaces.
  // simplify: meshoptimizer's quadric-error decimator. error=0.005 is loose
  //   enough to allow aggressive collapse on smooth surfaces but preserves
  //   silhouette edges.
  // dedup + prune: remove orphaned accessors/textures left behind.
  // draco: re-encode geometry compactly for transport.
  try {
    await doc.transform(
      weld({ tolerance: 0.0001 }),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005, lockBorder: true }),
      dedup(),
      prune(),
      draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 10, quantizeTexcoordBits: 12 }),
    );
  } catch (err) {
    rows.push({ file: rel, error: err.message });
    continue;
  }

  await io.write(dst, doc);
  const trisAfter = countTriangles(doc);
  const [sa, sb] = await Promise.all([stat(src), stat(dst)]);

  rows.push({
    file: rel,
    trisBefore: fmt(trisBefore),
    trisAfter:  fmt(trisAfter),
    triReduction: `${((1 - trisAfter / trisBefore) * 100).toFixed(0)}%`,
    fileBefore: fmtMB(sa.size),
    fileAfter:  fmtMB(sb.size),
    vramSavedMB: ((trisBefore - trisAfter) * 12 / 1024 / 1024 + (trisBefore - trisAfter) * 0.5 * 32 / 1024 / 1024).toFixed(1),
  });
}

console.table(rows);

const totals = rows.reduce(
  (a, r) => {
    if (r.error) return a;
    a.before += Number(r.trisBefore.replace(/,/g, ''));
    a.after  += Number(r.trisAfter.replace(/,/g, ''));
    return a;
  },
  { before: 0, after: 0 },
);

console.log(`\nTriangle totals: ${fmt(totals.before)} → ${fmt(totals.after)} ` +
  `(${((1 - totals.after / totals.before) * 100).toFixed(0)}% reduction)`);
console.log(`Estimated iOS GPU memory saved: ~${
  ((totals.before - totals.after) * 32 * 0.5 / 1024 / 1024).toFixed(0)
} MB (conservative)\n`);
console.log('iOS-only assets written to public/models-ios/. Originals untouched.');
