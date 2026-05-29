import { loadSiteConfig, saveSiteConfig } from '@/lib/siteConfigDb';
import { mergeSiteConfig } from '@/lib/siteConfigMerge';
import { DEFAULT_SITE_CONFIG } from '@/lib/siteConfigTypes';
import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import type { SiteConfig } from '@/lib/siteConfigTypes';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { config, updatedAt, source } = await loadSiteConfig();
    return Response.json({ config, updatedAt, source });
  } catch (err) {
    console.error('[site-config] GET', err);
    // Return defaults rather than a hard error so the page always loads.
    return Response.json({ config: DEFAULT_SITE_CONFIG, updatedAt: null, source: 'default' });
  }
}

export async function PUT(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { config?: SiteConfig };
    const { config: current } = await loadSiteConfig();
    const merged = mergeSiteConfig(
      body.config ? { ...current, ...body.config } : current,
    );
    const updatedAt = await saveSiteConfig(merged);
    return Response.json({ config: merged, updatedAt });
  } catch (err) {
    console.error('[site-config] PUT', err);
    return Response.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}
