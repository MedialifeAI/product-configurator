import { useGLTF } from '@react-three/drei';
import { getConfiguratorPartUrls, getDragonUrl } from '@/lib/catalogFromConfig';
import type { DragonId, MetalId, SiteCatalog, SiteConfig } from '@/lib/siteConfigTypes';

/**
 * Drop drei's GLTF cache for the configurator's models so AR / Quick Look can
 * reclaim GPU memory on iOS.
 *
 * `runtime` carries the *resolved* variant flags from renderQuality, not raw
 * `config.featureFlags` — the persisted config never contains the runtime-only
 * `useIosAssets` flag, so reading it from there would leave the iOS cache
 * untouched (we'd be clearing /models/ URLs while the actually-loaded ones
 * were /models-ios/). `config` is still needed for consolidatedMetals + any
 * persisted asset-variant fallback.
 */
export function releaseConfiguratorGltfCache(
  catalog: SiteCatalog,
  config: SiteConfig,
  dragon: DragonId,
  metal: MetalId,
  globeMetal: MetalId,
  runtime: { useOptimizedAssets?: boolean; useIosAssets?: boolean },
): void {
  const featureFlags = {
    ...config.featureFlags,
    useOptimizedAssets: runtime.useOptimizedAssets,
    useIosAssets: runtime.useIosAssets,
  };
  const configWithRuntime = { ...config, featureFlags };
  const urlOpts = {
    useOptimizedAssets: runtime.useOptimizedAssets,
    useIosAssets: runtime.useIosAssets,
    consolidatedMetals: config.featureFlags?.consolidatedMetals,
    globeMetal,
  };

  for (const d of catalog.dragons) {
    useGLTF.clear(getDragonUrl(catalog, d.id, configWithRuntime));
  }
  const parts = getConfiguratorPartUrls(catalog, metal, urlOpts);
  for (const url of Object.values(parts)) {
    useGLTF.clear(url);
  }
  useGLTF.clear(getDragonUrl(catalog, dragon, configWithRuntime));
}
