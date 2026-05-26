'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface SceneSettings {
  /** Multiplier on the bbox-derived hero scale. 1.0 = computed default. */
  heroScale: number;
  /** Added to the raw scrollProgress before driving the explode (0..1). */
  heroAnimOffset: number;
  /** Vertical world-space offset of the hero watch group. */
  heroY: number;
  /** Sway amplitude in radians for the hero showcase rotation. */
  heroSway: number;

  /** Multiplier on the bbox-derived configurator scale. */
  configScale: number;
  /** Configurator OrbitControls autoRotateSpeed. */
  configRotate: number;

  /** Optional override URL for the hero model (blob URL from file upload). */
  heroModelUrl: string | null;
  /** Optional override URL for the configurator base model. */
  configModelUrl: string | null;

  // Hero lighting (intensity-style). Defaults already trimmed 10% from the
  // tuned values — the rose gold case kept reading hot against the headline.
  heroAmbient: number;   // ambient fill
  heroKey: number;       // upper-front-left key (warm white)
  heroRim: number;       // back-left rim (warm gold)
  heroKicker: number;    // lower-front cool kicker
  heroEnv: number;       // studio HDR environmentIntensity
  heroExposure: number;  // toneMappingExposure
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

  // ×0.9 of the previously tuned values.
  heroAmbient:  0.108,
  heroKey:      0.63,
  heroRim:      0.45,
  heroKicker:   0.18,
  heroEnv:      0.315,
  heroExposure: 0.738,
};

interface Ctx {
  settings: SceneSettings;
  set: <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => void;
  reset: () => void;
}

const SceneSettingsContext = createContext<Ctx | null>(null);

export function SceneSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SceneSettings>(DEFAULT_SETTINGS);
  const set = useCallback(<K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const value = useMemo(() => ({ settings, set, reset }), [settings, set, reset]);
  return (
    <SceneSettingsContext.Provider value={value}>{children}</SceneSettingsContext.Provider>
  );
}

export function useSceneSettings(): Ctx {
  const ctx = useContext(SceneSettingsContext);
  if (!ctx) throw new Error('useSceneSettings must be used inside SceneSettingsProvider');
  return ctx;
}
