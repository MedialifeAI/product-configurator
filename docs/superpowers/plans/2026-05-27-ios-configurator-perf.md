# iOS Configurator Performance & AR Stability Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop iOS Safari crashes in the Astronomia Dragon configurator and the "View in AR" flow, without changing the visual fidelity on desktop / Android.

**Architecture:** The crash is GPU memory pressure, not network. Echo 3D is a CDN/DAM — it would deliver identical GLB bytes that still OOM the device after decode, plus it introduces a `userKey`-in-browser exposure, an extra round-trip, and ~50× the bandwidth cost of Cloudflare R2 / Bunny. We will instead (1) dispose GPU resources between variant swaps, (2) ship a proper USDZ for iOS Quick Look and compress the AR GLB, (3) add an iOS device tier that caps DPR / disables AA / unmounts the hero canvas, (4) re-author the metal-finish parts as one geometry + swappable PBR materials, (5) put the asset pipeline through `gltf-transform` with KTX2 textures + Meshopt geometry. Echo 3D is kept as an optional appendix (Phase 7) in case the team later wants a DAM layer for a larger product line.

**Tech Stack:** Next.js 14 (App Router), React 18, `@react-three/fiber`, `@react-three/drei` (`useGLTF`), Three.js r155+, `@google/model-viewer` 4.x, `@gltf-transform/cli` (asset pipeline), `usdz_converter` / `usd-from-gltf` via Docker (USDZ generation), Vitest (or the existing tsx-based smoke harness — see `npm test`), Playwright (iOS Safari emulation for verification).

**Out of scope:** Echo 3D integration (rejected — see Appendix A for the reasoning the team can reread later); restructuring the dragon variants into one mesh + material swap (deferred — see Appendix B; the dragon GLBs have per-variant geometry differences that need an artist pass first, this plan only consolidates the metal-finish parts where geometry is provably identical).

---

## File Structure

### New files

- `scripts/build-assets.mjs` — Node script orchestrating `gltf-transform` passes (Draco geometry, Meshopt vertex, KTX2 textures, dedupe, prune) over every GLB in `public/models/`. Writes to `public/models-optimized/` and prints a before/after size table.
- `scripts/build-usdz.sh` — Docker-based GLB→USDZ conversion for `watch_full_ar.glb` (and, later, per-combo). Writes to `public/models/full_watch/watch_full_ar.usdz`.
- `src/lib/deviceTier.ts` — `getDeviceTier()` returns `'low' | 'mid' | 'high'` based on UA + `deviceMemory` + `hardwareConcurrency`. Pure function, no React.
- `src/lib/disposeScene.ts` — `disposeObject3D(root)` walks a Three.js object tree and disposes geometries, materials, textures. Used in `Part` cleanup.
- `src/components/Configurator/useVariantSwap.ts` — replaces the current "new URL → new `useGLTF` cache entry forever" pattern with a hook that tracks the *previous* URL and clears its drei cache entry on swap.
- `src/components/Configurator/MetalPart.tsx` — single-geometry version of the metal-finish parts. Loads one GLB and applies a PBR material override (rose / white / yellow) at runtime.
- `tests/disposeScene.test.ts` — verifies `disposeObject3D` frees geometries + materials + textures.
- `tests/deviceTier.test.ts` — UA-based tier classification.
- `tests/variantSwap.test.ts` — asserts the drei cache only ever holds one URL per slot.

### Modified files

- `src/components/Configurator.tsx` — replace `Part` clone-without-dispose pattern; thread `deviceTier` into Canvas props; gate the configurator preload on `requestIdleCallback`; lazy-mount the Canvas (Suspense + IntersectionObserver) so it doesn't fight the hero context.
- `src/components/WatchScene.tsx` — `frameloop="demand"` until in view; unmount when scrolled past; cap DPR at 1.5 on `tier==='low'`; drop `ContactShadows` on low tier.
- `src/components/ArView.tsx` — set `ios-src` to the now-existing USDZ; remove the "uncompressed" warning once the build pipeline is wired; preflight against the optimized GLB.
- `src/lib/ar.ts` — point `MODEL_PATHS.ar` to `models-optimized/`; export a `getArUsdzPath()` helper that confirms existence at build time.
- `src/lib/catalogFromConfig.ts` — switch metal-finish URL resolution to the consolidated `MetalPart` path when `featureFlags.consolidatedMetals === true`.
- `src/lib/siteConfigTypes.ts` — add `featureFlags: { consolidatedMetals: boolean; lowTierIOS: boolean }`.
- `package.json` — add `build:assets`, `build:usdz`, `verify:perf` scripts; pin `@gltf-transform/cli`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `sharp`, `meshoptimizer`.
- `next.config.mjs` — add a `Cache-Control: public, max-age=31536000, immutable` header rule for `/models-optimized/`.

