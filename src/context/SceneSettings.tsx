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
  configScale: 0.88,
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

export {
  SceneSettingsProvider,
  useSceneSettings,
  useSiteConfig,
  type PersistStatus,
} from '@/context/SiteConfigProvider';
