/** @deprecated Use @/lib/modelBlobs — legacy hero/config slot names */
import { deleteModelBlob as del, getModelBlob as get, saveModelBlob as save } from '@/lib/modelBlobs';
import type { ModelSlot } from '@/lib/sceneSettingsShared';

const LEGACY_KEYS: Record<ModelSlot, string> = {
  hero: 'hero-watch',
  config: 'config-assembly',
};

export async function saveModelBlob(slot: ModelSlot, data: ArrayBuffer) {
  return save(LEGACY_KEYS[slot], data);
}
export async function getModelBlob(slot: ModelSlot) {
  return get(LEGACY_KEYS[slot]);
}
export async function deleteModelBlob(slot: ModelSlot) {
  return del(LEGACY_KEYS[slot]);
}
