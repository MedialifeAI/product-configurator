import type { ModelQuality } from '@/context/SceneSettings';
import type { DeviceTier } from '@/lib/deviceTier';
import { isIosDevice } from '@/lib/ar';
import { shouldUseIosAssets } from '@/lib/iosSimulation';

export interface RenderQualitySettings {
  dpr: [number, number];
  antialias: boolean;
  /** When true, prefer /models-optimized paths. */
  useOptimizedAssets: boolean;
  /**
   * When true, load /models-ios paths (decimated meshes, ~10% triangle count).
   * Set automatically for real iOS devices and the ?ios=1 simulator override.
   * Takes precedence over useOptimizedAssets.
   */
  useIosAssets: boolean;
}

export function resolveWebGlPowerPreference(tier: DeviceTier): WebGLPowerPreference {
  if (isIosDevice()) return 'default';
  if (tier === 'low') return 'low-power';
  return 'high-performance';
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
  const useIosAssets = shouldUseIosAssets();

  switch (effective) {
    case 'low':
      // iOS maps to low tier — keep memory caps but restore MSAA + sharper DPR (no AA looked jagged/blurry).
      return {
        dpr: [1, 1.5],
        antialias: true,
        useOptimizedAssets,
        useIosAssets,
      };
    case 'medium':
      return {
        dpr: [1, 1.5],
        antialias: false,
        useOptimizedAssets,
        useIosAssets,
      };
    case 'high':
      return {
        dpr: [1, 2],
        antialias: true,
        useOptimizedAssets,
        useIosAssets,
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
