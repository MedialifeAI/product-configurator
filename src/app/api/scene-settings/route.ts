import { loadSiteConfig, saveSiteConfig } from '@/lib/siteConfigDb';
import { mergeSiteConfig, stripBlobUrlsFromScene } from '@/lib/siteConfigMerge';
import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { DEFAULT_SETTINGS, type SceneSettings } from '@/context/SceneSettings';
import { mergeWithDefaults } from '@/lib/sceneSettingsShared';

export const runtime = 'nodejs';
// Opt out of static prerendering: this route reads/writes a database and must
// run as a live function. Without this, Next.js bakes the GET response at build
// time and only GET/HEAD survive — PUT then returns 405 (Allow: GET, HEAD).
export const dynamic = 'force-dynamic';

/** Legacy API — reads/writes scene slice of unified site config. */
export async function GET() {
  try {
    const { config, updatedAt } = await loadSiteConfig();
    return Response.json({ settings: config.scene, updatedAt });
  } catch {
    return Response.json(
      { settings: DEFAULT_SETTINGS, updatedAt: null, unavailable: true },
      { status: 503 },
    );
  }
}

export async function PUT(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { settings?: Partial<SceneSettings> };
    const { config } = await loadSiteConfig();
    const scene = mergeWithDefaults(body.settings ?? null);
    const next = mergeSiteConfig({
      ...config,
      scene: stripBlobUrlsFromScene(scene),
    });
    const updatedAt = await saveSiteConfig(next);
    return Response.json({ settings: next.scene, updatedAt });
  } catch (err) {
    console.error('[scene-settings] PUT failed', err);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
