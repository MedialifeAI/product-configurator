/**
 * Asset variant routing.
 *
 * Three GLB variants exist on disk:
 *   - 'original'  → /models/...           (full quality, 37M tris total)
 *   - 'optimized' → /models-optimized/... (Meshopt-encoded; same VRAM as original)
 *   - 'ios'       → /models-ios/...       (decimated ~10% triangle count; iOS-safe)
 *
 * Which variant loads is decided by the detected platform + admin config:
 *   1. URL override   `?variant=original|optimized|ios`  (highest priority, QA)
 *   2. URL override   `?platform=desktop|android|ios`    (simulate platform)
 *   3. Legacy URL     `?ios=1`                           (simulates iOS platform)
 *   4. Admin config   featureFlags.assetVariantByPlatform[detectedPlatform]
 *   5. Hard defaults  (desktop/android → original, ios → ios)
 *
 * No localStorage persistence — URL params last only for the page load.
 * Durable per-platform routing lives in admin config.
 */
import { isIosDevice } from '@/lib/ar';

export type AssetVariant = 'original' | 'optimized' | 'ios';
export type Platform = 'desktop' | 'android' | 'ios';

export interface AssetVariantByPlatform {
  desktop?: AssetVariant;
  android?: AssetVariant;
  ios?: AssetVariant;
}

/**
 * Hard defaults applied when the admin hasn't set an explicit value for a
 * platform. iOS gets the decimated assets out of the box; everyone else keeps
 * the full-fidelity originals so we don't regress desktop / Android quality.
 */
export const DEFAULT_ASSET_VARIANT_BY_PLATFORM: Required<AssetVariantByPlatform> = {
  desktop: 'original',
  android: 'original',
  ios: 'ios',
};

const ASSET_VARIANTS: ReadonlySet<AssetVariant> = new Set(['original', 'optimized', 'ios']);
const PLATFORMS: ReadonlySet<Platform> = new Set(['desktop', 'android', 'ios']);

function readUrlParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

/** Heuristic UA-based detection. Real iPhones/iPads + iPadOS-on-Mac. */
function detectNativePlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  if (isIosDevice()) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

/**
 * Resolve the *effective* platform for asset routing.
 *
 * QA overrides via URL win:
 *   `?platform=ios|android|desktop`  → return that
 *   `?ios=1`                          → return 'ios' (legacy alias)
 * Otherwise return the natively-detected platform.
 */
export function detectPlatform(): Platform {
  const params = readUrlParams();
  const explicit = params?.get('platform');
  if (explicit && (PLATFORMS as ReadonlySet<string>).has(explicit)) {
    return explicit as Platform;
  }
  const legacyIos = params?.get('ios');
  if (legacyIos === '1' || legacyIos === 'true') return 'ios';
  return detectNativePlatform();
}

/**
 * Resolve which asset variant the current session should load. URL
 * `?variant=…` overrides everything (for visual QA across platforms).
 */
export function resolveAssetVariant(byPlatform?: AssetVariantByPlatform): AssetVariant {
  const params = readUrlParams();
  const explicit = params?.get('variant');
  if (explicit && (ASSET_VARIANTS as ReadonlySet<string>).has(explicit)) {
    return explicit as AssetVariant;
  }
  const platform = detectPlatform();
  return byPlatform?.[platform] ?? DEFAULT_ASSET_VARIANT_BY_PLATFORM[platform];
}

/** Back-compat convenience for the existing `useIosAssets` boolean threading. */
export function shouldUseIosAssets(byPlatform?: AssetVariantByPlatform): boolean {
  return resolveAssetVariant(byPlatform) === 'ios';
}

/** Back-compat convenience for the existing `useOptimizedAssets` boolean threading. */
export function shouldUseOptimizedAssets(byPlatform?: AssetVariantByPlatform): boolean {
  return resolveAssetVariant(byPlatform) === 'optimized';
}

/**
 * One-time cleanup of the legacy `jacob:ios-sim` localStorage key from the
 * previous (sticky) simulator implementation. Anyone who tried `?ios=1` for
 * QA had that key persisted — without this, default-URL visits would keep
 * routing to /models-ios/ forever.
 */
function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('jacob:ios-sim');
  } catch {
    /* private mode / quota — ignore */
  }
}

clearLegacyStorage();
