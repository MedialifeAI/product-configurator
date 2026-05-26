/** Shared AR / QR handoff helpers for Google Model Viewer + mobile deep links. */

/** Draco-compressed watch for AR (run `npm run compress:ar`). Falls back to hero GLB if missing. */
export const AR_MODEL_GLB = '/models/full_watch/watch_full_ar.glb';
export const AR_MODEL_GLB_FALLBACK = '/models/full_watch/watch_full_default.glb';
/** Add a matching .usdz beside the GLB to enable iOS Quick Look (optional). */
export const AR_MODEL_USDZ = '/models/full_watch/watch_full_ar.usdz';

export type DragonId = 'v1' | 'v2' | 'v3' | 'v4';
export type MetalId = 'rose_gold' | 'white_gold' | 'yellow_gold';

export interface ArHandoffConfig {
  dragon: DragonId;
  metal: MetalId;
}

export interface ParsedArParams extends Partial<ArHandoffConfig> {
  openAr: boolean;
}

const DRAGON_IDS: DragonId[] = ['v1', 'v2', 'v3', 'v4'];
const METAL_IDS: MetalId[] = ['rose_gold', 'white_gold', 'yellow_gold'];

export function isDragonId(value: string | null): value is DragonId {
  return value !== null && DRAGON_IDS.includes(value as DragonId);
}

export function isMetalId(value: string | null): value is MetalId {
  return value !== null && METAL_IDS.includes(value as MetalId);
}

/** True when the device can launch Scene Viewer / Quick Look / WebXR. */
export function isMobileArDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as Mac with touch
  return navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform);
}

export function parseArSearchParams(search: string): ParsedArParams {
  const params = new URLSearchParams(search);
  const dragon = params.get('dragon');
  const metal = params.get('metal');
  return {
    openAr: params.get('ar') === '1',
    ...(isDragonId(dragon) ? { dragon } : {}),
    ...(isMetalId(metal) ? { metal } : {}),
  };
}

/** Build the URL encoded in the desktop QR code. */
export function buildArHandoffUrl(
  baseHref: string,
  config: ArHandoffConfig,
  hash = '#configurator',
): string {
  const u = new URL(baseHref);
  u.search = '';
  u.searchParams.set('ar', '1');
  u.searchParams.set('dragon', config.dragon);
  u.searchParams.set('metal', config.metal);
  u.hash = hash;
  return u.toString();
}

/** Remove handoff query keys so refresh does not re-open AR. */
export function stripArParamsFromUrl(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('ar');
  u.searchParams.delete('dragon');
  u.searchParams.delete('metal');
  return u.toString();
}

export function scrollToConfigurator(hash = '#configurator'): void {
  const id = hash.replace(/^#/, '');
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  window.location.hash = hash;
}
