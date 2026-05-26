import { getDatabase } from '@netlify/database';
import { mergeSiteConfig, stripBlobUrlsFromScene } from '@/lib/siteConfigMerge';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@/lib/siteConfigTypes';

const SCOPE = 'site';

interface Row {
  payload: unknown;
  updated_at: string;
}

export async function loadSiteConfig(): Promise<{
  config: SiteConfig;
  updatedAt: string | null;
}> {
  const db = getDatabase();
  const rows = (await db.sql`
    SELECT payload, updated_at FROM scene_settings WHERE scope = ${SCOPE} LIMIT 1
  `) as Row[];
  const row = rows[0];
  if (!row?.payload) {
    return { config: DEFAULT_SITE_CONFIG, updatedAt: null };
  }
  return {
    config: mergeSiteConfig(row.payload),
    updatedAt: row.updated_at ?? null,
  };
}

export async function saveSiteConfig(config: SiteConfig): Promise<string> {
  const db = getDatabase();
  const payload = {
    ...config,
    scene: stripBlobUrlsFromScene(config.scene),
  };
  const rows = (await db.sql`
    INSERT INTO scene_settings (scope, payload, updated_at)
    VALUES (${SCOPE}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (scope) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = NOW()
    RETURNING updated_at
  `) as { updated_at: string }[];
  return rows[0]?.updated_at ?? new Date().toISOString();
}
