import type {
  ArPreset,
  ArSettings,
  DragonId,
  MetalId,
  SiteCatalog,
  SiteConfig,
} from '@/lib/siteConfigTypes';
import { DEFAULT_AR_SETTINGS } from '@/lib/siteConfigTypes';
import { arWatchUrl, resolveSource } from '@/lib/resolveModelUrl';

export type { ArPreset, ArSettings };
export { DEFAULT_AR_SETTINGS };

export type ArComboKey = `${DragonId}_${MetalId}`;

export function arComboKey(dragon: DragonId, metal: MetalId): ArComboKey {
  return `${dragon}_${metal}`;
}

export function buildArPresets(catalog: SiteCatalog, maxPresets = 0): ArPreset[] {
  const out: ArPreset[] = [];
  for (const d of catalog.dragons) {
    for (const m of catalog.metals) {
      out.push({
        dragon: d.id,
        metal: m.id,
        label: `${d.label.split(' ')[0]} · ${m.label}`,
      });
    }
  }
  if (maxPresets > 0) return out.slice(0, maxPresets);
  return out;
}

export function resolveArComboModelUrl(
  catalog: SiteCatalog,
  dragon: DragonId,
  metal: MetalId,
): string {
  const key = arComboKey(dragon, metal);
  const combo = catalog.arCombos?.[key];
  if (combo) return resolveSource(combo, arWatchUrl(catalog));
  return arWatchUrl(catalog);
}

export type ModelViewerDimensions = { x: number; y: number; z: number };

export function computeModelViewerScale(
  dimensions: ModelViewerDimensions,
  ar: ArSettings,
): number {
  const width = Math.max(dimensions.x, dimensions.z, 0.001);
  const targetM = (ar.caseDiameterMm / 1000) * ar.sizeMultiplier;
  return (targetM / width) * ar.previewScale;
}

export function formatScaleTriple(scale: number): string {
  const s = scale.toFixed(4);
  return `${s} ${s} ${s}`;
}

export function mergeArSettings(partial?: Partial<ArSettings>): ArSettings {
  return { ...DEFAULT_AR_SETTINGS, ...partial };
}

export function getArFromConfig(config: SiteConfig): ArSettings {
  return config.ar ?? DEFAULT_AR_SETTINGS;
}
