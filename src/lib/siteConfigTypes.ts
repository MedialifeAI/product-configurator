import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';

export const SITE_CONFIG_VERSION = 1 as const;
export const SITE_CONFIG_API = '/api/site-config';
export const MODELS_API = '/api/models';
export const ADMIN_TOKEN_STORAGE_KEY = 'scene-settings-admin-token';

/** Built-in path, external URL, or blob uploaded via admin. */
export type ModelSource =
  | { type: 'builtin'; path: string }
  | { type: 'url'; url: string }
  | { type: 'blob'; key: string };

export type DragonId = 'v1' | 'v2' | 'v3' | 'v4';
export type MetalId = 'rose_gold' | 'white_gold' | 'yellow_gold';
export type ComponentId = 'dragon' | 'case' | 'movement' | 'dial' | 'globe' | 'strap';

export interface DragonVariant {
  id: DragonId;
  label: string;
  sub: string;
  swatch: string;
  builtinPath: string;
  model?: ModelSource;
}

export interface MetalVariant {
  id: MetalId;
  label: string;
  swatch: string;
}

export interface MetalPartSources {
  caseBody?: ModelSource;
  case?: ModelSource;
  movement?: ModelSource;
}

export interface StaticPartSources {
  /** Celestial dial + inner background plate (`blue-watch-bg-plate`). */
  dial?: ModelSource;
  /** Default globe when no per-metal entry (rose gold cage). */
  globe?: ModelSource;
  hand?: ModelSource;
  /** Top + bottom strap armatures and skinned meshes. */
  strap?: ModelSource;
}

/** Terrestrial globe in the movement cage — metal-tinted cage, blue earth unchanged. */
export type GlobePartSources = Partial<Record<MetalId, ModelSource>>;

export interface NavLink {
  label: string;
  href: string;
}

