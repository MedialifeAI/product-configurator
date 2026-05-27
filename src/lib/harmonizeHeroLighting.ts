import type { SceneSettings } from '@/context/SceneSettings';

/** Keep hero lighting aligned with configurator — slightly brighter, never harsher. */
export function harmonizeHeroLighting(scene: SceneSettings): SceneSettings {
  return {
    ...scene,
    heroAmbient: clamp(
      scene.heroAmbient,
      scene.configAmbient * 0.95,
      scene.configAmbient * 1.12,
    ),
    heroKey: Math.min(scene.heroKey, scene.configKey * 1.05),
    heroRim: Math.min(scene.heroRim, scene.configRim * 1.05),
    heroKicker: Math.min(scene.heroKicker, scene.configKicker * 1.05),
    heroEnv: Math.min(scene.heroEnv, scene.configEnv * 1.08),
    heroExposure: Math.min(scene.heroExposure, scene.configExposure * 1.05),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
