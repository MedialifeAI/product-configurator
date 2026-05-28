/**
 * Admin authentication for scene-settings / site-config writes.
 *
 * Auth is DISABLED by default so local development and quick demos work
 * without any setup. To enable, set both env vars in Netlify / .env.local:
 *
 *   ADMIN_AUTH_ENABLED=true
 *   SCENE_SETTINGS_ADMIN_TOKEN=<your-secret>
 *
 * When ADMIN_AUTH_ENABLED is not "true", every request is allowed through
 * regardless of what token (if any) is sent.
 */

const AUTH_ENABLED = process.env.ADMIN_AUTH_ENABLED === 'true';

const AUTH_ERROR =
  'Invalid admin token — set SCENE_SETTINGS_ADMIN_TOKEN in .env.local (local) ' +
  'or Netlify env (production) and sign in with the exact same value.';

/** Extract bearer token; tolerates extra whitespace. */
export function readAdminToken(req: Request): string {
  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return auth;
}

/**
 * Returns a 401 Response if the request is not authorised, or null to allow.
 *
 * When ADMIN_AUTH_ENABLED != "true" this always returns null (open access).
 * When enabled, requires a Bearer token matching SCENE_SETTINGS_ADMIN_TOKEN.
 */
export function assertSceneSettingsAdmin(req: Request): Response | null {
  if (!AUTH_ENABLED) return null;           // auth disabled — allow everything
  const secret = process.env.SCENE_SETTINGS_ADMIN_TOKEN?.trim();
  if (!secret) return null;                 // token not configured — allow
  const token = readAdminToken(req);
  if (token === secret) return null;        // valid token — allow
  return Response.json({ error: AUTH_ERROR }, { status: 401 });
}

/** True when auth is active AND the request carries a valid token. */
export function isAdminAuthed(req: Request): boolean {
  return assertSceneSettingsAdmin(req) === null;
}
