import { modelApiUrl } from '@/lib/modelBlobs';
import type {
  ComponentId,
  DragonVariant,
  MetalId,
  ModelSource,
  SiteCatalog,
} from '@/lib/siteConfigTypes';
import { builtinPartIconPath } from './siteConfigTypes';

export function resolveSource(src: ModelSource | undefined, fallback: string): string {
  if (!src) return fallback;
  switch (src.type) {
    case 'builtin':
      return src.path?.trim() || fallback;
    case 'url':
      return src.url?.trim() || fallback;
    case 'blob':
      return modelApiUrl(src.key);
    default:
      return fallback;
  }
}

export function heroWatchUrl(catalog: SiteCatalog, sceneOverride: string | null): string {
  if (sceneOverride?.trim()) return sceneOverride.trim();
  return resolveSource(catalog.heroWatch, '/models/full_watch/watch_full_default.glb');
}

const AR_WATCH_DEFAULT = '/models/full_watch/watch_full_ar.glb';

export function arWatchUrl(catalog: SiteCatalog): string {
  return resolveSource(catalog.arWatch, AR_WATCH_DEFAULT);
}

export function dragonModelUrl(dragon: DragonVariant): string {
  return resolveSource(dragon.model, dragon.builtinPath);
}

export function metalPartUrl(
  catalog: SiteCatalog,
  metal: MetalId,
  part: 'caseBody' | 'case' | 'movement',
): string {
  const builtins: Record<typeof part, string> = {
    caseBody: `/models/case_body/case_body_${metal}.glb`,
    case: `/models/case/case_${metal}.glb`,
    movement: `/models/movement/movement_${metal}.glb`,
  };
  const sources = catalog.metalParts[metal];
  return resolveSource(sources?.[part], builtins[part]);
}

export function staticPartUrl(
  catalog: SiteCatalog,
  part: 'dial' | 'hand' | 'strap',
  fallback: string,
): string {
  return resolveSource(catalog.staticParts[part], fallback);
}

export function globePartUrl(catalog: SiteCatalog, metal: MetalId): string {
  const fallback =
    resolveSource(catalog.staticParts.globe, '/models/parts/globe_rose_gold.glb');
  return resolveSource(catalog.globeParts[metal], fallback);
}

export function partIconUrl(catalog: SiteCatalog, id: ComponentId): string {
  return resolveSource(catalog.partIcons?.[id], builtinPartIconPath(id));
}
