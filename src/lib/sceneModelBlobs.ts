import { getDeployStore, getStore } from '@netlify/blobs';
import type { ModelSlot } from '@/lib/sceneSettingsShared';

const STORE_NAME = 'jacobco-scene-models';

function blobKey(slot: ModelSlot): string {
  return `${slot}.glb`;
}

function modelStore() {
  if (process.env.CONTEXT === 'production') {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return getDeployStore(STORE_NAME);
}

export async function saveModelBlob(slot: ModelSlot, data: ArrayBuffer): Promise<void> {
  await modelStore().set(blobKey(slot), data, {
    metadata: { contentType: 'model/gltf-binary' },
  });
}

export async function getModelBlob(slot: ModelSlot): Promise<ArrayBuffer | null> {
  const data = await modelStore().get(blobKey(slot), { type: 'arrayBuffer' });
  return data ?? null;
}

export async function deleteModelBlob(slot: ModelSlot): Promise<void> {
  await modelStore().delete(blobKey(slot));
}

export async function modelBlobExists(slot: ModelSlot): Promise<boolean> {
  const meta = await modelStore().getMetadata(blobKey(slot));
  return meta !== null;
}
