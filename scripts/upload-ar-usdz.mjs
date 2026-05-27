/**
 * Upload watch_full_ar.usdz to Netlify Blobs via /api/models/upload.
 *
 * Usage:
 *   SCENE_SETTINGS_ADMIN_TOKEN=… node scripts/upload-ar-usdz.mjs
 *   SCENE_SETTINGS_ADMIN_TOKEN=… node scripts/upload-ar-usdz.mjs https://jacobco-3d.netlify.app
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const usdzPath = path.join(root, 'public/models/full_watch/watch_full_ar.usdz');
const slot = 'full_watch/watch_full_ar.usdz';
const base = (process.argv[2] ?? 'http://localhost:8888').replace(/\/$/, '');
const token = process.env.SCENE_SETTINGS_ADMIN_TOKEN;

if (!token) {
  console.error('Set SCENE_SETTINGS_ADMIN_TOKEN (same as Netlify env / admin login).');
  process.exit(1);
}

if (!fs.existsSync(usdzPath)) {
  console.error('Missing', usdzPath, '— run: npm run build:usdz');
  process.exit(1);
}

const bytes = fs.readFileSync(usdzPath);
const form = new FormData();
form.append('slot', slot);
form.append('file', new Blob([bytes], { type: 'model/vnd.usdz+zip' }), 'watch_full_ar.usdz');

const res = await fetch(`${base}/api/models/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Upload failed', res.status, body);
  process.exit(1);
}

console.log('Uploaded AR USDZ:', body.url ?? `/api/models/${slot}`);
console.log(`Size: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
