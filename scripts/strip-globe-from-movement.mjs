/**
 * Remove embedded "globe" nodes from movement GLBs (configurator loads globe separately).
 * Usage: node scripts/strip-globe-from-movement.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTS_ROOT =
  process.env.WATCH_PARTS_ROOT ??
  path.join(__dirname, '..', '..');
const OUT_DIR = path.join(PARTS_ROOT, 'movement', 'variants');

const GLOBE_NAMES = new Set(['globe', 'globe_earth']);

function isGlobeRoot(name) {
  if (!name) return false;
  if (GLOBE_NAMES.has(name)) return true;
  const lower = name.toLowerCase();
  return lower === 'globe' || lower === 'globe_earth';
}

function removeGlobeSubtree(node) {
  if (isGlobeRoot(node.getName())) {
    node.dispose();
    return true;
  }
  for (const child of [...node.listChildren()]) {
    if (removeGlobeSubtree(child)) {
      // child disposed
    }
  }
  return false;
}

async function stripMovement(inPath, outPath) {
  const io = new NodeIO();
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  for (const scene of root.listScenes()) {
    for (const child of [...scene.listChildren()]) {
      removeGlobeSubtree(child);
    }
  }

  await doc.transform(dedup(), prune());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await io.write(outPath, doc);

  const inMb = (fs.statSync(inPath).size / (1024 * 1024)).toFixed(1);
  const outMb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(1);
  return { inMb, outMb };
}

for (const metal of ['rose_gold', 'white_gold', 'yellow_gold']) {
  const file = path.join(OUT_DIR, `movement_${metal}.glb`);
  if (!fs.existsSync(file)) {
    console.warn('Skip missing', file);
    continue;
  }
  const tmp = path.join(OUT_DIR, `_movement_${metal}_no_globe.glb`);
  const { inMb, outMb } = await stripMovement(file, tmp);
  fs.renameSync(tmp, file);
  console.log(`movement_${metal}: ${inMb} MB → ${outMb} MB (globe stripped)`);
}
