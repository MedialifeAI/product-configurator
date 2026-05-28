/**
 * iOS asset routing detection.
 *
 * Real iOS devices always load /models-ios/ (decimated to ~10% triangle count).
 * Desktop / Android can opt in to the iOS asset path for QA via:
 *   - ?ios=1 in the URL  (sets a localStorage flag so it persists across nav)
 *   - ?ios=0 in the URL  (clears the flag)
 *
 * This is read at module-eval time on the client; it does not react to URL
 * changes mid-session — refresh the page after toggling.
 */
import { isIosDevice } from '@/lib/ar';

const STORAGE_KEY = 'jacob:ios-sim';

function readQueryFlag(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ios');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function readStoredFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistFlag(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode failures */
  }
}

/** True iff the current session should load iOS-decimated /models-ios/ assets. */
export function shouldUseIosAssets(): boolean {
  if (typeof window === 'undefined') return false;

  // Real iOS device → always iOS assets.
  if (isIosDevice()) return true;

  // Desktop / Android simulator override via ?ios=1 (persisted).
  const queryFlag = readQueryFlag();
  if (queryFlag !== null) {
    persistFlag(queryFlag);
    return queryFlag;
  }
  return readStoredFlag();
}
