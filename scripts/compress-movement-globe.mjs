/**
 * Draco-compress movement + globe variants into public/models.
 * Usage: npm run compress:parts
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC =
  process.env.WATCH_PARTS_ROOT ?? path.join(__dirname, '..', '..');
const DST =
  process.env.CONFIGURATOR_MODELS_DST ??
  path.join(__dirname, '..', 'public', 'models');
const CACHE = path.join(__dirname, '..', '.cache-compress');
const NPX = 'npx --yes @gltf-transform/cli@4.1.3';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
}

function optimize(inFile, outFile) {
  if (!fs.existsSync(inFile)) {
    console.warn('Skip missing', inFile);
    return;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const p1 = path.join(CACHE, 'p1.glb');
  const p2 = path.join(CACHE, 'p2.glb');
  const p3 = path.join(CACHE, 'p3.glb');
  const p4 = path.join(CACHE, 'p4.glb');
  const tmp = path.join(CACHE, 'out.glb');

  console.log('\n→', path.basename(outFile));
  run(`${NPX} dedup "${inFile}" "${p1}"`);
  try {
    run(`${NPX} prune "${p1}" "${p2}"`);
  } catch {
    fs.copyFileSync(p1, p2);
  }
  run(`${NPX} weld "${p2}" "${p3}"`);
  try {
    run(`${NPX} webp "${p3}" "${p4}" --quality 85`);
  } catch {
    fs.copyFileSync(p3, p4);
  }
  run(
    `${NPX} draco "${p4}" "${tmp}" --method edgebreaker --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12 --quantize-color 8 --quantize-generic 12`,
  );
  const data = fs.readFileSync(tmp);
  try {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  } catch {
    /* locked — write alongside then swap */
    const alt = `${outFile}.new`;
    fs.writeFileSync(alt, data);
    try {
      fs.renameSync(alt, outFile);
    } catch {
      console.warn(`  locked: left ${alt} — stop dev server and rename over ${outFile}`);
      return;
    }
  }
  if (!fs.existsSync(outFile)) fs.writeFileSync(outFile, data);
  const mb = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
  console.log(`  wrote ${outFile} (${mb} MB)`);
}

for (const metal of ['rose_gold', 'white_gold', 'yellow_gold']) {
  optimize(
    path.join(SRC, 'movement', 'variants', `movement_${metal}.glb`),
    path.join(DST, 'movement', `movement_${metal}.glb`),
  );
  optimize(
    path.join(SRC, 'globe', 'variants', `globe_${metal}.glb`),
    path.join(DST, 'parts', `globe_${metal}.glb`),
  );
}

console.log('\nMovement + globe variants compressed into public/models.');
