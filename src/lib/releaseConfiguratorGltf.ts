import { useGLTF } from '@react-three/drei';
import { getConfiguratorPartUrls, getDragonUrl } from '@/lib/catalogFromConfig';
import type { DragonId, MetalId, SiteCatalog, SiteConfig } from '@/lib/siteConfigTypes';

/** Drop drei GLTF cache so AR / Quick Look can use GPU memory on iOS. */
export function releaseConfiguratorGltfCache(
  catalog: SiteCatalog,
  config: SiteConfig,
  dragon: DragonId,
  metal: MetalId,
  globeMetal: MetalId,
): void {
  const urlOpts = {
    useOptimizedAssets: config.featureFlags?.useOptimizedAssets,
    globeMetal,
  };

  for (const d of catalog.dragons) {
    useGLTF.clear(getDragonUrl(catalog, d.id, config));
  }
  const parts = getConfiguratorPartUrls(catalog, metal, urlOpts);
  for (const url of Object.values(parts)) {
    useGLTF.clear(url);
  }
  useGLTF.clear(getDragonUrl(catalog, dragon, config));
}
