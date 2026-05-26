import { getDatabase } from '@netlify/database';
import { DEFAULT_SETTINGS, type SceneSettings } from '@/context/SceneSettings';
import { mergeWithDefaults, SCENE_SETTINGS_SCOPE } from '@/lib/sceneSettingsShared';

interface SceneSettingsRow {
  scope: string;
  payload: SceneSettings | null;
  updated_at: string;
}

export async function loadSceneSettings(): Promise<{
  settings: SceneSettings;
  updatedAt: string | null;
}> {
  const db = getDatabase();
  const rows = (await db.sql`
    SELECT scope, payload, updated_at
    FROM scene_settings
    WHERE scope = ${SCENE_SETTINGS_SCOPE}
    LIMIT 1
  `) as SceneSettingsRow[];
  const row = rows[0];
  if (!row?.payload) {
    return { settings: DEFAULT_SETTINGS, updatedAt: null };
  }
  return {
    settings: mergeWithDefaults(row.payload),
    updatedAt: row.updated_at ?? null,
  };
}

export async function saveSceneSettings(payload: SceneSettings): Promise<string> {
  const db = getDatabase();
  const rows = (await db.sql`
    INSERT INTO scene_settings (scope, payload, updated_at)
    VALUES (${SCENE_SETTINGS_SCOPE}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (scope) DO UPDATE
      SET payload = EXCLUDED.payload,
          updated_at = NOW()
    RETURNING updated_at
  `) as { updated_at: string }[];
  return rows[0]?.updated_at ?? new Date().toISOString();
}