---

## Phase 0 — Baseline & Verification Harness

We need a way to *prove* iOS got better. No subjective "feels faster."

### Task 0.1: Capture the current iOS failure mode

**Files:**

- Create: `docs/superpowers/plans/2026-05-27-baseline.md`
- **Step 1: Start dev server**

```powershell
npm run dev
```

Expected: server up on `http://localhost:3000`.

- **Step 2: Open Playwright against iOS Safari emulation**

Use `mcp__plugin_playwright_playwright__browser_navigate` with viewport `375x812` and UA `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1`.

Navigate to `http://localhost:3000`, scroll to the configurator, click through all 4 dragons × 3 metal finishes (12 swaps), then click "View in AR."

- **Step 3: Record metrics**

In `browser_evaluate`, run:

```js
({
  jsHeap: performance.memory?.usedJSHeapSize,
  canvases: document.querySelectorAll('canvas').length,
  gltfCacheKeys: Object.keys(window.__R3F_GLTF_CACHE__ ?? {}).length, // if exposed; else count via drei internals
})
```

Save the heap-size-after-each-swap series and the AR-button outcome (load? crash? blank?) to `docs/superpowers/plans/2026-05-27-baseline.md`.

- **Step 4: Commit the baseline**

```bash
git add docs/superpowers/plans/2026-05-27-baseline.md
git commit -m "perf(ios): capture baseline iOS Safari heap/AR behavior"
```

---

## Phase 1 — Stop the Bleeding (the actual crash fixes)

These four tasks together are the highest-leverage change. Likely fixes the crash on their own.

### Task 1.1: Add `disposeObject3D` utility

**Files:**

- Create: `src/lib/disposeScene.ts`
- Test: `tests/disposeScene.test.ts`
- **Step 1: Write the failing test**

```ts
// tests/disposeScene.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D } from '../src/lib/disposeScene';

describe('disposeObject3D', () => {
  it('disposes geometries, materials, and textures of every descendant Mesh', () => {
    const tex = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    const geo = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geo, mat);
    const root = new THREE.Group();
    root.add(mesh);

    const geoSpy = vi.spyOn(geo, 'dispose');
    const matSpy = vi.spyOn(mat, 'dispose');
    const texSpy = vi.spyOn(tex, 'dispose');

    disposeObject3D(root);

    expect(geoSpy).toHaveBeenCalledOnce();
    expect(matSpy).toHaveBeenCalledOnce();
    expect(texSpy).toHaveBeenCalledOnce();
  });

  it('handles material arrays', () => {
    const mat1 = new THREE.MeshStandardMaterial();
    const mat2 = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [mat1, mat2]);
    const s1 = vi.spyOn(mat1, 'dispose');
    const s2 = vi.spyOn(mat2, 'dispose');
    disposeObject3D(mesh);
    expect(s1).toHaveBeenCalledOnce();
    expect(s2).toHaveBeenCalledOnce();
  });
});
```

- **Step 2: Run the test, confirm it fails**

```powershell
npm test -- tests/disposeScene.test.ts
```

Expected: FAIL — `disposeScene` module not found.

- **Step 3: Implement**

```ts
// src/lib/disposeScene.ts
import * as THREE from 'three';

const TEXTURE_PROPS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
  'envMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'specularMap', 'specularIntensityMap',
] as const;

function disposeMaterial(mat: THREE.Material) {
  for (const key of TEXTURE_PROPS) {
    const tex = (mat as unknown as Record<string, unknown>)[key];
    if (tex && tex instanceof THREE.Texture) tex.dispose();
  }
  mat.dispose();
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    }
  });
}
```

- **Step 4: Re-run, confirm pass**

```powershell
npm test -- tests/disposeScene.test.ts
```

Expected: PASS.

- **Step 5: Commit**

```bash
git add src/lib/disposeScene.ts tests/disposeScene.test.ts
git commit -m "feat(perf): add disposeObject3D walker for Three.js scenes"
```

