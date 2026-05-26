# Astronomia Dragon — Configurator Site

A scroll-driven 3D landing page and configurator for the Jacob & Co Astronomia Dragon, built with Next.js 14 (App Router), React Three Fiber, and Framer Motion. Geometry is delivered as Draco-compressed glTF binaries (.glb).

## What's in here

```
configurator-site/
├── public/models/         Draco-compressed GLBs (commit these or upload to CDN)
│   ├── full_watch/        watch_full_default.glb — hero, both NLA animations
│   ├── dragon/            v1-v4 variants, ~3 MB each
│   ├── case/              rose / white / yellow gold bezel + outer case
│   ├── case_body/         rose / white / yellow gold body
│   ├── movement/          rose / white / yellow gold tourbillon + gears
│   └── parts/             dial, globe, hand, strap (static across variants)
├── src/
│   ├── app/               Next.js App Router (layout, page, globals.css)
│   ├── components/
│   │   ├── WatchScene.tsx       Scroll-scrubbed hero (full_watch + Draco loader)
│   │   ├── StoryPanel.tsx       Glassmorphic overlay used by each story section
│   │   ├── Configurator.tsx     Interactive variant picker + assembled viewer
│   │   ├── ArView.tsx           Google Model Viewer fullscreen AR overlay
│   │   ├── ArQrModal.tsx        Desktop QR handoff to mobile AR
│   ├── lib/ar.ts                AR URL helpers + device detection
│   │   ├── SiteHeader.tsx
│   │   └── SpecsAndCTA.tsx
│   └── hooks/useScrollProgress.ts   rAF-driven scroll ref (no React state)
└── scripts/
    ├── compress.sh        Re-compress all source GLBs (one shot)
    └── compress_one.sh    Compress a single GLB (used by compress.sh; can be called directly)
```

## Quick start

