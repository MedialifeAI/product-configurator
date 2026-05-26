/**
 * Draco-compress hero + AR watch GLB (266 MB → ~15–40 MB).
 * Requires: npx @gltf-transform/cli
 *
 * Usage: npm run compress:ar
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const modelsDir = path.join(root, 'public', 'models', 'full_watch');
const src =
  process.env.AR_SRC ??
  path.join(modelsDir, 'watch_full_default.glb');
const outAr = path.join(modelsDir, 'watch_full_ar.glb');
const outHero = path.join(modelsDir, 'watch_full_default.glb');
const cache = path.join(root, '.cache-compress');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
}

if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}

fs.mkdirSync(cache, { recursive: true });
const p1 = path.join(cache, 'p1.glb');
const p2 = path.join(cache, 'p2.glb');
const p3 = path.join(cache, 'p3.glb');
const p4 = path.join(cache, 'p4.glb');
const tmpOut = path.join(cache, 'out.glb');

const npx = 'npx --yes @gltf-transform/cli';

run(`${npx} dedup "${src}" "${p1}"`);
try {
  run(`${npx} prune "${p1}" "${p2}"`);
} catch {
  fs.copyFileSync(p1, p2);
}
run(`${npx} weld "${p2}" "${p3}"`);
try {
  run(`${npx} webp "${p3}" "${p4}" --quality 85`);
} catch {
  fs.copyFileSync(p3, p4);
}
run(
  `${npx} draco "${p4}" "${tmpOut}" --method edgebreaker --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12 --quantize-color 8 --quantize-generic 12`,
);

fs.copyFileSync(tmpOut, outAr);
console.log(`\nWrote AR asset: ${outAr}`);

try {
  fs.copyFileSync(tmpOut, outHero);
  console.log(`Wrote hero asset: ${outHero}`);
} catch (err) {
  console.warn(
    `\nCould not overwrite hero GLB (file may be open in dev server / OneDrive).`,
  );
  console.warn(`Stop the dev server, then copy manually:`);
  console.warn(`  ${tmpOut}`);
  console.warn(`  → ${outHero}`);
}

const inMb = (fs.statSync(src).size / (1024 * 1024)).toFixed(1);
const outMb = (fs.statSync(outAr).size / (1024 * 1024)).toFixed(1);
console.log(`\nDone: ${inMb} MB → ${outMb} MB`);
