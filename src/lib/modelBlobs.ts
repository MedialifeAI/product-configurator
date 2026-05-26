import { getDeployStore, getStore } from '@netlify/blobs';

const STORE_NAME = 'jacobco-scene-models';

function blobStore() {
  if (process.env.CONTEXT === 'production') {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return getDeployStore(STORE_NAME);
}

/** Blob key uses forward slashes, e.g. dragon/v1.glb */
export function modelBlobKey(slot: string): string {
  return slot.endsWith('.glb') ? slot : `${slot}.glb`;
}

export function modelApiUrl(slot: string): string {
  return `/api/models/${slot}`;
}

export async function saveModelBlob(slot: string, data: ArrayBuffer): Promise<void> {
  await blobStore().set(modelBlobKey(slot), data, {
    metadata: { contentType: 'model/gltf-binary' },
  });
}

export async function getModelBlob(slot: string): Promise<ArrayBuffer | null> {
  const data = await blobStore().get(modelBlobKey(slot), { type: 'arrayBuffer' });
  return data ?? null;
}

export async function deleteModelBlob(slot: string): Promise<void> {
  await blobStore().delete(modelBlobKey(slot));
}
