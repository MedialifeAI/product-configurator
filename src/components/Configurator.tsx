'use client';

/**
 * Configurator — interactive variant picker.
 *
 * Architecture:
 *   - Renders its OWN 3D canvas (separate from the scroll-scrubbed hero) so we
 *     can compose assembled-only state without the explode animation interfering.
 *   - Composes the watch from individual variant GLBs:
 *       case_body + case (bezel) + movement + dial + globe + hand + dragon + strap
 *   - Swapping a variant just unloads/loads the affected GLB. Other parts stay.
 *   - User can rotate via OrbitControls. Highlight isolates a component (others fade).
 *
 * Why separate from the hero scene: keeps WatchScene focused on scroll narrative.
 * The configurator is its own self-contained experience.
 */

import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF } from '@react-three/drei';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';

// The AR view bundles @google/model-viewer (~150KB) — load only when invoked.
const ArView     = dynamic(() => import('./ArView'),     { ssr: false });
const ArQrModal  = dynamic(() => import('./ArQrModal'),  { ssr: false });

const AR_MODEL_URL = '/models/full_watch/watch_full_default.glb';

useGLTF.setDecoderPath?.('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ============================================================
// Variant catalogues — kept here for easy authoring/extension
// ============================================================

type DragonId   = 'v1' | 'v2' | 'v3' | 'v4';
type MetalId    = 'rose_gold' | 'white_gold' | 'yellow_gold';
type ComponentId = 'dragon' | 'case' | 'movement' | 'dial' | 'globe' | 'strap';

const DRAGON_VARIANTS: { id: DragonId; label: string; sub: string; swatch: string; url: string }[] = [
  { id: 'v1', label: 'Imperial Rose Gold',  sub: 'Citrine accents',   swatch: '#c98363', url: '/models/dragon/dragon_v1_imperial_rose_gold.glb' },
  { id: 'v2', label: 'Sapphire Sky',        sub: 'Rose-gold body',    swatch: '#3661a9', url: '/models/dragon/dragon_v2_sapphire_sky.glb' },
  { id: 'v3', label: 'White Gold',          sub: 'Pure sculptural',   swatch: '#dfe1e3', url: '/models/dragon/dragon_v3_white_gold.glb' },
  { id: 'v4', label: 'Crimson Lacquer',     sub: 'Sapphire eyes',     swatch: '#7b1e1e', url: '/models/dragon/dragon_v4_crimson_dragon.glb' },
];

const METAL_VARIANTS: { id: MetalId; label: string; swatch: string }[] = [
  { id: 'rose_gold',   label: 'Rose Gold',   swatch: '#c98363' },
  { id: 'white_gold',  label: 'White Gold',  swatch: '#dfe1e3' },
  { id: 'yellow_gold', label: 'Yellow Gold', swatch: '#d4ad58' },
];

const COMPONENTS: { id: ComponentId; label: string }[] = [
  { id: 'dragon',   label: 'Dragon' },
  { id: 'case',     label: 'Case & Bezel' },
  { id: 'movement', label: 'Movement' },
  { id: 'dial',     label: 'Dial' },
  { id: 'globe',    label: 'Globe' },
  { id: 'strap',    label: 'Strap' },
];

// ============================================================
// 3D model parts
// ============================================================

function Part({ url, visible = true, dim = false }: { url: string; visible?: boolean; dim?: boolean }) {
  const { scene } = useGLTF(url) as any;
  // Clone so multiple <Part> instances of the same url don't share material state
  const cloned = scene.clone();
  if (dim) {
    cloned.traverse((o: any) => {
      if (o.isMesh && o.material) {
        const m = o.material.clone();
        m.transparent = true;
        m.opacity = 0.15;
        o.material = m;
      }
    });
  }
  return visible ? <primitive object={cloned} /> : null;
}

// Derive a fit transform from the assembled full-watch GLB (already preloaded by
// the hero). Using horizontal dims so the long vertical strap doesn't dwarf the
// case. All individual variant GLBs share the master's world coordinates, so
// applying this transform to the assembled group lines them up correctly.
// Derive the fit from a static part (the case body) instead of the assembled
// full watch — the hero scene plays NLA_Exploded_View on the shared full-watch
// GLB and that mutates the bounding box of any other consumer.
function useWatchFit() {
  const { scene } = useGLTF('/models/case_body/case_body_rose_gold.glb') as any;
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const horiz = Math.max(size.x, size.z, 0.001);
    return { scale: 1.2 / horiz, center };
  }, [scene]);
}

