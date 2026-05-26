import { AR_MODEL_GLB, AR_MODEL_GLB_FALLBACK } from '@/lib/ar';

/** Preload AR GLB only when the user is about to open AR (avoids a 200+ MB fetch on page load). */
export function warmArModelUrl(url: string): void {
  if (typeof document === 'undefined') return;
  const escaped = url.replace(/"/g, '\\"');
  if (document.querySelector(`link[rel="preload"][href="${escaped}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'fetch';
  link.href = url;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/** Warm compressed AR asset, with fallback path if the primary file is not deployed yet. */
export function warmArCatalogUrl(primaryUrl: string): void {
  warmArModelUrl(primaryUrl);
  if (primaryUrl !== AR_MODEL_GLB_FALLBACK && primaryUrl !== AR_MODEL_GLB) {
    warmArModelUrl(AR_MODEL_GLB_FALLBACK);
  }
}