```bash
cd configurator-site
npm install
npm run dev
# open http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Adding or re-compressing assets

The site expects Draco-compressed GLBs in `public/models/`. The originals live one folder up (in the Blender export directories). To re-compress:

```bash
# Install gltf-transform once (npm i -g @gltf-transform/cli)
npm run compress
```

Or compress a single new variant:

```bash
bash scripts/compress_one.sh ../dragon/variants/dragon_v5_new.glb public/models/dragon/dragon_v5_new.glb
```

The pipeline does dedup → prune → weld → texture-compress (WebP, q85) → Draco mesh compression (edgebreaker, position quant 14, normal 10, texcoord 12). Typical reduction is **90 – 95 %** with no perceptible visual loss for this geometry.

When you add a new dragon variant, also edit `src/components/Configurator.tsx`'s `DRAGON_VARIANTS` array; for a new metal, add to `METAL_VARIANTS` and produce matching `case_<name>.glb`, `case_body_<name>.glb`, and `movement_<name>.glb` files.

## How the scroll-scrubbed explode works

`WatchScene.tsx` loads `full_watch/watch_full_default.glb`. That file ships two named NLA animation clips:


| Clip                                     | Behaviour                                       |
| ---------------------------------------- | ----------------------------------------------- |
| `NLA_Exploded_View`                      | Pinned to scroll position — never auto-advances |
| `NLA_Watch_Movement` (or `Take 001.001`) | Loops forever, drives the tourbillon            |


A rAF loop in `useScrollProgress.ts` writes the current 0…1 scroll value to a ref. Inside the R3F `useFrame`, we set `explodeAction.time = duration * progress` on every frame. The watch movement loop is advanced by `mixer.update(dt)` so it keeps ticking independent of scroll.

The page layout uses a `sticky top-0 h-screen` canvas inside a tall scroll strip, with story panels stacked above using a negative top margin (`-mt-screen`). Each `StoryPanel` is a normal flow section that fades in/out using Framer's `useScroll` + `useTransform`.

## Deployment

### Vercel (recommended)

```bash
npx vercel
```

The GLBs are static assets — Vercel will edge-cache them automatically. The `Cache-Control` header in `next.config.mjs` sets `max-age=31536000, immutable` for `/models/*` so repeat visits are instant.

### Netlify

```bash
npx netlify deploy --prod
```

Same idea — `public/models` is treated as static.

### Self-hosted

```bash
npm run build
npm start
```

Use a CDN in front of `/models` for production traffic — they're large binary files and benefit from edge caching.

## Performance budget

Approximate post-Draco sizes:


| Asset                                          | Size          |
| ---------------------------------------------- | ------------- |
| full_watch_default.glb (hero, both animations) | ~25 – 40 MB   |
| dragon (each of 4)                             | ~3 MB         |
| case (each of 3)                               | ~3.4 MB       |
| case_body (each of 3)                          | ~2.1 MB       |
| movement (each of 3)                           | ~7 MB         |
| dial / globe / hand / strap                    | < 200 KB each |


The hero loads first; configurator variants are preloaded after the page is interactive (see `useGLTF.preload` calls at the bottom of `Configurator.tsx`). On a typical broadband connection, total time-to-interactive for the hero should be ≤ 3 s.

## Augmented reality (Model Viewer + QR)

The configurator includes a **View in AR** flow powered by [`@google/model-viewer`](https://modelviewer.dev/) and [`qrcode`](https://www.npmjs.com/package/qrcode):

| Platform | Behaviour |
| --- | --- |
| **Mobile** | Fullscreen Model Viewer with `ar-modes="webxr scene-viewer quick-look"`, floor placement, and auto AR activation after load (where the browser allows). |
| **Desktop** | QR modal encodes the current page with `?ar=1&dragon=…&metal=…#configurator`. Scanning opens AR on the phone and restores the picker state. |
| **Shared `?ar=1` links** | Desktop shows the QR handoff (not a non-functional desktop AR session). Mobile opens AR directly and scrolls to the configurator. |

AR loads `public/models/full_watch/watch_full_default.glb` (the same assembled hero asset). Variant picks in the configurator apply to the interactive R3F viewer; AR uses this single GLB until per-configuration exports exist.

**iOS Quick Look:** add `public/models/full_watch/watch_full_default.usdz` (same pose/scale as the GLB). The app probes for the file and only sets `ios-src` when it is present.

## Scene controls persistence (Netlify Database + Blobs)

The floating **Scene controls** panel (operator UI) saves site-wide tuning to **Netlify Database** and optional GLB overrides to **Netlify Blobs**.

| Piece | Role |
| --- | --- |
| `netlify/database/migrations/` | Creates `scene_settings` table (applied on deploy) |
| `GET /api/scene-settings` | Load saved sliders / lighting / model URLs |
| `PUT /api/scene-settings` | Save (requires admin token when configured) |
| `POST /api/scene-settings/upload` | Upload hero or configurator `.glb` to Blobs |
| `GET /api/scene-settings/model/:slot` | Serve stored GLB (`hero` or `config`) |

**Deploy on Netlify** (`jacobco-3d`):

1. Push to the linked repo — `@netlify/database` provisions Postgres on first deploy with migrations.
2. In **Site configuration → Environment variables**, add `SCENE_SETTINGS_ADMIN_TOKEN` (long random string).
3. On the live site, open Scene controls → key icon → paste the same token once per browser.
4. Changes auto-save after ~1 s; all visitors see the same scene tuning.

**Local dev with DB/Blobs:**

```bash
npm run dev:netlify   # not plain next dev — enables Netlify primitives locally
```

Without `netlify dev`, the panel still works but shows **Local only** and uses in-memory defaults.

## Browser support

Modern Chromium, Firefox, Safari 16+. Draco decoder is loaded from the Google CDN (`https://www.gstatic.com/draco/versioned/decoders/1.5.7/`) — host this yourself if your client is concerned about third-party resources.

AR additionally requires a WebXR-, Scene Viewer-, or Quick Look–capable mobile browser.

## Credits

- 3D models exported from Blender 5.0 using the `blender-product-configurator` skill (see sibling folder `blender-product-configurator/`)
- Source of truth document: `../INVENTORY.md`
- Reference site: [Astronomia Dragon | Jacob & Co.](https://jacobandco.com/timepieces/astronomia-dragon)

