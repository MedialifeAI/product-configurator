import { getModelBlob } from '@/lib/modelBlobs';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
) {
  const slot = params.path.join('/');
  if (!slot || slot.includes('..')) {
    return Response.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const data = await getModelBlob(slot);
    if (!data) {
      return Response.json({ error: 'Model not found' }, { status: 404 });
    }
    return new Response(data, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('[models] GET failed', err);
    return Response.json({ error: 'Storage unavailable' }, { status: 503 });
  }
}
