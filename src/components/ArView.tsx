'use client';

import { AR_MODEL_USDZ } from '@/lib/ar';
import {
  buildArPresets,
  computeModelViewerScale,
  formatScaleTriple,
  resolveArComboModelUrl,
  type ArPreset,
  type ArSettings,
} from '@/lib/arSettings';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { DragonId, MetalId, SiteCatalog } from '@/lib/siteConfigTypes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          'ios-src'?: string;
          ar?: boolean;
          'ar-modes'?: string;
          'ar-scale'?: string;
          'ar-placement'?: string;
          'camera-controls'?: boolean;
          'auto-rotate'?: boolean;
          'shadow-intensity'?: string | number;
          exposure?: string | number;
          alt?: string;
          loading?: 'auto' | 'lazy' | 'eager';
          reveal?: 'auto' | 'interaction' | 'manual';
          'tone-mapping'?: string;
          'interpolation-decay'?: number;
          'camera-orbit'?: string;
          'min-camera-orbit'?: string;
          'max-camera-orbit'?: string;
          scale?: string;
          'touch-action'?: string;
        },
        HTMLElement
      >;
    }
  }
}

type ModelViewerElement = HTMLElement & {
  activateAR?: () => void;
  pause?: () => void;
  play?: () => void;
  cameraOrbit?: string;
  scale?: string;
  getDimensions?: () => { x: number; y: number; z: number };
  updateFraming?: () => void;
};

interface ArViewProps {
  catalog: SiteCatalog;
  ar: ArSettings;
  initialDragon: DragonId;
  initialMetal: MetalId;
  iosSrc?: string;
  alt: string;
  onClose: () => void;
  autoActivate?: boolean;
}

function parseOrbitTheta(orbit: string): number {
  const part = orbit.trim().split(/\s+/)[0] ?? '0deg';
  const n = parseFloat(part);
  return Number.isFinite(n) ? n : 0;
}

function setOrbitTheta(orbit: string, thetaDeg: number): string {
  const parts = orbit.trim().split(/\s+/);
  parts[0] = `${thetaDeg}deg`;
  return parts.join(' ');
}

