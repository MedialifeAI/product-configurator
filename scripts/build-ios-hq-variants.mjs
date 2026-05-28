// Build medium-high and extra-high quality iOS GLB variants of
// watch_full_default.glb for direct visual comparison.
//
// Quality tiers (all vs original 7.2M triangles):
//   models-ios/     (existing) — 500K  triangles — ultra-low, crash-safe
//   models-ios-mh/  (this)    — 1.5M  triangles — medium-high, balanced
//   models-ios-xh/  (this)    — 3M    triangles — extra-high, near-original
//
// Run:  node scripts/build-ios-hq-variants.mjs

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const SRC = 'public/models/full_watch/watch_full_default.glb';

// [destination directory, target triangle count, label]
const VARIANTS = [
  ['public/models-ios-mh/full_watch/watch_full_default.glb', 1_500_000, 'medium-high (1.5M)'],
  ['public/models-ios-xh/full_watch/watch_full_default.glb', 3_000_000, 'extra-high  (3.0M)'],
];

await MeshoptSimplifier.ready;
const decoder = await draco3d.createDecoderModule();
const encoder = await draco3d.createEncoderModule();

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': decoder,
    'draco3d.encoder': encoder,
  });

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

// Read the source once, process separate clones per variant.
console.log(`\nSource: ${SRC}`);
const srcStat = await stat(SRC);
console.log(`Source size: ${fmtMB(srcStat.size)}`);

for (const [dst, targetTris, label] of VARIANTS) {
  process.stdout.write(`\nBuilding ${label} → ${dst} … `);
  await mkdir(dirname(dst), { recursive: true });

  // Read a fresh document for each variant so transforms don't compound.
  const doc = await io.read(SRC);
  const trisBefore = countTriangles(doc);
  const ratio = Math.min(1, targetTris / trisBefore);

  await doc.transform(
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005, lockBorder: true }),
    dedup(),
    prune(),
    draco({ method: 'edgebreaker', quantizePositionBits: 14, quantizeNormalBits: 10, quantizeTexcoordBits: 12 }),
  );

  await io.write(dst, doc);
  const trisAfter = countTriangles(doc);
  const dstStat = await stat(dst);

  console.log('done');
  console.log(`  Triangles : ${fmt(trisBefore)} → ${fmt(trisAfter)} (${((1 - trisAfter / trisBefore) * 100).toFixed(0)}% reduction)`);
  console.log(`  File size : ${fmtMB(srcStat.size)} → ${fmtMB(dstStat.size)}`);
  const vramSavedMB = ((trisBefore - trisAfter) * (12 + 16) / 1024 / 1024).toFixed(0);
  console.log(`  VRAM saved: ~${vramSavedMB} MB vs original`);
}

console.log('\n──────────────────────────────────────────────────');
console.log('Summary of all watch_full_default.glb iOS variants:');
console.log('  models-ios/    ultra-low   ~500K  tris  — crash-safe for all iPhones');
console.log('  models-ios-mh/ medium-high ~1.5M  tris  — good balance, test on iPhone');
console.log('  models-ios-xh/ extra-high  ~3.0M  tris  — near-original, newer iPhones only');
console.log('\nTo compare variants, add ?variant=ios-mh or ?variant=ios-xh to your dev URL');
console.log('(you\'ll need to wire those variant keys to resolveModelUrl if you want to ship them).');
