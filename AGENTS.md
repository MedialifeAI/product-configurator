## Learned User Preferences

- Do not delete files without explicit approval; explain duplicate consolidation before removing anything.
- Prefer draft PRs from `cursor/` feature branches; never commit or push directly to `main`.
- Admin portal should manage scene settings, toggle the public settings gear, per-part model uploads, and support model URLs plus uploads.
- AR must feel smooth (avoid stutter); unmount the R3F canvas while AR is open when possible.
- Mobile configurator should fit one screen: smaller 3D viewport plus visible customization controls; default model scale smaller on narrow viewports.
- AR should use realistic luxury-watch scale (locked real-world size, slightly larger than true case size by default).
- Expose AR tuning (scale, camera, presets, tap-to-place copy) in admin and/or scene controls, not only in code.
- Use Google Model Viewer slots for AR UX: custom AR button/prompt, dragon×metal quick-pick presets, preview rotation; optional per-combo AR GLBs for true variant swaps.
- MediaLife Netlify (`jacobco-3d`) is the deploy target for this repo; keep Rethink Reality Netlify/CLI separate from MediaLife work.

## Learned Workspace Facts

- Next.js Jacob & Co Astronomia Dragon configurator: React Three Fiber (`WatchScene`) plus `@google/model-viewer` for AR/QR handoff.
- GitHub repo: `MedialifeAI/product-configurator`; active feature work on branch `cursor/netlify-scene-settings-ar`.
- Production site: Netlify **jacobco-3d** (https://jacobco-3d.netlify.app).
- Site-wide config persists via Netlify Database (`siteConfigDb`, `GET/PUT /api/site-config`); GLB overrides use Netlify Blobs (`/api/models`, upload routes).
- Canonical site-config modules: `siteConfigTypes.ts`, `siteConfigDb.ts`, `siteConfigMerge.ts`, `SiteConfigProvider.tsx`, `catalogFromConfig.ts`, `resolveModelUrl.ts` — avoid reviving `src/lib/siteConfig/` duplicates.
- Admin UI: `/admin` (`AdminPortal`); protected writes use `SCENE_SETTINGS_ADMIN_TOKEN` (operator-chosen secret in Netlify env, not in git).
- AR settings live in `config.ar` (`ArSettings` in `siteConfigTypes.ts`); helpers in `arSettings.ts` and `ar.ts`; optional per-combo models in `catalog.arCombos`.
- Legacy scene panel still maps to the scene slice via `/api/scene-settings`.
- Mobile layout uses `useCompactViewport` (stacked ~38dvh canvas, compact controls, reduced default `configScale`).
- Local Netlify-backed dev: `npm run dev:netlify`; project uses `legacy-peer-deps` in `.npmrc`.
