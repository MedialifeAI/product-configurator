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
import { useCompactViewport } from '@/hooks/useCompactViewport';
import * as THREE from 'three';
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { useSiteConfig } from '@/context/SiteConfigProvider';
import {
  buildArHandoffUrl,
  isMobileArDevice,
  parseArSearchParams,
  scrollToConfigurator,
  stripArParamsFromUrl,
} from '@/lib/ar';
import { getConfiguratorPartUrls, getDragonUrl } from '@/lib/catalogFromConfig';
import { hideEmbeddedGlobeInScene } from '@/lib/hideEmbeddedGlobe';
import { warmArCatalogUrl } from '@/lib/arPreload';
import { arWatchUrl, partIconUrl } from '@/lib/resolveModelUrl';
import type { ComponentId, DragonId, MetalId, SiteCatalog } from '@/lib/siteConfigTypes';

// The AR view bundles @google/model-viewer (~150KB) — load only when invoked.
const ArView     = dynamic(() => import('./ArView'),     { ssr: false });
const ArQrModal  = dynamic(() => import('./ArQrModal'),  { ssr: false });

useGLTF.setDecoderPath?.('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ============================================================
// Variant catalogues — kept here for easy authoring/extension
// ============================================================

// ============================================================
// 3D model parts
// ============================================================

function Part({
  url,
  visible = true,
  dim = false,
  hideMovementGlobe = false,
}: {
  url: string;
  visible?: boolean;
  dim?: boolean;
  /** Strip globe geometry from movement GLBs (globe is a separate part). */
  hideMovementGlobe?: boolean;
}) {
  const { scene } = useGLTF(url) as { scene: THREE.Object3D };
  const cloned = useMemo(() => {
    const copy = scene.clone();
    if (hideMovementGlobe) hideEmbeddedGlobeInScene(copy);
    if (dim) {
      copy.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const m = src.clone();
          m.transparent = true;
          m.opacity = 0.15;
          mesh.material = m;
        }
      });
    }
    return copy;
  }, [scene, dim, hideMovementGlobe]);
  return visible ? <primitive object={cloned} /> : null;
}

// Derive a fit transform from the assembled full-watch GLB (already preloaded by
// the hero). Using horizontal dims so the long vertical strap doesn't dwarf the
// case. All individual variant GLBs share the master's world coordinates, so
// applying this transform to the assembled group lines them up correctly.
// Derive the fit from a static part (the case body) instead of the assembled
// full watch — the hero scene plays NLA_Exploded_View on the shared full-watch
// GLB and that mutates the bounding box of any other consumer.
function useWatchFit(fitUrl: string) {
  const { scene } = useGLTF(fitUrl) as any;
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const horiz = Math.max(size.x, size.z, 0.001);
    return { scale: 1.2 / horiz, center };
  }, [scene]);
}

function AssembledWatch({
  dragon, metal, globeMetal, highlight, settings, catalog, scaleMultiplier = 1,
}: {
  dragon: DragonId;
  metal: MetalId;
  globeMetal: MetalId;
  highlight: ComponentId | null;
  settings: SceneSettings;
  catalog: SiteCatalog;
  /** Responsive shrink on phones / narrow viewports. */
  scaleMultiplier?: number;
}) {
  const isDim = (id: ComponentId) => highlight !== null && highlight !== id;
  const parts = getConfiguratorPartUrls(catalog, metal, { globeMetal });
  const fit = useWatchFit(parts.caseBody);
  const scale = fit.scale * settings.configScale * scaleMultiplier;
  const dragonUrl = getDragonUrl(catalog, dragon);

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
      <Part key={parts.caseBody} url={parts.caseBody} dim={isDim('case')} />
      <Part key={parts.case} url={parts.case} dim={isDim('case')} />
      <Part
        key={parts.movement}
        url={parts.movement}
        dim={isDim('movement')}
        hideMovementGlobe
      />
      <Part key={parts.dial} url={parts.dial} dim={isDim('dial')} />
      <Part key={parts.globe} url={parts.globe} dim={isDim('globe')} />
      <Part key={parts.hand} url={parts.hand} dim={isDim('dial')} />
      <Part key={dragonUrl} url={dragonUrl} dim={isDim('dragon')} />
      <Part key={parts.strap} url={parts.strap} dim={isDim('strap')} />
    </group>
  );
}