function AssembledWatch({
  dragon, metal, highlight, settings,
}: {
  dragon: DragonId;
  metal: MetalId;
  highlight: ComponentId | null;
  settings: SceneSettings;
}) {
  const isDim = (id: ComponentId) => highlight !== null && highlight !== id;
  const fit = useWatchFit();
  const scale = fit.scale * settings.configScale;

  const dragonUrl = DRAGON_VARIANTS.find((d) => d.id === dragon)!.url;

  // Operator override — single uploaded GLB stands in for the whole assembly.
  if (settings.configModelUrl) {
    return (
      <group
        position={[-fit.center.x * scale, -fit.center.y * scale, -fit.center.z * scale]}
        scale={scale}
      >
        <Part url={settings.configModelUrl} />
      </group>
    );
  }

  return (
    <group
      position={[-fit.center.x * scale, -fit.center.y * scale, -fit.center.z * scale]}
      scale={scale}
    >
      <Part url={`/models/case_body/case_body_${metal}.glb`} dim={isDim('case')} />
      <Part url={`/models/case/case_${metal}.glb`}           dim={isDim('case')} />
      <Part url={`/models/movement/movement_${metal}.glb`}   dim={isDim('movement')} />
      <Part url="/models/parts/dial.glb"                     dim={isDim('dial')} />
      <Part url="/models/parts/globe.glb"                    dim={isDim('globe')} />
      <Part url="/models/parts/hand.glb"                     dim={isDim('dial')} />
      <Part url={dragonUrl}                                  dim={isDim('dragon')} />
      <Part url="/models/parts/strap.glb"                    dim={isDim('strap')} />
    </group>
  );
}

// ============================================================
// UI
// ============================================================

interface ConfiguratorProps {
  id?: string;
  settings?: SceneSettings;
}

