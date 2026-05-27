import type { ModelQuality } from '@/context/SceneSettings';
import type { DeviceTier } from '@/lib/deviceTier';

export interface RenderQualitySettings {
  dpr: [number, number];
  antialias: boolean;
  /** When true, prefer /models-optimized paths. */
  useOptimizedAssets: boolean;
}

function tierToQuality(tier: DeviceTier): ModelQuality {
  if (tier === 'low') return 'low';
  if (tier === 'mid') return 'medium';
  return 'high';
}

/** Low preset prefers /models-optimized unless the feature flag is explicitly off. */
function resolveOptimizedAssets(globalOptimized: boolean | undefined, effective: ModelQuality): boolean {
  if (globalOptimized === false) return false;
  if (globalOptimized === true) return true;
  return effective === 'low';
}

/** Map admin model-quality preset to canvas DPR, AA, and asset tier. */
export function resolveRenderQuality(
  quality: ModelQuality,
  tier: DeviceTier,
  globalOptimized?: boolean,
): RenderQualitySettings {
  const effective = quality === 'auto' ? tierToQuality(tier) : quality;
  const useOptimizedAssets = resolveOptimizedAssets(globalOptimized, effective);

  switch (effective) {
    case 'low':
      return {
        dpr: [1, 1.25],
        antialias: false,
        useOptimizedAssets,
      };
    case 'medium':
      return {
        dpr: [1, 1.5],
        antialias: false,
        useOptimizedAssets,
      };
    case 'high':
      return {
        dpr: [1, 2],
        antialias: true,
        useOptimizedAssets,
      };
    default:
      return resolveRenderQuality('auto', tier, globalOptimized);
  }
}

/** Skip warming every variant GLB on low-quality / low-tier viewports. */
export function shouldWarmVariantPreload(quality: ModelQuality, tier: DeviceTier): boolean {
  const effective = quality === 'auto' ? tierToQuality(tier) : quality;
  return effective !== 'low' && tier !== 'low';
}