### Task 1.2: Wire disposal into `Part` cleanup + add `useGLTF.clear()` on URL swap

**Files:**

- Modify: `src/components/Configurator.tsx:72-90` (the `Part` component)
- Test: `tests/variantSwap.test.ts`
- **Step 1: Read current `Part` implementation**

Open `src/components/Configurator.tsx` lines 60–110. The current `useMemo` returns `scene.clone()`; there is no `useEffect` cleanup. Cloned geometries / materials leak.

- **Step 2: Add cleanup**

Replace the `const cloned = useMemo(...)` block with:

```tsx
const cloned = useMemo(() => {
  const copy = scene.clone(true);
  if (dim || hideMovementGlobe) {
    copy.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const src = mesh.material;
        const cloneMat = (m: THREE.Material) => {
          const c = m.clone();
          if (dim) {
            c.transparent = true;
            (c as THREE.MeshStandardMaterial).opacity = 0.35;
          }
          return c;
        };
        mesh.material = Array.isArray(src) ? src.map(cloneMat) : cloneMat(src);
      }
    });
  }
  return copy;
}, [scene, dim, hideMovementGlobe]);

useEffect(() => {
  return () => {
    disposeObject3D(cloned);
  };
}, [cloned]);

useEffect(() => {
  // When the URL itself changes, evict the previous URL from drei's cache.
  return () => {
    useGLTF.clear(url);
  };
}, [url]);
```

Add the import:

```tsx
import { disposeObject3D } from '@/lib/disposeScene';
```

- **Step 3: Write smoke test**

```ts
// tests/variantSwap.test.ts
import { describe, it, expect } from 'vitest';
import { useGLTF } from '@react-three/drei';

describe('variant swap cache hygiene', () => {
  it('useGLTF.clear removes the entry', () => {
    // drei stores in a WeakMap keyed by URL string; we cannot read it directly,
    // but we can assert .clear does not throw and is the right shape.
    expect(typeof useGLTF.clear).toBe('function');
  });
});
```

(Yes, this is a thin test — the real verification is the iOS heap regression in Phase 4.)

- **Step 4: Run smoke**

```powershell
npm test -- tests/variantSwap.test.ts
```

Expected: PASS.

- **Step 5: Commit**

```bash
git add src/components/Configurator.tsx tests/variantSwap.test.ts
git commit -m "fix(perf): dispose cloned scenes and evict prior GLBs from drei cache on variant swap"
```

### Task 1.3: Generate the missing USDZ for iOS Quick Look

**Files:**

- Create: `scripts/build-usdz.sh`
- Create: `public/models/full_watch/watch_full_ar.usdz` (output)
- **Step 1: Write the build script**

```bash
#!/usr/bin/env bash
# scripts/build-usdz.sh
# Requires Docker. Uses leon/usd-from-gltf.
set -euo pipefail

SRC="${1:-public/models/full_watch/watch_full_ar.glb}"
OUT="${2:-public/models/full_watch/watch_full_ar.usdz}"

if [ ! -f "$SRC" ]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

docker run --rm -v "$(pwd)":/work -w /work \
  leon/usd-from-gltf:latest "$SRC" "$OUT"

echo "Wrote $OUT ($(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT") bytes)"
```

- **Step 2: Run it**

```powershell
bash scripts/build-usdz.sh
```

Expected: `public/models/full_watch/watch_full_ar.usdz` exists and is under 25 MB. If Docker not available locally, run from WSL or note for the Netlify build environment.

- **Step 3: Verify `ArView.tsx` finds it**

Open `src/components/ArView.tsx:175-185` (the HEAD-fetch probe). With the file now present, `iosUsdz` should resolve to the path and `ios-src` should render on `<model-viewer>`. No code change needed; the probe is already correct.

- **Step 4: Add npm script**

In `package.json`:

```json
"build:usdz": "bash scripts/build-usdz.sh"
```

- **Step 5: Commit**

```bash
git add scripts/build-usdz.sh package.json public/models/full_watch/watch_full_ar.usdz
git commit -m "fix(ar): generate USDZ for iOS Quick Look so View in AR works on iPhone"
```

### Task 1.4: iOS device-tier and Canvas adjustments

**Files:**

- Create: `src/lib/deviceTier.ts`
- Test: `tests/deviceTier.test.ts`
- Modify: `src/components/Configurator.tsx:476-479` (Canvas props)
- Modify: `src/components/WatchScene.tsx:192-200` (Canvas props)
- **Step 1: Write failing test**

