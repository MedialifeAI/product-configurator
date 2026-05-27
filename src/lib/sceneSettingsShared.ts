import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { harmonizeHeroLighting } from '@/lib/harmonizeHeroLighting';

export const SCENE_SETTINGS_SCOPE = 'site';
export const SCENE_SETTINGS_API = '/api/scene-settings';
export const ADMIN_TOKEN_STORAGE_KEY = 'scene-settings-admin-token';

export type ModelSlot = 'hero' | 'config';

export function modelApiPath(slot: ModelSlot): string {
  return `${SCENE_SETTINGS_API}/model/${slot}`;
}

/** Strip blob: URLs before persisting; keep http(s) and our model API paths. */
export function toPersistedPayload(settings: SceneSettings): SceneSettings {
  return {
    ...settings,
    heroModelUrl: persistableModelUrl(settings.heroModelUrl),
    configModelUrl: persistableModelUrl(settings.configModelUrl),
  };
}

function persistableModelUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return null;
  if (url.startsWith('/api/scene-settings/model/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return null;
}

export function mergeWithDefaults(partial: Partial<SceneSettings> | null): SceneSettings {
  if (!partial || typeof partial !== 'object') return DEFAULT_SETTINGS;
  return harmonizeHeroLighting({
    ...DEFAULT_SETTINGS,
    ...partial,
    heroModelUrl: partial.heroModelUrl ?? DEFAULT_SETTINGS.heroModelUrl,
    configModelUrl: partial.configModelUrl ?? DEFAULT_SETTINGS.configModelUrl,
    configYaw: partial.configYaw ?? DEFAULT_SETTINGS.configYaw,
    configBackgrounds: partial.configBackgrounds?.length
      ? partial.configBackgrounds
      : DEFAULT_SETTINGS.configBackgrounds,
  });
}

export function adminHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
