import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { deleteModelBlob, saveModelBlob } from '@/lib/modelBlobs';

export const runtime = 'nodejs';

const MAX_BYTES = 120 * 1024 * 1024;

export async function DELETE(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  const key = new URL(req.url).searchParams.get('key');
  if (!key || key.includes('..')) {
    return Response.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    await deleteModelBlob(key);
    return Response.json({ ok: true, key });
  } catch (err) {
    console.error('[admin/models] DELETE', err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const key = form.get('key') as string | null;
    const file = form.get('file');

    if (!key || key.includes('..')) {
      return Response.json({ error: 'Invalid key' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Max 120 MB' }, { status: 413 });
    }

    await saveModelBlob(key, await file.arrayBuffer());
    return Response.json({
      key,
      url: `/api/models/${key}`,
      size: file.size,
    });
  } catch (err) {
    console.error('[admin/models] POST', err);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}
