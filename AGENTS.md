## Learned User Preferences

- Do not delete files without explicit approval; explain duplicate consolidation before removing anything.
- Prefer draft PRs from `cursor/` feature branches; never commit or push directly to `main`; do not commit uncompressed GLBs over GitHub's 100 MB limit—use compressed assets or Netlify Blobs.
- Admin portal should manage scene settings, toggle the public settings gear, per-part model uploads, circular inspect part icons (`partIcons`), hero/configurator preview embeds, and support model URLs plus uploads.
- Hero copy should stay text-only with shadows—no glass/blue panel behind the title; keep the 3D watch visible; eyebrow sits above the hand-engraved body (lower block), not above the title; hero spacing avoids header/title clash on mobile.
- Header is logo-only: no nav links or Reserve CTA; Jacob & Co wordmark is white (`text-bone`), ~26px mobile / ~30px desktop—not gold gradient or oversized.
- Desktop configurator uses a 60/40 grid (`3fr` canvas / `2fr` controls), compact dragon/metal chips, and smaller desktop button typography.
- Story/glass panels use lighter blur (~8px) so the 3D scene shows through behind scroll cards.
- AR must feel smooth (avoid stutter); unmount the R3F canvas while AR is open when possible; defer AR GLB preload until View in AR hover/click.
- Mobile configurator should fit one screen: smaller 3D viewport plus visible customization controls; default model scale smaller on narrow viewports.
- AR should use realistic luxury-watch scale (locked real-world size, slightly larger than true case size by default); default AR asset is compressed `watch_full_ar.glb`; keep `usePerComboArModels` false until per-combo GLBs are compressed; expose AR tuning and Model Viewer slot UX in admin/scene controls.
- MediaLife Netlify (`jacobco-3d`) is the deploy target for this repo; keep Rethink Reality Netlify/CLI separate from MediaLife work.

## Learned Workspace Facts

- Next.js Jacob & Co Astronomia Dragon configurator: React Three Fiber (`WatchScene`) plus `@google/model-viewer` for AR/QR handoff.
- GitHub repo: `MedialifeAI/product-configurator`; active feature work on branch `cursor/admin-portal-netlify-fix`.
- Production site: Netlify **jacobco-3d** ([https://jacobco-3d.netlify.app](https://jacobco-3d.netlify.app)).
- Site-wide config persists via Netlify Database (`siteConfigDb`, `GET/PUT /api/site-config`); GLB overrides use Netlify Blobs (`/api/models`, upload routes).
- Canonical site-config modules: `siteConfigTypes.ts`, `siteConfigDb.ts`, `siteConfigMerge.ts`, `SiteConfigProvider.tsx`, `catalogFromConfig.ts`, `resolveModelUrl.ts` — avoid reviving `src/lib/siteConfig/` duplicates.
- Admin UI: `/admin` (`AdminPortal`); protected writes use `SCENE_SETTINGS_ADMIN_TOKEN` (operator-chosen secret in Netlify env, not in git).
- Scene settings include `configYaw` (default π rad) for configurator dial-facing orientation; exposed in admin Scene tab and debug panel.
- AR settings live in `config.ar` (`ArSettings` in `siteConfigTypes.ts`); helpers in `arSettings.ts` and `ar.ts`; optional per-combo models in `catalog.arCombos`.
- Legacy scene panel still maps to the scene slice via `/api/scene-settings`.
- Mobile layout uses `useCompactViewport` (stacked ~38dvh canvas, compact controls, reduced default `configScale`).
- Local Netlify-backed dev: `npm run dev:netlify`; project uses `legacy-peer-deps` in `.npmrc`.
- Globe is a separate configurator part (`globe_{metal}.glb`); `globe_earth` is the dial background plate, not the terrestrial globe; movement GLBs must omit embedded globe (`strip:movement-globe`, `hideEmbeddedGlobeInScene`); keep-original-globe pins separate globe metal.
- Asset pipeline: `npm run compress:ar`, `strip:movement-globe`, `compress:parts`; source GLBs in sibling `Watch parts/` via `WATCH_PARTS_ROOT`; Blender MCP on port 9876.
