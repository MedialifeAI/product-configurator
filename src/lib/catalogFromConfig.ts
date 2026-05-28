import type { MetalId, SiteCatalog, SiteConfig } from '@/lib/siteConfigTypes';
import {
  dragonModelUrl,
  globePartUrl,
  metalPartUrl,
  staticPartUrl,
} from '@/lib/resolveModelUrl';

export type CatalogUrlOptions = {
  globeMetal?: MetalId;
  useOptimizedAssets?: boolean;
  useIosAssets?: boolean;
  consolidatedMetals?: boolean;
};

function catalogOptions(config?: Pick<SiteConfig, 'featureFlags'>): CatalogUrlOptions {
  return {
    useOptimizedAssets: config?.featureFlags?.useOptimizedAssets ?? false,
    useIosAssets: config?.featureFlags?.useIosAssets ?? false,
    consolidatedMetals: config?.featureFlags?.consolidatedMetals ?? false,
  };
}

export function getDragonUrl(
  catalog: SiteCatalog,
  dragonId: string,
  config?: Pick<SiteConfig, 'featureFlags'>,
): string {
  const d = catalog.dragons.find(x => x.id === dragonId);
  if (!d) return catalog.dragons[0]!.builtinPath;
  return dragonModelUrl(d, catalogOptions(config));
}

export function getConfiguratorPartUrls(
  catalog: SiteCatalog,
  metal: MetalId,
  options?: CatalogUrlOptions,
): {
  caseBody: string;
  case: string;
  movement: string;
  dial: string;
  globe: string;
  hand: string;
  strap: string;
} {
  const globeMetal = options?.globeMetal ?? metal;
  const urlOpts = {
    useOptimizedAssets: options?.useOptimizedAssets,
    useIosAssets: options?.useIosAssets,
    consolidatedMetals: options?.consolidatedMetals,
  };
  return {
    caseBody: metalPartUrl(catalog, metal, 'caseBody', urlOpts),
    case: metalPartUrl(catalog, metal, 'case', urlOpts),
    movement: metalPartUrl(catalog, metal, 'movement', urlOpts),
    dial: staticPartUrl(catalog, 'dial', '/models/parts/dial.glb', urlOpts),
    globe: globePartUrl(catalog, globeMetal, urlOpts),
    hand: staticPartUrl(catalog, 'hand', '/models/parts/hand.glb', urlOpts),
    strap: staticPartUrl(catalog, 'strap', '/models/parts/strap.glb', urlOpts),
  };
}

/** Apply catalog blob/url overrides into catalog model fields from registry keys */
export function syncCatalogFromBlobKeys(config: SiteConfig): SiteConfig {
  const c = { ...config, catalog: { ...config.catalog } };
  // Registry keys are documentation; catalog stores ModelSource on each entity.
  return c;
}
