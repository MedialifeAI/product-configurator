'use client';

import { useEffect, useState } from 'react';

interface ArQrModalProps {
  /** The mobile URL to encode — usually current page with `?ar=1`. */
  url: string;
  /** Human-readable summary of the selected configuration, shown above the QR. */
  configLabel?: string;
  onClose: () => void;
}

/**
 * Desktop fallback for AR: shows a styled QR code that the user scans with a
 * phone camera. The handoff URL re-opens the configurator with `?ar=1` so the
 * mobile session jumps straight into the AR view.
 */
export default function ArQrModal({ url, configLabel, onClose }: ArQrModalProps) {
  const [svg, setSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toString(url, {
        type: 'svg',
        margin: 1,
        color: { dark: '#f1d9a4', light: '#0a0a0c' },
        errorCorrectionLevel: 'M',
      }).then(out => { if (!cancelled) setSvg(out); });
    });
    return () => { cancelled = true; };
  }, [url]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
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

        <p className="text-bone/70 text-sm leading-relaxed mb-6">
          Scan with your phone&apos;s camera to open the Astronomia Dragon in augmented reality.
          Hold steady, find a flat surface, and place it wherever you&apos;d like to wear it.
        </p>

        <div className="bg-ink/60 border border-jc-gold/20 rounded-2xl p-5 flex items-center justify-center min-h-[280px]">
          {svg ? (
            <div
              className="w-[240px] h-[240px] [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: svg }}
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

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={copyUrl}
            className="flex-1 text-xs text-bone/70 hover:text-bone border border-bone/15 hover:border-bone/40 rounded-lg py-2 transition"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
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
