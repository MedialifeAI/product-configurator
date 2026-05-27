'use client';

import { ChangeEvent, useState } from 'react';
import { useSceneSettings, useSiteConfig, type PersistStatus } from '@/context/SceneSettings';
import type { ArSettings } from '@/lib/siteConfigTypes';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  SCENE_SETTINGS_API,
  adminHeaders,
  type ModelSlot,
} from '@/lib/sceneSettingsShared';

/**
 * Operator panel — scene tuning persisted to Netlify Database (site-wide).
 * GLB overrides upload to Netlify Blobs and are served from /api/scene-settings/model/:slot.
 */
export default function DebugSettings() {
  const { settings, set, reset, persistStatus, lastSavedAt } = useSceneSettings();
  const { config, patchConfig, saveConfig } = useSiteConfig();
  const ar = config.ar;
  const setAr = <K extends keyof ArSettings>(key: K, value: ArSettings[K]) =>
    patchConfig({ ar: { ...ar, [key]: value } });
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState<ModelSlot | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const saveToken = () => {
    if (adminToken.trim()) {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken.trim());
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
    setShowToken(false);
  };

  const uploadModel = async (slot: ModelSlot, file: File) => {
    setUploading(slot);
    try {
      const form = new FormData();
      form.set('slot', slot);
      form.set('file', file);
      const res = await fetch(`${SCENE_SETTINGS_API}/upload`, {
        method: 'POST',
        headers: adminHeaders(),
        body: form,
      });
      if (res.status === 401) {
        setShowToken(true);
        return;
      }
      if (!res.ok) throw new Error('upload failed');
      const { url } = await res.json();
      const key = slot === 'hero' ? 'heroModelUrl' : 'configModelUrl';
      set(key, url as string);
    } finally {
      setUploading(null);
    }
  };

  const onFile =
    (slot: ModelSlot) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const key = slot === 'hero' ? 'heroModelUrl' : 'configModelUrl';
      const previous = settings[key];
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      void uploadModel(slot, file);
      e.target.value = '';
    };

  const clear = (slot: ModelSlot) => async () => {
    const key = slot === 'hero' ? 'heroModelUrl' : 'configModelUrl';
    const previous = settings[key];
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    if (previous?.startsWith('/api/scene-settings/model/')) {
      await fetch(`${SCENE_SETTINGS_API}/upload?slot=${slot}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
    }
    set(key, null);
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
      <div className="flex justify-between items-center mb-2">
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

      <PersistBadge status={persistStatus} lastSavedAt={lastSavedAt} />

      {showToken && (
        <div className="mb-3 p-2 rounded-lg border border-jc-gold/30 bg-ink/40 space-y-2">
          <p className="text-[10px] text-bone/60 leading-relaxed">
            Set the admin token from Netlify env <code className="text-jc-gold/80">SCENE_SETTINGS_ADMIN_TOKEN</code> to save changes.
          </p>
          <input
            type="password"
            value={adminToken}
            onChange={e => setAdminToken(e.target.value)}
            placeholder="Admin token"
            className="w-full rounded-md bg-ink/60 border border-bone/15 px-2 py-1.5 text-bone text-[11px]"
          />
          <button
            type="button"
            onClick={saveToken}
            className="w-full rounded-md border border-jc-gold/40 text-jc-gold py-1.5 hover:bg-jc-gold/10"
          >
            Save token
          </button>
        </div>
      )}

      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
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
                   uploading={uploading === 'hero'}
                   onFile={onFile('hero')}
                   onClear={() => void clear('hero')()} />
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
          <Slider
            label="Watch yaw (°)"
            value={Math.round((settings.configYaw * 180) / Math.PI)}
            min={0}
            max={360}
            step={1}
            onChange={v => set('configYaw', (v * Math.PI) / 180)}
            hint="0° = model default · 180° = dial toward camera"
          />

          <FileRow label="Replace configurator model"
                   filledUrl={settings.configModelUrl}
                   uploading={uploading === 'config'}
                   onFile={onFile('config')}
                   onClear={() => void clear('config')()}
                   hint="Stored in Netlify Blobs; shared across visits" />
        </Section>

        <Section title="AR (Model Viewer)">
          <Slider label="Case diameter (mm)" value={ar.caseDiameterMm} min={40} max={55} step={1}
                  onChange={v => setAr('caseDiameterMm', v)} />
          <Slider label="AR size multiplier" value={ar.sizeMultiplier} min={0.9} max={1.5} step={0.02}
                  onChange={v => setAr('sizeMultiplier', v)}
                  hint="1.22 ≈ 20% larger than true scale" />
          <Slider label="Preview scale" value={ar.previewScale} min={0.8} max={1.3} step={0.02}
                  onChange={v => setAr('previewScale', v)} />
          <label className="flex items-center gap-2 text-bone/70 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={ar.lockRealWorldScale}
              onChange={e => setAr('lockRealWorldScale', e.target.checked)}
              className="accent-[#b4904e]"
            />
            Lock real-world scale in AR
          </label>
          <button
            type="button"
            onClick={() => void saveConfig()}
            className="w-full rounded-lg border border-jc-gold/30 text-jc-gold/90 py-2 text-[11px] uppercase tracking-[0.2em] hover:bg-jc-gold/10"
          >
            Save AR settings to Netlify
          </button>
        </Section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex-1 glass-gold-edge rounded-lg py-2 text-jc-gold hover:bg-jc-gold/10 transition"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            className="px-3 rounded-lg border border-bone/15 text-bone/50 hover:text-bone hover:border-bone/30"
            title="Admin token for saving"
          >
            🔑
          </button>
        </div>
      </div>
    </div>
  );
}

function PersistBadge({
  status,
  lastSavedAt,
}: {
  status: PersistStatus;
  lastSavedAt: string | null;
}) {
  const label: Record<PersistStatus, string> = {
    idle: '—',
    loading: 'Loading saved settings…',
    ready: 'Synced with Netlify',
    saving: 'Saving…',
    saved: lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : 'Saved',
    error: 'Save failed — check admin token',
    offline: 'Local only (run netlify dev or deploy)',
  };
  const tone =
    status === 'error'
      ? 'text-red-300/80'
      : status === 'offline'
        ? 'text-bone/40'
        : 'text-jc-gold/70';

  return (
    <div className={`text-[10px] tracking-[0.15em] uppercase mb-3 ${tone}`}>
      {label[status]}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
  label, filledUrl, uploading, onFile, onClear, hint,
}: {
  label: string;
  filledUrl: string | null;
  uploading?: boolean;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hint?: string;
}) {
  const isStored = filledUrl?.startsWith('/api/scene-settings/model/');
  return (
    <div>
      <div className="text-bone/70 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <label className="flex-1 cursor-pointer rounded-md border border-bone/15 hover:border-bone/40 px-2 py-1.5 text-bone/70 text-[11px] transition">
          {uploading ? 'Uploading…' : filledUrl ? 'Replace…' : 'Choose .glb…'}
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={onFile}
            className="hidden"
            disabled={uploading}
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
      {isStored && (
        <div className="text-[10px] text-jc-gold/50 mt-1">Stored on Netlify</div>
      )}
      {hint && <div className="text-[10px] text-bone/40 mt-1">{hint}</div>}
    </div>
  );
}
