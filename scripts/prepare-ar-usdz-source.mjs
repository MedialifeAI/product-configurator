/**
 * Strip skins/animations from AR GLB so leon/usd-from-gltf can convert without rig errors.
 * Usage: node scripts/prepare-ar-usdz-source.mjs [src.glb] [out.glb]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, process.argv[2] ?? 'public/models/full_watch/watch_full_ar.glb');
const out = path.resolve(
  root,
  process.argv[3] ?? '.cache-compress/watch_full_ar_usdz.glb',
);

if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
const doc = await io.read(src);
const rootNode = doc.getRoot();

for (const node of rootNode.listNodes()) {
  node.setSkin(null);
}
for (const skin of [...rootNode.listSkins()]) {
  skin.dispose();
}
for (const animation of [...rootNode.listAnimations()]) {
  animation.dispose();
}

await doc.transform(dedup(), prune());

fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);

const inMb = (fs.statSync(src).size / (1024 * 1024)).toFixed(2);
const outMb = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
console.log(`Prepared ${path.relative(root, out)} (${inMb} MB → ${outMb} MB, skins/animations removed)`);
