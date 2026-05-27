/**
 * Verify metal-finish GLBs share identical geometry (position + indices).
 * Usage: node scripts/verify-metal-geometry.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const models = (...parts) => path.join(root, 'public', 'models', ...parts);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

async function geomHash(filePath) {
  const doc = await io.read(filePath);
  const h = createHash('sha256');
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) h.update(Buffer.from(pos.getArray().buffer));
      const idx = prim.getIndices();
      if (idx) h.update(Buffer.from(idx.getArray().buffer));
    }
  }
  return h.digest('hex');
}

const groups = {
  case: [
    models('case', 'case_rose_gold.glb'),
    models('case', 'case_white_gold.glb'),
    models('case', 'case_yellow_gold.glb'),
  ],
  case_body: [
    models('case_body', 'case_body_rose_gold.glb'),
    models('case_body', 'case_body_white_gold.glb'),
    models('case_body', 'case_body_yellow_gold.glb'),
  ],
  movement: [
    models('movement', 'movement_rose_gold.glb'),
    models('movement', 'movement_white_gold.glb'),
    models('movement', 'movement_yellow_gold.glb'),
  ],
  globe: [
    models('parts', 'globe_rose_gold.glb'),
    models('parts', 'globe_white_gold.glb'),
    models('parts', 'globe_yellow_gold.glb'),
  ],
};

let allIdentical = true;

for (const [name, files] of Object.entries(groups)) {
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) {
    console.log(`${name}: SKIPPED (missing ${missing.length} file(s))`);
    allIdentical = false;
    continue;
  }
  const hashes = await Promise.all(files.map(geomHash));
  const equal = hashes.every((h) => h === hashes[0]);
  console.log(`${name}: ${equal ? 'IDENTICAL ✓' : 'DIFFERENT ✗'}`);
  if (!equal) {
    allIdentical = false;
    hashes.forEach((h, i) => console.log(`  ${files[i]}: ${h.slice(0, 12)}`));
  }
}

process.exit(allIdentical ? 0 : 2);
