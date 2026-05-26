## Learned User Preferences

- Do not delete files without explicit approval; explain duplicate consolidation before removing anything.
- Prefer draft PRs from `cursor/` feature branches; never commit or push directly to `main`.
- Admin portal should manage scene settings, toggle the public settings gear, per-part model uploads, circular inspect part icons (`partIcons`), hero/configurator preview embeds, and support model URLs plus uploads.
- Hero copy should stay text-only with shadows—no glass/blue panel behind the title; keep the 3D watch visible.
- Jacob & Co header logo should be ~15px larger on mobile and desktop.
- AR must feel smooth (avoid stutter); unmount the R3F canvas while AR is open when possible; defer AR GLB preload until View in AR hover/click.
- Mobile configurator should fit one screen: smaller 3D viewport plus visible customization controls; default model scale smaller on narrow viewports.
- AR should use realistic luxury-watch scale (locked real-world size, slightly larger than true case size by default); default AR asset is compressed `watch_full_ar.glb`; keep `usePerComboArModels` false until per-combo GLBs are compressed.
- Expose AR tuning (scale, camera, presets, tap-to-place copy) in admin and/or scene controls, not only in code.
- Use Google Model Viewer slots for AR UX: custom AR button/prompt, dragon×metal quick-pick presets, preview rotation; optional per-combo AR GLBs for true variant swaps.
- MediaLife Netlify (`jacobco-3d`) is the deploy target for this repo; keep Rethink Reality Netlify/CLI separate from MediaLife work.

## Learned Workspace Facts

- Next.js Jacob & Co Astronomia Dragon configurator: React Three Fiber (`WatchScene`) plus `@google/model-viewer` for AR/QR handoff.
- GitHub repo: `MedialifeAI/product-configurator`; active feature work on branch `cursor/netlify-scene-settings-ar`.
- Production site: Netlify **jacobco-3d** ([https://jacobco-3d.netlify.app](https://jacobco-3d.netlify.app)).
- Site-wide config persists via Netlify Database (`siteConfigDb`, `GET/PUT /api/site-config`); GLB overrides use Netlify Blobs (`/api/models`, upload routes).
- Canonical site-config modules: `siteConfigTypes.ts`, `siteConfigDb.ts`, `siteConfigMerge.ts`, `SiteConfigProvider.tsx`, `catalogFromConfig.ts`, `resolveModelUrl.ts` — avoid reviving `src/lib/siteConfig/` duplicates.
- Admin UI: `/admin` (`AdminPortal`); protected writes use `SCENE_SETTINGS_ADMIN_TOKEN` (operator-chosen secret in Netlify env, not in git).
- AR settings live in `config.ar` (`ArSettings` in `siteConfigTypes.ts`); helpers in `arSettings.ts` and `ar.ts`; optional per-combo models in `catalog.arCombos`.
- Legacy scene panel still maps to the scene slice via `/api/scene-settings`.
- Mobile layout uses `useCompactViewport` (stacked ~38dvh canvas, compact controls, reduced default `configScale`).
- Local Netlify-backed dev: `npm run dev:netlify`; project uses `legacy-peer-deps` in `.npmrc`.
- Globe is a separate configurator part (`globe_{metal}.glb`); `globe_earth` is the dial background plate, not the terrestrial globe; movement GLBs must omit embedded globe (`strip:movement-globe`, `hideEmbeddedGlobeInScene`); keep-original-globe pins separate globe metal.
- Asset pipeline: `npm run compress:ar`, `strip:movement-globe`, `compress:parts`; source GLBs in sibling `Watch parts/` via `WATCH_PARTS_ROOT`; Blender MCP on port 9876.