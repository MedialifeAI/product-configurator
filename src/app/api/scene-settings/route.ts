import { loadSceneSettings, saveSceneSettings } from '@/lib/sceneSettingsDb';
import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { mergeWithDefaults, toPersistedPayload } from '@/lib/sceneSettingsShared';
import type { SceneSettings } from '@/context/SceneSettings';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { settings, updatedAt } = await loadSceneSettings();
    return Response.json({ settings, updatedAt });
  } catch (err) {
    console.error('[scene-settings] GET failed', err);
    return Response.json(
      { settings: mergeWithDefaults(null), updatedAt: null, unavailable: true },
      { status: 503 },
    );
  }
}

export async function PUT(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { settings?: Partial<SceneSettings> };
    const settings = mergeWithDefaults(body.settings ?? null);
    const persisted = toPersistedPayload(settings);
    const updatedAt = await saveSceneSettings(persisted);
    return Response.json({ settings: persisted, updatedAt });
  } catch (err) {
    console.error('[scene-settings] PUT failed', err);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
