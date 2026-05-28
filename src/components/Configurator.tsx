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

import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF } from '@react-three/drei';
import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCompactViewport } from '@/hooks/useCompactViewport';
import * as THREE from 'three';
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { useSiteConfig } from '@/context/SiteConfigProvider';
import {
  buildArHandoffUrl,
  isIosDevice,
  isMobileArDevice,
  parseArSearchParams,
  scrollToConfigurator,
  setArSessionOpen,
  stripArParamsFromUrl,
} from '@/lib/ar';
import { formatAssetMegabytes, probeAssetByteSize } from '@/lib/arAssetSize';
import {
  buildConfigShareUrl,
  parseConfigSearchParams,
  syncConfigSearchParams,
} from '@/lib/configUrl';
import { getConfiguratorPartUrls, getDragonUrl } from '@/lib/catalogFromConfig';
import { disposeObject3D } from '@/lib/disposeScene';
import { getDeviceTier } from '@/lib/deviceTier';
import { resolveRenderQuality, resolveWebGlPowerPreference, shouldWarmVariantPreload } from '@/lib/renderQuality';
import { resolveBackgroundStyle } from '@/lib/resolveBackgroundUrl';
import { hideEmbeddedGlobeInScene } from '@/lib/hideEmbeddedGlobe';
import { warmArCatalogUrl } from '@/lib/arPreload';
import { releaseConfiguratorGltfCache } from '@/lib/releaseConfiguratorGltf';
import { arWatchUrl, partIconUrl } from '@/lib/resolveModelUrl';
import type {
  ComponentId,
  DragonId,
  MetalId,
  MetalOverride,
  SiteCatalog,
  SiteConfig,
} from '@/lib/siteConfigTypes';
import { DEFAULT_METAL_OVERRIDES } from '@/lib/siteConfigTypes';
import { WebGlContextBanner } from '@/components/WebGlContextBanner';
import { WebGlContextListener } from '@/components/WebGlContextListener';
import ConfiguratorBackgroundPicker from '@/components/ConfiguratorBackgroundPicker';
import { PerformanceOverlayPanel, PerformanceSampler } from '@/components/PerformanceOverlay';
import { MetalPart } from '@/components/Configurator/MetalPart';
import { useInViewOnce } from '@/hooks/useInViewOnce';

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

  // Free GPU resources from the cloned scene when this clone is replaced or unmounted.
  // The dim branch above clones materials; without this, those clones leak.
  useEffect(() => {
    return () => {
      disposeObject3D(cloned);
    };
  }, [cloned]);

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
  dragon, metal, globeMetal, highlight, settings, catalog, config, scaleMultiplier = 1,
  useOptimizedAssets, useIosAssets,
}: {
  dragon: DragonId;
  metal: MetalId;
  globeMetal: MetalId;
  highlight: ComponentId | null;
  settings: SceneSettings;
  catalog: SiteCatalog;
  config: SiteConfig;
  /** Responsive shrink on phones / narrow viewports. */
  scaleMultiplier?: number;
  useOptimizedAssets?: boolean;
  useIosAssets?: boolean;
}) {
  const isDim = (id: ComponentId) => highlight !== null && highlight !== id;
  const urlOpts = {
    globeMetal,
    useOptimizedAssets: useOptimizedAssets ?? config.featureFlags?.useOptimizedAssets,
    useIosAssets: useIosAssets ?? config.featureFlags?.useIosAssets,
    consolidatedMetals: config.featureFlags?.consolidatedMetals,
  };
  const parts = getConfiguratorPartUrls(catalog, metal, urlOpts);
  const fit = useWatchFit(parts.caseBody);
  const scale = fit.scale * settings.configScale * scaleMultiplier;
  // Synthesize a config-shaped object so getDragonUrl picks up the runtime
  // useIosAssets value rather than the persisted feature flag.
  const dragonUrl = getDragonUrl(catalog, dragon, {
    ...config,
    featureFlags: {
      ...config.featureFlags,
      useOptimizedAssets: urlOpts.useOptimizedAssets,
      useIosAssets: urlOpts.useIosAssets,
    },
  });
  const consolidated = config.featureFlags?.consolidatedMetals ?? false;
  const metalOverrides = config.materialOverrides?.metal ?? DEFAULT_METAL_OVERRIDES;
  const metalOverride: MetalOverride = metalOverrides[metal] ?? DEFAULT_METAL_OVERRIDES[metal];
  const globeOverride: MetalOverride = metalOverrides[globeMetal] ?? DEFAULT_METAL_OVERRIDES[globeMetal];

  const renderMetal = (
    slot: string,
    url: string,
    dimId: ComponentId,
    override: MetalOverride,
    hideGlobe = false,
  ) => {
    if (consolidated) {
      return (
        <MetalPart
          key={slot}
          url={url}
          override={override}
          dim={isDim(dimId)}
          hideMovementGlobe={hideGlobe}
        />
      );
    }
    return (
      <Part
        key={slot}
        url={url}
        dim={isDim(dimId)}
        hideMovementGlobe={hideGlobe}
      />
    );
  };

  const yaw = settings.configYaw ?? 0;

  if (settings.configModelUrl) {
    return (
      <group rotation={[0, yaw, 0]}>
        <group
          position={[-fit.center.x * scale, -fit.center.y * scale, -fit.center.z * scale]}
          scale={scale}
        >
          <Part url={settings.configModelUrl} />
        </group>
      </group>
    );
  }

  return (
    <group rotation={[0, yaw, 0]}>
      <group
        position={[-fit.center.x * scale, -fit.center.y * scale, -fit.center.z * scale]}
        scale={scale}
      >
      {renderMetal('caseBody', parts.caseBody, 'case', metalOverride)}
      {renderMetal('case', parts.case, 'case', metalOverride)}
      {renderMetal('movement', parts.movement, 'movement', metalOverride, true)}
      <Part key="dial" url={parts.dial} dim={isDim('dial')} />
      {renderMetal('globe', parts.globe, 'globe', globeOverride)}
      <Part key="hand" url={parts.hand} dim={isDim('dial')} />
      <Part key="dragon" url={dragonUrl} dim={isDim('dragon')} />
      <Part key="strap" url={parts.strap} dim={isDim('strap')} />
      </group>
    </group>
  );
}

