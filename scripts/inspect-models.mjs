// Inspect every GLB in public/models and (if present) public/models-optimized.
// Reports per-file: file size, triangle count, vertex count, texture count and
// dimensions, estimated VRAM footprint (decoded, with mipmaps). Sorts by VRAM.
//
// Run: node scripts/inspect-models.mjs

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['public/models', 'public/models-optimized'].filter(existsSync);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.glb')) yield p;
  }
}

// Decoded VRAM estimate for a texture.
// Assumes RGBA8 (4 bytes/pixel) after decode unless a KTX2/Basis texture is
// detected — for those, assume ETC2/ASTC ~ 1 byte/pixel on GPU.
// Mipmaps add ~33%.
function texBytes(w, h, mime) {
  const bpp = mime === 'image/ktx2' ? 1 : 4;
  return Math.round(w * h * bpp * 1.33);
}

const rows = [];

for (const root of ROOTS) {
  for await (const path of walk(root)) {
    try {
      const doc = await io.read(path);
      const r = doc.getRoot();

      let triangles = 0;
      let vertices = 0;
      let primitives = 0;

      for (const mesh of r.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          primitives++;
          const idx = prim.getIndices();
          const pos = prim.getAttribute('POSITION');
          if (idx) triangles += Math.floor(idx.getCount() / 3);
          else if (pos) triangles += Math.floor(pos.getCount() / 3);
          if (pos) vertices += pos.getCount();
        }
      }

      let texVRAM = 0;
      const texDetails = [];
      for (const tex of r.listTextures()) {
        const size = tex.getSize();
        const mime = tex.getMimeType() || 'unknown';
        if (size) {
          const [w, h] = size;
          texVRAM += texBytes(w, h, mime);
          texDetails.push(`${w}x${h} ${mime.replace('image/', '')}`);
        } else {
          texDetails.push(`?x? ${mime.replace('image/', '')}`);
        }
      }

      const fileBytes = (await stat(path)).size;
      const geoVRAM = vertices * 32 + triangles * 6; // 32B/vertex (pos+norm+uv+tan), 6B/tri index

      rows.push({
        file: relative('.', path).replace(/\\/g, '/'),
        fileMB: +(fileBytes / 1024 / 1024).toFixed(2),
        prims: primitives,
        tris: triangles,
        verts: vertices,
        tex: r.listTextures().length,
        geoMB: +(geoVRAM / 1024 / 1024).toFixed(2),
        texMB: +(texVRAM / 1024 / 1024).toFixed(2),
        totalVRAM: +((geoVRAM + texVRAM) / 1024 / 1024).toFixed(2),
        texDetails: texDetails.join(' | '),
      });
    } catch (err) {
      rows.push({ file: relative('.', path), error: err.message });
    }
  }
}

rows.sort((a, b) => (b.totalVRAM || 0) - (a.totalVRAM || 0));

console.log('\n=== Per-file inventory (sorted by est. decoded VRAM) ===\n');
console.table(
  rows.map((r) => r.error
    ? { file: r.file, error: r.error }
    : {
        file: r.file,
        fileMB: r.fileMB,
        prims: r.prims,
        tris: r.tris.toLocaleString(),
        verts: r.verts.toLocaleString(),
        tex: r.tex,
        geoMB: r.geoMB,
        texMB: r.texMB,
        totalVRAM: r.totalVRAM,
      }),
);

console.log('\n=== Texture details (only files with textures) ===\n');
for (const r of rows) {
  if (r.tex > 0) console.log(`${r.file}\n  ${r.texDetails}\n`);
}

const totals = rows.reduce(
  (a, r) => ({
    file: (a.file || 0) + (r.fileMB || 0),
    tris: (a.tris || 0) + (r.tris || 0),
    verts: (a.verts || 0) + (r.verts || 0),
    tex: (a.tex || 0) + (r.tex || 0),
    geo: (a.geo || 0) + (r.geoMB || 0),
    texMB: (a.texMB || 0) + (r.texMB || 0),
    vram: (a.vram || 0) + (r.totalVRAM || 0),
  }),
  {},
);

console.log('\n=== Totals if every GLB loaded simultaneously ===');
console.log(`  Disk:     ${totals.file.toFixed(2)} MB`);
console.log(`  Triangles:${totals.tris.toLocaleString()}`);
console.log(`  Vertices: ${totals.verts.toLocaleString()}`);
console.log(`  Textures: ${totals.tex}`);
console.log(`  Geo VRAM: ${totals.geo.toFixed(2)} MB`);
console.log(`  Tex VRAM: ${totals.texMB.toFixed(2)} MB`);
console.log(`  TOTAL VRAM (est decoded):  ${totals.vram.toFixed(2)} MB`);

console.log('\n=== iOS Safari per-tab memory budgets (approximate kill thresholds) ===');
console.log('  iPhone 8 / SE 2nd gen (A11/A13, 2-3GB RAM):  ~250-300 MB');
console.log('  iPhone 11/12/13 (A13-A15, 4-6GB RAM):        ~380-500 MB');
console.log('  iPhone 14/15 Pro (A16/A17, 6-8GB RAM):       ~500-700 MB');
console.log('  iPad Pro M-series:                            ~1000+ MB');
console.log('\nNote: VRAM is only part of process memory. JS heap + DOM + WebGL contexts');
console.log('add another 100-200 MB baseline. Total memory == VRAM + JS heap + everything.');
