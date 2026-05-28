import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { harmonizeHeroLighting } from '@/lib/harmonizeHeroLighting';
import { mergeArSettings } from '@/lib/arSettings';
import {
  DEFAULT_SITE_CONFIG,
  DEFAULT_METAL_OVERRIDES,
  type SiteConfig,
  SITE_CONFIG_VERSION,
} from '@/lib/siteConfigTypes';

function isLegacyScenePayload(payload: unknown): payload is SceneSettings {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return 'heroScale' in p && !('version' in p);
}

export function mergeSiteConfig(partial: unknown): SiteConfig {
  if (!partial || typeof partial !== 'object') return DEFAULT_SITE_CONFIG;

  if (isLegacyScenePayload(partial)) {
    return {
      ...DEFAULT_SITE_CONFIG,
      scene: harmonizeHeroLighting({ ...DEFAULT_SETTINGS, ...partial }),
    };
  }

  const p = partial as Partial<SiteConfig>;
  return {
    version: SITE_CONFIG_VERSION,
    features: { ...DEFAULT_SITE_CONFIG.features, ...p.features },
    featureFlags: { ...DEFAULT_SITE_CONFIG.featureFlags, ...p.featureFlags },
    materialOverrides: {
      metal: {
        ...DEFAULT_METAL_OVERRIDES,
        ...DEFAULT_SITE_CONFIG.materialOverrides?.metal,
        ...p.materialOverrides?.metal,
      },
    },
    theme: { ...DEFAULT_SITE_CONFIG.theme, ...p.theme },
    scene: harmonizeHeroLighting({
      ...DEFAULT_SETTINGS,
      ...p.scene,
      configBackgrounds: p.scene?.configBackgrounds?.length
        ? p.scene.configBackgrounds
        : DEFAULT_SETTINGS.configBackgrounds,
    }),
    ar: mergeArSettings(p.ar),
    content: deepMergeContent(DEFAULT_SITE_CONFIG.content, p.content),
    catalog: deepMergeCatalog(DEFAULT_SITE_CONFIG.catalog, p.catalog),
  };
}

function deepMergeContent(
  base: SiteConfig['content'],
  patch?: Partial<SiteConfig['content']>,
): SiteConfig['content'] {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    meta: { ...base.meta, ...patch.meta },
    header: {
      ...base.header,
      ...patch.header,
      nav: patch.header?.nav ?? base.header.nav,
    },
    hero: { ...base.hero, ...patch.hero },
    storyPanels: patch.storyPanels ?? base.storyPanels,
    configurator: { ...base.configurator, ...patch.configurator },
    specs: {
      ...base.specs,
      ...patch.specs,
      rows: patch.specs?.rows ?? base.specs.rows,
    },
    cta: { ...base.cta, ...patch.cta },
    activatedPrint: { ...base.activatedPrint, ...patch.activatedPrint },
    footer: patch.footer ?? base.footer,
  };
}

function deepMergeCatalog(
  base: SiteConfig['catalog'],
  patch?: Partial<SiteConfig['catalog']>,
): SiteConfig['catalog'] {
  if (!patch) return base;
  const dragons = patch.dragons
    ? base.dragons.map(d => {
        const found = patch.dragons!.find(p => p.id === d.id);
        return found ? { ...d, ...found } : d;
      })
    : base.dragons;

  return {
    ...base,
    ...patch,
    dragons,
    metals: patch.metals ?? base.metals,
    components: patch.components ?? base.components,
    partIcons: { ...base.partIcons, ...patch.partIcons },
    staticParts: { ...base.staticParts, ...patch.staticParts },
    globeParts: { ...base.globeParts, ...patch.globeParts },
    metalParts: { ...base.metalParts, ...patch.metalParts },
    heroWatch: patch.heroWatch ?? base.heroWatch,
    arWatch: patch.arWatch ?? base.arWatch,
    arCombos: { ...base.arCombos, ...patch.arCombos },
  };
}

export function stripBlobUrlsFromScene(scene: SceneSettings): SceneSettings {
  return {
    ...scene,
    heroModelUrl: persistableUrl(scene.heroModelUrl),
    configModelUrl: persistableUrl(scene.configModelUrl),
  };
}

function persistableUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('blob:')) return null;
  return url;
}
