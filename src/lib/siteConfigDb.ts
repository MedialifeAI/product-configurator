/**
 * Site-config persistence layer.
 *
 * Storage priority:
 *   1. Netlify Blobs — used when NETLIFY=true (set automatically by the Netlify
 *      CLI / runtime). This is the same serverless-native store the model-upload
 *      pipeline uses (see modelBlobs.ts), so it needs no provisioning and works
 *      on the read-only function filesystem.
 *   2. Local JSON file (.data/site-config.json) — automatic fallback for plain
 *      `npm run dev` so the admin portal works without the Netlify CLI.
 *
 * No code changes needed to switch — the layer detects context at runtime.
 *
 * NOTE: An earlier version persisted to Netlify Database (@netlify/database).
 * On production that backend was never provisioned, so every write threw and
 * fell back to a local-file write — which fails with EROFS on the read-only
 * serverless filesystem, surfacing as a 500. Blobs removes both failure modes.
 */

import { getDeployStore, getStore } from '@netlify/blobs';
import { mergeSiteConfig, stripBlobUrlsFromScene } from '@/lib/siteConfigMerge';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/siteConfigTypes';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STORE_NAME = 'jacobco-site-config';
const BLOB_KEY   = 'config.json';
const LOCAL_DIR  = join(process.cwd(), '.data');
const LOCAL_PATH = join(LOCAL_DIR, 'site-config.json');

// ─── Local JSON file fallback ─────────────────────────────────────────────────

interface LocalStore { config: SiteConfig; updatedAt: string }

function readLocalStore(): LocalStore | null {
  try {
    if (!existsSync(LOCAL_PATH)) return null;
    return JSON.parse(readFileSync(LOCAL_PATH, 'utf-8')) as LocalStore;
  } catch { return null; }
}

function writeLocalStore(config: SiteConfig): string {
  const updatedAt = new Date().toISOString();
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify({ config, updatedAt }, null, 2), 'utf-8');
  return updatedAt;
}

function loadLocalConfig(): { config: SiteConfig; updatedAt: string | null } {
  const store = readLocalStore();
  if (!store) return { config: DEFAULT_SITE_CONFIG, updatedAt: null };
  return { config: mergeSiteConfig(store.config), updatedAt: store.updatedAt };
}

function saveLocalConfig(config: SiteConfig): string {
  return writeLocalStore({ ...config, scene: stripBlobUrlsFromScene(config.scene) });
}

// ─── Netlify Blobs backend ──────────────────────────────────────────────────
// Active when the Netlify CLI / runtime sets NETLIFY=true. Mirrors modelBlobs.ts:
// strong consistency for production reads, deploy-scoped store otherwise.

const IS_NETLIFY = process.env.NETLIFY === 'true';

interface BlobStore {
  config: SiteConfig;
  updatedAt: string;
}

function configStore() {
  if (process.env.CONTEXT === 'production') {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return getDeployStore(STORE_NAME);
}

async function blobLoad(): Promise<{ config: SiteConfig; updatedAt: string | null }> {
  const store = (await configStore().get(BLOB_KEY, { type: 'json' })) as BlobStore | null;
  if (!store?.config) return { config: DEFAULT_SITE_CONFIG, updatedAt: null };
  return { config: mergeSiteConfig(store.config), updatedAt: store.updatedAt ?? null };
}

async function blobSave(config: SiteConfig): Promise<string> {
  const updatedAt = new Date().toISOString();
  const payload: BlobStore = {
    config: { ...config, scene: stripBlobUrlsFromScene(config.scene) },
    updatedAt,
  };
  await configStore().set(BLOB_KEY, JSON.stringify(payload));
  return updatedAt;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadSiteConfig(): Promise<{
  config: SiteConfig;
  updatedAt: string | null;
  source: 'netlify' | 'local';
}> {
  if (IS_NETLIFY) {
    try {
      const result = await blobLoad();
      return { ...result, source: 'netlify' };
    } catch (err) {
      console.error('[siteConfigDb] Netlify Blobs load failed, falling back to defaults:', err);
    }
  }
  return { ...loadLocalConfig(), source: 'local' };
}

export async function saveSiteConfig(config: SiteConfig): Promise<string> {
  // On Netlify, Blobs is the only writable store — the local-file path would
  // throw EROFS on the read-only function filesystem. Let any Blobs error
  // propagate to the route handler instead of masking it with a doomed write.
  if (IS_NETLIFY) return blobSave(config);
  return saveLocalConfig(config);
}