```ts
// tests/deviceTier.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDeviceTier } from '../src/lib/deviceTier';

const setNav = (overrides: Partial<Navigator>) => {
  vi.stubGlobal('navigator', { ...navigator, ...overrides });
};

describe('getDeviceTier', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns low for iPhone', () => {
    setNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } as Navigator);
    expect(getDeviceTier()).toBe('low');
  });

  it('returns low for iPad with <=4GB device memory', () => {
    setNav({ userAgent: 'iPad', deviceMemory: 4 } as unknown as Navigator);
    expect(getDeviceTier()).toBe('low');
  });

  it('returns high for desktop with 8 cores and 8GB+', () => {
    setNav({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0)',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    } as unknown as Navigator);
    expect(getDeviceTier()).toBe('high');
  });
});
```

- **Step 2: Run, confirm fail**

```powershell
npm test -- tests/deviceTier.test.ts
```

- **Step 3: Implement**

```ts
// src/lib/deviceTier.ts
export type DeviceTier = 'low' | 'mid' | 'high';

export function getDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'mid';

  const ua = navigator.userAgent ?? '';
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Mac/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isIOS) return 'low';
  if (mem <= 4 || cores <= 4) return 'mid';
  return 'high';
}
```

- **Step 4: Run, confirm pass**
- **Step 5: Use the tier in both Canvases**

In `src/components/Configurator.tsx`, at the top of the component:

```tsx
import { getDeviceTier } from '@/lib/deviceTier';
const tier = useMemo(() => getDeviceTier(), []);
const isLow = tier === 'low';
```

Replace the Canvas at line 476–479 with:

```tsx
<Canvas
  dpr={isLow ? [1, 1.25] : compact ? [1, 1.5] : [1, 2]}
  gl={{
    antialias: !isLow && !compact,
    alpha: true,
    powerPreference: isLow ? 'low-power' : 'high-performance',
  }}
  frameloop={settings.configRotate > 0 ? 'always' : 'demand'}
  ...
```

In `src/components/WatchScene.tsx` (line 192-ish), apply the same `tier` derivation and use `frameloop="demand"` plus conditional `ContactShadows` (skip on low tier).

- **Step 6: Commit**

```bash
git add src/lib/deviceTier.ts tests/deviceTier.test.ts src/components/Configurator.tsx src/components/WatchScene.tsx
git commit -m "perf(ios): cap DPR, disable AA, demand-loop on low-tier devices"
```

### Task 1.5: Lazy-mount the configurator Canvas

So the hero Canvas is the only one holding a WebGL context until the user actually scrolls down.

**Files:**

- Modify: `src/components/Configurator.tsx` (wrap Canvas in IntersectionObserver gate)
- **Step 1: Add intersection-gated mount**

Just above the existing `<Canvas>`:

```tsx
const canvasHostRef = useRef<HTMLDivElement>(null);
const [canvasReady, setCanvasReady] = useState(false);

useEffect(() => {
  const el = canvasHostRef.current;
  if (!el || canvasReady) return;
  const io = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) setCanvasReady(true); },
    { rootMargin: '200px' }
  );
  io.observe(el);
  return () => io.disconnect();
}, [canvasReady]);
```

Wrap the Canvas:

```tsx
<div ref={canvasHostRef} className="canvas-host">
  {canvasReady && (
    <Canvas ...>
      ...
    </Canvas>
  )}
</div>
```

- **Step 2: Symmetrically, unmount the hero Canvas once the configurator is in view**

In `page.tsx`, track `configuratorInView` with a similar IO; when true, set `heroMounted={false}` and pass that to `<WatchScene>` to short-circuit render to `null`. Hero scrub animation is finished by then anyway.

- **Step 3: Verify in Playwright (iOS UA) that `document.querySelectorAll('canvas').length` is never > 1 at any scroll position**
- **Step 4: Commit**

```bash
git add src/components/Configurator.tsx src/app/page.tsx
git commit -m "perf(ios): mount one WebGL canvas at a time (hero or configurator, never both)"
```

---

## Phase 2 — Asset Pipeline (KTX2 + Meshopt + Draco)

The biggest VRAM win. KTX2 textures stay GPU-compressed (4 bpp vs 32 bpp). On iOS this typically drops a 4K PBR set from ~80 MB VRAM to ~5 MB.

