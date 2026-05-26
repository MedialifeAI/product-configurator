'use client';

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
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  DEFAULT_SITE_CONFIG,
  SITE_CONFIG_API,
  type SiteConfig,
} from '@/lib/siteConfigTypes';
import { mergeSiteConfig, stripBlobUrlsFromScene } from '@/lib/siteConfigMerge';
import { SCENE_SETTINGS_API } from '@/lib/sceneSettingsShared';

export type PersistStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'offline';

interface Ctx {
  config: SiteConfig;
  setConfig: (next: SiteConfig | ((prev: SiteConfig) => SiteConfig)) => void;
  patchConfig: (patch: Partial<SiteConfig>) => void;
  settings: SceneSettings;
  setScene: <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => void;
  resetScene: () => void;
  saveConfig: () => Promise<boolean>;
  persistStatus: PersistStatus;
  lastSavedAt: string | null;
}

const SiteConfigContext = createContext<Ctx | null>(null);

export function adminHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SCENE_SAVE_DEBOUNCE_MS = 900;

export function SiteConfigProvider({
  children,
  enableSceneAutoSave = true,
}: {
  children: ReactNode;
  /** Public debug panel auto-persists scene sliders; admin portal disables this. */
  enableSceneAutoSave?: boolean;
}) {
  const [config, setConfigState] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(SITE_CONFIG_API);
        const data = await res.json();
        if (cancelled) return;
        if (data.config) setConfigState(mergeSiteConfig(data.config));
        setLastSavedAt(data.updatedAt ?? null);
        setPersistStatus(data.unavailable ? 'offline' : 'ready');
      } catch {
        if (!cancelled) setPersistStatus('offline');
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistScene = useCallback(async (scene: SceneSettings) => {
    setPersistStatus('saving');
    try {
      const res = await fetch(SCENE_SETTINGS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ settings: stripBlobUrlsFromScene(scene) }),
      });
      if (res.status === 401) {
        setPersistStatus('error');
        return;
      }
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      setLastSavedAt(data.updatedAt ?? null);
      setPersistStatus('saved');
    } catch {
      setPersistStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!enableSceneAutoSave || !hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistScene(config.scene), SCENE_SAVE_DEBOUNCE_MS);
  }, [config.scene, enableSceneAutoSave, persistScene]);

  const setConfig = useCallback((next: SiteConfig | ((prev: SiteConfig) => SiteConfig)) => {
    setConfigState(prev => (typeof next === 'function' ? next(prev) : next));
  }, []);

  const patchConfig = useCallback((patch: Partial<SiteConfig>) => {
    setConfigState(prev =>
      mergeSiteConfig({
        ...prev,
        ...patch,
        scene: patch.scene ? { ...prev.scene, ...patch.scene } : prev.scene,
        ar: patch.ar ? { ...prev.ar, ...patch.ar } : prev.ar,
        features: patch.features ? { ...prev.features, ...patch.features } : prev.features,
        theme: patch.theme ? { ...prev.theme, ...patch.theme } : prev.theme,
      }),
    );
  }, []);

  const setScene = useCallback(<K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => {
    setConfigState(prev => ({ ...prev, scene: { ...prev.scene, [key]: value } }));
  }, []);

  const resetScene = useCallback(() => {
    setConfigState(prev => ({ ...prev, scene: DEFAULT_SETTINGS }));
  }, []);

  const saveConfig = useCallback(async () => {
    setPersistStatus('saving');
    try {
      const res = await fetch(SITE_CONFIG_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ config }),
      });
      if (res.status === 401) {
        setPersistStatus('error');
        return false;
      }
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      setConfigState(mergeSiteConfig(data.config));
      setLastSavedAt(data.updatedAt ?? null);
      setPersistStatus('saved');
      return true;
    } catch {
      setPersistStatus('error');
      return false;
    }
  }, [config]);

  const value = useMemo(
    () => ({
      config,
      setConfig,
      patchConfig,
      settings: config.scene,
      setScene,
      resetScene,
      saveConfig,
      persistStatus,
      lastSavedAt,
    }),
    [config, setConfig, patchConfig, setScene, resetScene, saveConfig, persistStatus, lastSavedAt],
  );

  return (
    <SiteConfigContext.Provider value={value}>
      <ThemeVariables theme={config.theme} />
      {children}
    </SiteConfigContext.Provider>
  );
}

function ThemeVariables({ theme }: { theme: SiteConfig['theme'] }) {
  const ref = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (!ref.current) {
      ref.current = document.createElement('style');
      ref.current.setAttribute('data-site-theme', '');
      document.head.appendChild(ref.current);
    }
    ref.current.textContent = `
      :root {
        --site-ink: ${theme.ink};
        --site-carbon: ${theme.carbon};
        --site-bone: ${theme.bone};
        --site-jc-gold: ${theme.jcGold};
        --site-rose-gold: ${theme.roseGold};
        --site-white-gold: ${theme.whiteGold};
        --site-yellow-gold: ${theme.yellowGold};
      }
      html, body { background: var(--site-ink); color: var(--site-bone); }
      .gold-text {
        background: linear-gradient(180deg, #f1d9a4 0%, var(--site-jc-gold) 60%, #8a6a30 100%);
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
    `;
    return () => ref.current?.remove();
  }, [theme]);
  return null;
}

export function useSiteConfig(): Ctx {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error('useSiteConfig requires SiteConfigProvider');
  return ctx;
}

/** Backward-compatible alias used across 3D components */
export function useSceneSettings() {
  const { settings, setScene, resetScene, persistStatus, lastSavedAt } = useSiteConfig();
  return {
    settings,
    set: setScene,
    reset: resetScene,
    persistStatus,
    lastSavedAt,
  };
}

export function SceneSettingsProvider({ children }: { children: ReactNode }) {
  return <SiteConfigProvider>{children}</SiteConfigProvider>;
}
