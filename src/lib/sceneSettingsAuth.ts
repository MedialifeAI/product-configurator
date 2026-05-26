/** Optional bearer token for writes/uploads (set SCENE_SETTINGS_ADMIN_TOKEN on Netlify). */
export function assertSceneSettingsAdmin(req: Request): Response | null {
  const secret = process.env.SCENE_SETTINGS_ADMIN_TOKEN;
  if (!secret) return null;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return null;
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