export default function Configurator({ id, settings = DEFAULT_SETTINGS }: ConfiguratorProps) {
  const [dragon, setDragon] = useState<DragonId>('v1');
  const [metal, setMetal]   = useState<MetalId>('rose_gold');
  // selected = sticky (click), hovered = ephemeral (mouse preview). Hover wins
  // when both are set so quick scans still preview, but the choice persists
  // when the cursor leaves the rail.
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [hovered, setHovered]   = useState<ComponentId | null>(null);
  const highlight = hovered ?? selected;

  // AR — null = closed; 'ar' = fullscreen model-viewer; 'qr' = desktop handoff
  const [arMode, setArMode] = useState<null | 'ar' | 'qr'>(null);
  const [arUrl, setArUrl] = useState<string>('');

  const dragonLabel = DRAGON_VARIANTS.find(d => d.id === dragon)?.label;
  const metalLabel  = METAL_VARIANTS.find(m => m.id === metal)?.label;
  const configLabel = `${dragonLabel} · ${metalLabel}`;

  // Honour mobile handoffs that arrive with ?ar=1[&dragon=...&metal=...]
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('ar') !== '1') return;
    const d = params.get('dragon') as DragonId | null;
    const m = params.get('metal')  as MetalId  | null;
    if (d && DRAGON_VARIANTS.some(v => v.id === d)) setDragon(d);
    if (m && METAL_VARIANTS.some(v => v.id === m))  setMetal(m);
    setArMode('ar');
  }, []);

  const handleArClick = () => {
    if (typeof window === 'undefined') return;
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));

    if (isMobile) {
      setArMode('ar');
      return;
    }
    // Desktop: build the handoff URL the phone will scan
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set('ar', '1');
    u.searchParams.set('dragon', dragon);
    u.searchParams.set('metal',  metal);
    u.hash = '#configurator';
    setArUrl(u.toString());
    setArMode('qr');
  };

  const closeAr = () => {
    setArMode(null);
    // Strip ?ar=1 from the URL so refresh doesn't re-open AR.
    if (typeof window !== 'undefined' && window.location.search.includes('ar=')) {
      const u = new URL(window.location.href);
      u.searchParams.delete('ar');
      u.searchParams.delete('dragon');
      u.searchParams.delete('metal');
      window.history.replaceState({}, '', u.toString());
    }
  };

  return (
    <section id={id} className="relative w-full min-h-screen bg-ink py-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">Configurator</span>
          <h2 className="font-display text-5xl md:text-6xl mt-3 text-bone">Make it yours.</h2>
          <p className="text-bone/60 mt-4 max-w-2xl mx-auto">
            Choose the dragon&apos;s finish and the case metal. Click any component to isolate it; hover for a quick peek.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-stretch">
          {/* 3D viewer */}
          <div className="glass rounded-3xl overflow-hidden h-[60vh] md:h-[70vh] relative">
            <Canvas
              camera={{ position: [0, 0.3, 3.6], fov: 32 }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
              style={{ background: 'transparent' }}
            >
              <ambientLight intensity={0.25} />
              <directionalLight position={[3, 4, 5]}  intensity={1.1} color="#fff5e0" />
              <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b4904e" />
              <Environment preset="studio" environmentIntensity={0.65} />
              <Suspense fallback={null}>
                <AssembledWatch
                  dragon={dragon}
                  metal={metal}
                  highlight={highlight}
                  settings={settings}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                enableZoom
                minDistance={2.5}
                maxDistance={6}
                autoRotate={settings.configRotate > 0}
                autoRotateSpeed={settings.configRotate}
              />
            </Canvas>
            {highlight && (
              <div className="absolute bottom-4 left-4 glass-gold-edge rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] text-bone/80">
                Isolating: {COMPONENTS.find(c => c.id === highlight)?.label}
              </div>
            )}
          </div>

          {/* Picker rail */}
          <div className="glass rounded-3xl p-6 md:p-8 flex flex-col gap-8 overflow-y-auto">
            {/* Dragon picker */}
            <div>
              <h3 className="text-xs tracking-[0.3em] uppercase text-bone/60 mb-4">The Dragon</h3>
              <div className="grid grid-cols-2 gap-3">
                {DRAGON_VARIANTS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setDragon(v.id)}
                    className={`text-left rounded-xl p-3 transition border ${
                      dragon === v.id
                        ? 'border-jc-gold/60 bg-jc-gold/5'
                        : 'border-bone/10 hover:border-bone/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-4 h-4 rounded-full border border-bone/20"
                        style={{ background: v.swatch }}
                      />
                      <span className="text-sm text-bone">{v.label}</span>
                    </div>
                    <div className="text-xs text-bone/50 ml-6">{v.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Metal picker */}
            <div>
              <h3 className="text-xs tracking-[0.3em] uppercase text-bone/60 mb-4">
                Case · Bezel · Movement
              </h3>
              <div className="flex gap-3">
                {METAL_VARIANTS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setMetal(v.id)}
                    className={`flex-1 rounded-xl p-3 transition border flex flex-col items-center gap-2 ${
                      metal === v.id
                        ? 'border-jc-gold/60 bg-jc-gold/5'
                        : 'border-bone/10 hover:border-bone/30'
                    }`}
                  >
                    <span
                      className="w-10 h-10 rounded-full border border-bone/20 shadow-inner"
                      style={{ background: `radial-gradient(circle at 35% 30%, ${v.swatch}, #2a2a2a)` }}
                    />
                    <span className="text-xs text-bone">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Component highlight */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-xs tracking-[0.3em] uppercase text-bone/60">Inspect a Component</h3>
                <span className="text-[10px] uppercase tracking-[0.25em] text-bone/30">
                  Click to lock · hover to peek
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelected(null)}
                  onMouseEnter={() => setHovered(null)}
                  className={`text-xs rounded-lg py-2 px-2 transition border ${
                    selected === null
                      ? 'border-jc-gold/60 bg-jc-gold/5 text-bone'
                      : 'border-bone/10 hover:border-bone/30 text-bone/60'
                  }`}
                >
                  All
                </button>
                {COMPONENTS.map(c => {
                  const isSelected = selected === c.id;
                  const isHovered  = hovered  === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(prev => prev === c.id ? null : c.id)}
                      onMouseEnter={() => setHovered(c.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`text-xs rounded-lg py-2 px-2 transition border ${
                        isSelected
                          ? 'border-jc-gold/60 bg-jc-gold/10 text-bone'
                          : isHovered
                            ? 'border-bone/40 bg-bone/5 text-bone'
                            : 'border-bone/10 hover:border-bone/30 text-bone/60'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live summary */}
            <div className="mt-auto pt-6 border-t border-bone/10 text-sm text-bone/70">
              <div className="flex justify-between mb-2">
                <span>Dragon</span>
                <span className="text-bone">{dragonLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Metal</span>
                <span className="text-bone">{metalLabel}</span>
              </div>

              {/* AR launch — luxury gold pill, full width below the summary */}
              <button
                type="button"
                onClick={handleArClick}
                className="mt-6 group relative w-full rounded-full overflow-hidden
                           border border-jc-gold/50 hover:border-jc-gold
                           bg-gradient-to-r from-jc-gold/10 via-jc-gold/5 to-jc-gold/10
                           py-3 px-5 transition-all duration-300
                           hover:shadow-[0_0_24px_rgba(180,144,78,0.35)]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100
                             bg-gradient-to-r from-transparent via-jc-gold/15 to-transparent
                             transition-opacity duration-500"
                />
                <span className="relative flex items-center justify-center gap-3 text-bone">
                  <ArGlyph className="w-4 h-4 text-jc-gold" />
                  <span className="text-xs uppercase tracking-[0.3em]">View in AR</span>
                </span>
              </button>
              <div className="mt-2 text-center text-[10px] text-bone/40 tracking-[0.2em] uppercase">
                On desktop · scan to your phone
              </div>
            </div>
          </div>
        </div>
      </div>

      {arMode === 'ar' && (
        <ArView
          src={AR_MODEL_URL}
          alt={`Astronomia Dragon — ${configLabel}`}
          onClose={closeAr}
          autoActivate
        />
      )}
      {arMode === 'qr' && (
        <ArQrModal url={arUrl} configLabel={configLabel} onClose={closeAr} />
      )}
    </section>
  );
}

/** Compact AR glyph — two corner brackets framing a cube. */
function ArGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" className={className}
         aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M12 8.5l4 2v3l-4 2-4-2v-3l4-2z" />
      <path d="M12 8.5v5" />
    </svg>
  );
}

// Preload first-shown variants so the configurator pops in instantly
DRAGON_VARIANTS.forEach(v => useGLTF.preload(v.url));
METAL_VARIANTS.forEach(v => {
  useGLTF.preload(`/models/case_body/case_body_${v.id}.glb`);
  useGLTF.preload(`/models/case/case_${v.id}.glb`);
  useGLTF.preload(`/models/movement/movement_${v.id}.glb`);
});
useGLTF.preload('/models/parts/dial.glb');
useGLTF.preload('/models/parts/globe.glb');
useGLTF.preload('/models/parts/hand.glb');
useGLTF.preload('/models/parts/strap.glb');
