/**
 * Site-config persistence layer.
 *
 * Storage priority:
 *   1. Netlify Database  — used when NETLIFY=true (set automatically by the
 *      Netlify CLI / runtime). Requires `netlify dev` or a deployed Netlify
 *      function context.
 *   2. Local JSON file (.data/site-config.json) — automatic fallback for plain
 *      `npm run dev` so the admin portal works without the Netlify CLI.
 *
 * No code changes needed to switch — the layer detects context at runtime.
 */

import { mergeSiteConfig, stripBlobUrlsFromScene } from '@/lib/siteConfigMerge';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/siteConfigTypes';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SCOPE = 'site';
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

// ─── Netlify Database backend ─────────────────────────────────────────────────
// Only imported when the Netlify CLI / runtime sets NETLIFY=true.
// This avoids the package's connection code running during plain `npm run dev`.

const IS_NETLIFY = process.env.NETLIFY === 'true';

interface Row { payload: unknown; updated_at: string }

async function netlifyLoad(): Promise<{ config: SiteConfig; updatedAt: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDatabase } = require('@netlify/database') as { getDatabase: () => { sql: (...args: unknown[]) => Promise<unknown[]> } };
  const db = getDatabase();
  const rows = (await db.sql`
    SELECT payload, updated_at FROM scene_settings WHERE scope = ${SCOPE} LIMIT 1
  `) as Row[];
  const row = rows[0];
  if (!row?.payload) return { config: DEFAULT_SITE_CONFIG, updatedAt: null };
  return { config: mergeSiteConfig(row.payload), updatedAt: row.updated_at ?? null };
}

async function netlifySave(config: SiteConfig): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDatabase } = require('@netlify/database') as { getDatabase: () => { sql: (...args: unknown[]) => Promise<unknown[]> } };
  const db = getDatabase();
  const payload = { ...config, scene: stripBlobUrlsFromScene(config.scene) };
  const rows = (await db.sql`
    INSERT INTO scene_settings (scope, payload, updated_at)
    VALUES (${SCOPE}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (scope) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = NOW()
    RETURNING updated_at
  `) as { updated_at: string }[];
  return rows[0]?.updated_at ?? new Date().toISOString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadSiteConfig(): Promise<{
  config: SiteConfig;
  updatedAt: string | null;
  source: 'netlify' | 'local';
}> {
  if (IS_NETLIFY) {
    try {
      const result = await netlifyLoad();
      return { ...result, source: 'netlify' };
    } catch (err) {
      console.error('[siteConfigDb] Netlify DB load failed, falling back to local:', err);
    }
  }
  return { ...loadLocalConfig(), source: 'local' };
}

export async function saveSiteConfig(config: SiteConfig): Promise<string> {
  if (IS_NETLIFY) {
    try {
      return await netlifySave(config);
    } catch (err) {
      console.error('[siteConfigDb] Netlify DB save failed, falling back to local:', err);
    }
  }
  return saveLocalConfig(config);
}
