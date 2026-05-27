import type { ModelSource } from '@/lib/siteConfigTypes';

export type ModelQuality = 'auto' | 'low' | 'medium' | 'high';

export interface ConfiguratorBackgroundOption {
  id: string;
  label: string;
  type: 'color' | 'image';
  color?: string;
  image?: ModelSource;
}

export interface SceneSettings {
  heroScale: number;
  heroAnimOffset: number;
  heroY: number;
  heroSway: number;
  configScale: number;
  configRotate: number;
  /** Y-axis rotation (radians) so dial + dragon face the camera (0 = front, π = caseback). */
  configYaw: number;
  heroModelUrl: string | null;
  configModelUrl: string | null;
  heroAmbient: number;
  heroKey: number;
  heroRim: number;
  heroKicker: number;
  heroEnv: number;
  heroExposure: number;
  /** Configurator canvas lighting (parallel to hero). */
  configAmbient: number;
  configKey: number;
  configRim: number;
  configKicker: number;
  configEnv: number;
  configExposure: number;
  /** Per-viewport render quality; auto follows device tier. */
  heroModelQuality: ModelQuality;
  configModelQuality: ModelQuality;
  /** Fallback canvas color when no background option matches. */
  configCanvasColor: string;
  /** Default background id for new visitors. */
  configDefaultBackgroundId: string;
  /** Palette of colors / images visitors can pick in the configurator. */
  configBackgrounds: ConfiguratorBackgroundOption[];
}

export const DEFAULT_CONFIG_BACKGROUNDS: ConfiguratorBackgroundOption[] = [
  { id: 'ink', label: 'Ink', type: 'color', color: '#0a0a0c' },
  { id: 'carbon', label: 'Carbon', type: 'color', color: '#15151a' },
  { id: 'warm', label: 'Warm black', type: 'color', color: '#12100e' },
];

export const DEFAULT_SETTINGS: SceneSettings = {
  heroScale: 1.0,
  heroAnimOffset: 0,
  heroY: 0,
  heroSway: 0.28,
  configScale: 0.88,
  configRotate: 0.5,
  configYaw: 0,
  heroModelUrl: null,
  configModelUrl: null,
  heroAmbient: 0.108,
  heroKey: 0.63,
  heroRim: 0.45,
  heroKicker: 0.18,
  heroEnv: 0.315,
  heroExposure: 0.738,
  configAmbient: 0.18,
  configKey: 0.52,
  configRim: 0.26,
  configKicker: 0.12,
  configEnv: 0.26,
  configExposure: 0.68,
  heroModelQuality: 'auto',
  configModelQuality: 'auto',
  configCanvasColor: '#0a0a0c',
  configDefaultBackgroundId: 'ink',
  configBackgrounds: DEFAULT_CONFIG_BACKGROUNDS,
};

export {
  SceneSettingsProvider,
  useSceneSettings,
  useSiteConfig,
  type PersistStatus,
} from '@/context/SiteConfigProvider';