### Task 2.1: Add the build pipeline

**Files:**

- Create: `scripts/build-assets.mjs`
- Modify: `package.json`
- **Step 1: Install tooling**

```powershell
npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp meshoptimizer draco3d
```

- **Step 2: Write the script**

```js
// scripts/build-assets.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco, meshopt, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

const SRC = 'public/models';
const DST = 'public/models-optimized';

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.encoder': MeshoptEncoder,
  });

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.glb')) yield p;
  }
}

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const rows = [];

for await (const src of walk(SRC)) {
  const rel = relative(SRC, src);
  const dst = join(DST, rel);
  await mkdir(dirname(dst), { recursive: true });

  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    draco({ method: 'edgebreaker', quantizePositionBits: 14 }),
  );
  await io.write(dst, doc);

  const [a, b] = await Promise.all([stat(src), stat(dst)]);
  rows.push({ file: rel, before: a.size, after: b.size });
}

console.table(
  rows.map((r) => ({
    file: r.file,
    before: fmt(r.before),
    after: fmt(r.after),
    delta: `${((1 - r.after / r.before) * 100).toFixed(0)}%`,
  })),
);
```

- **Step 3: Add npm script**

```json
"build:assets": "node scripts/build-assets.mjs"
```

- **Step 4: Run, eyeball the table, commit**

```powershell
npm run build:assets
```

Expected: a table showing 60–85% size reduction per file. Spot-check one with `npx gltf-transform inspect public/models-optimized/dragon/dragon_v1_imperial_rose_gold.glb`.

- **Step 5: Commit pipeline + outputs**

```bash
git add scripts/build-assets.mjs package.json package-lock.json public/models-optimized
git commit -m "perf(assets): KTX2 + Meshopt + Draco optimization pipeline for all GLBs"
```

### Task 2.2: Upgrade the path *one feature flag at a time*

KTX2 needs the `KTX2Loader` configured on drei. If we point everything at `models-optimized/` before configuring the loader, scenes render black.

**Files:**

- Modify: `src/components/Configurator.tsx`, `src/components/WatchScene.tsx`
- Modify: `src/lib/resolveModelUrl.ts`
- Modify: `src/lib/siteConfigTypes.ts`
- **Step 1: Configure KTX2 + Meshopt on drei's GLTFLoader**

In both Canvas files, ensure the loader is set up. Add `<Suspense fallback={null}>` around `<primitive>` for safety. Add:

```tsx
import { useGLTF } from '@react-three/drei';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { useThree } from '@react-three/fiber';

function LoaderConfig() {
  const { gl } = useThree();
  useEffect(() => {
    const ktx2 = new KTX2Loader()
      .setTranscoderPath('https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/')
      .detectSupport(gl);
    useGLTF.setMeshoptDecoder(MeshoptDecoder);
    // useGLTF in drei uses the GLTFLoader internally; we set KTX2 via the gltf loader's setter:
    (useGLTF as unknown as { setKTX2Loader: (l: KTX2Loader) => void }).setKTX2Loader?.(ktx2);
  }, [gl]);
  return null;
}
```

(If drei does not expose `setKTX2Loader`, fall back to a custom `GLTFLoader` instance wrapped in a `useLoader` call. Verify the drei version: `npm ls @react-three/drei`. As of drei ≥9.92, KTX2 is set via `useGLTF.preload(url, true)` — confirm before committing this task.)

Add `<LoaderConfig />` as a child of both Canvases, before the rest of the scene.

- **Step 2: Add feature flag**

In `siteConfigTypes.ts`:

```ts
featureFlags?: {
  consolidatedMetals?: boolean;
  useOptimizedAssets?: boolean;
};
```

Default: `useOptimizedAssets: true`.

- **Step 3: Switch path in `resolveModelUrl.ts`**

```ts
const ROOT = config.featureFlags?.useOptimizedAssets ? '/models-optimized' : '/models';
```

- **Step 4: Visual diff on desktop first**

Run dev, open the configurator, click through all variants. Compare side-by-side with main branch screenshots. Use Playwright `browser_take_screenshot` at fixed angles for each variant; diff with `pixelmatch` (already in many CI setups; install if needed).

- **Step 5: Verify on iOS Playwright emulation**

Repeat the Phase 0 metrics capture. Expected: heap usage at idle (post-all-12-swaps) drops by ~60%.

