'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SceneSettings } from '@/context/SceneSettings';
import {
  adminHeaders,
  useSiteConfig,
  type PersistStatus,
} from '@/context/SiteConfigProvider';
import { arComboKey } from '@/lib/arSettings';
import AdminScenePreviews from '@/components/admin/AdminScenePreviews';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  builtinArComboPath,
  builtinPartIconPath,
  DEFAULT_SITE_CONFIG,
  type ArSettings,
  type MetalId,
  type ModelSource,
  type SiteConfig,
  type StoryPanelContent,
} from '@/lib/siteConfigTypes';

type Tab = 'overview' | 'features' | 'scene' | 'ar' | 'models' | 'content' | 'theme';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'scene', label: 'Scene' },
  { id: 'ar', label: 'AR' },
  { id: 'models', label: '3D Models' },
  { id: 'content', label: 'Content' },
  { id: 'theme', label: 'Theme' },
];

export default function AdminPortal() {
  const { config, setConfig, saveConfig, persistStatus, lastSavedAt } = useSiteConfig();
  const [tab, setTab] = useState<Tab>('overview');
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
      setAuthed(true);
    }
  }, []);

  const login = () => {
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.trim());
    setAuthed(true);
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAuthed(false);
    setToken('');
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-6">
        <div className="glass-gold-edge rounded-3xl p-10 max-w-md w-full">
          <h1 className="font-display text-3xl text-bone">Admin portal</h1>
          <p className="text-bone/60 text-sm mt-3 leading-relaxed">
            Enter the <code className="text-jc-gold/90">SCENE_SETTINGS_ADMIN_TOKEN</code> from Netlify environment variables.
          </p>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Admin token"
            className="mt-6 w-full rounded-lg bg-ink/60 border border-bone/15 px-4 py-3 text-bone text-sm"
          />
          <button
            type="button"
            onClick={login}
            className="mt-4 w-full rounded-full bg-jc-gold text-ink py-3 text-xs uppercase tracking-[0.25em] hover:bg-yellow-gold transition"
          >
            Sign in
          </button>
          <Link href="/" className="block text-center mt-6 text-xs text-bone/40 hover:text-bone">
            ← Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="sticky top-0 z-40 border-b border-bone/10 bg-ink/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl gold-text">Configurator Admin</h1>
            <StatusLine status={persistStatus} lastSavedAt={lastSavedAt} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void saveConfig()}
              className="text-xs uppercase tracking-[0.2em] border border-jc-gold/40 text-jc-gold px-4 py-2 rounded-full hover:bg-jc-gold/10"
            >
              Save now
            </button>
            <Link href="/" className="text-xs uppercase tracking-[0.2em] text-bone/60 hover:text-bone">
              View site
            </Link>
            <button type="button" onClick={logout} className="text-xs text-bone/40 hover:text-bone">
              Log out
            </button>
          </div>
        </div>
        <nav className="max-w-[1440px] mx-auto px-6 flex gap-1 overflow-x-auto pb-3">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs uppercase tracking-[0.15em] transition ${
                tab === t.id
                  ? 'bg-jc-gold/15 text-jc-gold border border-jc-gold/40'
                  : 'text-bone/50 hover:text-bone border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-10">
        <div className="flex flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
          <div className="min-w-0 w-full">
            {tab === 'overview' && <OverviewTab config={config} setTab={setTab} />}
            {tab === 'features' && <FeaturesTab config={config} setConfig={setConfig} />}
            {tab === 'scene' && <SceneTab config={config} setConfig={setConfig} />}
            {tab === 'ar' && <ArTab config={config} setConfig={setConfig} />}
            {tab === 'models' && <ModelsTab config={config} setConfig={setConfig} />}
            {tab === 'content' && <ContentTab config={config} setConfig={setConfig} />}
            {tab === 'theme' && <ThemeTab config={config} setConfig={setConfig} />}
          </div>
          <div className="w-full xl:sticky xl:top-36 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
            <AdminScenePreviews />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusLine({ status, lastSavedAt }: { status: PersistStatus; lastSavedAt: string | null }) {
  const labels: Record<PersistStatus, string> = {
    idle: '—',
    loading: 'Loading…',
    ready: 'Connected to Netlify Database',
    saving: 'Saving…',
    saved: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleString()}` : 'Saved',
    error: 'Save failed — check token',
    offline: 'Offline — run netlify dev',
  };
  return <p className="text-[11px] text-bone/50 mt-1">{labels[status]}</p>;
}

function OverviewTab({ config, setTab }: { config: SiteConfig; setTab: (t: Tab) => void }) {
  const yawDeg = Math.round((config.scene.configYaw * 180) / Math.PI);
  const checklist = [
    { ok: !config.features.showSceneControls, label: 'Scene-controls gear hidden on public site' },
    { ok: config.features.showArButton, label: 'View in AR enabled' },
    { ok: !config.ar.usePerComboArModels, label: 'Fast AR mode (single compressed GLB)' },
    { ok: yawDeg === 180 || yawDeg === 0, label: `Configurator yaw set (${yawDeg}° — dial toward camera)` },
  ];

  return (
    <div className="space-y-6">
      <Card title="Client demo">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-jc-gold border border-jc-gold/40 rounded-lg px-4 py-2.5 hover:bg-jc-gold/10 transition"
        >
          Open live site preview ↗
        </a>
        <ul className="mt-4 space-y-2 text-sm text-bone/70">
          {checklist.map(item => (
            <li key={item.label} className="flex items-start gap-2">
              <span className={item.ok ? 'text-jc-gold' : 'text-amber-300/90'} aria-hidden>
                {item.ok ? '✓' : '○'}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-bone/45 leading-relaxed">
          Before a client meeting: test AR on phone, confirm hero/config GLBs are compressed in Network tab,
          and copy a configuration link from the configurator.
        </p>
      </Card>
      <Card title="Quick actions">
        <div className="grid sm:grid-cols-2 gap-3">
          {TABS.filter(t => t.id !== 'overview').map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="text-left glass rounded-xl p-4 hover:border-jc-gold/30 border border-bone/10 transition"
            >
              <div className="text-sm text-bone">{t.label}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Current state">
        <ul className="text-sm text-bone/70 space-y-2">
          <li>
            Scene controls on site:{' '}
            <strong className="text-bone">{config.features.showSceneControls ? 'Visible' : 'Hidden'}</strong>
          </li>
          <li>
            AR button: <strong className="text-bone">{config.features.showArButton ? 'On' : 'Off'}</strong>
          </li>
          <li>Dragon variants: {config.catalog.dragons.length}</li>
          <li>Metal variants: {config.catalog.metals.length}</li>
          <li>Story panels: {config.content.storyPanels.length}</li>
          <li>Live hero & configurator previews are in the right column (desktop) or below the form (mobile).</li>
        </ul>
      </Card>
    </div>
  );
}

function FeaturesTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  return (
    <Card title="Site features">
      <Toggle
        label="Show floating scene-controls on the public homepage"
        checked={config.features.showSceneControls}
        onChange={v =>
          setConfig(p => ({ ...p, features: { ...p.features, showSceneControls: v } }))
        }
      />
      <Toggle
        label="Show View in AR button in the configurator"
        checked={config.features.showArButton}
        onChange={v =>
          setConfig(p => ({ ...p, features: { ...p.features, showArButton: v } }))
        }
      />
      <p className="text-[11px] text-bone/40 mt-3">
        Scene controls expose the legacy gear for rapid on-site tweaks. Most changes should be made here in admin.
      </p>
    </Card>
  );
}

function ArTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  const a = config.ar;
  const setAr = <K extends keyof ArSettings>(key: K, value: ArSettings[K]) =>
    setConfig(p => ({ ...p, ar: { ...p.ar, [key]: value } }));

  return (
    <div className="space-y-6">
      <Card title="Real-world size">
        <p className="text-[11px] text-bone/40 mb-3">
          Locks AR to luxury watch scale. Default is slightly larger than true 47 mm for visibility.
        </p>
        <Slider label="Case diameter (mm)" value={a.caseDiameterMm} min={40} max={55} step={1} onChange={v => setAr('caseDiameterMm', v)} />
        <Slider label="Size multiplier" value={a.sizeMultiplier} min={0.9} max={1.5} step={0.02} onChange={v => setAr('sizeMultiplier', v)} />
        <Slider label="Preview scale" value={a.previewScale} min={0.8} max={1.3} step={0.02} onChange={v => setAr('previewScale', v)} />
        <Toggle
          label="Lock real-world scale in AR (no pinch resize)"
          checked={a.lockRealWorldScale}
          onChange={v => setAr('lockRealWorldScale', v)}
        />
      </Card>
      <Card title="Camera & rendering">
        <Field label="Camera orbit" value={a.cameraOrbit} onChange={v => setAr('cameraOrbit', v)} />
        <Field label="Min camera orbit" value={a.minCameraOrbit} onChange={v => setAr('minCameraOrbit', v)} />
        <Field label="Max camera orbit" value={a.maxCameraOrbit} onChange={v => setAr('maxCameraOrbit', v)} />
        <Slider label="Exposure" value={a.exposure} min={0.3} max={1.5} step={0.02} onChange={v => setAr('exposure', v)} />
        <Slider label="Shadow intensity" value={a.shadowIntensity} min={0} max={1} step={0.05} onChange={v => setAr('shadowIntensity', v)} />
        <Toggle
          label="Auto-rotate in preview (off recommended for performance)"
          checked={a.autoRotateInPreview}
          onChange={v => setAr('autoRotateInPreview', v)}
        />
      </Card>
      <Card title="AR UX">
        <Toggle
          label="Use per-combo AR GLBs (slower — enable only after Draco compress to ~15–40 MB each)"
          checked={a.usePerComboArModels}
          onChange={v => setAr('usePerComboArModels', v)}
        />
        <Toggle
          label="Show dragon × metal quick-pick bar in AR"
          checked={a.showPresetBar}
          onChange={v => setAr('showPresetBar', v)}
        />
        <Slider label="Max presets (0 = all)" value={a.maxPresets} min={0} max={12} step={1} onChange={v => setAr('maxPresets', Math.round(v))} />
        <Field label="Tap-to-place hint" value={a.tapToPlaceHint} onChange={v => setAr('tapToPlaceHint', v)} multiline />
      </Card>
      <Card title="Per-combo AR models">
        <p className="text-[11px] text-bone/40 mb-3">
          Default: assembled GLB at <code className="text-bone/55">/models/ar/combos/&#123;dragon&#125;_&#123;metal&#125;.glb</code> (12 files).
          Upload or override a slot to replace the built-in path; missing files fall back to the default AR watch GLB.
        </p>
        {config.catalog.dragons.map(d =>
          config.catalog.metals.map(m => {
            const key = arComboKey(d.id, m.id);
            const comboDefault = builtinArComboPath(d.id, m.id);
            const source =
              config.catalog.arCombos?.[key] ?? ({ type: 'builtin' as const, path: comboDefault });
            return (
              <ModelSourceEditor
                key={key}
                label={key}
                source={source}
                uploadSlot={`ar/${key}`}
                builtinDefault={comboDefault}
                onChange={src =>
                  setConfig(p => ({
                    ...p,
                    catalog: {
                      ...p.catalog,
                      arCombos: { ...p.catalog.arCombos, [key]: src },
                    },
                  }))
                }
              />
            );
          }),
        )}
      </Card>
      <button
        type="button"
        onClick={() => setConfig(p => ({ ...p, ar: DEFAULT_SITE_CONFIG.ar }))}
        className="text-xs text-jc-gold border border-jc-gold/40 px-4 py-2 rounded-lg hover:bg-jc-gold/10"
      >
        Reset AR settings to defaults
      </button>
    </div>
  );
}

function SceneTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  const s = config.scene;
  const set = <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) =>
    setConfig(p => ({ ...p, scene: { ...p.scene, [key]: value } }));

  return (
    <div className="space-y-6">
      <Card title="Hero transform">
        <Slider label="Scale" value={s.heroScale} min={0.3} max={2.5} step={0.05} onChange={v => set('heroScale', v)} />
        <Slider label="Animation start" value={s.heroAnimOffset} min={0} max={1} step={0.01} onChange={v => set('heroAnimOffset', v)} />
        <Slider label="Y position" value={s.heroY} min={-1.5} max={1.5} step={0.05} onChange={v => set('heroY', v)} />
        <Slider label="Sway" value={s.heroSway} min={0} max={1} step={0.02} onChange={v => set('heroSway', v)} />
      </Card>
      <Card title="Hero lighting">
        <Slider label="Ambient" value={s.heroAmbient} min={0} max={1} step={0.01} onChange={v => set('heroAmbient', v)} />
        <Slider label="Key" value={s.heroKey} min={0} max={3} step={0.05} onChange={v => set('heroKey', v)} />
        <Slider label="Rim" value={s.heroRim} min={0} max={2} step={0.05} onChange={v => set('heroRim', v)} />
        <Slider label="Kicker" value={s.heroKicker} min={0} max={1.5} step={0.05} onChange={v => set('heroKicker', v)} />
        <Slider label="Environment" value={s.heroEnv} min={0} max={1.5} step={0.05} onChange={v => set('heroEnv', v)} />
        <Slider label="Exposure" value={s.heroExposure} min={0.2} max={1.6} step={0.02} onChange={v => set('heroExposure', v)} />
      </Card>
      <Card title="Configurator">
        <Slider label="Scale" value={s.configScale} min={0.3} max={2.5} step={0.05} onChange={v => set('configScale', v)} />
        <Slider label="Auto-rotate" value={s.configRotate} min={0} max={5} step={0.1} onChange={v => set('configRotate', v)} />
        <Slider
          label="Watch yaw (°)"
          value={Math.round((s.configYaw * 180) / Math.PI)}
          min={0}
          max={360}
          step={1}
          onChange={v => set('configYaw', (v * Math.PI) / 180)}
        />
        <p className="text-[10px] text-bone/45 -mt-2">
          Dial toward camera. Default 180° (π rad) for exported GLBs that load facing away.
        </p>
      </Card>
      <button
        type="button"
        onClick={() => setConfig(p => ({ ...p, scene: DEFAULT_SITE_CONFIG.scene }))}
        className="text-xs text-jc-gold border border-jc-gold/40 px-4 py-2 rounded-lg hover:bg-jc-gold/10"
      >
        Reset scene to defaults
      </button>
    </div>
  );
}

function ModelsTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  return (
    <div className="space-y-6">
      <Card title="Hero & AR">
        <ModelSourceEditor
          label="Scroll hero GLB"
          source={config.catalog.heroWatch}
          uploadSlot="hero/watch"
          builtinDefault="/models/full_watch/watch_full_default.glb"
          onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, heroWatch: src } }))}
        />
        <ModelSourceEditor
          label="AR handoff GLB"
          source={config.catalog.arWatch}
          uploadSlot="ar/watch"
          builtinDefault="/models/full_watch/watch_full_ar.glb"
          onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, arWatch: src } }))}
        />
      </Card>
      <Card title="Static parts">
        <p className="text-[11px] text-bone/40 mb-3">
          Dial includes the inner background plate. Strap export includes top and bottom armatures.
        </p>
        {(['dial', 'hand', 'strap'] as const).map(part => (
          <ModelSourceEditor
            key={part}
            label={part}
            source={config.catalog.staticParts[part] ?? { type: 'builtin', path: `/models/parts/${part}.glb` }}
            uploadSlot={`parts/${part}`}
            builtinDefault={`/models/parts/${part}.glb`}
            onChange={src =>
              setConfig(p => ({
                ...p,
                catalog: {
                  ...p.catalog,
                  staticParts: { ...p.catalog.staticParts, [part]: src },
                },
              }))
            }
          />
        ))}
      </Card>
      <Card title="Inspect part icons">
        <p className="text-[11px] text-bone/40 mb-3">
          Circular thumbnails on the configurator Inspect grid. Upload PNG/WebP/JPEG from Blender renders
          (square crop, ~256×256 recommended). Served from <code className="text-bone/50">/images/parts/</code> or admin blob storage.
        </p>
        {config.catalog.components.map(c => (
          <PartIconSourceEditor
            key={c.id}
            label={c.label}
            source={
              config.catalog.partIcons?.[c.id] ?? {
                type: 'builtin',
                path: builtinPartIconPath(c.id),
              }
            }
            uploadSlot={`icons/${c.id}`}
            builtinDefault={builtinPartIconPath(c.id)}
            onChange={src =>
              setConfig(p => ({
                ...p,
                catalog: {
                  ...p.catalog,
                  partIcons: { ...p.catalog.partIcons, [c.id]: src },
                },
              }))
            }
          />
        ))}
      </Card>
      <Card title="Globe (per case metal)">
        <p className="text-[11px] text-bone/40 mb-3">
          Terrestrial globe from the animated movement rig (not the dial background plate). Loaded with movement; metal picker swaps these files.
        </p>
        {config.catalog.metals.map(m => (
          <ModelSourceEditor
            key={m.id}
            label={`Globe · ${m.label}`}
            source={
              config.catalog.globeParts[m.id] ?? {
                type: 'builtin',
                path: `/models/parts/globe_${m.id}.glb`,
              }
            }
            uploadSlot={`parts/globe/${m.id}`}
            builtinDefault={`/models/parts/globe_${m.id}.glb`}
            onChange={src =>
              setConfig(p => ({
                ...p,
                catalog: {
                  ...p.catalog,
                  globeParts: { ...p.catalog.globeParts, [m.id]: src },
                },
              }))
            }
          />
        ))}
      </Card>
      <Card title="Dragon variants">
        {config.catalog.dragons.map((d, i) => (
          <ModelSourceEditor
            key={d.id}
            label={`${d.label} (${d.id})`}
            source={d.model ?? { type: 'builtin', path: d.builtinPath }}
            uploadSlot={`dragon/${d.id}`}
            builtinDefault={d.builtinPath}
            onChange={src =>
              setConfig(p => {
                const dragons = [...p.catalog.dragons];
                dragons[i] = { ...dragons[i], model: src };
                return { ...p, catalog: { ...p.catalog, dragons } };
              })
            }
          />
        ))}
      </Card>
      <Card title="Metal parts (per finish)">
        {config.catalog.metals.map(m => (
          <MetalPartsEditor
            key={m.id}
            metal={m.id}
            label={m.label}
            sources={config.catalog.metalParts[m.id]}
            onChange={sources =>
              setConfig(p => ({
                ...p,
                catalog: {
                  ...p.catalog,
                  metalParts: { ...p.catalog.metalParts, [m.id]: sources },
                },
              }))
            }
          />
        ))}
      </Card>
    </div>
  );
}

function MetalPartsEditor({
  metal,
  label,
  sources,
  onChange,
}: {
  metal: MetalId;
  label: string;
  sources: SiteConfig['catalog']['metalParts'][MetalId];
  onChange: (s: SiteConfig['catalog']['metalParts'][MetalId]) => void;
}) {
  const setPart = (part: 'caseBody' | 'case' | 'movement', src: ModelSource) =>
    onChange({ ...sources, [part]: src });

  const builtin = (part: 'caseBody' | 'case' | 'movement') => {
    const folder = part === 'caseBody' ? 'case_body' : part;
    const file = part === 'caseBody' ? `case_body_${metal}` : `${part}_${metal}`;
    return `/models/${folder}/${file}.glb`;
  };

  return (
    <div className="mb-6 pb-6 border-b border-bone/10 last:border-0">
      <div className="text-sm text-jc-gold/90 mb-3">{label}</div>
      {(['caseBody', 'case', 'movement'] as const).map(part => (
        <ModelSourceEditor
          key={part}
          label={part}
          source={sources?.[part] ?? { type: 'builtin', path: builtin(part) }}
          uploadSlot={`${part === 'caseBody' ? 'case_body' : part}/${metal}`}
          builtinDefault={builtin(part)}
          onChange={src => setPart(part, src)}
        />
      ))}
    </div>
  );
}

function PartIconSourceEditor({
  label,
  source,
  uploadSlot,
  builtinDefault,
  onChange,
}: {
  label: string;
  source: ModelSource;
  uploadSlot: string;
  builtinDefault: string;
  onChange: (s: ModelSource) => void;
}) {
  const preview =
    source.type === 'builtin'
      ? source.path
      : source.type === 'url'
        ? source.url
        : `/api/models/${source.key}`;

  return (
    <div className="mb-5 last:mb-0 pb-5 last:pb-0 border-b border-bone/10 last:border-0">
      <div className="flex items-center gap-4 mb-3">
        <div className="w-14 h-14 rounded-full overflow-hidden border border-jc-gold/30 bg-ink shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || builtinDefault} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="text-sm text-jc-gold/90">{label}</div>
      </div>
      <ModelSourceEditor
        label="Icon source"
        source={source}
        uploadSlot={uploadSlot}
        builtinDefault={builtinDefault}
        acceptImages
        onChange={onChange}
      />
    </div>
  );
}

function ModelSourceEditor({
  label,
  source,
  uploadSlot,
  builtinDefault,
  acceptImages,
  onChange,
}: {
  label: string;
  source: ModelSource;
  uploadSlot: string;
  builtinDefault?: string;
  acceptImages?: boolean;
  onChange: (s: ModelSource) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.set('slot', uploadSlot);
      form.set('file', file);
      const res = await fetch('/api/models/upload', {
        method: 'POST',
        headers: adminHeaders(),
        body: form,
      });
      if (!res.ok) throw new Error('upload failed');
      const json = (await res.json()) as { slot?: string };
      onChange({ type: 'blob', key: json.slot ?? uploadSlot });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs text-bone/60 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {(['builtin', 'url', 'blob'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => {
              if (type === 'builtin') onChange({ type: 'builtin', path: builtinDefault ?? '' });
              if (type === 'url') onChange({ type: 'url', url: '' });
              if (type === 'blob') onChange({ type: 'blob', key: uploadSlot });
            }}
            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border ${
              source.type === type
                ? 'border-jc-gold/50 text-jc-gold bg-jc-gold/10'
                : 'border-bone/15 text-bone/50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      {source.type === 'builtin' && (
        <input
          className="w-full rounded-lg bg-ink/50 border border-bone/10 px-3 py-2 text-xs text-bone"
          value={source.path}
          onChange={e => onChange({ type: 'builtin', path: e.target.value })}
          placeholder={acceptImages ? '/images/parts/dragon.webp' : '/models/...'}
        />
      )}
      {source.type === 'url' && (
        <input
          className="w-full rounded-lg bg-ink/50 border border-bone/10 px-3 py-2 text-xs text-bone"
          value={source.url}
          onChange={e => onChange({ type: 'url', url: e.target.value })}
          placeholder="https://cdn.example.com/model.glb"
        />
      )}
      {source.type === 'blob' && (
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-xs text-jc-gold border border-jc-gold/30 px-3 py-1.5 rounded-lg hover:bg-jc-gold/10">
            {uploading ? 'Uploading…' : acceptImages ? 'Upload image' : 'Upload .glb'}
            <input
              type="file"
              accept={acceptImages ? '.png,.jpg,.jpeg,.webp,.svg' : '.glb,.gltf'}
              className="hidden"
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </label>
          <span className="text-[10px] text-bone/40 truncate">/api/models/{source.key}</span>
        </div>
      )}
    </div>
  );
}

function ContentTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  const c = config.content;
  const patch = (partial: Partial<typeof c>) =>
    setConfig(p => ({ ...p, content: { ...p.content, ...partial } }));

  return (
    <div className="space-y-6">
      <Card title="SEO">
        <Field label="Title" value={c.meta.title} onChange={v => patch({ meta: { ...c.meta, title: v } })} />
        <Field label="Description" value={c.meta.description} onChange={v => patch({ meta: { ...c.meta, description: v } })} multiline />
      </Card>
      <Card title="Header">
        <Field label="Brand" value={c.header.brand} onChange={v => patch({ header: { ...c.header, brand: v } })} />
        <Field label="CTA label" value={c.header.ctaLabel} onChange={v => patch({ header: { ...c.header, ctaLabel: v } })} />
        <Field label="CTA href" value={c.header.ctaHref} onChange={v => patch({ header: { ...c.header, ctaHref: v } })} />
        <NavEditor
          links={c.header.nav}
          onChange={nav => patch({ header: { ...c.header, nav } })}
        />
      </Card>
      <Card title="Hero copy">
        <Field label="Eyebrow" value={c.hero.eyebrow} onChange={v => patch({ hero: { ...c.hero, eyebrow: v } })} />
        <Field label="Title line 1" value={c.hero.titleLine1} onChange={v => patch({ hero: { ...c.hero, titleLine1: v } })} />
        <Field label="Title line 2" value={c.hero.titleLine2} onChange={v => patch({ hero: { ...c.hero, titleLine2: v } })} />
        <Field label="Body" value={c.hero.body} onChange={v => patch({ hero: { ...c.hero, body: v } })} multiline />
        <Field label="Scroll hint" value={c.hero.scrollHint} onChange={v => patch({ hero: { ...c.hero, scrollHint: v } })} />
        <Field
          label="Explore configurator CTA"
          value={c.hero.exploreConfiguratorLabel}
          onChange={v => patch({ hero: { ...c.hero, exploreConfiguratorLabel: v } })}
        />
        <Field label="Loader title" value={c.hero.loadingTitle} onChange={v => patch({ hero: { ...c.hero, loadingTitle: v } })} />
        <Field label="Loader subtitle" value={c.hero.loadingSubtitle} onChange={v => patch({ hero: { ...c.hero, loadingSubtitle: v } })} />
      </Card>
      <Card title="Configurator copy">
        <Field label="Eyebrow" value={c.configurator.eyebrow} onChange={v => patch({ configurator: { ...c.configurator, eyebrow: v } })} />
        <Field label="Title" value={c.configurator.title} onChange={v => patch({ configurator: { ...c.configurator, title: v } })} />
        <Field label="Description" value={c.configurator.description} onChange={v => patch({ configurator: { ...c.configurator, description: v } })} multiline />
        <Field label="Edition line" value={c.configurator.editionLine} onChange={v => patch({ configurator: { ...c.configurator, editionLine: v } })} />
        <Field label="Share link label" value={c.configurator.shareLinkLabel} onChange={v => patch({ configurator: { ...c.configurator, shareLinkLabel: v } })} />
        <Field label="Reset view label" value={c.configurator.resetViewLabel} onChange={v => patch({ configurator: { ...c.configurator, resetViewLabel: v } })} />
        <Field label="AR button" value={c.configurator.arButtonLabel} onChange={v => patch({ configurator: { ...c.configurator, arButtonLabel: v } })} />
        <Field label="AR size hint" value={c.configurator.arSizeHint} onChange={v => patch({ configurator: { ...c.configurator, arSizeHint: v } })} multiline />
      </Card>
      <Card title="Story panels">
        {c.storyPanels.map((panel, i) => (
          <StoryEditor
            key={`${panel.eyebrow}-${i}`}
            panel={panel}
            onChange={next =>
              setConfig(p => {
                const storyPanels = [...p.content.storyPanels];
                storyPanels[i] = next;
                return { ...p, content: { ...p.content, storyPanels } };
              })
            }
          />
        ))}
      </Card>
      <Card title="Specifications">
        <Field label="Eyebrow" value={c.specs.eyebrow} onChange={v => patch({ specs: { ...c.specs, eyebrow: v } })} />
        <Field label="Title" value={c.specs.title} onChange={v => patch({ specs: { ...c.specs, title: v } })} />
        {c.specs.rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <Field
              label={`Row ${i + 1} label`}
              value={row.label}
              onChange={v =>
                setConfig(p => {
                  const rows = [...p.content.specs.rows];
                  rows[i] = { ...rows[i], label: v };
                  return { ...p, content: { ...p.content, specs: { ...p.content.specs, rows } } };
                })
              }
            />
            <Field
              label={`Row ${i + 1} value`}
              value={row.value}
              onChange={v =>
                setConfig(p => {
                  const rows = [...p.content.specs.rows];
                  rows[i] = { ...rows[i], value: v };
                  return { ...p, content: { ...p.content, specs: { ...p.content.specs, rows } } };
                })
              }
            />
          </div>
        ))}
      </Card>
      <Card title="CTA & footer">
        <Field label="Eyebrow" value={c.cta.eyebrow} onChange={v => patch({ cta: { ...c.cta, eyebrow: v } })} />
        <Field label="Title" value={c.cta.title} onChange={v => patch({ cta: { ...c.cta, title: v } })} />
        <Field label="Body" value={c.cta.body} onChange={v => patch({ cta: { ...c.cta, body: v } })} multiline />
        <Field label="Primary label" value={c.cta.primaryLabel} onChange={v => patch({ cta: { ...c.cta, primaryLabel: v } })} />
        <Field label="Primary href" value={c.cta.primaryHref} onChange={v => patch({ cta: { ...c.cta, primaryHref: v } })} />
        <Field label="Secondary label" value={c.cta.secondaryLabel} onChange={v => patch({ cta: { ...c.cta, secondaryLabel: v } })} />
        <Field label="Secondary href" value={c.cta.secondaryHref} onChange={v => patch({ cta: { ...c.cta, secondaryHref: v } })} />
        <Field label="Footer line" value={c.footer} onChange={v => patch({ footer: v })} />
      </Card>
    </div>
  );
}

function NavEditor({
  links,
  onChange,
}: {
  links: { label: string; href: string }[];
  onChange: (links: { label: string; href: string }[]) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-bone/50">Navigation links</div>
      {links.map((link, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <Field label="Label" value={link.label} onChange={v => {
            const next = [...links];
            next[i] = { ...next[i], label: v };
            onChange(next);
          }} />
          <Field label="Href" value={link.href} onChange={v => {
            const next = [...links];
            next[i] = { ...next[i], href: v };
            onChange(next);
          }} />
        </div>
      ))}
    </div>
  );
}

function StoryEditor({
  panel,
  onChange,
}: {
  panel: StoryPanelContent;
  onChange: (p: StoryPanelContent) => void;
}) {
  return (
    <div className="mb-6 pb-6 border-b border-bone/10 last:border-0">
      <div className="text-xs text-jc-gold/80 mb-2 uppercase tracking-wider">{panel.eyebrow}</div>
      <Field label="Eyebrow" value={panel.eyebrow} onChange={v => onChange({ ...panel, eyebrow: v })} />
      <Field label="Title" value={panel.title} onChange={v => onChange({ ...panel, title: v })} />
      <Field label="Body" value={panel.body} onChange={v => onChange({ ...panel, body: v })} multiline />
      <Field label="Metric value" value={panel.metric.value} onChange={v => onChange({ ...panel, metric: { ...panel.metric, value: v } })} />
      <Field label="Metric label" value={panel.metric.label} onChange={v => onChange({ ...panel, metric: { ...panel.metric, label: v } })} />
    </div>
  );
}

function ThemeTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  const t = config.theme;
  const set = (key: keyof typeof t, value: string) =>
    setConfig(p => ({ ...p, theme: { ...p.theme, [key]: value } }));

  return (
    <Card title="Brand colors">
      <p className="text-[11px] text-bone/40 mb-4">Applied as CSS variables on the public site.</p>
      {(['ink', 'carbon', 'bone', 'jcGold', 'roseGold', 'whiteGold', 'yellowGold'] as const).map(key => (
        <div key={key} className="flex items-center gap-3 mb-3">
          <input
            type="color"
            value={t[key]}
            onChange={e => set(key, e.target.value)}
            className="w-10 h-10 rounded border-0 cursor-pointer"
          />
          <Field label={key} value={t[key]} onChange={v => set(key, v)} />
        </div>
      ))}
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer mb-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-jc-gold w-4 h-4"
      />
      <span className="text-sm text-bone/80">{label}</span>
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-6 border border-bone/10">
      <h2 className="font-display text-xl text-bone mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls = 'w-full rounded-lg bg-ink/50 border border-bone/10 px-3 py-2 text-sm text-bone';
  return (
    <div className="mb-3">
      <label className="text-[10px] uppercase tracking-wider text-bone/50 block mb-1">{label}</label>
      {multiline ? (
        <textarea className={`${cls} min-h-[80px]`} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-bone/60 mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-jc-gold"
      />
    </div>
  );
}
