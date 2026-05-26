'use client';

import {
  adminHeaders,
  mergeWithDefaults,
  SCENE_SETTINGS_API,
  toPersistedPayload,
} from '@/lib/sceneSettingsShared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

export interface SceneSettings {
  heroScale: number;
  heroAnimOffset: number;
  heroY: number;
  heroSway: number;
  configScale: number;
  configRotate: number;
  heroModelUrl: string | null;
  configModelUrl: string | null;
  heroAmbient: number;
  heroKey: number;
  heroRim: number;
  heroKicker: number;
  heroEnv: number;
  heroExposure: number;
}

export const DEFAULT_SETTINGS: SceneSettings = {
  heroScale: 1.0,
  heroAnimOffset: 0,
  heroY: 0,
  heroSway: 0.28,
  configScale: 1.0,
  configRotate: 0.5,
  heroModelUrl: null,
  configModelUrl: null,
  heroAmbient: 0.108,
  heroKey: 0.63,
  heroRim: 0.45,
  heroKicker: 0.18,
  heroEnv: 0.315,
  heroExposure: 0.738,
};

export type PersistStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'offline';

interface Ctx {
  settings: SceneSettings;
  set: <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => void;
  reset: () => void;
  persistStatus: PersistStatus;
  lastSavedAt: string | null;
}

const SceneSettingsContext = createContext<Ctx | null>(null);

const SAVE_DEBOUNCE_MS = 900;

export function SceneSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SceneSettings>(DEFAULT_SETTINGS);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async (next: SceneSettings) => {
    setPersistStatus('saving');
    try {
      const res = await fetch(SCENE_SETTINGS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ settings: toPersistedPayload(next) }),
      });
      if (res.status === 401) {
        setPersistStatus('error');
        return;
      }
      if (!res.ok) throw new Error(`save ${res.status}`);
      const data = await res.json();
      setLastSavedAt(data.updatedAt ?? null);
      setPersistStatus('saved');
    } catch {
      setPersistStatus('error');
    }
  }, []);

  const scheduleSave = useCallback(
    (next: SceneSettings) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(SCENE_SETTINGS_API);
        const data = await res.json();
        if (cancelled) return;
        if (data.settings) {
          setSettings(mergeWithDefaults(data.settings));
          setLastSavedAt(data.updatedAt ?? null);
        }
        setPersistStatus(data.unavailable ? 'offline' : 'ready');
      } catch {
        if (!cancelled) setPersistStatus('offline');
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    scheduleSave(settings);
  }, [settings, scheduleSave]);

  const set = useCallback(<K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, set, reset, persistStatus, lastSavedAt }),
    [settings, set, reset, persistStatus, lastSavedAt],
  );

  return (
    <SceneSettingsContext.Provider value={value}>{children}</SceneSettingsContext.Provider>
  );
}

export function useSceneSettings(): Ctx {
  const ctx = useContext(SceneSettingsContext);
  if (!ctx) throw new Error('useSceneSettings must be used inside SceneSettingsProvider');
  return ctx;
}
