import type { ModelQuality } from '@/context/SceneSettings';
import type { DeviceTier } from '@/lib/deviceTier';
import { isIosDevice } from '@/lib/ar';
import { resolveAssetVariant, resolveIosVariant, type IosHeroVariant } from '@/lib/assetRouting';
import type { SiteFeatureFlags } from '@/lib/siteConfigTypes';

export interface RenderQualitySettings {
  dpr: [number, number];
  antialias: boolean;
  /** When true, prefer /models-optimized paths. */
  useOptimizedAssets: boolean;
  /**
   * When true, load /models-ios paths (decimated meshes, ~10% triangle count).
   * Resolved per-session from admin config (`assetVariantByPlatform`) + the
   * detected platform + URL overrides. Takes precedence over useOptimizedAssets.
   */
  useIosAssets: boolean;
  /**
   * Which iOS quality tier to use for the hero watch specifically.
   * 'ios' = ultra-low (safe for all iPhones), 'ios-mh' = medium-high,
   * 'ios-xh' = extra-high. Only meaningful when useIosAssets is true.
   */
  iosVariant: IosHeroVariant;
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

/**
 * Resolve the active asset variant for this session.
 *
 * Priority: URL ?variant= → admin `assetVariantByPlatform[detectedPlatform]`
 *          → legacy `useOptimizedAssets` boolean → hard defaults.
 */
function resolveVariantFlags(
  featureFlags: SiteFeatureFlags | undefined,
  effective: ModelQuality,
): { useOptimizedAssets: boolean; useIosAssets: boolean; iosVariant: IosHeroVariant } {
  const byPlatform = featureFlags?.assetVariantByPlatform;
  const variant = resolveAssetVariant(byPlatform);

  // Variant 'optimized' from admin config / URL override beats the legacy flag.
  if (variant === 'optimized') return { useOptimizedAssets: true, useIosAssets: false, iosVariant: 'ios' };

  // Any iOS-family variant → set useIosAssets + resolve which quality tier.
  if (variant === 'ios' || variant === 'ios-mh' || variant === 'ios-xh') {
    return { useOptimizedAssets: false, useIosAssets: true, iosVariant: resolveIosVariant(byPlatform) };
  }

  // variant === 'original' → respect the legacy useOptimizedAssets boolean if
  // it's explicitly set, otherwise nudge the low quality preset toward optimized
  // (preserves prior "auto-low → optimized" behaviour from earlier releases).
  if (featureFlags?.useOptimizedAssets === true)  return { useOptimizedAssets: true,  useIosAssets: false, iosVariant: 'ios' };
  if (featureFlags?.useOptimizedAssets === false) return { useOptimizedAssets: false, useIosAssets: false, iosVariant: 'ios' };
  return { useOptimizedAssets: effective === 'low', useIosAssets: false, iosVariant: 'ios' };
}

/** Map admin model-quality preset to canvas DPR, AA, and asset variant. */
export function resolveRenderQuality(
  quality: ModelQuality,
  tier: DeviceTier,
  featureFlags?: SiteFeatureFlags,
): RenderQualitySettings {
  const effective = quality === 'auto' ? tierToQuality(tier) : quality;
  const { useOptimizedAssets, useIosAssets, iosVariant } = resolveVariantFlags(featureFlags, effective);

  switch (effective) {
    case 'low':
      // iOS maps to low tier — keep memory caps but restore MSAA + sharper DPR (no AA looked jagged/blurry).
      return { dpr: [1, 1.5], antialias: true,  useOptimizedAssets, useIosAssets, iosVariant };
    case 'medium':
      return { dpr: [1, 1.5], antialias: false, useOptimizedAssets, useIosAssets, iosVariant };
    case 'high':
      return { dpr: [1, 2],   antialias: true,  useOptimizedAssets, useIosAssets, iosVariant };
    default:
      return resolveRenderQuality('auto', tier, featureFlags);
  }
}

/** Skip warming every variant GLB on low-quality / low-tier viewports. */
export function shouldWarmVariantPreload(quality: ModelQuality, tier: DeviceTier): boolean {
  const effective = quality === 'auto' ? tierToQuality(tier) : quality;
  return effective !== 'low' && tier !== 'low';
}