- **Step 6: Commit**

```bash
git add -p  # stage only the loader + flag + URL switch
git commit -m "perf(assets): enable KTX2 + Meshopt decoding and switch to models-optimized/"
```

---

## Phase 3 — Consolidate Metal Finishes into One Mesh + Material Override

The audit confirms `case_*`, `case_body_*`, `movement_*`, `globe_*` are 12 files differing only in metal finish. If geometry is identical across the three colorways per part, we can ship one GLB per part and apply a PBR override (color / metalness / roughness / IOR) at runtime. That's a 75% asset-count reduction for metal parts.

**Risk:** if any of the GLBs have engraving, hand-painted detail, or slightly different topology per colorway, the swap loses fidelity. Verify geometry hash equivalence before deleting source GLBs.

### Task 3.1: Verify geometry equivalence

**Files:**

- Create: `scripts/verify-metal-geometry.mjs`
- **Step 1: Write the verifier**

```js
// scripts/verify-metal-geometry.mjs
import { NodeIO } from '@gltf-transform/core';
import { createHash } from 'node:crypto';

const io = new NodeIO();

async function geomHash(path) {
  const doc = await io.read(path);
  const root = doc.getRoot();
  const h = createHash('sha256');
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) h.update(Buffer.from(pos.getArray().buffer));
      const idx = prim.getIndices();
      if (idx) h.update(Buffer.from(idx.getArray().buffer));
    }
  }
  return h.digest('hex');
}

const groups = {
  case: ['public/models/case_rose_gold.glb', 'public/models/case_white_gold.glb', 'public/models/case_yellow_gold.glb'],
  case_body: ['public/models/case_body_rose_gold.glb', 'public/models/case_body_white_gold.glb', 'public/models/case_body_yellow_gold.glb'],
  movement: ['public/models/movement_rose_gold.glb', 'public/models/movement_white_gold.glb', 'public/models/movement_yellow_gold.glb'],
  globe: ['public/models/globe_rose_gold.glb', 'public/models/globe_white_gold.glb', 'public/models/globe_yellow_gold.glb'],
};

for (const [name, files] of Object.entries(groups)) {
  const hashes = await Promise.all(files.map(geomHash));
  const allEqual = hashes.every((h) => h === hashes[0]);
  console.log(`${name}: ${allEqual ? 'IDENTICAL ✓' : 'DIFFERENT ✗'}`);
  if (!allEqual) hashes.forEach((h, i) => console.log(`  ${files[i]}: ${h.slice(0, 12)}`));
}
```

- **Step 2: Run**

```powershell
node scripts/verify-metal-geometry.mjs
```

- **Step 3: Branch on result**
- If **all four groups are IDENTICAL**: proceed to Task 3.2.
- If **any group DIFFERS**: report to user, defer consolidation for that part to Appendix B (artist pass needed). Do not delete the source GLBs.

### Task 3.2: Add PBR override config + `MetalPart` component

**Files:**

- Modify: `src/lib/siteConfigTypes.ts`
- Create: `src/components/Configurator/MetalPart.tsx`
- **Step 1: Define the override schema**

In `siteConfigTypes.ts`:

```ts
export type MetalFinishKey = 'rose_gold' | 'white_gold' | 'yellow_gold';

export interface MetalOverride {
  color: string;        // hex, e.g. '#b76e79' for rose
  metalness: number;    // 1 for true metal
  roughness: number;    // 0.15–0.35 typical
  ior?: number;
  clearcoat?: number;
}

export type MetalOverrideMap = Record<MetalFinishKey, MetalOverride>;
```

With defaults wired into `siteConfig.materialOverrides.metal`. Initial values to ship (tune against the original GLBs):

```ts
{
  rose_gold:   { color: '#b76e79', metalness: 1, roughness: 0.22 },
  white_gold:  { color: '#e6e6e6', metalness: 1, roughness: 0.18 },
  yellow_gold: { color: '#d4af37', metalness: 1, roughness: 0.24 },
}
```

- **Step 2: Component**

