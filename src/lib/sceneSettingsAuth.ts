const AUTH_ERROR =
  'Invalid admin token — set SCENE_SETTINGS_ADMIN_TOKEN in .env.local (local) or Netlify env (production) and sign in with the exact same value.';

/** Extract bearer token; tolerates extra whitespace. */
export function readAdminToken(req: Request): string {
  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return auth;
}

/** Optional bearer token for writes/uploads (set SCENE_SETTINGS_ADMIN_TOKEN on Netlify). */
export function assertSceneSettingsAdmin(req: Request): Response | null {
  const secret = process.env.SCENE_SETTINGS_ADMIN_TOKEN?.trim();
  if (!secret) return null;
  const token = readAdminToken(req);
  if (token === secret) return null;
  return Response.json({ error: AUTH_ERROR }, { status: 401 });
}