export interface StoryPanelContent {
  eyebrow: string;
  title: string;
  body: string;
  side: 'left' | 'right';
  metric: { value: string; label: string };
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface SiteTheme {
  ink: string;
  carbon: string;
  bone: string;
  jcGold: string;
  roseGold: string;
  whiteGold: string;
  yellowGold: string;
}

export interface SiteFeatures {
  /** Floating scene-controls gear on the public site. */
  showSceneControls: boolean;
  /** Show View in AR button in configurator. */
  showArButton: boolean;
  /** FPS / draw-call overlay on hero + configurator canvases. */
  showPerformanceOverlay: boolean;
}

/**
 * Which GLB variant to load. See assetRouting.ts for the resolution algorithm.
 * - 'original'  → /models/         (full quality, ~37M triangles total)
 * - 'optimized' → /models-optimized/ (Meshopt-encoded; smaller files, same VRAM after decode)
 * - 'ios'       → /models-ios/     (decimated ~10% triangle count, iOS-safe)
 */
export type AssetVariant = 'original' | 'optimized' | 'ios';

export interface AssetVariantByPlatform {
  desktop?: AssetVariant;
  android?: AssetVariant;
  ios?: AssetVariant;
}

export interface SiteFeatureFlags {
  /**
   * Per-platform variant routing. Admin-controlled. When set for a platform,
   * overrides the hard defaults (desktop/android → original, ios → ios).
   */
  assetVariantByPlatform?: AssetVariantByPlatform;
  /**
   * Legacy boolean — when assetVariantByPlatform is absent, true forces every
   * platform to load /models-optimized. Kept for backward compatibility with
   * older configs; new work should use assetVariantByPlatform.
   */
  useOptimizedAssets?: boolean;
  /**
   * Runtime-only pass-through — true when the current session has resolved to
   * the 'ios' variant. Helper functions carry it through type-safe option bags.
   * Never persisted in config; populated from resolveAssetVariant().
   */
  useIosAssets?: boolean;
  /** One geometry + PBR tint per metal part (requires identical source meshes). */
  consolidatedMetals?: boolean;
}

export type MetalFinishKey = MetalId;

export interface MetalOverride {
  color: string;
  metalness: number;
  roughness: number;
  ior?: number;
  clearcoat?: number;
}

export type MetalOverrideMap = Record<MetalFinishKey, MetalOverride>;

export const DEFAULT_METAL_OVERRIDES: MetalOverrideMap = {
  rose_gold: { color: '#b76e79', metalness: 1, roughness: 0.22 },
  white_gold: { color: '#e6e6e6', metalness: 1, roughness: 0.18 },
  yellow_gold: { color: '#d4af37', metalness: 1, roughness: 0.24 },
};

export interface ArPreset {
  dragon: DragonId;
  metal: MetalId;
  label: string;
}

/** Google Model Viewer session tuning (persisted in site config). */
export interface ArSettings {
  caseDiameterMm: number;
  sizeMultiplier: number;
  previewScale: number;
  lockRealWorldScale: boolean;
  exposure: number;
  shadowIntensity: number;
  autoRotateInPreview: boolean;
  cameraOrbit: string;
  minCameraOrbit: string;
  maxCameraOrbit: string;
  showPresetBar: boolean;
  maxPresets: number;
  tapToPlaceHint: string;
  /**
   * When false (default), AR uses the single compressed `arWatch` GLB for speed.
   * Enable after per-combo files under `/models/ar/combos/` are Draco-compressed (~15–40 MB each).
   */
  usePerComboArModels: boolean;
}

export const DEFAULT_AR_SETTINGS: ArSettings = {
  caseDiameterMm: 47,
  sizeMultiplier: 1.22,
  previewScale: 1.08,
  lockRealWorldScale: true,
  exposure: 0.75,
  shadowIntensity: 0,
  autoRotateInPreview: false,
  cameraOrbit: '0deg 72deg 105%',
  minCameraOrbit: 'auto 28deg 80%',
  maxCameraOrbit: 'auto 95deg 140%',
  showPresetBar: true,
  maxPresets: 0,
  tapToPlaceHint: 'Tap the AR button, then place the watch on a flat surface.',
  usePerComboArModels: false,
};

export interface SiteContent {
  meta: { title: string; description: string };
  header: {
    brand: string;
    nav: NavLink[];
    ctaLabel: string;
    ctaHref: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    body: string;
    scrollHint: string;
    loadingTitle: string;
    loadingSubtitle: string;
    exploreConfiguratorLabel: string;
  };
  storyPanels: StoryPanelContent[];
  configurator: {
    eyebrow: string;
    title: string;
    description: string;
    keepGlobeLabel: string;
    keepGlobeHint: string;
    editionLine: string;
    shareLinkLabel: string;
    shareLinkCopied: string;
    resetViewLabel: string;
    arButtonLabel: string;
    arDesktopHint: string;
    arMobileHint: string;
    arSizeHint: string;
  };
  specs: {
    eyebrow: string;
    title: string;
    rows: SpecRow[];
  };
  cta: {
    eyebrow: string;
    title: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    footerLine: string;
  };
  footer: string;
}

export type PartIconSources = Partial<Record<ComponentId, ModelSource>>;

export interface SiteCatalog {
  dragons: DragonVariant[];
  metals: MetalVariant[];
  components: { id: ComponentId; label: string }[];
  /** Circular inspect-button thumbnails (builtin path, URL, or admin upload). */
  partIcons?: PartIconSources;
  staticParts: StaticPartSources;
  /** Per case-metal globe GLB (movement exports omit globe; loaded separately). */
  globeParts: GlobePartSources;
  metalParts: Record<MetalId, MetalPartSources>;
  heroWatch: ModelSource;
  arWatch: ModelSource;
  /** Optional per dragon+metal assembled GLB for AR (key: v1_rose_gold). */
  arCombos?: Partial<Record<`${DragonId}_${MetalId}`, ModelSource>>;
}

export interface SiteConfig {
  version: typeof SITE_CONFIG_VERSION;
  features: SiteFeatures;
  featureFlags?: SiteFeatureFlags;
  /** Runtime PBR tints when featureFlags.consolidatedMetals is enabled. */
  materialOverrides?: { metal?: MetalOverrideMap };
  theme: SiteTheme;
  scene: SceneSettings;
  /** Google Model Viewer / AR session tuning. */
  ar: ArSettings;
  content: SiteContent;
  catalog: SiteCatalog;
}

export const DEFAULT_THEME: SiteTheme = {
  ink: '#0a0a0c',
  carbon: '#15151a',
  bone: '#f5f2ea',
  jcGold: '#b4904e',
  roseGold: '#c98363',
  whiteGold: '#dfe1e3',
  yellowGold: '#d4ad58',
};

export const DEFAULT_DRAGONS: DragonVariant[] = [
  { id: 'v1', label: 'Imperial Rose Gold', sub: 'Citrine accents', swatch: '#c98363', builtinPath: '/models/dragon/dragon_v1_imperial_rose_gold.glb' },
  { id: 'v2', label: 'Sapphire Sky', sub: 'Rose-gold body', swatch: '#3661a9', builtinPath: '/models/dragon/dragon_v2_sapphire_sky.glb' },
  { id: 'v3', label: 'White Gold', sub: 'Pure sculptural', swatch: '#dfe1e3', builtinPath: '/models/dragon/dragon_v3_white_gold.glb' },
  { id: 'v4', label: 'Crimson Lacquer', sub: 'Sapphire eyes', swatch: '#7b1e1e', builtinPath: '/models/dragon/dragon_v4_crimson_dragon.glb' },
];

export const DEFAULT_METALS: MetalVariant[] = [
  { id: 'rose_gold', label: 'Rose Gold', swatch: '#c98363' },
  { id: 'white_gold', label: 'White Gold', swatch: '#dfe1e3' },
  { id: 'yellow_gold', label: 'Yellow Gold', swatch: '#d4ad58' },
];

const builtinMetalParts = (metal: MetalId): MetalPartSources => ({
  caseBody: { type: 'builtin', path: `/models/case_body/case_body_${metal}.glb` },
  case: { type: 'builtin', path: `/models/case/case_${metal}.glb` },
  movement: { type: 'builtin', path: `/models/movement/movement_${metal}.glb` },
});

const builtinGlobePart = (metal: MetalId): ModelSource => ({
  type: 'builtin',
  path: `/models/parts/globe_${metal}.glb`,
});

export function buildDefaultGlobeParts(): GlobePartSources {
  return {
    rose_gold: builtinGlobePart('rose_gold'),
    white_gold: builtinGlobePart('white_gold'),
    yellow_gold: builtinGlobePart('yellow_gold'),
  };
}

export const AR_COMBO_BUILTIN_DIR = '/models/ar/combos';

export function builtinArComboPath(dragon: DragonId, metal: MetalId): string {
  return `${AR_COMBO_BUILTIN_DIR}/${dragon}_${metal}.glb`;
}

export function buildDefaultArCombos(): NonNullable<SiteCatalog['arCombos']> {
  const combos = {} as Record<`${DragonId}_${MetalId}`, ModelSource>;
  for (const d of DEFAULT_DRAGONS) {
    for (const m of DEFAULT_METALS) {
      const key = `${d.id}_${m.id}` as `${DragonId}_${MetalId}`;
      combos[key] = { type: 'builtin', path: builtinArComboPath(d.id, m.id) };
    }
  }
  return combos;
}

export function builtinPartIconPath(id: ComponentId): string {
  return `/images/parts/${id}.svg`;
}

export function buildDefaultPartIcons(): PartIconSources {
  const ids: ComponentId[] = ['dragon', 'case', 'movement', 'dial', 'globe', 'strap'];
  const out: PartIconSources = {};
  for (const id of ids) {
    out[id] = { type: 'builtin', path: builtinPartIconPath(id) };
  }
  return out;
}

export const DEFAULT_CATALOG: SiteCatalog = {
  dragons: DEFAULT_DRAGONS,
  metals: DEFAULT_METALS,
  partIcons: buildDefaultPartIcons(),
  components: [
    { id: 'dragon', label: 'Dragon' },
    { id: 'case', label: 'Case & Bezel' },
    { id: 'movement', label: 'Movement' },
    { id: 'dial', label: 'Dial' },
    { id: 'globe', label: 'Globe' },
    { id: 'strap', label: 'Strap' },
  ],
  staticParts: {
    dial: { type: 'builtin', path: '/models/parts/dial.glb' },
    globe: { type: 'builtin', path: '/models/parts/globe_rose_gold.glb' },
    hand: { type: 'builtin', path: '/models/parts/hand.glb' },
    strap: { type: 'builtin', path: '/models/parts/strap.glb' },
  },
  globeParts: buildDefaultGlobeParts(),
  metalParts: {
    rose_gold: builtinMetalParts('rose_gold'),
    white_gold: builtinMetalParts('white_gold'),
    yellow_gold: builtinMetalParts('yellow_gold'),
  },
  heroWatch: { type: 'builtin', path: '/models/full_watch/watch_full_default.glb' },
  arWatch: { type: 'builtin', path: '/models/full_watch/watch_full_ar.glb' },
  arCombos: buildDefaultArCombos(),
};

export const DEFAULT_CONTENT: SiteContent = {
  meta: {
    title: 'Astronomia Dragon — Jacob & Co',
    description:
      'A hand-engraved 18K rose gold dragon orbits a triple-axis gravitational tourbillon, a lacquered terrestrial globe, and a faceted diamond. Explore every component in 3D.',
  },
  header: {
    brand: 'JACOB & CO',
    nav: [
      { label: 'The Dragon', href: '#story' },
      { label: 'Configurator', href: '#configurator' },
      { label: 'Specifications', href: '#specs' },
      { label: 'Inquire', href: '#inquire' },
    ],
    ctaLabel: 'Reserve',
    ctaHref: '#inquire',
  },
  hero: {
    eyebrow: 'The Astronomia Collection',
    titleLine1: 'Astronomia',
    titleLine2: 'Dragon',
    body: 'A hand-engraved 18K rose-gold dragon orbits a triple-axis gravitational tourbillon — for eighteen people who will ever own one.',
    scrollHint: 'Scroll to reveal ↓',
    loadingTitle: 'Preparing 3D experience',
    loadingSubtitle: 'Loading the dragon…',
    exploreConfiguratorLabel: 'Explore the configurator ↓',
  },
  storyPanels: [
    {
      eyebrow: 'The Dragon',
      title: '2,294 scales. One pair of hands.',
      body: 'The dragon is cast in three solid parts of 18K rose gold, then engraved, polished and hand-painted by a single master artisan over several weeks. Each scale is articulated individually.',
      side: 'right',
      metric: { value: '2,294', label: 'Hand-engraved scales' },
    },
    {
      eyebrow: 'The Movement',
      title: 'JCAM10. Gravity in three dimensions.',
      body: 'A gravitational triple-axis tourbillon rotates on three independent axes — every 60 seconds, every 5 minutes, every 20 minutes — perpetually defying the pull of gravity on the escapement.',
      side: 'left',
      metric: { value: '60 h', label: 'Power reserve' },
    },
    {
      eyebrow: 'The Cosmos in Miniature',
      title: 'A globe of magnesium-lacquered earth.',
      body: 'At the heart of the dial, a faceted spherical diamond and a hand-lacquered terrestrial globe orbit the central differential, completing one revolution every minute.',
      side: 'right',
      metric: { value: '1 min', label: 'Globe rotation' },
    },
    {
      eyebrow: 'The Architecture',
      title: 'Six sapphire crystals. No hidden faces.',
      body: 'The cage-like 47mm rose-gold case carries six pieces of sapphire — top, bottom, caseband, and between every lug — so the mechanism is visible from any angle.',
      side: 'left',
      metric: { value: '47 mm', label: '18K rose-gold case' },
    },
  ],
  configurator: {
    eyebrow: 'Configurator',
    title: 'Make it yours.',
    description:
      'Choose the dragon\'s finish and the case metal. Click any component to isolate it; hover for a quick peek.',
    keepGlobeLabel: 'Keep original globe',
    keepGlobeHint: 'Case, bezel & movement still follow the metal picker',
    editionLine: 'Limited to 18 pieces worldwide · AT112.40.DR.SD.A',
    shareLinkLabel: 'Copy link to this configuration',
    shareLinkCopied: 'Link copied',
    resetViewLabel: 'Reset view',
    arButtonLabel: 'View in AR',
    arDesktopHint: 'On desktop · scan QR to your phone',
    arMobileHint: 'Best on iPhone · opens AR in your space',
    arSizeHint: 'AR model ~15 MB · first open may take a moment on cellular',
  },
  specs: {
    eyebrow: 'Specifications',
    title: 'An exact accounting.',
    rows: [
      { label: 'Reference', value: 'AT112.40.DR.SD.A' },
      { label: 'Movement', value: 'Jacob & Co. JCAM10 — manual winding' },
      { label: 'Complication', value: 'Triple-axis gravitational tourbillon (60s / 5min / 20min)' },
      { label: 'Power reserve', value: '60 hours' },
      { label: 'Case', value: '18K rose gold · 47 mm × 25 mm' },
      { label: 'Crystal', value: 'Six sapphire crystals (top, bottom, caseband, lugs)' },
      { label: 'Dragon', value: '18K rose gold, hand-engraved with 2,294 scales' },
      { label: 'Globe', value: 'Magnesium-lacquered terrestrial globe · 1-minute rotation' },
      { label: 'Water resistance', value: '30 m' },
      { label: 'Limited edition', value: '18 pieces' },
    ],
  },
  cta: {
    eyebrow: 'By Appointment',
    title: 'Begin a conversation.',
    body: 'Only eighteen pieces will exist. Each is finished to the wearer\'s specification by our master engravers in Geneva. Reach out to schedule a private viewing at the boutique nearest you.',
    primaryLabel: 'Request a viewing',
    primaryHref: 'mailto:concierge@jacobandco.com?subject=Astronomia%20Dragon%20Inquiry',
    secondaryLabel: 'Find a boutique',
    secondaryHref: 'https://jacobandco.com/boutiques',
    footerLine: 'Geneva · Monaco · New York · Dubai · Hong Kong · Tokyo',
  },
  footer: '© Jacob & Co. · Astronomia Dragon · This page is an interactive presentation.',
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  version: SITE_CONFIG_VERSION,
  features: {
    showSceneControls: false,
    showArButton: true,
    showPerformanceOverlay: false,
  },
  featureFlags: {
    useOptimizedAssets: false,
    consolidatedMetals: false,
    assetVariantByPlatform: {
      desktop: 'original',
      android: 'original',
      ios: 'ios',
    },
  },
  materialOverrides: {
    metal: DEFAULT_METAL_OVERRIDES,
  },
  theme: DEFAULT_THEME,
  scene: DEFAULT_SETTINGS,
  ar: DEFAULT_AR_SETTINGS,
  content: DEFAULT_CONTENT,
  catalog: DEFAULT_CATALOG,
};
