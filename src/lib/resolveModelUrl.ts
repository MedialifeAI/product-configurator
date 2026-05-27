import { modelApiUrl } from '@/lib/modelBlobs';
import type {
  ComponentId,
  DragonVariant,
  MetalId,
  ModelSource,
  SiteCatalog,
} from '@/lib/siteConfigTypes';
import { builtinPartIconPath } from './siteConfigTypes';

const MODELS_ROOT = '/models';
const OPTIMIZED_ROOT = '/models-optimized';

/** Rewrite a builtin /models/… path to /models-optimized/… when enabled. */
export function toOptimizedModelPath(path: string, useOptimized = false): string {
  if (!useOptimized || !path.startsWith(`${MODELS_ROOT}/`)) return path;
  return `${OPTIMIZED_ROOT}${path.slice(MODELS_ROOT.length)}`;
}

export function resolveSource(
  src: ModelSource | undefined,
  fallback: string,
  options?: { useOptimizedAssets?: boolean },
): string {
  const useOptimized = options?.useOptimizedAssets ?? false;
  if (!src) return toOptimizedModelPath(fallback, useOptimized);
  switch (src.type) {
    case 'builtin':
      return toOptimizedModelPath(src.path?.trim() || fallback, useOptimized);
    case 'url':
      return src.url?.trim() || fallback;
    case 'blob':
      return modelApiUrl(src.key);
    default:
      return toOptimizedModelPath(fallback, useOptimized);
  }
}

export function heroWatchUrl(
  catalog: SiteCatalog,
  sceneOverride: string | null,
  options?: { useOptimizedAssets?: boolean },
): string {
  if (sceneOverride?.trim()) return sceneOverride.trim();
  return resolveSource(
    catalog.heroWatch,
    '/models/full_watch/watch_full_default.glb',
    options,
  );
}

const AR_WATCH_DEFAULT = '/models/full_watch/watch_full_ar.glb';

export function arWatchUrl(
  catalog: SiteCatalog,
  options?: { useOptimizedAssets?: boolean },
): string {
  return resolveSource(catalog.arWatch, AR_WATCH_DEFAULT, options);
}

export function getArUsdzPath(glbPath: string): string {
  if (glbPath.endsWith('.glb')) return glbPath.replace(/\.glb$/i, '.usdz');
  return '/models/full_watch/watch_full_ar.usdz';
}

export function dragonModelUrl(
  dragon: DragonVariant,
  options?: { useOptimizedAssets?: boolean },
): string {
  return resolveSource(dragon.model, dragon.builtinPath, options);
}

export function metalPartUrl(
  catalog: SiteCatalog,
  metal: MetalId,
  part: 'caseBody' | 'case' | 'movement',
  options?: { useOptimizedAssets?: boolean; consolidatedMetals?: boolean },
): string {
  if (options?.consolidatedMetals) {
    const bases: Record<typeof part, string> = {
      caseBody: '/models/case_body/case_body_base.glb',
      case: '/models/case/case_base.glb',
      movement: '/models/movement/movement_base.glb',
    };
    return resolveSource(undefined, bases[part], options);
  }
  const builtins: Record<typeof part, string> = {
    caseBody: `/models/case_body/case_body_${metal}.glb`,
    case: `/models/case/case_${metal}.glb`,
    movement: `/models/movement/movement_${metal}.glb`,
  };
  const sources = catalog.metalParts[metal];
  return resolveSource(sources?.[part], builtins[part], options);
}

export function staticPartUrl(
  catalog: SiteCatalog,
  part: 'dial' | 'hand' | 'strap',
  fallback: string,
  options?: { useOptimizedAssets?: boolean },
): string {
  return resolveSource(catalog.staticParts[part], fallback, options);
}

export function globePartUrl(
  catalog: SiteCatalog,
  metal: MetalId,
  options?: { useOptimizedAssets?: boolean; consolidatedMetals?: boolean },
): string {
  if (options?.consolidatedMetals) {
    return resolveSource(undefined, '/models/parts/globe_base.glb', options);
  }
  const fallback =
    resolveSource(catalog.staticParts.globe, '/models/parts/globe_rose_gold.glb', options);
  return resolveSource(catalog.globeParts[metal], fallback, options);
}

export function partIconUrl(catalog: SiteCatalog, id: ComponentId): string {
  return resolveSource(catalog.partIcons?.[id], builtinPartIconPath(id));
}
