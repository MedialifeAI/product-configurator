'use client';

import { isMobileArDevice } from '@/lib/ar';
import {
  estimateArLoadSeconds,
  formatAssetMegabytes,
  isLargeArAsset,
  probeAssetByteSize,
} from '@/lib/arAssetSize';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useEffect, useState } from 'react';

interface ArQrModalProps {
  /** The mobile URL to encode — usually current page with `?ar=1`. */
  url: string;
  /** GLB used for AR on the phone (for size / load-time hints). */
  arModelUrl?: string;
  /** Human-readable summary of the selected configuration, shown above the QR. */
  configLabel?: string;
  onClose: () => void;
}

/**
 * Desktop AR handoff: QR code + copy link. Scanning opens the configurator with
 * `?ar=1` so the phone jumps straight into Model Viewer AR.
 */
export default function ArQrModal({ url, arModelUrl, configLabel, onClose }: ArQrModalProps) {
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const [assetBytes, setAssetBytes] = useState<number | null>(null);

  useBodyScrollLock(true);
  useEscapeKey(onClose);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toString(url, {
        type: 'svg',
        margin: 1,
        width: 280,
        color: { dark: '#f1d9a4', light: '#0a0a0c' },
        errorCorrectionLevel: 'M',
      }).then(out => {
        if (!cancelled) setSvg(out);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!arModelUrl) return;
    let cancelled = false;
    probeAssetByteSize(arModelUrl).then(bytes => {
      if (!cancelled) setAssetBytes(bytes);
    });
    return () => {
      cancelled = true;
    };
  }, [arModelUrl]);

  const loadEtaSec = estimateArLoadSeconds(assetBytes);
  const assetSizeLabel = assetBytes ? formatAssetMegabytes(assetBytes) : null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const openOnPhone = () => {
    if (isMobileArDevice()) {
      window.location.assign(url);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/85 backdrop-blur-md flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Open in AR on your phone"
      onClick={onClose}
    >
      <div
        className="glass-gold-edge rounded-3xl p-8 md:p-10 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] tracking-[0.35em] uppercase text-jc-gold/80">Augmented Reality</div>
            <h3 className="font-display text-3xl text-bone mt-2 leading-tight">
              Try it <span className="gold-text">in your space.</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-bone/20 hover:border-bone/50 w-9 h-9 flex items-center justify-center text-bone/80 hover:text-bone transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-bone/70 text-sm leading-relaxed mb-4">
          Scan with your phone&apos;s camera to open this configuration in augmented reality on your phone.
        </p>
        <ol className="text-bone/55 text-xs leading-relaxed mb-6 space-y-2 list-decimal list-inside">
          <li>Pick dragon and case metal in the configurator before scanning.</li>
          <li>On your phone, tap <span className="text-bone/75">Place in your space</span> when the model finishes loading.</li>
          <li>Point at a flat floor or table and move slowly to anchor the watch.</li>
        </ol>

        <div className="bg-ink/60 border border-jc-gold/20 rounded-2xl p-5 flex items-center justify-center min-h-[280px]">
          {svg ? (
            <div
              className="w-[240px] h-[240px] [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svg }}
              role="img"
              aria-label="QR code to open AR on your phone"
            />
          ) : (
            <div className="text-bone/40 text-xs tracking-[0.3em] uppercase">Generating…</div>
          )}
        </div>

        {configLabel && (
          <div className="mt-5 text-center text-[11px] tracking-[0.25em] uppercase text-bone/50">
            {configLabel}
          </div>
        )}

        {(assetSizeLabel || loadEtaSec != null) && (
          <p className="mt-4 text-center text-[10px] text-bone/45 leading-relaxed">
            AR download · {assetSizeLabel ?? 'checking size…'}
            {loadEtaSec != null && ` · allow ~${loadEtaSec}s on Wi‑Fi`}
          </p>
        )}
        {isLargeArAsset(assetBytes) && (
          <p className="mt-2 text-center text-[10px] text-amber-200/65 leading-relaxed px-2">
            The AR file is still very large — compress{' '}
            <code className="text-bone/50">watch_full_default.glb</code> with{' '}
            <code className="text-bone/50">scripts/compress.sh</code> for a ~15 MB production build.
          </p>
        )}
        <p className="mt-3 text-center text-[10px] text-bone/40 leading-relaxed">
          Android · Scene Viewer · iPhone · Quick Look (with USDZ) · desktop browsers · WebXR preview
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
          <button
            type="button"
            onClick={copyUrl}
            className="flex-1 text-xs text-bone/70 hover:text-bone border border-bone/15 hover:border-bone/40 rounded-lg py-2 transition"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          {isMobileArDevice() && (
            <a
              href={url}
              className="flex-1 text-center text-xs text-jc-gold border border-jc-gold/40 hover:bg-jc-gold/10 rounded-lg py-2 transition"
              onClick={e => {
                e.preventDefault();
                openOnPhone();
              }}
            >
              Open AR now
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs text-jc-gold border border-jc-gold/40 hover:bg-jc-gold/10 rounded-lg py-2 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
