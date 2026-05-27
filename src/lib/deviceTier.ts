export type DeviceTier = 'low' | 'mid' | 'high';

/** Classify GPU/memory budget from UA + hardware hints (SSR-safe). */
export function getDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'mid';

  const ua = navigator.userAgent ?? '';
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Mac/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isIOS) return 'low';
  if (mem <= 4 || cores <= 4) return 'mid';
  return 'high';
}
