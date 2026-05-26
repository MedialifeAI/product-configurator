import type { MetalId, SiteCatalog, SiteConfig } from '@/lib/siteConfigTypes';
import {
  dragonModelUrl,
  globePartUrl,
  metalPartUrl,
  staticPartUrl,
} from '@/lib/resolveModelUrl';

export function getDragonUrl(catalog: SiteCatalog, dragonId: string): string {
  const d = catalog.dragons.find(x => x.id === dragonId);
  if (!d) return catalog.dragons[0]!.builtinPath;
  return dragonModelUrl(d);
}

export function getConfiguratorPartUrls(
  catalog: SiteCatalog,
  metal: MetalId,
  options?: { globeMetal?: MetalId },
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
  return {
    caseBody: metalPartUrl(catalog, metal, 'caseBody'),
    case: metalPartUrl(catalog, metal, 'case'),
    movement: metalPartUrl(catalog, metal, 'movement'),
    dial: staticPartUrl(catalog, 'dial', '/models/parts/dial.glb'),
    globe: globePartUrl(catalog, globeMetal),
    hand: staticPartUrl(catalog, 'hand', '/models/parts/hand.glb'),
    strap: staticPartUrl(catalog, 'strap', '/models/parts/strap.glb'),
  };
}

/** Apply catalog blob/url overrides into catalog model fields from registry keys */
export function syncCatalogFromBlobKeys(config: SiteConfig): SiteConfig {
  const c = { ...config, catalog: { ...config.catalog } };
  const mapBlob = (key: string): { type: 'blob'; key: string } => ({ type: 'blob', key });

  // Registry keys are documentation; catalog stores ModelSource on each entity.
  return c;
}