type OrbitControlsApi = { reset: () => void };

/** Softer product lighting — avoids blown HDR hotspots on polished metal. */
function ConfiguratorLighting({
  settings,
  compact,
  useIosAssets,
}: {
  settings: SceneSettings;
  compact?: boolean;
  /** Drop the studio cubemap resolution on iOS (~24MB → ~100KB GPU). */
  useIosAssets?: boolean;
}) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = settings.configExposure;
  }, [gl, settings.configExposure]);

  const envIntensity = compact
    ? settings.configEnv * 0.77
    : settings.configEnv;

  return (
    <>
      <ambientLight intensity={settings.configAmbient} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={settings.configKey} color="#fff5e0" />
      <directionalLight position={[-3, 1.5, -2.5]} intensity={settings.configRim} color="#b4904e" />
      <directionalLight position={[0, -2, 3]} intensity={settings.configKicker} color="#6a8db3" />
      <Environment
        preset="studio"
        environmentIntensity={envIntensity}
        resolution={useIosAssets ? 64 : 256}
      />
    </>
  );
}

function ConfiguratorScene({
  dragon,
  metal,
  globeMetal,
  highlight,
  settings,
  catalog,
  config,
  scaleMultiplier,
  compact,
  showPerformanceOverlay,
  perfSourceId,
  useOptimizedAssets,
  useIosAssets,
  onResetReady,
}: {
  dragon: DragonId;
  metal: MetalId;
  globeMetal: MetalId;
  highlight: ComponentId | null;
  settings: SceneSettings;
  catalog: SiteCatalog;
  config: SiteConfig;
  scaleMultiplier: number;
  compact: boolean;
  showPerformanceOverlay: boolean;
  perfSourceId: string;
  useOptimizedAssets?: boolean;
  useIosAssets?: boolean;
  onResetReady: (reset: () => void) => void;
}) {
  const controlsRef = useRef<OrbitControlsApi | null>(null);

  useEffect(() => {
    onResetReady(() => {
      controlsRef.current?.reset();
    });
  }, [onResetReady]);

  return (
    <>
      <PerformanceSampler enabled={showPerformanceOverlay} sourceId={perfSourceId} />
      <ConfiguratorLighting settings={settings} compact={compact} useIosAssets={useIosAssets} />
      <Suspense fallback={null}>
        <AssembledWatch
          dragon={dragon}
          metal={metal}
          globeMetal={globeMetal}
          highlight={highlight}
          settings={settings}
          catalog={catalog}
          config={config}
          scaleMultiplier={scaleMultiplier}
          useOptimizedAssets={useOptimizedAssets}
          useIosAssets={useIosAssets}
        />
      </Suspense>
      <OrbitControls
        ref={controlsRef as never}
        enablePan={false}
        enableZoom
        target={[0, 0.05, 0]}
        minDistance={compact ? 2.2 : 2.5}
        maxDistance={compact ? 5 : 6}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.85}
        autoRotate={settings.configRotate > 0}
        autoRotateSpeed={settings.configRotate}
      />
    </>
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
  const tier = useMemo(() => getDeviceTier(), []);
  const isLowTier = tier === 'low';
  const renderQuality = useMemo(
    () =>
      resolveRenderQuality(
        settings.configModelQuality ?? 'auto',
        tier,
        config.featureFlags,
      ),
    [settings.configModelQuality, tier, config.featureFlags],
  );
  const perfSourceId = useId();
  const showPerf = features.showPerformanceOverlay;
  const backgrounds = settings.configBackgrounds?.length
    ? settings.configBackgrounds
    : DEFAULT_SETTINGS.configBackgrounds;
  const embedBgStyle = resolveBackgroundStyle(
    backgrounds.find(b => b.id === (settings.configDefaultBackgroundId ?? 'ink')) ?? backgrounds[0],
    settings.configCanvasColor ?? '#0a0a0c',
  );
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const canvasReady = useInViewOnce(canvasHostRef);
  const [contextLost, setContextLost] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);

  const handleContextLost = useCallback(() => {
    setContextLost(true);
  }, []);

  const reloadCanvas = useCallback(() => {
    setContextLost(false);
    setCanvasEpoch(n => n + 1);
  }, []);

  const urlOpts = {
    useOptimizedAssets: renderQuality.useOptimizedAssets,
    useIosAssets: renderQuality.useIosAssets,
  };

  const [dragon, setDragon] = useState<DragonId>('v1');
  const [metal, setMetal]   = useState<MetalId>('rose_gold');
  const [keepOriginalGlobe, setKeepOriginalGlobe] = useState(false);
  const [pinnedGlobeMetal, setPinnedGlobeMetal] = useState<MetalId>('rose_gold');
  const globeMetal = keepOriginalGlobe ? pinnedGlobeMetal : metal;

  useCatalogPreload(
    catalog,
    dragon,
    metal,
    globeMetal,
    urlOpts.useOptimizedAssets,
    urlOpts.useIosAssets,
    isLowTier,
  );

  // Desktop / mid-tier: warm all variant GLBs once so swaps stay instant.
  useConfiguratorWarmPreload(
    catalog,
    urlOpts.useOptimizedAssets,
    urlOpts.useIosAssets,
    canvasReady &&
      shouldWarmVariantPreload(settings.configModelQuality ?? 'auto', tier),
  );

  const selectMetal = (id: MetalId) => {
    setMetal(id);
    if (!keepOriginalGlobe) setPinnedGlobeMetal(id);
  };
  const [selected, setSelected] = useState<ComponentId | null>(null);
  const [hovered, setHovered]   = useState<ComponentId | null>(null);
  const highlight = hovered ?? selected;

  const [arMode, setArMode] = useState<null | 'ar' | 'qr'>(null);
  const [arUiReady, setArUiReady] = useState(false);
  const arOpen = arMode !== null;
  const [arUrl, setArUrl] = useState<string>('');
  const [mobileAr, setMobileAr] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [arAssetLabel, setArAssetLabel] = useState<string | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);

  const dragonLabel = dragons.find(d => d.id === dragon)?.label;
  const metalLabel  = metals.find(m => m.id === metal)?.label;
  const configLabel = `${dragonLabel} · ${metalLabel}`;

  const onResetReady = useCallback((reset: () => void) => {
    resetViewRef.current = reset;
  }, []);

  useEffect(() => {
    setMobileAr(isMobileArDevice());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { dragon: d, metal: m } = parseConfigSearchParams(window.location.search);
    if (d) setDragon(d);
    if (m) {
      setMetal(m);
      if (!keepOriginalGlobe) setPinnedGlobeMetal(m);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate from share URL once
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || embedPreview) return;
    syncConfigSearchParams(dragon, metal);
  }, [dragon, metal, embedPreview]);

  useEffect(() => {
    let cancelled = false;
    const url = arWatchUrl(catalog, urlOpts);
    probeAssetByteSize(url).then(bytes => {
      if (!cancelled && bytes) setArAssetLabel(formatAssetMegabytes(bytes));
    });
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  const openArHandoff = (handoff: { dragon: DragonId; metal: MetalId }) => {
    if (typeof window === 'undefined') return;

    // Admin override: redirect to an external URL instead of launching AR.
    // Useful when AR is hosted elsewhere (Echo3D viewer, Spark AR, etc).
    const ar = config.ar;
    if (ar?.externalLinkEnabled && ar.externalLinkUrl && ar.externalLinkUrl.trim()) {
      window.open(ar.externalLinkUrl.trim(), '_blank', 'noopener,noreferrer');
      return;
    }

    if (isIosDevice()) {
      releaseConfiguratorGltfCache(catalog, config, handoff.dragon, handoff.metal, globeMetal, urlOpts);
      setArSessionOpen(true);
    }
    warmArCatalogUrl(arWatchUrl(catalog, urlOpts));
    if (isMobileArDevice()) {
      setArUiReady(!isIosDevice());
      setArMode('ar');
      if (isIosDevice()) {
        window.setTimeout(() => setArUiReady(true), 350);
      }
      return;
    }
    setArSessionOpen(true);
    setArUrl(buildArHandoffUrl(window.location.href, handoff));
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

  const isExternalArMode = Boolean(
    config.ar?.externalLinkEnabled && config.ar.externalLinkUrl?.trim(),
  );

  const handleArClick = () => {
    // openArHandoff handles its own preload after the external-link check —
    // calling it again here wastes a 15 MB fetch in external-link mode.
    openArHandoff({ dragon, metal });
  };

  const onArButtonHover = () => {
    // Skip the GLB preload when an external link will be opened instead.
    if (isExternalArMode) return;
    warmArCatalogUrl(arWatchUrl(catalog, urlOpts));
  };

  const copyConfigLink = async () => {
    if (typeof window === 'undefined') return;
    const url = buildConfigShareUrl(window.location.href, { dragon, metal });
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
      window.setTimeout(() => setShareStatus('idle'), 2200);
    } catch {
      window.prompt('Copy configuration link:', url);
    }
  };

  const closeAr = () => {
    setArMode(null);
    setArUiReady(false);
    setArSessionOpen(false);
    if (typeof window !== 'undefined' && window.location.search.includes('ar=')) {
      window.history.replaceState({}, '', stripArParamsFromUrl(window.location.href));
    }
  };

  const configScaleMultiplier = embedPreview ? 0.85 : compact ? MOBILE_CONFIG_SCALE : 1;
  const canvasDpr = renderQuality.dpr;
  const canvasGl = {
    antialias: renderQuality.antialias,
    alpha: true,
    powerPreference: resolveWebGlPowerPreference(tier),
  };

  if (embedPreview) {
    return (
      <div className="h-full min-h-[360px] relative">
        <div className="absolute inset-0 -z-10" style={embedBgStyle} aria-hidden />
        <Canvas
          camera={{ position: [0, 0.22, 3.5], fov: 34 }}
          dpr={canvasDpr}
          gl={canvasGl}
          style={{ background: 'transparent' }}
        >
          <WebGlContextListener onLost={handleContextLost} />
          <PerformanceSampler enabled={showPerf} sourceId={perfSourceId} />
          <ConfiguratorLighting settings={settings} compact />
          <Suspense fallback={null}>
            <AssembledWatch
              dragon={dragon}
              metal={metal}
              globeMetal={globeMetal}
              highlight={null}
              settings={settings}
              catalog={catalog}
              config={config}
              scaleMultiplier={configScaleMultiplier}
              useOptimizedAssets={renderQuality.useOptimizedAssets}
              useIosAssets={renderQuality.useIosAssets}
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
        <PerformanceOverlayPanel enabled={showPerf} sourceId={perfSourceId} />
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
          className={`flex flex-col gap-3 min-h-0 flex-1 lg:grid lg:grid-cols-[7fr_6fr] lg:gap-5 lg:items-stretch ${
            compact ? 'max-h-[calc(100dvh-7.5rem)]' : 'lg:h-[min(68vh,680px)]'
          }`}
        >
          <div
            ref={canvasHostRef}
            className={`glass rounded-2xl lg:rounded-3xl overflow-hidden relative shrink-0 min-h-0 ${
              compact
                ? 'h-[48dvh] min-h-[220px] max-h-[420px]'
                : 'h-[50vh] sm:h-[55vh] lg:h-full'
            }`}
          >
            {!arOpen && canvasReady && !contextLost && (
            <Canvas
              key={canvasEpoch}
              camera={{ position: [0, 0.22, 3.5], fov: compact ? 36 : 32 }}
              dpr={canvasDpr}
              frameloop={settings.configRotate > 0 ? 'always' : 'demand'}
              gl={canvasGl}
              style={{ background: 'transparent' }}
            >
              <WebGlContextListener onLost={handleContextLost} />
              <ConfiguratorScene
                dragon={dragon}
                metal={metal}
                globeMetal={globeMetal}
                highlight={highlight}
                settings={settings}
                catalog={catalog}
                config={config}
                scaleMultiplier={configScaleMultiplier}
                compact={compact}
                showPerformanceOverlay={showPerf}
                perfSourceId={perfSourceId}
                useOptimizedAssets={renderQuality.useOptimizedAssets}
                useIosAssets={renderQuality.useIosAssets}
                onResetReady={onResetReady}
              />
            </Canvas>
            )}
            {!arOpen && (
              <ConfiguratorBackgroundPicker
                backgrounds={backgrounds}
                defaultId={settings.configDefaultBackgroundId ?? 'ink'}
                fallbackColor={settings.configCanvasColor ?? '#0a0a0c'}
              />
            )}
            <PerformanceOverlayPanel enabled={showPerf && !arOpen} sourceId={perfSourceId} />
            <WebGlContextBanner visible={contextLost} onReload={reloadCanvas} />
            {!arOpen && (
              <button
                type="button"
                onClick={() => resetViewRef.current?.()}
                className="absolute top-3 right-3 pointer-events-auto z-10 rounded-full border border-bone/20 bg-ink/70 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-bone/75 hover:text-bone hover:border-bone/40 transition"
              >
                {copy.resetViewLabel}
              </button>
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
              compact ? 'flex-1 p-4 gap-4' : 'p-3 md:p-4 gap-3 lg:h-full'
            }`}
          >
            <div className={compact ? 'space-y-3' : 'space-y-4 lg:space-y-3.5'}>
              <div>
                <h3 className={`tracking-[0.3em] uppercase text-bone/60 ${compact ? 'text-[10px] mb-2' : 'text-[10px] mb-2'}`}>
                  The Dragon
                </h3>
                <div
                  className={
                    compact
                      ? 'flex gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide -mx-0.5 px-0.5'
                      : 'grid grid-cols-2 gap-2'
                  }
                >
                  {dragons.map(v => (
                    <DragonVariantChip
                      key={v.id}
                      label={v.label}
                      sub={v.sub}
                      swatch={v.swatch}
                      selected={dragon === v.id}
                      compact={compact}
                      horizontal={compact}
                      onClick={() => setDragon(v.id)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className={`tracking-[0.28em] uppercase text-bone/60 leading-snug ${compact ? 'text-[10px] mb-2' : 'text-[10px] mb-2'}`}>
                  {compact ? (
                    'Case · Bezel · Movement'
                  ) : (
                    <>
                      <span className="block">Case · Bezel</span>
                      <span className="block mt-0.5">Movement</span>
                    </>
                  )}
                </h3>
                <div className={`flex ${compact ? 'gap-2' : 'gap-2'}`}>
                  {metals.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectMetal(v.id)}
                      title={v.label}
                      className={`flex-1 min-w-0 rounded-lg transition border flex flex-col items-center ${
                        compact ? 'p-2 gap-1' : 'p-2 gap-1'
                      } ${
                        metal === v.id
                          ? 'border-jc-gold/60 bg-jc-gold/5'
                          : 'border-bone/10 hover:border-bone/30'
                      }`}
                    >
                      <span
                        className={`rounded-full border border-bone/20 shadow-inner shrink-0 ${
                          compact ? 'w-7 h-7' : 'w-7 h-7'
                        }`}
                        style={{ background: `radial-gradient(circle at 35% 30%, ${v.swatch}, #2a2a2a)` }}
                      />
                      <span className={`text-bone truncate w-full text-center ${compact ? 'text-[10px]' : 'text-[10px] leading-tight'}`}>
                        {v.label.replace(' Gold', '')}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer group mt-2.5">
                  <input
                    type="checkbox"
                    checked={keepOriginalGlobe}
                    onChange={e => {
                      const on = e.target.checked;
                      if (on) setPinnedGlobeMetal(metal);
                      setKeepOriginalGlobe(on);
                    }}
                    className="accent-jc-gold shrink-0"
                  />
                  <span className="min-w-0 leading-snug">
                    <span className={`block text-bone/75 group-hover:text-bone transition ${compact ? 'text-[10px]' : 'text-[10px]'}`}>
                      {copy.keepGlobeLabel}
                    </span>
                    {!compact && (
                      <span className="block text-bone/40 text-[9px] mt-0.5 leading-snug">
                        {copy.keepGlobeHint}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            <div className="shrink-0">
              <h3 className={`tracking-[0.3em] uppercase text-bone/60 ${compact ? 'text-[10px] mb-1' : 'text-[10px] mb-1'}`}>
                Inspect
              </h3>
              {!compact && (
                <p className="text-[9px] uppercase tracking-[0.22em] text-bone/30 mb-2 leading-snug">
                  Click to lock · hover to peek
                </p>
              )}
              <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-1.5'}`}>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  onMouseEnter={() => setHovered(null)}
                  className={`rounded-lg transition border flex flex-col items-center justify-center ${
                    compact ? 'py-2 px-1 min-h-[4.5rem]' : 'py-1 px-1 min-h-[3rem] lg:min-h-[2.75rem]'
                  } ${
                    selected === null
                      ? 'border-jc-gold/60 bg-jc-gold/5 text-bone'
                      : 'border-bone/10 hover:border-bone/30 text-bone/60'
                  }`}
                >
                  <span
                    className={`rounded-full border border-dashed border-bone/25 bg-bone/5 ${
                      compact ? 'w-9 h-9 mb-1' : 'w-7 h-7 mb-0.5'
                    }`}
                  />
                  <span className={compact ? 'text-[10px]' : 'text-[9px] leading-tight'}>All</span>
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

            <div className={`border-t border-bone/10 text-bone/70 shrink-0 ${compact ? 'pt-3 text-xs' : 'mt-auto pt-3 text-xs lg:text-[11px]'}`}>
              <p className="text-[9px] text-jc-gold/80 tracking-[0.12em] uppercase mb-2 leading-snug">
                {copy.editionLine}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 text-[10px] lg:text-[11px]">
                <div className="flex justify-between gap-2 col-span-2">
                  <span className="text-bone/55">Dragon</span>
                  <span className="text-bone text-right">{dragonLabel}</span>
                </div>
                <div className="flex justify-between gap-2 col-span-2">
                  <span className="text-bone/55">Metal</span>
                  <span className="text-bone text-right">{metalLabel}</span>
                </div>
                {keepOriginalGlobe && (
                  <div className="flex justify-between gap-2 col-span-2 text-bone/50">
                    <span>Globe</span>
                    <span className="text-bone/80 text-right">
                      {metals.find(m => m.id === globeMetal)?.label ?? globeMetal}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void copyConfigLink()}
                className="w-full rounded-lg border border-bone/15 hover:border-bone/35 py-2 text-[10px] uppercase tracking-[0.22em] text-bone/65 hover:text-bone transition"
              >
                {shareStatus === 'copied' ? copy.shareLinkCopied : copy.shareLinkLabel}
              </button>

              {features.showArButton && (
                <>
                  <button
                    type="button"
                    onClick={handleArClick}
                    onMouseEnter={onArButtonHover}
                    onFocus={onArButtonHover}
                    className="mt-3 group relative w-full rounded-full overflow-hidden
                               border border-jc-gold/50 hover:border-jc-gold
                               bg-gradient-to-r from-jc-gold/10 via-jc-gold/5 to-jc-gold/10
                               py-2.5 px-4 transition-all duration-300
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
                      <span className="text-[10px] uppercase tracking-[0.28em]">
                        {arSettings?.externalLinkEnabled && arSettings.externalLinkLabel?.trim()
                          ? arSettings.externalLinkLabel
                          : copy.arButtonLabel}
                      </span>
                    </span>
                  </button>
                  <div className="mt-2 text-center text-[10px] text-bone/40 tracking-[0.15em]">
                    {mobileAr ? copy.arMobileHint : copy.arDesktopHint}
                  </div>
                  <p className="mt-1 text-center text-[9px] text-bone/35 leading-snug">
                    {copy.arSizeHint}
                    {arAssetLabel ? ` (${arAssetLabel})` : ''}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {arMode === 'ar' && arUiReady && (
        <ArView
          catalog={catalog}
          ar={arSettings}
          initialDragon={dragon}
          initialMetal={metal}
          alt={`Astronomia Dragon — ${configLabel}`}
          onClose={closeAr}
          autoActivate={mobileAr && !isIosDevice()}
        />
      )}
      {arMode === 'qr' && (
        <ArQrModal
          url={arUrl}
          arModelUrl={arWatchUrl(catalog, urlOpts)}
          configLabel={configLabel}
          onClose={closeAr}
        />
      )}
    </section>
  );
}

function DragonVariantChip({
  label,
  sub,
  swatch,
  selected,
  compact,
  horizontal,
  onClick,
}: {
  label: string;
  sub: string;
  swatch: string;
  selected: boolean;
  compact: boolean;
  horizontal?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={`${label} — ${sub}`}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border text-left transition shrink-0 ${
        horizontal ? 'min-w-[9.5rem] px-2.5 py-2' : 'w-full px-2.5 py-2'
      } ${compact && !horizontal ? 'p-2' : horizontal ? '' : ''} ${
        selected
          ? 'border-jc-gold/60 bg-jc-gold/5'
          : 'border-bone/10 hover:border-bone/30'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full border border-bone/20 shrink-0"
        style={{ background: swatch }}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-bone leading-snug ${compact ? 'text-[11px]' : 'text-[11px]'}`}>
          {label}
        </span>
        <span className="block text-[9px] text-bone/45 leading-snug mt-0.5">
          {sub}
        </span>
      </span>
    </button>
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
      className={`rounded-lg transition border flex flex-col items-center ${
        compact ? 'py-2 px-1 min-h-[4.5rem]' : 'py-1 px-1 min-h-[3rem] lg:min-h-[2.75rem]'
      } ${
        active
          ? 'border-jc-gold/60 bg-jc-gold/10 text-bone'
          : hovered
            ? 'border-bone/40 bg-bone/5 text-bone'
            : 'border-bone/10 hover:border-bone/30 text-bone/60'
      }`}
    >
      <span
        className={`rounded-full overflow-hidden border shrink-0 bg-ink/80 mb-0.5 ${
          compact ? 'w-9 h-9' : 'w-7 h-7'
        } ${active ? 'border-jc-gold/50 ring-1 ring-jc-gold/25' : 'border-bone/15'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </span>
      <span className={`text-center leading-tight px-0.5 ${compact ? 'text-[10px]' : 'text-[9px]'}`}>
        {label}
      </span>
    </button>
  );
}

/** Preload active configuration — idle + skip on save-data / 2G. */
function useCatalogPreload(
  catalog: SiteCatalog,
  dragon: DragonId,
  metal: MetalId,
  globeMetal: MetalId,
  useOptimizedAssets?: boolean,
  useIosAssets?: boolean,
  lowTier?: boolean,
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (conn?.saveData || ['slow-2g', '2g'].includes(conn?.effectiveType ?? '')) return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const p = getConfiguratorPartUrls(catalog, metal, {
        globeMetal,
        useOptimizedAssets,
        useIosAssets,
      });
      useGLTF.preload(
        getDragonUrl(catalog, dragon, {
          featureFlags: { useOptimizedAssets, useIosAssets },
        }),
      );
      useGLTF.preload(p.caseBody);
      useGLTF.preload(p.case);
      useGLTF.preload(p.movement);
      useGLTF.preload(p.globe);
      useGLTF.preload(p.dial);
      useGLTF.preload(p.hand);
      useGLTF.preload(p.strap);
    };

    const idleId = window.requestIdleCallback?.(run, { timeout: lowTier ? 2500 : 800 });
    const timeoutId = idleId == null ? window.setTimeout(run, lowTier ? 1200 : 400) : undefined;

    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [catalog, dragon, metal, globeMetal, useOptimizedAssets, useIosAssets, lowTier]);
}

/** One-time warm preload of every dragon + metal combo (skipped on iOS low tier). */
function useConfiguratorWarmPreload(
  catalog: SiteCatalog,
  useOptimizedAssets: boolean | undefined,
  useIosAssets: boolean | undefined,
  enabled: boolean,
) {
  const warmed = useRef(false);

  useEffect(() => {
    if (!enabled || warmed.current || typeof window === 'undefined') return;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      warmed.current = true;
      const flag = { featureFlags: { useOptimizedAssets, useIosAssets } };
      for (const d of catalog.dragons) {
        useGLTF.preload(getDragonUrl(catalog, d.id, flag));
      }
      for (const m of catalog.metals) {
        const p = getConfiguratorPartUrls(catalog, m.id, { useOptimizedAssets, useIosAssets });
        useGLTF.preload(p.caseBody);
        useGLTF.preload(p.case);
        useGLTF.preload(p.movement);
        useGLTF.preload(p.globe);
      }
      const staticParts = getConfiguratorPartUrls(catalog, 'rose_gold', {
        useOptimizedAssets,
        useIosAssets,
      });
      useGLTF.preload(staticParts.dial);
      useGLTF.preload(staticParts.hand);
      useGLTF.preload(staticParts.strap);
    };

    const idleId = window.requestIdleCallback?.(run, { timeout: 4000 });
    const timeoutId = idleId == null ? window.setTimeout(run, 1500) : undefined;

    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [catalog, useOptimizedAssets, useIosAssets, enabled]);
}
