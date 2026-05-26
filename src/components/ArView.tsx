'use client';

import { useEffect, useState } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // model-viewer is a custom element — typing all its attrs loosely
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          'ios-src'?: string;
          ar?: boolean;
          'ar-modes'?: string;
          'ar-scale'?: string;
          'camera-controls'?: boolean;
          'auto-rotate'?: boolean;
          'shadow-intensity'?: string | number;
          'environment-image'?: string;
          'skybox-image'?: string;
          exposure?: string | number;
          poster?: string;
          alt?: string;
          loading?: 'auto' | 'lazy' | 'eager';
          reveal?: 'auto' | 'interaction' | 'manual';
        },
        HTMLElement
      >;
    }
  }
}

interface ArViewProps {
  src: string;
  /** Optional .usdz path for iOS Quick Look — falls back to Scene Viewer if absent. */
  iosSrc?: string;
  alt: string;
  onClose: () => void;
  /** Auto-trigger the AR session as soon as model-viewer is ready. */
  autoActivate?: boolean;
}

/**
 * Fullscreen overlay that hosts a Google Model Viewer with AR enabled.
 * On Android the AR button hands off to Scene Viewer; on iOS to Quick Look
 * (only when ios-src is provided). On desktop the user sees a 3D viewer they
 * can orbit — the QR modal handles the desktop → mobile handoff separately.
 */
export default function ArView({ src, iosSrc, alt, onClose, autoActivate }: ArViewProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    import('@google/model-viewer').then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || !autoActivate) return;
    // Give model-viewer a tick to attach, then try to enter AR.
    const t = setTimeout(() => {
      const el = document.querySelector('model-viewer') as any;
      if (el?.activateAR) {
        try { el.activateAR(); } catch { /* user must tap */ }
      }
    }, 800);
    return () => clearTimeout(t);
  }, [ready, autoActivate]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Augmented reality viewer"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-bone/10">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-jc-gold/70">Augmented Reality</div>
          <div className="font-display text-xl text-bone mt-1">Astronomia Dragon</div>
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

      <div className="flex-1 relative">
        {ready ? (
          <model-viewer
            src={src}
            ios-src={iosSrc}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="0.85"
            alt={alt}
            loading="eager"
            reveal="auto"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              ['--poster-color' as any]: 'transparent',
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-2 border-jc-gold/30 border-t-jc-gold rounded-full animate-spin" />
              <div className="mt-6 text-xs tracking-[0.3em] uppercase text-bone/60">Preparing AR…</div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-bone/10 text-center text-bone/60 text-xs tracking-[0.15em]">
        Tap the AR icon to place the Astronomia Dragon in your room.
      </div>
    </div>
  );
}