export default function ArView({
  catalog,
  ar,
  initialDragon,
  initialMetal,
  iosSrc = AR_MODEL_USDZ,
  alt,
  onClose,
  autoActivate,
}: ArViewProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [iosUsdz, setIosUsdz] = useState<string | undefined>(undefined);
  const [dragon, setDragon] = useState(initialDragon);
  const [metal, setMetal] = useState(initialMetal);
  const [previewScaleAdj, setPreviewScaleAdj] = useState(1);

  const src = useMemo(
    () => resolveArComboModelUrl(catalog, dragon, metal),
    [catalog, dragon, metal],
  );

  const presets = useMemo(
    () => buildArPresets(catalog, ar.maxPresets),
    [catalog, ar.maxPresets],
  );

  const configLabel = useMemo(() => {
    const d = catalog.dragons.find(x => x.id === dragon);
    const m = catalog.metals.find(x => x.id === metal);
    return `${d?.label ?? dragon} · ${m?.label ?? metal}`;
  }, [catalog, dragon, metal]);

  const usesSharedArAsset = !catalog.arCombos?.[`${dragon}_${metal}`];

  const setViewerRef = (el: HTMLElement | null) => {
    viewerRef.current = el as ModelViewerElement | null;
  };

  useBodyScrollLock(true);
  useEscapeKey(onClose);

  useEffect(() => {
    let mounted = true;
    import('@google/model-viewer').then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(iosSrc, { method: 'HEAD' })
      .then(res => {
        if (!cancelled && res.ok) setIosUsdz(iosSrc);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [iosSrc]);

  const applyWatchScale = useCallback(() => {
    const el = viewerRef.current;
    if (!el?.getDimensions) return;
    try {
      const dims = el.getDimensions();
      const base = computeModelViewerScale(dims, ar) * previewScaleAdj;
      el.scale = formatScaleTriple(base);
      el.updateFraming?.();
    } catch {
      /* dimensions not ready */
    }
  }, [ar, previewScaleAdj]);

  const onModelLoad = () => {
    setLoaded(true);
    setError(false);
    const el = viewerRef.current;
    try {
      el?.pause?.();
    } catch {
      /* optional */
    }
    applyWatchScale();
  };

  const tryActivateAr = useCallback(() => {
    const el = viewerRef.current;
    if (!el?.activateAR) return;
    try {
      el.activateAR();
    } catch {
      /* platform policy */
    }
  }, []);

  useEffect(() => {
    if (!ready || !autoActivate || !loaded) return;
    const t = setTimeout(tryActivateAr, 500);
    return () => clearTimeout(t);
  }, [ready, autoActivate, loaded, tryActivateAr]);

  useEffect(() => {
    if (!loaded) return;
    applyWatchScale();
  }, [loaded, applyWatchScale, src]);

  const rotatePreview = (deltaDeg: number) => {
    const el = viewerRef.current;
    if (!el) return;
    const current = el.cameraOrbit ?? ar.cameraOrbit;
    const theta = parseOrbitTheta(current) + deltaDeg;
    el.cameraOrbit = setOrbitTheta(current, theta);
  };

  const selectPreset = (preset: ArPreset) => {
    setDragon(preset.dragon);
    setMetal(preset.metal);
    setLoaded(false);
  };

  const arScaleAttr = ar.lockRealWorldScale ? 'fixed' : 'auto';

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Augmented reality viewer"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-bone/10 shrink-0">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.3em] uppercase text-jc-gold/70">Augmented Reality</div>
          <div className="font-display text-lg sm:text-xl text-bone mt-0.5 truncate">{configLabel}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-bone/20 hover:border-bone/50 w-9 h-9 flex items-center justify-center text-bone/80 hover:text-bone transition"
          aria-label="Close AR viewer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 relative min-h-0 bg-[#0a0a0c]">
        {ready && !error ? (
          <model-viewer
            key={`${loadKey}-${src}`}
            ref={setViewerRef}
            src={src}
            {...(iosUsdz ? { 'ios-src': iosUsdz } : {})}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="floor"
            ar-scale={arScaleAttr}
            camera-controls
            touch-action="pan-y"
            auto-rotate={ar.autoRotateInPreview}
            shadow-intensity={ar.shadowIntensity}
            exposure={String(ar.exposure)}
            tone-mapping="commerce"
            interpolation-decay={200}
            camera-orbit={ar.cameraOrbit}
            min-camera-orbit={ar.minCameraOrbit}
            max-camera-orbit={ar.maxCameraOrbit}
            alt={alt}
            loading="eager"
            reveal="auto"
            onLoad={onModelLoad}
            onError={() => {
              setError(true);
              setLoaded(false);
            }}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0a0a0c',
              ['--poster-color' as string]: '#0a0a0c',
            }}
          >
            <button
              slot="ar-button"
              type="button"
              className="ar-slot-button"
              aria-label="Launch augmented reality"
            >
              Place in your space
            </button>
            <div slot="ar-prompt" className="ar-slot-prompt">
              {ar.tapToPlaceHint}
            </div>
          </model-viewer>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="text-center max-w-sm">
              <p className="text-bone/80 text-sm leading-relaxed">
                The AR model could not be loaded. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setLoaded(false);
                  setLoadKey(k => k + 1);
                }}
                className="mt-6 text-xs uppercase tracking-[0.25em] text-jc-gold border border-jc-gold/40 hover:bg-jc-gold/10 rounded-lg px-4 py-2 transition"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-10 h-10 border-2 border-jc-gold/30 border-t-jc-gold rounded-full animate-spin" />
              <div className="mt-4 text-xs tracking-[0.3em] uppercase text-bone/60">Preparing AR…</div>
            </div>
          </div>
        )}

        {loaded && (
          <div className="absolute top-3 right-3 flex gap-2 pointer-events-auto z-10">
            <button
              type="button"
              onClick={() => rotatePreview(-22)}
              className="ar-control-chip"
              aria-label="Rotate left"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => rotatePreview(22)}
              className="ar-control-chip"
              aria-label="Rotate right"
            >
              ↻
            </button>
          </div>
        )}

        {ar.showPresetBar && loaded && presets.length > 0 && (
          <div className="absolute left-0 right-0 bottom-2 z-10 px-3 pointer-events-auto">
            <div className="glass rounded-2xl p-2 border border-bone/10 max-h-[28vh] overflow-y-auto overscroll-contain">
              <div className="text-[9px] uppercase tracking-[0.25em] text-bone/45 mb-1.5 px-1">
                Quick configurations
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => {
                  const active = p.dragon === dragon && p.metal === metal;
                  const swatchD = catalog.dragons.find(d => d.id === p.dragon)?.swatch;
                  const swatchM = catalog.metals.find(m => m.id === p.metal)?.swatch;
                  return (
                    <button
                      key={`${p.dragon}-${p.metal}`}
                      type="button"
                      onClick={() => selectPreset(p)}
                      className={`ar-preset-chip ${active ? 'ar-preset-chip-active' : ''}`}
                    >
                      <span className="flex gap-0.5 shrink-0">
                        {swatchD && (
                          <span className="w-2.5 h-2.5 rounded-full border border-bone/20" style={{ background: swatchD }} />
                        )}
                        {swatchM && (
                          <span className="w-2.5 h-2.5 rounded-full border border-bone/20" style={{ background: swatchM }} />
                        )}
                      </span>
                      <span className="truncate max-w-[7rem]">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-bone/10 px-4 py-3 space-y-2 bg-ink/95">
        {!ar.lockRealWorldScale && loaded && (
          <label className="flex items-center gap-3 text-[10px] text-bone/60">
            <span className="uppercase tracking-[0.2em] shrink-0">Preview size</span>
            <input
              type="range"
              min={0.85}
              max={1.25}
              step={0.01}
              value={previewScaleAdj}
              onChange={e => setPreviewScaleAdj(parseFloat(e.target.value))}
              className="flex-1 accent-jc-gold"
            />
          </label>
        )}
        <p className="text-center text-bone/50 text-[10px] tracking-[0.1em] leading-snug">
          {ar.lockRealWorldScale
            ? `Locked to ~${Math.round(ar.caseDiameterMm * ar.sizeMultiplier)} mm case width in AR.`
            : 'Pinch to resize in AR · drag to rotate in preview.'}
          {usesSharedArAsset && (
            <span className="block mt-1 text-bone/35">
              Per-combo AR exports can be assigned in Admin → 3D Models → AR combos.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
