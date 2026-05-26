import { getModelBlob } from '@/lib/sceneModelBlobs';
import type { ModelSlot } from '@/lib/sceneSettingsShared';

export const runtime = 'nodejs';

const SLOTS: ModelSlot[] = ['hero', 'config'];

export async function GET(
  _req: Request,
  { params }: { params: { slot: string } },
) {
  const slot = params.slot as ModelSlot;
  if (!SLOTS.includes(slot)) {
    return Response.json({ error: 'Invalid slot' }, { status: 400 });
  }

  try {
    const data = await getModelBlob(slot);
    if (!data) {
      return Response.json({ error: 'Model not found' }, { status: 404 });
    }
    return new Response(data, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error('[scene-settings/model] GET failed', err);
    return Response.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}
