'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { resolveBackgroundStyle } from '@/lib/resolveBackgroundUrl';
import type { ConfiguratorBackgroundOption } from '@/context/SceneSettings';

const STORAGE_KEY = 'configurator-background-id';

interface ConfiguratorBackgroundPickerProps {
  backgrounds: ConfiguratorBackgroundOption[];
  defaultId: string;
  fallbackColor: string;
  onBackgroundChange?: (id: string) => void;
}

export default function ConfiguratorBackgroundPicker({
  backgrounds,
  defaultId,
  fallbackColor,
  onBackgroundChange,
}: ConfiguratorBackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultId);

  useBodyScrollLock(open);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && backgrounds.some(b => b.id === stored)) {
      setSelectedId(stored);
    } else {
      setSelectedId(defaultId);
    }
  }, [defaultId, backgrounds]);

  const active = useMemo(
    () => backgrounds.find(b => b.id === selectedId) ?? backgrounds[0],
    [backgrounds, selectedId],
  );

  const pick = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    onBackgroundChange?.(id);
    setOpen(false);
  };

  const previewStyle = resolveBackgroundStyle(active, fallbackColor);

  if (backgrounds.length === 0) return null;

  return (
    <>
      <div
        className="absolute inset-0 -z-10 transition-colors duration-300"
        style={previewStyle}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-3 right-3 z-10 pointer-events-auto rounded-full border border-bone/20 bg-ink/75 backdrop-blur-sm p-2.5 text-bone/70 hover:text-bone hover:border-bone/40 transition"
        title="Change canvas background"
        aria-label="Change canvas background"
      >
        <BackgroundIcon />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-30 flex items-end sm:items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Canvas backgrounds"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass rounded-2xl border border-bone/15 p-4 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-[0.2em] text-bone/70">Background</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-bone/40 hover:text-bone text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {backgrounds.map(bg => {
                const style = resolveBackgroundStyle(bg, fallbackColor);
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => pick(bg.id)}
                    className={`aspect-square rounded-xl border overflow-hidden transition ${
                      selectedId === bg.id
                        ? 'border-jc-gold/60 ring-1 ring-jc-gold/30'
                        : 'border-bone/15 hover:border-bone/35'
                    }`}
                    title={bg.label}
                  >
                    <span className="block w-full h-full" style={style} />
                    <span className="sr-only">{bg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BackgroundIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Resolve visitor background from localStorage + site defaults. */
export function useConfiguratorBackground(
  backgrounds: ConfiguratorBackgroundOption[],
  defaultId: string,
  fallbackColor: string,
) {
  const [id, setId] = useState(defaultId);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && backgrounds.some(b => b.id === stored)) setId(stored);
    else setId(defaultId);
  }, [defaultId, backgrounds]);

  const option = backgrounds.find(b => b.id === id) ?? backgrounds[0];
  const style = resolveBackgroundStyle(option, fallbackColor);
  return { id, setId, style };
}
