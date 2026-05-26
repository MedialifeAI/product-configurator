# Astronomia Dragon — Configurator Site

A scroll-driven 3D landing page for the Jacob & Co Astronomia Dragon.

## Run it

```bash
cd configurator-site
npm install      # ~40s
npm run dev      # http://localhost:3000
```

That's it. The page loads, the watch appears, you scroll, the parts fly apart, you hit the configurator, you swap variants. Read `README.md` for the full architecture.

## What you get

1. **Pinned 3D hero** — the assembled watch sits front-and-center as the page background.
2. **Scroll-scrubbed explode** — as you scroll, the `NLA_Exploded_View` animation scrubs in real time (dragon out first, watch face last). The `NLA_Watch_Movement` loop keeps the tourbillon spinning independently.
3. **Four glassmorphic story panels** — The Dragon · The Movement · The Cosmos in Miniature · The Architecture. Each fades in over its scroll window with a gold metric callout.
4. **Configurator section** — its own interactive R3F canvas. Dragon picker (4 variants), metal picker (3 variants for case + bezel + movement together), and a component inspector that isolates one part by dimming the rest.
5. **Specs + CTA** — the full JCAM10 / triple-axis tourbillon / 47mm rose gold / 18-piece limited edition spec sheet, then a "Request a viewing" CTA matching the Jacob & Co tone.

## Asset pipeline

All 18 GLBs in `public/models/` are **Draco mesh + WebP texture compressed**. Verified end-to-end:


| Source                        | Compressed  | Reduction |
| ----------------------------- | ----------- | --------- |
| 1.04 GB total                 | 64 MB total | **94%**   |
| watch_full_default.glb 266 MB | 15.0 MB     | 94%       |
| movement variants 118 MB each | 6.8 MB each | 94%       |
| case variants 71 MB each      | 3.2 MB each | 95%       |
| dragon variants 35 MB each    | 3.0 MB each | 91%       |


Both NLA animations (`NLA_Exploded_View`, `NLA_Watch_Movement`) and all glTF extensions (`KHR_materials_transmission`, `KHR_materials_clearcoat`, `KHR_materials_ior`, `KHR_materials_anisotropy`, `KHR_materials_specular`) survive compression intact.

## Build verified

```
Route (app)             Size     First Load JS
┌ ○ /                   44.2 kB  132 kB
└ ○ /_not-found         873 B    88.2 kB
```

`next build` passes, `next dev` serves at port 3000 returning HTTP 200 with both the page HTML and all 18 model URLs.

## Deploy

`npx vercel` from `configurator-site/` will work out of the box. The `next.config.mjs` sets `Cache-Control: max-age=31536000, immutable` on `/models/*` so repeat visits are instant from the edge cache.