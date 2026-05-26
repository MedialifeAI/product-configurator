'use client';

import { AR_MODEL_USDZ } from '@/lib/ar';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useCallback, useEffect, useRef, useState } from 'react';

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
        },
        HTMLElement
      >;
    }
  }
}

type ModelViewerElement = HTMLElement & {
  activateAR?: () => void;
};

interface ArViewProps {
  src: string;
  /** Optional .usdz for iOS Quick Look — checked at runtime if the file exists. */
  iosSrc?: string;
  alt: string;
  configLabel?: string;
  /** Shown when the QR/config selection differs from the single hero GLB used in AR. */
  variantNote?: string;
  onClose: () => void;
  /** Auto-trigger the AR session once the model has loaded (mobile browsers may still require a tap). */
  autoActivate?: boolean;
}

/**
 * Fullscreen Google Model Viewer with AR enabled.
 * Android → Scene Viewer; iOS → Quick Look when ios-src is available; supported browsers → WebXR.
 */
export default function ArView({
  src,
  iosSrc = AR_MODEL_USDZ,
  alt,
  configLabel,
  variantNote,
  onClose,
  autoActivate,
}: ArViewProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [iosUsdz, setIosUsdz] = useState<string | undefined>(undefined);

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

  // Only pass ios-src when the asset exists (avoids 404 noise in Quick Look).
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

  const tryActivateAr = useCallback(() => {
    const el = viewerRef.current;
    if (!el?.activateAR) return;
    try {
      el.activateAR();
    } catch {
      /* Gesture or platform policy — user taps the AR control */
    }
  }, []);

  useEffect(() => {
    if (!ready || !autoActivate || !loaded) return;
    const t = setTimeout(tryActivateAr, 400);
    return () => clearTimeout(t);
  }, [ready, autoActivate, loaded, tryActivateAr]);

  const onModelLoad = () => {
    setLoaded(true);
    setError(false);
  };

  const onModelError = () => {
    setError(true);
    setLoaded(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Augmented reality viewer"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-bone/10 shrink-0">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-jc-gold/70">Augmented Reality</div>
          <div className="font-display text-xl text-bone mt-1">Astronomia Dragon</div>
          {configLabel && (
            <div className="text-[11px] tracking-[0.2em] uppercase text-bone/50 mt-1">{configLabel}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-bone/20 hover:border-bone/50 w-10 h-10 flex items-center justify-center text-bone/80 hover:text-bone transition"
          aria-label="Close AR viewer"
        >
          ✕
        </button>
      </div>

      {variantNote && (
        <p className="px-6 py-2 text-center text-[11px] text-bone/55 border-b border-bone/10 shrink-0">
          {variantNote}
        </p>
      )}

      <div className="flex-1 relative min-h-0">
        {ready && !error ? (
          <model-viewer
            key={loadKey}
            ref={setViewerRef}
            src={src}
            {...(iosUsdz ? { 'ios-src': iosUsdz } : {})}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-placement="floor"
            ar-scale="auto"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="0.85"
            alt={alt}
            loading="eager"
            reveal="auto"
            onLoad={onModelLoad}
            onError={onModelError}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              ['--poster-color' as string]: 'transparent',
            }}
          />
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
              <div className="inline-block w-12 h-12 border-2 border-jc-gold/30 border-t-jc-gold rounded-full animate-spin" />
              <div className="mt-6 text-xs tracking-[0.3em] uppercase text-bone/60">Preparing AR…</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-bone/10 text-center text-bone/60 text-xs tracking-[0.15em] shrink-0 space-y-2">
        <p>Tap the AR icon to place the watch on a flat surface in your space.</p>
        {!iosUsdz && (
          <p className="text-bone/40 text-[10px]">
            iOS Quick Look requires a USDZ export alongside the GLB (see README).
          </p>
        )}
      </div>
    </div>
  );
}
