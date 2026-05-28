/**
 * Upload compressed AR GLB + USDZ to Netlify Blobs via /api/models/upload.
 *
 * Usage:
 *   SCENE_SETTINGS_ADMIN_TOKEN=… node scripts/upload-ar-assets.mjs
 *   SCENE_SETTINGS_ADMIN_TOKEN=… node scripts/upload-ar-assets.mjs https://jacobco-3d.netlify.app
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] ?? 'https://jacobco-3d.netlify.app').replace(/\/$/, '');
const token = process.env.SCENE_SETTINGS_ADMIN_TOKEN;

const assets = [
  {
    path: path.join(root, 'public/models/full_watch/watch_full_ar.glb'),
    slot: 'full_watch/watch_full_ar.glb',
    name: 'watch_full_ar.glb',
    type: 'model/gltf-binary',
  },
  {
    path: path.join(root, 'public/models/full_watch/watch_full_ar.usdz'),
    slot: 'full_watch/watch_full_ar.usdz',
    name: 'watch_full_ar.usdz',
    type: 'model/vnd.usdz+zip',
  },
];

if (!token) {
  console.error('Set SCENE_SETTINGS_ADMIN_TOKEN (same as Netlify env / admin login).');
  process.exit(1);
}

async function uploadAsset({ path: filePath, slot, name, type }) {
  if (!fs.existsSync(filePath)) {
    console.error('Missing', filePath);
    process.exit(1);
  }

  const bytes = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('slot', slot);
  form.append('file', new Blob([bytes], { type }), name);

  const res = await fetch(`${base}/api/models/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Upload failed', slot, res.status, body);
    process.exit(1);
  }

  console.log(`Uploaded ${slot}: ${body.url ?? `/api/models/${slot}`} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
}

for (const asset of assets) {
  await uploadAsset(asset);
}

console.log('All AR assets uploaded to Netlify Blobs.');
