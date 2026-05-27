import { assertSceneSettingsAdmin } from '@/lib/sceneSettingsAuth';

export const runtime = 'nodejs';

/** Lightweight auth check for admin sign-in (no DB write). */
export async function GET(req: Request) {
  const denied = assertSceneSettingsAdmin(req);
  if (denied) return denied;
  return Response.json({
    ok: true,
    authRequired: Boolean(process.env.SCENE_SETTINGS_ADMIN_TOKEN?.trim()),
  });
}