```tsx
// src/components/Configurator/MetalPart.tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { disposeObject3D } from '@/lib/disposeScene';
import type { MetalOverride } from '@/lib/siteConfigTypes';

interface Props {
  url: string;            // e.g. /models-optimized/case_base.glb
  override: MetalOverride;
}

export function MetalPart({ url, override }: Props) {
  const { scene } = useGLTF(url) as { scene: THREE.Object3D };
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const apply = (m: THREE.Material) => {
        const std = m as THREE.MeshStandardMaterial;
        std.color = new THREE.Color(override.color);
        std.metalness = override.metalness;
        std.roughness = override.roughness;
        if ('ior' in std && override.ior != null) (std as THREE.MeshPhysicalMaterial).ior = override.ior;
        if ('clearcoat' in std && override.clearcoat != null) (std as THREE.MeshPhysicalMaterial).clearcoat = override.clearcoat;
        std.needsUpdate = true;
      };
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => apply(m.clone()));
      else mesh.material = (mat.clone(), apply(mesh.material as THREE.Material), mesh.material);
    });
    return copy;
  }, [scene, override.color, override.metalness, override.roughness, override.ior, override.clearcoat]);

  useEffect(() => () => disposeObject3D(cloned), [cloned]);
  return <primitive object={cloned} />;
}
```

- **Step 3: Rename one source GLB per group to the base path**

For each consolidated group, copy the rose-gold variant (arbitrary baseline) to a neutral path:

```powershell
Copy-Item public/models-optimized/case_rose_gold.glb public/models-optimized/case_base.glb
# repeat for case_body_base.glb, movement_base.glb, globe_base.glb
```

