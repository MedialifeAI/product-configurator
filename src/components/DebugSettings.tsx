'use client';

import { ChangeEvent, useState } from 'react';
import { useSceneSettings } from '@/context/SceneSettings';

/**
 * Floating bottom-right control surface. Lets the operator tune the 3D scene
 * in-place: scale, animation baseline, sway, and even swap in a different GLB
 * via file upload. Persistence is in-memory only — refreshing the page resets
 * to defaults, which is the intent.
 */
export default function DebugSettings() {
  const { settings, set, reset } = useSceneSettings();
  const [open, setOpen] = useState(true);

  const onFile =
    (which: 'heroModelUrl' | 'configModelUrl') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Revoke the previous blob URL so we don't leak memory across uploads.
      const previous = settings[which];
      if (previous && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
      set(which, URL.createObjectURL(file));
      e.target.value = '';
    };

  const clear = (which: 'heroModelUrl' | 'configModelUrl') => () => {
    const previous = settings[which];
    if (previous && previous.startsWith('blob:')) URL.revokeObjectURL(previous);
    set(which, null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] glass-gold-edge rounded-full h-12 w-12 flex items-center justify-center text-jc-gold text-lg shadow-xl"
        aria-label="Open scene controls"
        title="Open scene controls"
      >
        ⚙
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[340px] glass rounded-2xl p-4 text-bone text-xs shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <span className="font-display text-sm text-jc-gold tracking-wider">Scene controls</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-bone/60 hover:text-bone"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Section title="Hero">
          <Slider label="Scale" value={settings.heroScale} min={0.3} max={2.5} step={0.05}
                  onChange={v => set('heroScale', v)} />
          <Slider label="Animation start" value={settings.heroAnimOffset} min={0} max={1} step={0.01}
                  onChange={v => set('heroAnimOffset', v)}
                  hint="0 = assembled at top of page, 1 = fully exploded" />
          <Slider label="Y position" value={settings.heroY} min={-1.5} max={1.5} step={0.05}
                  onChange={v => set('heroY', v)} />
          <Slider label="Sway amplitude" value={settings.heroSway} min={0} max={1} step={0.02}
                  onChange={v => set('heroSway', v)}
                  hint="Radians of left/right showcase swing" />

          <FileRow label="Replace hero model"
                   filledUrl={settings.heroModelUrl}
                   onFile={onFile('heroModelUrl')}
                   onClear={clear('heroModelUrl')} />
        </Section>

        <Section title="Hero · Lighting">
          <Slider label="Ambient" value={settings.heroAmbient} min={0} max={1} step={0.01}
                  onChange={v => set('heroAmbient', v)} />
          <Slider label="Key (warm white)" value={settings.heroKey} min={0} max={3} step={0.05}
                  onChange={v => set('heroKey', v)} />
          <Slider label="Rim (gold)" value={settings.heroRim} min={0} max={2} step={0.05}
                  onChange={v => set('heroRim', v)} />
          <Slider label="Kicker (cool)" value={settings.heroKicker} min={0} max={1.5} step={0.05}
                  onChange={v => set('heroKicker', v)} />
          <Slider label="Environment (HDR)" value={settings.heroEnv} min={0} max={1.5} step={0.05}
                  onChange={v => set('heroEnv', v)}
                  hint="Studio HDR intensity driving PBR reflections" />
          <Slider label="Exposure" value={settings.heroExposure} min={0.2} max={1.6} step={0.02}
                  onChange={v => set('heroExposure', v)}
                  hint="toneMappingExposure on the WebGL renderer" />
        </Section>

        <Section title="Configurator">
          <Slider label="Scale" value={settings.configScale} min={0.3} max={2.5} step={0.05}
                  onChange={v => set('configScale', v)} />
          <Slider label="Auto-rotate speed" value={settings.configRotate} min={0} max={5} step={0.1}
                  onChange={v => set('configRotate', v)} />

          <FileRow label="Replace configurator model"
                   filledUrl={settings.configModelUrl}
                   onFile={onFile('configModelUrl')}
                   onClear={clear('configModelUrl')}
                   hint="Replaces the assembled watch with a single GLB (variant pickers will not affect it)" />
        </Section>

        <button
          type="button"
          onClick={reset}
          className="w-full glass-gold-edge rounded-lg py-2 text-jc-gold hover:bg-jc-gold/10 transition"
        >
          Reset all
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] tracking-[0.3em] uppercase text-jc-gold/70 border-b border-bone/10 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-bone/70 mb-1">
        <span>{label}</span>
        <span className="text-bone tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#b4904e]"
      />
      {hint && <div className="text-[10px] text-bone/40 mt-0.5">{hint}</div>}
    </div>
  );
}

function FileRow({
  label, filledUrl, onFile, onClear, hint,
}: {
  label: string;
  filledUrl: string | null;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-bone/70 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-md border border-bone/15 hover:border-bone/40 px-2 py-1.5 text-bone/70 text-[11px] transition">
          {filledUrl ? 'Replace…' : 'Choose .glb…'}
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={onFile}
            className="hidden"
          />
        </label>
        {filledUrl && (
          <button
            type="button"
            onClick={onClear}
            className="text-jc-gold/80 hover:text-jc-gold text-[11px] underline underline-offset-2"
          >
            reset
          </button>
        )}
      </div>
      {hint && <div className="text-[10px] text-bone/40 mt-1">{hint}</div>}
    </div>
  );
}