// ============================================================
// UI
// ============================================================

interface ConfiguratorProps {
  id?: string;
  settings?: SceneSettings;
  /** Admin embed: 3D canvas + compact variant chips only. */
  embedPreview?: boolean;
}

/** Extra shrink on compact viewports so model + controls fit one screen. */
const MOBILE_CONFIG_SCALE = 0.72;

export default function Configurator({
  id,
  settings: settingsProp,
  embedPreview = false,
}: ConfiguratorProps) {
  const { config } = useSiteConfig();
  const settings = settingsProp ?? config.scene;
  const { catalog, content, features, ar: arSettings } = config;
  const copy = content.configurator;
  const dragons = catalog.dragons;
  const metals = catalog.metals;
  const components = catalog.components;
  const compact = useCompactViewport();

  const [dragon, setDragon] = useState<DragonId>('v1');
  const [metal, setMetal]   = useState<MetalId>('rose_gold');
  const [keepOriginalGlobe, setKeepOriginalGlobe] = useState(false);
  const [pinnedGlobeMetal, setPinnedGlobeMetal] = useState<MetalId>('rose_gold');
  const globeMetal = keepOriginalGlobe ? pinnedGlobeMetal : metal;

  useCatalogPreload(catalog, dragon, metal, globeMetal);

  const selectMetal = (id: MetalId) => {
    setMetal(id);
    if (!keepOriginalGlobe) setPinnedGlobeMetal(id);
  };
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [hovered, setHovered]   = useState<ComponentId | null>(null);
  const highlight = hovered ?? selected;

  const [arMode, setArMode] = useState<null | 'ar' | 'qr'>(null);
  const arOpen = arMode !== null;
  const [arUrl, setArUrl] = useState<string>('');
  const [mobileAr, setMobileAr] = useState(false);

  const dragonLabel = dragons.find(d => d.id === dragon)?.label;
  const metalLabel  = metals.find(m => m.id === metal)?.label;
  const configLabel = `${dragonLabel} · ${metalLabel}`;


  useEffect(() => {
    setMobileAr(isMobileArDevice());
  }, []);

  const openArHandoff = (config: { dragon: DragonId; metal: MetalId }) => {
    if (typeof window === 'undefined') return;
    warmArCatalogUrl(arWatchUrl(catalog));
    if (isMobileArDevice()) {
      setArMode('ar');
      return;
    }
    setArUrl(buildArHandoffUrl(window.location.href, config));
    setArMode('qr');
  };

  // Honour ?ar=1[&dragon=...&metal=...] from QR / shared links
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { openAr, dragon: d, metal: m } = parseArSearchParams(window.location.search);
    if (!openAr) return;
    if (d) setDragon(d);
    if (m) {
      setMetal(m);
      if (!keepOriginalGlobe) setPinnedGlobeMetal(m);
    }
    scrollToConfigurator();
    const config = { dragon: d ?? dragon, metal: m ?? metal };
    openArHandoff(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for URL handoff
  }, []);

  const handleArClick = () => {
    warmArCatalogUrl(arWatchUrl(catalog));
    openArHandoff({ dragon, metal });
  };

  const onArButtonHover = () => {
    warmArCatalogUrl(arWatchUrl(catalog));
  };

  const closeAr = () => {
    setArMode(null);
    if (typeof window !== 'undefined' && window.location.search.includes('ar=')) {
      window.history.replaceState({}, '', stripArParamsFromUrl(window.location.href));
    }
  };

  const configScaleMultiplier = embedPreview ? 0.85 : compact ? MOBILE_CONFIG_SCALE : 1;
  const canvasDpr: [number, number] = embedPreview ? [1, 1.5] : compact ? [1, 1.25] : [1, 2];

  if (embedPreview) {
    return (
      <div className="h-[240px] md:h-[280px] relative">
        <Canvas
          camera={{ position: [0, 0.3, 3.6], fov: 34 }}
          dpr={canvasDpr}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.25} />
          <directionalLight position={[3, 4, 5]} intensity={1.1} color="#fff5e0" />
          <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b4904e" />
          <Environment preset="studio" environmentIntensity={0.55} />
          <Suspense fallback={null}>
            <AssembledWatch
              dragon={dragon}
              metal={metal}
              globeMetal={globeMetal}
              highlight={null}
              settings={settings}
              catalog={catalog}
              scaleMultiplier={configScaleMultiplier}
            />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={2.2}
            maxDistance={5.5}
            autoRotate={settings.configRotate > 0}
            autoRotateSpeed={settings.configRotate}
          />
        </Canvas>
        <div className="absolute bottom-0 inset-x-0 p-2 flex flex-wrap gap-1 bg-gradient-to-t from-ink/90 to-transparent pointer-events-auto">
          {dragons.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => setDragon(v.id)}
              className={`px-2 py-0.5 rounded-full text-[9px] border ${
                dragon === v.id ? 'border-jc-gold/60 bg-jc-gold/15 text-bone' : 'border-bone/15 text-bone/55'
              }`}
            >
              {v.id}
            </button>
          ))}
          <span className="w-px h-4 bg-bone/20 self-center" />
          {metals.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectMetal(v.id)}
              className={`px-2 py-0.5 rounded-full text-[9px] border ${
                metal === v.id ? 'border-jc-gold/60 bg-jc-gold/15 text-bone' : 'border-bone/15 text-bone/55'
              }`}
            >
              {v.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      id={id}
      className={`relative w-full bg-ink px-4 sm:px-6 md:px-12 ${
        compact ? 'py-10 min-h-[100dvh]' : 'py-24 min-h-screen'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col h-full">
        <div className={`text-center shrink-0 ${compact ? 'mb-4' : 'mb-12'}`}>
          <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">{copy.eyebrow}</span>
          <h2 className={`font-display text-bone mt-2 ${compact ? 'text-3xl' : 'text-5xl md:text-6xl mt-3'}`}>
            {copy.title}
          </h2>
          {!compact && (
            <p className="text-bone/60 mt-4 max-w-2xl mx-auto">{copy.description}</p>
          )}
        </div>

        <div
          className={`flex flex-col gap-3 min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-stretch ${
            compact ? 'max-h-[calc(100dvh-7.5rem)]' : ''
          }`}
        >
          <div
            className={`glass rounded-2xl lg:rounded-3xl overflow-hidden relative shrink-0 ${
              compact ? 'h-[38dvh] min-h-[200px] max-h-[320px]' : 'h-[60vh] md:h-[70vh]'
            }`}
          >
            {!arOpen && (
            <Canvas
              camera={{ position: [0, 0.3, 3.6], fov: compact ? 36 : 32 }}
              dpr={canvasDpr}
              frameloop={settings.configRotate > 0 ? 'always' : 'demand'}
              gl={{ antialias: !compact, alpha: true, powerPreference: 'high-performance' }}
              style={{ background: 'transparent' }}
            >
              <ambientLight intensity={0.25} />
              <directionalLight position={[3, 4, 5]}  intensity={1.1} color="#fff5e0" />
              <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b4904e" />
              <Environment preset="studio" environmentIntensity={compact ? 0.45 : 0.65} />
              <Suspense fallback={null}>
                <AssembledWatch
                  dragon={dragon}
                  metal={metal}
                  globeMetal={globeMetal}
                  highlight={highlight}
                  settings={settings}
                  catalog={catalog}
                  scaleMultiplier={configScaleMultiplier}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                enableZoom
                minDistance={compact ? 2.2 : 2.5}
                maxDistance={compact ? 5 : 6}
                autoRotate={settings.configRotate > 0}
                autoRotateSpeed={settings.configRotate}
              />
            </Canvas>
            )}
            {arOpen && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-bone/40 uppercase tracking-[0.2em]">
                AR active
              </div>
            )}
            {highlight && (
              <div className="absolute bottom-4 left-4 glass-gold-edge rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] text-bone/80">
                Isolating: {components.find(c => c.id === highlight)?.label}
              </div>
            )}
          </div>

          <div
            className={`glass rounded-2xl lg:rounded-3xl flex flex-col min-h-0 overflow-y-auto overscroll-contain ${
              compact ? 'flex-1 p-4 gap-4' : 'p-6 md:p-8 gap-8'
            }`}
          >
            <div>
              <h3 className={`tracking-[0.3em] uppercase text-bone/60 ${compact ? 'text-[10px] mb-2' : 'text-xs mb-4'}`}>
                The Dragon
              </h3>
              <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
                {dragons.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setDragon(v.id)}
                    className={`text-left rounded-lg transition border ${
                      compact ? 'p-2' : 'rounded-xl p-3'
                    } ${
                      dragon === v.id
                        ? 'border-jc-gold/60 bg-jc-gold/5'
                        : 'border-bone/10 hover:border-bone/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`rounded-full border border-bone/20 shrink-0 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`}
                        style={{ background: v.swatch }}
                      />
                      <span className={`text-bone ${compact ? 'text-[11px] leading-tight' : 'text-sm'}`}>{v.label}</span>
                    </div>
                    {!compact && <div className="text-xs text-bone/50 ml-6">{v.sub}</div>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className={`tracking-[0.3em] uppercase text-bone/60 ${compact ? 'text-[10px] mb-2' : 'text-xs mb-4'}`}>
                Case · Bezel · Movement
              </h3>
              <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
                {metals.map(v => (
                  <button
                    key={v.id}
                    onClick={() => selectMetal(v.id)}
                    className={`flex-1 rounded-lg transition border flex flex-col items-center ${
                      compact ? 'p-2 gap-1' : 'rounded-xl p-3 gap-2'
                    } ${
                      metal === v.id
                        ? 'border-jc-gold/60 bg-jc-gold/5'
                        : 'border-bone/10 hover:border-bone/30'
                    }`}
                  >
                    <span
                      className={`rounded-full border border-bone/20 shadow-inner ${compact ? 'w-7 h-7' : 'w-10 h-10'}`}
                      style={{ background: `radial-gradient(circle at 35% 30%, ${v.swatch}, #2a2a2a)` }}
                    />
                    <span className={`text-bone ${compact ? 'text-[10px]' : 'text-xs'}`}>{v.label}</span>
                  </button>
                ))}
              </div>
              <label
                className={`flex items-start gap-2.5 cursor-pointer group ${
                  compact ? 'mt-2' : 'mt-3'
                }`}
              >
                <input
                  type="checkbox"
                  checked={keepOriginalGlobe}
                  onChange={e => {
                    const on = e.target.checked;
                    if (on) setPinnedGlobeMetal(metal);
                    setKeepOriginalGlobe(on);
                  }}
                  className="mt-0.5 accent-jc-gold shrink-0"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-bone/75 group-hover:text-bone transition ${
                      compact ? 'text-[10px]' : 'text-xs'
                    }`}
                  >
                    {copy.keepGlobeLabel}
                  </span>
                  <span className="block text-bone/40 text-[10px] mt-0.5 leading-snug">
                    {copy.keepGlobeHint}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <div className={`flex items-baseline justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
                <h3 className={`tracking-[0.3em] uppercase text-bone/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                  Inspect
                </h3>
                {!compact && (
                  <span className="text-[10px] uppercase tracking-[0.25em] text-bone/30">
                    Click to lock · hover to peek
                  </span>
                )}
              </div>
              <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-2.5'}`}>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  onMouseEnter={() => setHovered(null)}
                  className={`rounded-xl transition border flex flex-col items-center justify-center ${
                    compact ? 'py-2 px-1 min-h-[4.5rem]' : 'py-3 px-2 min-h-[5.25rem]'
                  } ${
                    selected === null
                      ? 'border-jc-gold/60 bg-jc-gold/5 text-bone'
                      : 'border-bone/10 hover:border-bone/30 text-bone/60'
                  }`}
                >
                  <span
                    className={`rounded-full border border-dashed border-bone/25 bg-bone/5 ${
                      compact ? 'w-9 h-9 mb-1' : 'w-11 h-11 mb-1.5'
                    }`}
                  />
                  <span className={compact ? 'text-[10px]' : 'text-xs'}>All</span>
                </button>
                {components.map(c => (
                  <PartInspectButton
                    key={c.id}
                    label={c.label}
                    iconUrl={partIconUrl(catalog, c.id)}
                    compact={compact}
                    active={selected === c.id}
                    hovered={hovered === c.id}
                    onClick={() => setSelected(prev => (prev === c.id ? null : c.id))}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </div>
            </div>

            <div className={`border-t border-bone/10 text-bone/70 ${compact ? 'pt-3 text-xs shrink-0' : 'mt-auto pt-6 text-sm'}`}>
              <div className="flex justify-between mb-2">
                <span>Dragon</span>
                <span className="text-bone">{dragonLabel}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Metal</span>
                <span className="text-bone">{metalLabel}</span>
              </div>
              {keepOriginalGlobe && (
                <div className="flex justify-between text-bone/50">
                  <span>Globe</span>
                  <span className="text-bone/80">
                    {metals.find(m => m.id === globeMetal)?.label ?? globeMetal}
                  </span>
                </div>
              )}

              {features.showArButton && (
                <>
                  <button
                    type="button"
                    onClick={handleArClick}
                    onMouseEnter={onArButtonHover}
                    onFocus={onArButtonHover}
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
                      <span className="text-xs uppercase tracking-[0.3em]">{copy.arButtonLabel}</span>
                    </span>
                  </button>
                  <div className="mt-2 text-center text-[10px] text-bone/40 tracking-[0.2em] uppercase">
                    {mobileAr ? copy.arMobileHint : copy.arDesktopHint}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {arMode === 'ar' && (
        <ArView
          catalog={catalog}
          ar={arSettings}
          initialDragon={dragon}
          initialMetal={metal}
          alt={`Astronomia Dragon — ${configLabel}`}
          onClose={closeAr}
          autoActivate={mobileAr}
        />
      )}
      {arMode === 'qr' && (
        <ArQrModal
          url={arUrl}
          arModelUrl={arWatchUrl(catalog)}
          configLabel={configLabel}
          onClose={closeAr}
        />
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

function PartInspectButton({
  label,
  iconUrl,
  compact,
  active,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  iconUrl: string;
  compact: boolean;
  active: boolean;
  hovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`rounded-xl transition border flex flex-col items-center ${
        compact ? 'py-2 px-1 min-h-[4.5rem]' : 'py-3 px-2 min-h-[5.25rem]'
      } ${
        active
          ? 'border-jc-gold/60 bg-jc-gold/10 text-bone'
          : hovered
            ? 'border-bone/40 bg-bone/5 text-bone'
            : 'border-bone/10 hover:border-bone/30 text-bone/60'
      }`}
    >
      <span
        className={`rounded-full overflow-hidden border shrink-0 bg-ink/80 ${
          compact ? 'w-9 h-9 mb-1' : 'w-11 h-11 mb-1.5'
        } ${active ? 'border-jc-gold/50 ring-1 ring-jc-gold/25' : 'border-bone/15'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </span>
      <span className={`text-center leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {label}
      </span>
    </button>
  );
}

/** Preload active configuration — avoids fetching every metal/movement GLB at once. */
function useCatalogPreload(
  catalog: SiteCatalog,
  dragon: DragonId,
  metal: MetalId,
  globeMetal: MetalId,
) {
  useEffect(() => {
    const p = getConfiguratorPartUrls(catalog, metal, { globeMetal });
    useGLTF.preload(getDragonUrl(catalog, dragon));
    useGLTF.preload(p.caseBody);
    useGLTF.preload(p.case);
    useGLTF.preload(p.movement);
    useGLTF.preload(p.globe);
    useGLTF.preload(p.dial);
    useGLTF.preload(p.hand);
    useGLTF.preload(p.strap);
  }, [catalog, dragon, metal, globeMetal]);
}
