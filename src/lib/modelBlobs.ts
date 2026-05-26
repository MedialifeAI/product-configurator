import { getDeployStore, getStore } from '@netlify/blobs';

const STORE_NAME = 'jacobco-scene-models';

function blobStore() {
  if (process.env.CONTEXT === 'production') {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return getDeployStore(STORE_NAME);
}

const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif|avif)$/i;

/** Blob key uses forward slashes; GLB slots get `.glb`, image slots keep their extension. */
export function modelBlobKey(slot: string): string {
  if (IMAGE_EXT.test(slot)) return slot;
  return slot.endsWith('.glb') ? slot : `${slot}.glb`;
}

export function blobContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return 'model/gltf-binary';
  }
}

export function modelApiUrl(slot: string): string {
  return `/api/models/${slot}`;
}

export async function saveModelBlob(
  slot: string,
  data: ArrayBuffer,
  contentType?: string,
): Promise<void> {
  const key = modelBlobKey(slot);
  await blobStore().set(key, data, {
    metadata: { contentType: contentType ?? blobContentType(key) },
  });
}

export async function getModelBlob(slot: string): Promise<ArrayBuffer | null> {
  const data = await blobStore().get(modelBlobKey(slot), { type: 'arrayBuffer' });
  return data ?? null;
}

export async function deleteModelBlob(slot: string): Promise<void> {
  await blobStore().delete(modelBlobKey(slot));
}
