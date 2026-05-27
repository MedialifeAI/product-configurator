'use client';

interface WebGlContextBannerProps {
  visible: boolean;
  onReload: () => void;
}

/** Shown when iOS Safari drops the WebGL context under memory pressure. */
export function WebGlContextBanner({ visible, onReload }: WebGlContextBannerProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/85 backdrop-blur-sm p-6">
      <div className="text-center max-w-xs">
        <p className="text-sm text-bone/90 mb-4">
          3D preview paused to save memory. Tap to reload the watch view.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="rounded-full border border-jc-gold/50 bg-jc-gold/10 px-5 py-2 text-xs uppercase tracking-[0.2em] text-bone hover:bg-jc-gold/20 transition"
        >
          Reload 3D
        </button>
      </div>
    </div>
  );
}
