/** Probe and format AR model download size for loading UX. */

const LARGE_AR_BYTES = 50 * 1024 * 1024;

export function formatAssetMegabytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function isLargeArAsset(bytes: number | null | undefined): boolean {
  return typeof bytes === 'number' && bytes > LARGE_AR_BYTES;
}

/** Rough mobile download + decode estimate for UI copy only. */
export function estimateArLoadSeconds(bytes: number | null | undefined): number | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 25) return Math.max(8, Math.round(mb * 0.6));
  if (mb < 80) return Math.round(mb * 1.2);
  return Math.round(mb * 2.5);
}

export async function probeAssetByteSize(url: string): Promise<number | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
    if (!res.ok) return null;
    const len = res.headers.get('content-length');
    if (!len) return null;
    const n = parseInt(len, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
