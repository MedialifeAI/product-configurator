import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { deleteModelBlob, saveModelBlob } from '@/lib/sceneModelBlobs';
import { modelApiPath, type ModelSlot } from '@/lib/sceneSettingsShared';

export const runtime = 'nodejs';

const SLOTS: ModelSlot[] = ['hero', 'config'];
const MAX_BYTES = 80 * 1024 * 1024;

export async function DELETE(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  const slot = new URL(req.url).searchParams.get('slot');
  if (!slot || !SLOTS.includes(slot as ModelSlot)) {
    return Response.json({ error: 'Invalid slot' }, { status: 400 });
  }

  try {
    await deleteModelBlob(slot as ModelSlot);
    return Response.json({ ok: true, slot });
  } catch (err) {
    console.error('[scene-settings/upload] DELETE failed', err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const slot = form.get('slot') as string | null;
    const file = form.get('file');

    if (!slot || !SLOTS.includes(slot as ModelSlot)) {
      return Response.json({ error: 'Invalid slot' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'File too large (max 80 MB)' }, { status: 413 });
    }

    const buffer = await file.arrayBuffer();
    await saveModelBlob(slot as ModelSlot, buffer);

    return Response.json({
      slot,
      url: modelApiPath(slot as ModelSlot),
      size: file.size,
    });
  } catch (err) {
    console.error('[scene-settings/upload] POST failed', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
