import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';
import { deleteModelBlob, modelApiUrl, saveModelBlob } from '@/lib/modelBlobs';

export const runtime = 'nodejs';

const MAX_GLB_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|gif|avif)$/i;

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
    const isImage = IMAGE_EXT.test(file.name) || IMAGE_EXT.test(slot);
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_GLB_BYTES;
    if (file.size > maxBytes) {
      return Response.json(
        { error: isImage ? 'Image too large (max 8 MB)' : 'File too large (max 80 MB)' },
        { status: 413 },
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    const slotWithExt =
      isImage && ext && !IMAGE_EXT.test(slot) ? `${slot}.${ext}` : slot;
    await saveModelBlob(slotWithExt, await file.arrayBuffer(), file.type || undefined);

    return Response.json({
      slot: slotWithExt,
      url: modelApiUrl(slotWithExt),
      size: file.size,
    });
  } catch (err) {
    console.error('[models/upload] POST failed', err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
