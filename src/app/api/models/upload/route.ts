import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { deleteModelBlob, modelApiUrl, saveModelBlob } from '@/lib/modelBlobs';

export const runtime = 'nodejs';

const MAX_BYTES = 80 * 1024 * 1024;

export async function DELETE(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  const slot = new URL(req.url).searchParams.get('slot');
  if (!slot || slot.includes('..')) {
    return Response.json({ error: 'Invalid slot' }, { status: 400 });
  }

  try {
    await deleteModelBlob(slot);
    return Response.json({ ok: true, slot });
  } catch (err) {
    console.error('[models/upload] DELETE failed', err);
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

    if (!slot || slot.includes('..')) {
      return Response.json({ error: 'Invalid slot' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'File too large (max 80 MB)' }, { status: 413 });
    }

    await saveModelBlob(slot, await file.arrayBuffer());

    return Response.json({
      slot,
      url: modelApiUrl(slot),
      size: file.size,
    });
  } catch (err) {
    console.error('[models/upload] POST failed', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
