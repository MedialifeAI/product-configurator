import { isDragonId, isMetalId, type DragonId, type MetalId } from '@/lib/ar';

export interface ConfigUrlState {
  dragon?: DragonId;
  metal?: MetalId;
}

/** Read dragon/metal from URL (no AR flag). */
export function parseConfigSearchParams(search: string): ConfigUrlState {
  const params = new URLSearchParams(search);
  const dragon = params.get('dragon');
  const metal = params.get('metal');
  return {
    ...(isDragonId(dragon) ? { dragon } : {}),
    ...(isMetalId(metal) ? { metal } : {}),
  };
}

/** Shareable configurator deep link (no AR auto-open). */
export function buildConfigShareUrl(
  baseHref: string,
  state: { dragon: DragonId; metal: MetalId },
  hash = '#configurator',
): string {
  const u = new URL(baseHref);
  const params = new URLSearchParams(u.search);
  params.delete('ar');
  params.set('dragon', state.dragon);
  params.set('metal', state.metal);
  u.search = params.toString() ? `?${params.toString()}` : '';
  u.hash = hash;
  return u.toString();
}

/** Keep URL in sync without reload; preserves unrelated query keys except clears `ar`. */
export function syncConfigSearchParams(
  dragon: DragonId,
  metal: MetalId,
  hash = '#configurator',
): void {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  u.searchParams.delete('ar');
  u.searchParams.set('dragon', dragon);
  u.searchParams.set('metal', metal);
  u.hash = hash;
  window.history.replaceState({}, '', u.toString());
}