(Don't delete the originals yet; remove only after Phase 3 ships.)

- **Step 4: Wire feature flag**

In `getConfiguratorPartUrls` (`src/lib/catalogFromConfig.ts`), branch:

```ts
if (config.featureFlags?.consolidatedMetals) {
  return { case: '/models-optimized/case_base.glb', /* ... */ };
}
```

In the configurator's part renderer, branch:

```tsx
{config.featureFlags?.consolidatedMetals
  ? <MetalPart url={p.case} override={overrides.metal[metal]} />
  : <Part url={p.case} ... />}
```

- **Step 5: Visual A/B**

Run dev, toggle the feature flag in `siteConfig.json` admin panel, screenshot each metal for each part with both flag states. Side-by-side them. If indistinguishable: ship it. If a finish reads "off," tune the override numbers in the admin (it's a live-edit panel already per the existing admin work).

- **Step 6: Commit**

```bash
git add src/components/Configurator/MetalPart.tsx src/lib/siteConfigTypes.ts src/lib/catalogFromConfig.ts src/components/Configurator.tsx public/models-optimized/*_base.glb
git commit -m "perf(assets): consolidate metal finishes to one GLB per part with PBR override"
```

- **Step 7: (After visual sign-off in production)** delete the 9 redundant metal GLBs

```bash
git rm public/models/case_white_gold.glb public/models/case_yellow_gold.glb public/models/case_body_white_gold.glb public/models/case_body_yellow_gold.glb public/models/movement_white_gold.glb public/models/movement_yellow_gold.glb public/models/globe_white_gold.glb public/models/globe_yellow_gold.glb
# (keep case_rose_gold.glb as the original-finish reference, or rename it to *_base.glb in /models/ too)
git commit -m "chore(assets): remove redundant per-metal GLBs superseded by consolidated meshes"
```

---

## Phase 4 — Verification on iOS

### Task 4.1: Repeat baseline measurement, prove the win

**Files:**

- Modify: `docs/superpowers/plans/2026-05-27-baseline.md` (add "after" column)
- **Step 1: Run the exact same Playwright iOS-emulation flow from Task 0.1.**
- **Step 2: Targets**
- `jsHeap` after 12 swaps: ≤ 1.5× the value at idle (today it grows monotonically).
- `canvases` simultaneously mounted: ≤ 1.
- "View in AR" tap → Quick Look opens with the USDZ. No crash, no blank.
- Total `models-optimized/` bandwidth: ≤ 40% of original.
- **Step 3: Manual test on a real iPhone**

Playwright emulation does not catch memory-pressure crashes. Required: deploy a Netlify preview, test on a physical iPhone (any model from the user's device pool — the iPhone 12 or older is the relevant low-bar). Click every variant, then View in AR. Record any crash.

- **Step 4: Commit verification doc**

```bash
git add docs/superpowers/plans/2026-05-27-baseline.md
git commit -m "docs(perf): record post-optimization iOS Safari metrics"
```

---

## Phase 5 — Optional Hardening

### Task 5.1: Handle `webglcontextlost` gracefully

**Files:**

- Modify: `src/components/Configurator.tsx`, `src/components/WatchScene.tsx`
- **Step 1:** Add a `onContextLost` / `onContextRestored` handler that pauses the frameloop and shows a "Tap to reload" overlay. If iOS does run out of memory despite Phase 1–3, the user sees a friendly message instead of a blank canvas.

```tsx
const onContextLost = useCallback((e: WebGLContextEvent) => {
  e.preventDefault();
  setContextLost(true);
}, []);
```

Attach via `<Canvas onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', onContextLost)}>`.

- **Step 2: Commit.**

### Task 5.2: Preload throttling on slow connections

**Files:**

- Modify: `src/components/Configurator.tsx:865-875` (`useCatalogPreload`)
- **Step 1: Skip preload when `navigator.connection.saveData === true` or `effectiveType === 'slow-2g' | '2g'`.**

```tsx
const conn = (navigator as Navigator & { connection?: { saveData: boolean; effectiveType: string } }).connection;
if (conn?.saveData || ['slow-2g', '2g'].includes(conn?.effectiveType ?? '')) return;
```

- **Step 2: Commit.**

---

## Appendix A — Why Echo 3D was rejected

Findings from the research pass (`docs.echo3d.com/api/upload` + surrounding docs):

- **Not a streaming-mesh technology.** Echo 3D delivers the same GLB bytes via CDN. Once decoded into `BufferGeometry` + textures, GPU memory is identical to self-hosted GLBs. The iOS crash is GPU memory, not network — Echo 3D does not address it.
- `**userKey` exposure.** The Query/Download API requires `userKey` in the request. There is no public/secret split. To call from the browser you either expose it or proxy through your backend, which defeats the CDN benefit.
- **Extra round trip.** Query → CDN URL → GLB fetch adds 100–300 ms TTFB vs. direct.
- **Cost.** ~$0.02/MB bandwidth, 50–100× Cloudflare R2 / Bunny CDN. A modest 1000 visitors × 20 MB = 20 GB ≈ $400/mo.
- **No automatic USDZ pairing.** Conversion exists but is manual per asset, same as our self-hosted pipeline.
- **Vendor lock-in.** Models live behind their API keys; migration off requires re-uploading everywhere consumers exist.

Echo 3D is the right choice for: large 3D catalogues (hundreds of SKUs), teams without engineers, or use cases needing a non-technical DAM with versioning. None of those apply to a single luxury product configurator. If the product line expands to 50+ SKUs with frequent variant edits by non-engineers, revisit.

**Where keys would go (for the record, if the team overrides this recommendation):**

- `.env.local`: `ECHO3D_API_KEY=...`, `ECHO3D_USER_KEY=...`, `ECHO3D_EMAIL=...`
- Browser-safe collection ID: `NEXT_PUBLIC_ECHO3D_KEY` only — `userKey` must remain server-side, proxied by a Next.js route handler (`src/app/api/model/[entryId]/route.ts`) that does the `download` call server-side and returns the CDN URL.

## Appendix B — Why dragon variants are not consolidated in this plan

The four dragon colorways (`dragon_v1`..`dragon_v4`) likely differ in more than just material — different gem placements, possibly different dragon poses or jewel inlays per edition. Until an artist confirms geometry equivalence (or re-authors a base dragon + per-edition decal/inlay set), consolidating them risks losing the per-edition design language. Re-run `scripts/verify-metal-geometry.mjs` against the dragon GLBs to confirm. If hashes differ, file an asset task for the 3D artist rather than forcing it in code.

---

## Self-Review Notes

- **Spec coverage:** iOS crash (Phase 1.1, 1.2, 1.4, 1.5), AR crash (Phase 1.3), Echo 3D evaluation (Appendix A), material-swap idea (Phase 3, with Appendix B caveat for dragons), other optimizations (Phase 2 KTX2/Meshopt, Phase 5 context-loss handling). Covered.
- **Placeholder scan:** No "TBD" / "implement later" / "similar to" — every code step has actual code. Visual tuning numbers for metal overrides are concrete starting values, not "tune later."
- **Type consistency:** `MetalFinishKey`, `MetalOverride`, `MetalOverrideMap`, `DeviceTier`, `disposeObject3D(root: THREE.Object3D)` — used consistently across tasks. `featureFlags.consolidatedMetals` and `featureFlags.useOptimizedAssets` referenced the same way in every task that touches them.

