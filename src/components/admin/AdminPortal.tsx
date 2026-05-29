'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { detectPlatform, resolveAssetVariant } from '@/lib/assetRouting';
import type { SceneSettings } from '@/context/SceneSettings';
import {
  adminHeaders,
  useSiteConfig,
  type PersistStatus,
} from '@/context/SiteConfigProvider';
import { arComboKey } from '@/lib/arSettings';
import AdminScenePreviews, { type PreviewMode } from '@/components/admin/AdminScenePreviews';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  builtinArComboPath,
  builtinPartIconPath,
  DEFAULT_SITE_CONFIG,
  type ArSettings,
  type AssetVariant,
  type MetalId,
  type ModelSource,
  type SiteConfig,
  type StoryPanelContent,
} from '@/lib/siteConfigTypes';
import type { ConfiguratorBackgroundOption, ModelQuality } from '@/context/SceneSettings';
import { DEFAULT_CONFIG_BACKGROUNDS } from '@/context/SceneSettings';

// ─────────────────────────────────────────────────────────────
// Tab configuration
// ─────────────────────────────────────────────────────────────

type Tab = 'overview' | 'features' | 'scene' | 'ar' | 'models' | 'content' | 'theme';

const TABS: { id: Tab; label: string; preview?: PreviewMode }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'features',  label: 'Features', preview: 'hero' },
  { id: 'scene',     label: 'Scene',    preview: 'both' },
  { id: 'ar',        label: 'AR',       preview: 'configurator' },
  { id: 'models',    label: '3D Models', preview: 'hero' },
  { id: 'content',   label: 'Content' },
  { id: 'theme',     label: 'Theme' },
];

// ─────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────

/**
 * AUTH NOTE: Authentication is disabled by default so local dev and demos work
 * without any token setup. To re-enable, set in Netlify / .env.local:
 *
 *   ADMIN_AUTH_ENABLED=true
 *   SCENE_SETTINGS_ADMIN_TOKEN=<your-secret>
 *
 * The login UI, token plumbing, and session storage are preserved below — just
 * set AUTH_GATE_ENABLED = true to re-activate the gate.
 */
const AUTH_GATE_ENABLED = false;

export default function AdminPortal() {
  const { config, setConfig, saveConfig, persistStatus, persistError, lastSavedAt } = useSiteConfig();
  const [tab, setTab] = useState<Tab>('overview');
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(!AUTH_GATE_ENABLED);  // open by default
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  useEffect(() => {
    if (!AUTH_GATE_ENABLED) return;  // skip session-restore when auth is off
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const res = await fetch('/api/admin/validate');
        if (cancelled) return;
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; authRequired?: boolean };
        if (res.ok && body.authRequired === false) { setAuthed(true); return; }
      } catch { /* fall through */ }
      const stored = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (!stored || cancelled) return;
      setToken(stored);
      try {
        const res = await fetch('/api/admin/validate', { headers: { Authorization: `Bearer ${stored}` } });
        if (cancelled) return;
        if (res.ok) setAuthed(true);
        else sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      } catch {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setLoginError('Could not verify session — sign in again.');
      }
    };
    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  const login = async () => {
    const trimmed = token.trim();
    setLoginError(null);
    setLoginPending(true);
    try {
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
      const res = await fetch('/api/admin/validate', { headers: adminHeaders() });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setLoginError(body.error ?? 'Invalid admin token');
        return;
      }
      setAuthed(true);
    } catch {
      setLoginError('Could not reach server');
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } finally {
      setLoginPending(false);
    }
  };

  const logout = () => {
    if (!AUTH_GATE_ENABLED) return;
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAuthed(false);
    setToken('');
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-6">
        <div className="glass-gold-edge rounded-2xl p-10 max-w-sm w-full space-y-5">
          <div>
            <h1 className="font-display text-2xl gold-text">Admin Portal</h1>
            <p className="text-bone/50 text-xs mt-2 leading-relaxed">
              Enter the <code className="text-jc-gold/80">SCENE_SETTINGS_ADMIN_TOKEN</code> from
              Netlify or <code className="text-jc-gold/80">.env.local</code>.
            </p>
          </div>
          {loginError && <p className="text-xs text-amber-200/90 leading-relaxed">{loginError}</p>}
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void login(); }}
            placeholder="Admin token"
            className="w-full rounded-lg bg-ink/60 border border-bone/15 px-4 py-3 text-bone text-sm focus:border-jc-gold/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void login()}
            disabled={loginPending}
            className="w-full rounded-full bg-jc-gold text-ink py-3 text-xs uppercase tracking-[0.2em] font-medium hover:bg-yellow-gold transition disabled:opacity-50"
          >
            {loginPending ? 'Verifying…' : 'Sign in'}
          </button>
          <Link href="/" className="block text-center text-xs text-bone/35 hover:text-bone/70 transition">
            ← Back to site
          </Link>
        </div>
      </div>
    );
  }

  const activeTab = TABS.find(t => t.id === tab)!;
  const previewMode = activeTab.preview;

  return (
    <div className="min-h-screen bg-ink text-bone">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 border-b border-bone/10 bg-ink/95 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="font-display text-xl gold-text leading-none">Configurator Admin</h1>
              <StatusLine status={persistStatus} lastSavedAt={lastSavedAt} error={persistError} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void saveConfig()}
              className="text-[11px] uppercase tracking-[0.18em] border border-jc-gold/40 text-jc-gold px-4 py-2 rounded-full hover:bg-jc-gold/10 transition"
            >
              Save
            </button>
            <Link
              href="/"
              target="_blank"
              className="text-[11px] uppercase tracking-[0.18em] text-bone/50 px-3 py-2 hover:text-bone transition"
            >
              View site ↗
            </Link>
            {AUTH_GATE_ENABLED && (
              <button type="button" onClick={logout} className="text-[11px] text-bone/30 hover:text-bone/60 transition px-2 py-2">
                Log out
              </button>
            )}
          </div>
        </div>

        {/* ── Tab strip ── */}
        <nav className="max-w-[1600px] mx-auto px-5 flex gap-0.5 pb-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
                tab === t.id
                  ? 'text-jc-gold'
                  : 'text-bone/40 hover:text-bone/70'
              }`}
            >
              {t.label}
              {t.preview && (
                <span
                  title="Live preview available"
                  className={`ml-1.5 inline-block w-1 h-1 rounded-full align-middle ${
                    tab === t.id ? 'bg-jc-gold' : 'bg-bone/20'
                  }`}
                />
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-jc-gold" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main layout ── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-5 py-6">
        {previewMode ? (
          /* Tabs with live preview: sidebar + preview column */
          <div className="flex flex-col xl:grid xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-5 items-start">
            <aside className="w-full xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto order-2 xl:order-1 space-y-4 pb-6">
              <TabContent tab={tab} config={config} setConfig={setConfig} setTab={setTab} />
            </aside>
            <div className="w-full min-w-0 order-1 xl:order-2 xl:sticky xl:top-[5.5rem]">
              <AdminScenePreviews mode={previewMode} />
            </div>
          </div>
        ) : (
          /* Tabs without preview: centred single column */
          <div className="max-w-2xl mx-auto space-y-4 pb-6">
            <TabContent tab={tab} config={config} setConfig={setConfig} setTab={setTab} />
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab router
// ─────────────────────────────────────────────────────────────

function TabContent({
  tab,
  config,
  setConfig,
  setTab,
}: {
  tab: Tab;
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
  setTab: (t: Tab) => void;
}) {
  if (tab === 'overview')  return <OverviewTab config={config} setTab={setTab} />;
  if (tab === 'features')  return <FeaturesTab config={config} setConfig={setConfig} />;
  if (tab === 'scene')     return <SceneTab config={config} setConfig={setConfig} />;
  if (tab === 'ar')        return <ArTab config={config} setConfig={setConfig} />;
  if (tab === 'models')    return <ModelsTab config={config} setConfig={setConfig} />;
  if (tab === 'content')   return <ContentTab config={config} setConfig={setConfig} />;
  if (tab === 'theme')     return <ThemeTab config={config} setConfig={setConfig} />;
  return null;
}

// ─────────────────────────────────────────────────────────────
// Status line
// ─────────────────────────────────────────────────────────────

function StatusLine({ status, lastSavedAt, error }: { status: PersistStatus; lastSavedAt: string | null; error?: string | null }) {
  const dot: Record<PersistStatus, string> = {
    idle: 'bg-bone/20',
    loading: 'bg-bone/40 animate-pulse',
    ready: 'bg-emerald-400/70',
    saving: 'bg-jc-gold animate-pulse',
    saved: 'bg-emerald-400/70',
    error: 'bg-amber-400',
    offline: 'bg-bone/30',
  };
  const label: Record<PersistStatus, string> = {
    idle: 'Idle',
    loading: 'Loading…',
    ready: 'Connected',
    saving: 'Saving…',
    saved: lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Saved',
    error: error ?? 'Save error',
    offline: 'Offline — run dev:netlify',
  };
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[status]}`} />
      <span className={`text-[10px] ${status === 'error' ? 'text-amber-300/90' : 'text-bone/40'}`}>
        {label[status]}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────

function OverviewTab({ config, setTab }: { config: SiteConfig; setTab: (t: Tab) => void }) {
  const yawDeg = Math.round((config.scene.configYaw * 180) / Math.PI);
  const checks = [
    { ok: !config.features.showSceneControls, label: 'Scene controls hidden' },
    { ok: config.features.showArButton,       label: 'View in AR enabled' },
    { ok: !config.ar.usePerComboArModels,      label: 'Fast AR mode (single GLB)' },
    { ok: yawDeg === 0,                        label: `Yaw ${yawDeg}° (0° = dial forward)` },
  ];

  return (
    <div className="space-y-4">
      <Card title="Status">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-2.5 border border-bone/8">
              <span className={c.ok ? 'text-emerald-400' : 'text-amber-300'} aria-hidden>
                {c.ok ? '✓' : '○'}
              </span>
              <span className="text-[11px] text-bone/70">{c.label}</span>
            </div>
          ))}
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-jc-gold border border-jc-gold/30 rounded-lg px-4 py-2 hover:bg-jc-gold/8 transition"
        >
          Open live site ↗
        </a>
      </Card>

      <Card title="Quick nav">
        <div className="grid grid-cols-3 gap-2">
          {TABS.filter(t => t.id !== 'overview').map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex flex-col items-start gap-1 rounded-xl p-3 border border-bone/8 bg-ink/30 hover:border-jc-gold/25 hover:bg-jc-gold/5 transition text-left"
            >
              {t.preview && <span className="w-1 h-1 rounded-full bg-jc-gold/50" />}
              <span className="text-[11px] text-bone/80">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-bone/30 leading-relaxed">
          Tabs with a gold dot have live 3D previews.
        </p>
      </Card>

      <Card title="Current state">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mb-4">
          <dt className="text-bone/45">Dragon variants</dt><dd className="text-bone">{config.catalog.dragons.length}</dd>
          <dt className="text-bone/45">Metal finishes</dt><dd className="text-bone">{config.catalog.metals.length}</dd>
          <dt className="text-bone/45">Story panels</dt><dd className="text-bone">{config.content.storyPanels.length}</dd>
          <dt className="text-bone/45">AR button</dt><dd className="text-bone">{config.features.showArButton ? 'Enabled' : 'Off'}</dd>
          <dt className="text-bone/45">Activated Print</dt><dd className="text-bone">{config.content.activatedPrint?.enabled ? 'Visible' : 'Hidden'}</dd>
          <dt className="text-bone/45">Performance HUD</dt><dd className="text-bone">{config.features.showPerformanceOverlay ? 'On' : 'Off'}</dd>
        </dl>
        {/* Per-platform asset variant summary */}
        <div className="border-t border-bone/8 pt-3">
          <p className="text-[9px] uppercase tracking-wider text-bone/30 mb-2">Asset variants</p>
          <div className="grid grid-cols-3 gap-2">
            {(['desktop', 'android', 'ios'] as const).map(p => {
              const v = config.featureFlags?.assetVariantByPlatform?.[p] ?? (p === 'ios' ? 'ios' : 'original');
              const risk = platformRisk(p, v);
              const opt = ASSET_VARIANT_OPTIONS.find(o => o.value === v);
              return (
                <div key={p} className="rounded-lg bg-ink/40 border border-bone/8 px-2.5 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-bone/35">{p}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[risk]}`} />
                  </div>
                  <span className="text-[10px] text-bone/80 leading-snug block">{opt?.label ?? v}</span>
                  {opt?.expectedMb != null && (
                    <span className="text-[9px] text-bone/30 font-mono">~{opt.expectedMb} MB</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Features tab
// ─────────────────────────────────────────────────────────────

function FeaturesTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  return (
    <div className="space-y-4">
      <Card title="Site toggles">
        <div className="space-y-4">
          <Toggle
            label="Show scene-controls gear on public site"
            description="Floating gear icon exposing legacy sliders. Usually off for client demos."
            checked={config.features.showSceneControls}
            onChange={v => setConfig(p => ({ ...p, features: { ...p.features, showSceneControls: v } }))}
          />
          <Toggle
            label="View in AR button"
            description="Shows the AR launch button in the configurator."
            checked={config.features.showArButton}
            onChange={v => setConfig(p => ({ ...p, features: { ...p.features, showArButton: v } }))}
          />
          <Toggle
            label="FPS / draw-call performance overlay"
            description="Shows frame rate and renderer stats on 3D canvases."
            checked={config.features.showPerformanceOverlay}
            onChange={v => setConfig(p => ({ ...p, features: { ...p.features, showPerformanceOverlay: v } }))}
          />
        </div>
      </Card>
      <AssetVariantCard config={config} setConfig={setConfig} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Asset variant card — extended with ios-mh / ios-xh tiers
// ─────────────────────────────────────────────────────────────

type VariantRisk = 'safe' | 'moderate' | 'risky';

interface VariantOption {
  value: AssetVariant;
  label: string;
  hint: string;
  badge?: string;
  /** Expected heap when this variant is the active hero on a real device. */
  expectedMb?: number;
  /** Risk when used on iOS specifically (desktop/android are always at most 'moderate'). */
  iosRisk: VariantRisk;
}

const RISK_DOT: Record<VariantRisk, string> = {
  safe:     'bg-emerald-400',
  moderate: 'bg-yellow-400',
  risky:    'bg-red-400',
};
const RISK_TEXT: Record<VariantRisk, string> = {
  safe:     'text-emerald-400',
  moderate: 'text-yellow-400',
  risky:    'text-red-400',
};
const RISK_LABEL: Record<VariantRisk, string> = {
  safe:     'Safe',
  moderate: 'Moderate',
  risky:    'Risky',
};

function platformRisk(platform: 'desktop' | 'android' | 'ios', v: AssetVariant): VariantRisk {
  const opt = ASSET_VARIANT_OPTIONS.find(o => o.value === v);
  if (!opt) return 'moderate';
  if (platform !== 'ios') return v === 'original' ? 'safe' : 'safe';
  return opt.iosRisk;
}

const ASSET_VARIANT_OPTIONS: VariantOption[] = [
  { value: 'original',  label: 'Original',       hint: '/models — full 37M tri',                    badge: 'Desktop', expectedMb: 541, iosRisk: 'risky'    },
  { value: 'optimized', label: 'Optimized',       hint: '/models-optimized — parts only, hero falls back',           expectedMb: 432, iosRisk: 'risky'    },
  { value: 'ios',       label: 'iOS Ultra-Low',   hint: '/models-ios — ~500K tri, all iPhones',      badge: 'Safe',    expectedMb: 231, iosRisk: 'safe'     },
  { value: 'ios-mh',   label: 'iOS Medium-High', hint: '/models-ios-mh — ~2.2M tri, iPhone 13+',                    expectedMb: 253, iosRisk: 'moderate' },
  { value: 'ios-xh',   label: 'iOS Extra-High',  hint: '/models-ios-xh — ~3.5M tri, iPhone 15 Pro+',               expectedMb: 279, iosRisk: 'risky'    },
];

function AssetVariantCard({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (fn: (p: SiteConfig) => SiteConfig) => void;
}) {
  const ff = config.featureFlags ?? {};
  const variants = ff.assetVariantByPlatform ?? {};

  const setVariant = (platform: 'desktop' | 'android' | 'ios', value: AssetVariant) =>
    setConfig(p => ({
      ...p,
      featureFlags: {
        ...p.featureFlags,
        assetVariantByPlatform: { ...(p.featureFlags?.assetVariantByPlatform ?? {}), [platform]: value },
      },
    }));

  const resolved = useMemo(
    () => ({ platform: detectPlatform(), variant: resolveAssetVariant(ff.assetVariantByPlatform) }),
    [ff.assetVariantByPlatform],
  );

  return (
    <Card title="3D asset quality per platform">
      <p className="text-[11px] text-bone/45 mb-4 leading-relaxed">
        iOS Safari crashes above ~500 MB per-tab GPU memory. The ultra-low tier
        (≈10% triangles) is crash-safe on all iPhones. Medium-high and extra-high
        are higher-fidelity alternatives for the hero watch on newer devices.
      </p>

      <div className="space-y-4">
        {(['desktop', 'android', 'ios'] as const).map(platform => {
          const active = variants[platform] ?? (platform === 'ios' ? 'ios' : 'original');
          const activeOpt = ASSET_VARIANT_OPTIONS.find(o => o.value === active);
          const risk = platformRisk(platform, active);

          return (
            <div key={platform}>
              {/* Platform header with active summary */}
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase tracking-wider text-bone/45">{platform}</label>
                <div className="flex items-center gap-1.5">
                  {activeOpt?.expectedMb != null && (
                    <span className="text-[9px] text-bone/30 font-mono">~{activeOpt.expectedMb} MB</span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[risk]}`} title={RISK_LABEL[risk]} />
                  <span className={`text-[9px] ${RISK_TEXT[risk]}`}>{RISK_LABEL[risk]}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1">
                {ASSET_VARIANT_OPTIONS.map(opt => {
                  const optRisk = platformRisk(platform, opt.value);
                  const isActive = active === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVariant(platform, opt.value)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-left transition ${
                        isActive
                          ? 'border-jc-gold/50 bg-jc-gold/8 text-bone'
                          : 'border-bone/8 bg-ink/20 text-bone/55 hover:border-bone/20 hover:text-bone/80'
                      }`}
                    >
                      {/* Radio dot */}
                      <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        isActive ? 'border-jc-gold bg-jc-gold' : 'border-bone/25'
                      }`} />

                      {/* Label + hint */}
                      <span className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium">{opt.label}</span>
                        {opt.badge && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider text-jc-gold/60 border border-jc-gold/25 rounded px-1 py-px">
                            {opt.badge}
                          </span>
                        )}
                        <span className="block text-[10px] text-bone/35 font-mono mt-0.5 truncate">{opt.hint}</span>
                      </span>

                      {/* Risk indicator + memory */}
                      <span className="shrink-0 flex flex-col items-end gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[optRisk]}`} title={RISK_LABEL[optRisk]} />
                        {opt.expectedMb != null && (
                          <span className="text-[8px] text-bone/25 font-mono">{opt.expectedMb}MB</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Warning banner for risky iOS selections */}
              {platform === 'ios' && risk === 'risky' && (
                <div className="mt-1.5 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 flex items-start gap-2">
                  <span className="text-red-400 text-[11px] shrink-0 mt-0.5">⚠</span>
                  <p className="text-[10px] text-red-300/80 leading-relaxed">
                    {active === 'original'
                      ? 'Full quality (~541 MB) will likely crash iOS Safari. Switch to iOS Ultra-Low for crash-safe delivery.'
                      : 'Extra-High (~279 MB) may crash on older iPhones. Requires iPhone 15 Pro or newer.'}
                  </p>
                </div>
              )}
              {platform === 'ios' && risk === 'moderate' && (
                <div className="mt-1.5 rounded-lg bg-yellow-500/8 border border-yellow-500/20 px-3 py-2 flex items-start gap-2">
                  <span className="text-yellow-400 text-[11px] shrink-0 mt-0.5">ℹ</span>
                  <p className="text-[10px] text-yellow-300/70 leading-relaxed">
                    Medium-High (~253 MB) works well on iPhone 13+. May be slow on older models.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: this-browser status + QA preview links */}
      <div className="mt-4 rounded-lg border border-bone/10 bg-ink/40 px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-bone/35 uppercase tracking-wider">This browser</span>
          <span className="text-bone font-medium">{resolved.platform}</span>
          <span className="text-bone/35">→</span>
          <span className="text-jc-gold/80 font-medium">{resolved.variant}</span>
          {(() => {
            const opt = ASSET_VARIANT_OPTIONS.find(o => o.value === resolved.variant);
            const r = platformRisk(resolved.platform as 'desktop' | 'android' | 'ios', resolved.variant);
            return opt ? (
              <span className={`text-[9px] ${RISK_TEXT[r]}`}>· {RISK_LABEL[r]}</span>
            ) : null;
          })()}
        </div>

        {/* QA platform preview links */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[9px] text-bone/25 uppercase tracking-wider self-center">Preview as</span>
          {(['ios', 'android', 'desktop'] as const).map(p => (
            <a
              key={p}
              href={`/?platform=${p}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-jc-gold/60 border border-jc-gold/20 rounded px-2 py-0.5 hover:bg-jc-gold/8 hover:text-jc-gold transition font-mono"
            >
              {p}
            </a>
          ))}
          <span className="text-[9px] text-bone/20 self-center">·</span>
          {(['ios', 'ios-mh', 'ios-xh'] as const).map(v => (
            <a
              key={v}
              href={`/?platform=ios&hero-variant=${v === 'ios' ? 'ios' : v.replace('ios-', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-bone/40 border border-bone/12 rounded px-2 py-0.5 hover:border-bone/25 hover:text-bone/60 transition font-mono"
            >
              {v}
            </a>
          ))}
        </div>

        <div className="text-[9px] text-bone/25 font-mono leading-relaxed">
          <span className="text-jc-gold/40">?platform=ios|android|desktop</span>
          {' · '}
          <span className="text-jc-gold/40">?hero-variant=ios|mh|xh</span>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Scene tab
// ─────────────────────────────────────────────────────────────

function SceneTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  const s = config.scene;
  const set = <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) =>
    setConfig(p => ({ ...p, scene: { ...p.scene, [key]: value } }));

  return (
    <div className="space-y-4">
      <Card title="Hero" subtitle="Transform & animation">
        <Slider label="Scale"           value={s.heroScale}      min={0.3}  max={2.5} step={0.05} onChange={v => set('heroScale', v)} />
        <Slider label="Y position"      value={s.heroY}          min={-1.5} max={1.5} step={0.05} onChange={v => set('heroY', v)} />
        <Slider label="Anim start"      value={s.heroAnimOffset} min={0}    max={1}   step={0.01} onChange={v => set('heroAnimOffset', v)} />
        <Slider label="Sway"            value={s.heroSway}       min={0}    max={1}   step={0.02} onChange={v => set('heroSway', v)} />
      </Card>

      <Card title="Hero" subtitle="Lighting">
        <Slider label="Ambient"     value={s.heroAmbient}   min={0}   max={1}   step={0.01} onChange={v => set('heroAmbient', v)} />
        <Slider label="Key"         value={s.heroKey}       min={0}   max={3}   step={0.05} onChange={v => set('heroKey', v)} />
        <Slider label="Rim"         value={s.heroRim}       min={0}   max={2}   step={0.05} onChange={v => set('heroRim', v)} />
        <Slider label="Kicker"      value={s.heroKicker}    min={0}   max={1.5} step={0.05} onChange={v => set('heroKicker', v)} />
        <Slider label="Environment" value={s.heroEnv}       min={0}   max={1.5} step={0.05} onChange={v => set('heroEnv', v)} />
        <Slider label="Exposure"    value={s.heroExposure}  min={0.2} max={1.6} step={0.02} onChange={v => set('heroExposure', v)} />
      </Card>

      <Card title="Configurator" subtitle="Transform & rotation">
        <Slider label="Scale"        value={s.configScale}  min={0.3} max={2.5} step={0.05} onChange={v => set('configScale', v)} />
        <Slider label="Auto-rotate"  value={s.configRotate} min={0}   max={5}   step={0.1}  onChange={v => set('configRotate', v)} />
        <Slider
          label="Yaw (°)"
          value={Math.round((s.configYaw * 180) / Math.PI)}
          min={0} max={360} step={1}
          onChange={v => set('configYaw', (v * Math.PI) / 180)}
        />
        <p className="text-[10px] text-bone/35 mt-1">0° = dial toward camera (recommended)</p>
      </Card>

      <Card title="Configurator" subtitle="Lighting">
        <Slider label="Ambient"     value={s.configAmbient}  min={0}   max={1}   step={0.01} onChange={v => set('configAmbient', v)} />
        <Slider label="Key"         value={s.configKey}      min={0}   max={3}   step={0.05} onChange={v => set('configKey', v)} />
        <Slider label="Rim"         value={s.configRim}      min={0}   max={2}   step={0.05} onChange={v => set('configRim', v)} />
        <Slider label="Kicker"      value={s.configKicker}   min={0}   max={1.5} step={0.05} onChange={v => set('configKicker', v)} />
        <Slider label="Environment" value={s.configEnv}      min={0}   max={1.5} step={0.05} onChange={v => set('configEnv', v)} />
        <Slider label="Exposure"    value={s.configExposure} min={0.2} max={1.6} step={0.02} onChange={v => set('configExposure', v)} />
      </Card>

      <Card title="Render quality">
        <div className="grid grid-cols-2 gap-3">
          <QualitySelect label="Hero" value={s.heroModelQuality ?? 'auto'} onChange={v => set('heroModelQuality', v)} />
          <QualitySelect label="Configurator" value={s.configModelQuality ?? 'auto'} onChange={v => set('configModelQuality', v)} />
        </div>
        <p className="text-[10px] text-bone/35 mt-2 leading-relaxed">
          Auto follows device tier. Low prefers compressed assets to reduce memory.
        </p>
      </Card>

      <Card title="Canvas background">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Fallback color" value={s.configCanvasColor ?? '#0a0a0c'} onChange={v => set('configCanvasColor', v)} />
          <Field label="Default bg id"  value={s.configDefaultBackgroundId ?? 'ink'} onChange={v => set('configDefaultBackgroundId', v)} />
        </div>
        {(s.configBackgrounds ?? DEFAULT_CONFIG_BACKGROUNDS).map((bg, i) => (
          <BackgroundOptionEditor
            key={bg.id}
            option={bg}
            onChange={next => {
              const list = [...(s.configBackgrounds ?? DEFAULT_CONFIG_BACKGROUNDS)];
              list[i] = next;
              set('configBackgrounds', list);
            }}
            onRemove={() => {
              const list = (s.configBackgrounds ?? DEFAULT_CONFIG_BACKGROUNDS).filter((_, j) => j !== i);
              set('configBackgrounds', list.length ? list : DEFAULT_CONFIG_BACKGROUNDS);
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const list = [...(s.configBackgrounds ?? DEFAULT_CONFIG_BACKGROUNDS)];
            list.push({ id: `bg_${list.length + 1}`, label: 'New color', type: 'color', color: '#0a0a0c' });
            set('configBackgrounds', list);
          }}
          className="mt-2 text-[10px] text-jc-gold border border-jc-gold/25 px-3 py-1.5 rounded-lg hover:bg-jc-gold/8 transition"
        >
          + Add background
        </button>
      </Card>

      <ResetButton label="Reset scene to defaults" onClick={() => setConfig(p => ({ ...p, scene: DEFAULT_SITE_CONFIG.scene }))} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AR tab
// ─────────────────────────────────────────────────────────────

function ArTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  const a = config.ar;
  const setAr = <K extends keyof ArSettings>(key: K, value: ArSettings[K]) =>
    setConfig(p => ({ ...p, ar: { ...p.ar, [key]: value } }));

  return (
    <div className="space-y-4">
      <Card title="External link override" subtitle="Bypass the model-viewer flow">
        <div className="space-y-4 mb-2">
          <Toggle
            label="Open a URL instead of launching AR"
            description="When on and a URL is set, the AR button opens that URL in a new tab."
            checked={a.externalLinkEnabled ?? false}
            onChange={v => setAr('externalLinkEnabled', v)}
          />
        </div>
        <Field label="URL (https://…)" value={a.externalLinkUrl ?? ''} onChange={v => setAr('externalLinkUrl', v)} />
        <Field label="Button label override (blank = use default copy)" value={a.externalLinkLabel ?? ''} onChange={v => setAr('externalLinkLabel', v)} />
      </Card>

      <Card title="Real-world scale">
        <p className="text-[11px] text-bone/40 mb-3 leading-relaxed">
          Default is slightly larger than true 47 mm for better visibility in AR.
        </p>
        <Slider label="Case diameter (mm)" value={a.caseDiameterMm}  min={40}  max={55}  step={1}    onChange={v => setAr('caseDiameterMm', v)} />
        <Slider label="Size multiplier"    value={a.sizeMultiplier}  min={0.9} max={1.5} step={0.02} onChange={v => setAr('sizeMultiplier', v)} />
        <Slider label="Preview scale"      value={a.previewScale}    min={0.8} max={1.3} step={0.02} onChange={v => setAr('previewScale', v)} />
        <Toggle label="Lock real-world scale (no pinch resize)" checked={a.lockRealWorldScale} onChange={v => setAr('lockRealWorldScale', v)} />
      </Card>

      <Card title="Camera & rendering">
        <Field label="Camera orbit"     value={a.cameraOrbit}    onChange={v => setAr('cameraOrbit', v)} />
        <Field label="Min orbit"        value={a.minCameraOrbit} onChange={v => setAr('minCameraOrbit', v)} />
        <Field label="Max orbit"        value={a.maxCameraOrbit} onChange={v => setAr('maxCameraOrbit', v)} />
        <Slider label="Exposure"        value={a.exposure}       min={0.3} max={1.5} step={0.02} onChange={v => setAr('exposure', v)} />
        <Slider label="Shadow"          value={a.shadowIntensity} min={0}  max={1}   step={0.05} onChange={v => setAr('shadowIntensity', v)} />
        <Toggle label="Auto-rotate in preview" description="Off recommended for performance." checked={a.autoRotateInPreview} onChange={v => setAr('autoRotateInPreview', v)} />
      </Card>

      <Card title="AR UX">
        <Toggle
          label="Per-combo AR GLBs"
          description="Enable only after Draco-compressing all 12 combo files (~15–40 MB each)."
          checked={a.usePerComboArModels}
          onChange={v => setAr('usePerComboArModels', v)}
        />
        <Toggle label="Dragon × metal quick-pick bar" checked={a.showPresetBar} onChange={v => setAr('showPresetBar', v)} />
        <Slider label="Max presets (0 = all)" value={a.maxPresets} min={0} max={12} step={1} onChange={v => setAr('maxPresets', Math.round(v))} />
        <Field label="Tap-to-place hint" value={a.tapToPlaceHint} onChange={v => setAr('tapToPlaceHint', v)} multiline />
      </Card>

      <Card title="Per-combo models">
        <p className="text-[11px] text-bone/40 mb-3 leading-relaxed">
          Default: <code className="text-bone/50">/models/ar/combos/&#123;dragon&#125;_&#123;metal&#125;.glb</code>
        </p>
        <div className="space-y-3">
          {config.catalog.dragons.map(d =>
            config.catalog.metals.map(m => {
              const key = arComboKey(d.id, m.id);
              const comboDefault = builtinArComboPath(d.id, m.id);
              const source = config.catalog.arCombos?.[key] ?? ({ type: 'builtin' as const, path: comboDefault });
              return (
                <ModelSourceEditor
                  key={key}
                  label={key}
                  source={source}
                  uploadSlot={`ar/${key}`}
                  builtinDefault={comboDefault}
                  onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, arCombos: { ...p.catalog.arCombos, [key]: src } } }))}
                />
              );
            }),
          )}
        </div>
      </Card>

      <ResetButton label="Reset AR to defaults" onClick={() => setConfig(p => ({ ...p, ar: DEFAULT_SITE_CONFIG.ar }))} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Models tab
// ─────────────────────────────────────────────────────────────

function ModelsTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  return (
    <div className="space-y-4">
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
        <p className="text-[11px] text-bone/40 mb-3">Dial includes inner background plate. Strap includes top and bottom armatures.</p>
        {(['dial', 'hand', 'strap'] as const).map(part => (
          <ModelSourceEditor
            key={part}
            label={part}
            source={config.catalog.staticParts[part] ?? { type: 'builtin', path: `/models/parts/${part}.glb` }}
            uploadSlot={`parts/${part}`}
            builtinDefault={`/models/parts/${part}.glb`}
            onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, staticParts: { ...p.catalog.staticParts, [part]: src } } }))}
          />
        ))}
      </Card>

      <Card title="Part icons">
        <p className="text-[11px] text-bone/40 mb-3">Circular thumbnails on the Inspect grid. Square crop, ~256×256 recommended.</p>
        {config.catalog.components.map(c => (
          <PartIconSourceEditor
            key={c.id}
            label={c.label}
            source={config.catalog.partIcons?.[c.id] ?? { type: 'builtin', path: builtinPartIconPath(c.id) }}
            uploadSlot={`icons/${c.id}`}
            builtinDefault={builtinPartIconPath(c.id)}
            onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, partIcons: { ...p.catalog.partIcons, [c.id]: src } } }))}
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
            onChange={src => setConfig(p => {
              const dragons = [...p.catalog.dragons];
              dragons[i] = { ...dragons[i], model: src };
              return { ...p, catalog: { ...p.catalog, dragons } };
            })}
          />
        ))}
      </Card>

      <Card title="Globe (per metal)">
        <p className="text-[11px] text-bone/40 mb-3">Terrestrial globe from the movement rig, swapped by the metal picker.</p>
        {config.catalog.metals.map(m => (
          <ModelSourceEditor
            key={m.id}
            label={`Globe · ${m.label}`}
            source={config.catalog.globeParts[m.id] ?? { type: 'builtin', path: `/models/parts/globe_${m.id}.glb` }}
            uploadSlot={`parts/globe/${m.id}`}
            builtinDefault={`/models/parts/globe_${m.id}.glb`}
            onChange={src => setConfig(p => ({ ...p, catalog: { ...p.catalog, globeParts: { ...p.catalog.globeParts, [m.id]: src } } }))}
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
            onChange={sources => setConfig(p => ({ ...p, catalog: { ...p.catalog, metalParts: { ...p.catalog.metalParts, [m.id]: sources } } }))}
          />
        ))}
      </Card>
    </div>
  );
}

function MetalPartsEditor({ metal, label, sources, onChange }: {
  metal: MetalId; label: string;
  sources: SiteConfig['catalog']['metalParts'][MetalId];
  onChange: (s: SiteConfig['catalog']['metalParts'][MetalId]) => void;
}) {
  const setPart = (part: 'caseBody' | 'case' | 'movement', src: ModelSource) => onChange({ ...sources, [part]: src });
  const builtin = (part: 'caseBody' | 'case' | 'movement') => {
    const folder = part === 'caseBody' ? 'case_body' : part;
    const file = part === 'caseBody' ? `case_body_${metal}` : `${part}_${metal}`;
    return `/models/${folder}/${file}.glb`;
  };
  return (
    <div className="mb-5 pb-5 border-b border-bone/8 last:border-0 last:mb-0 last:pb-0">
      <div className="text-xs text-jc-gold/80 mb-3 font-medium">{label}</div>
      {(['caseBody', 'case', 'movement'] as const).map(part => (
        <ModelSourceEditor key={part} label={part}
          source={sources?.[part] ?? { type: 'builtin', path: builtin(part) }}
          uploadSlot={`${part === 'caseBody' ? 'case_body' : part}/${metal}`}
          builtinDefault={builtin(part)}
          onChange={src => setPart(part, src)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Content tab
// ─────────────────────────────────────────────────────────────

function ContentTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  const c = config.content;
  const patch = (partial: Partial<typeof c>) => setConfig(p => ({ ...p, content: { ...p.content, ...partial } }));

  return (
    <div className="space-y-4">
      <Card title="SEO">
        <Field label="Title"       value={c.meta.title}       onChange={v => patch({ meta: { ...c.meta, title: v } })} />
        <Field label="Description" value={c.meta.description} onChange={v => patch({ meta: { ...c.meta, description: v } })} multiline />
      </Card>

      <Card title="Header & nav">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"     value={c.header.brand}    onChange={v => patch({ header: { ...c.header, brand: v } })} />
          <Field label="CTA label" value={c.header.ctaLabel} onChange={v => patch({ header: { ...c.header, ctaLabel: v } })} />
        </div>
        <Field label="CTA href" value={c.header.ctaHref} onChange={v => patch({ header: { ...c.header, ctaHref: v } })} />
        <NavEditor links={c.header.nav} onChange={nav => patch({ header: { ...c.header, nav } })} />
      </Card>

      <Card title="Hero copy">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Eyebrow" value={c.hero.eyebrow} onChange={v => patch({ hero: { ...c.hero, eyebrow: v } })} />
          <Field label="Scroll hint" value={c.hero.scrollHint} onChange={v => patch({ hero: { ...c.hero, scrollHint: v } })} />
        </div>
        <Field label="Title line 1" value={c.hero.titleLine1} onChange={v => patch({ hero: { ...c.hero, titleLine1: v } })} />
        <Field label="Title line 2" value={c.hero.titleLine2} onChange={v => patch({ hero: { ...c.hero, titleLine2: v } })} />
        <Field label="Body"         value={c.hero.body}       onChange={v => patch({ hero: { ...c.hero, body: v } })} multiline />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Explore CTA"    value={c.hero.exploreConfiguratorLabel} onChange={v => patch({ hero: { ...c.hero, exploreConfiguratorLabel: v } })} />
          <Field label="Loader title"   value={c.hero.loadingTitle}             onChange={v => patch({ hero: { ...c.hero, loadingTitle: v } })} />
        </div>
        <Field label="Loader subtitle" value={c.hero.loadingSubtitle} onChange={v => patch({ hero: { ...c.hero, loadingSubtitle: v } })} />
      </Card>

      <Card title="Configurator copy">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Eyebrow"      value={c.configurator.eyebrow}      onChange={v => patch({ configurator: { ...c.configurator, eyebrow: v } })} />
          <Field label="Title"        value={c.configurator.title}        onChange={v => patch({ configurator: { ...c.configurator, title: v } })} />
        </div>
        <Field label="Description"   value={c.configurator.description}  onChange={v => patch({ configurator: { ...c.configurator, description: v } })} multiline />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edition line"     value={c.configurator.editionLine}     onChange={v => patch({ configurator: { ...c.configurator, editionLine: v } })} />
          <Field label="Share label"      value={c.configurator.shareLinkLabel}  onChange={v => patch({ configurator: { ...c.configurator, shareLinkLabel: v } })} />
          <Field label="Reset view label" value={c.configurator.resetViewLabel}  onChange={v => patch({ configurator: { ...c.configurator, resetViewLabel: v } })} />
          <Field label="AR button label"  value={c.configurator.arButtonLabel}   onChange={v => patch({ configurator: { ...c.configurator, arButtonLabel: v } })} />
        </div>
        <Field label="AR size hint" value={c.configurator.arSizeHint} onChange={v => patch({ configurator: { ...c.configurator, arSizeHint: v } })} multiline />
      </Card>

      <Card title="Story panels">
        {c.storyPanels.map((panel, i) => (
          <StoryEditor
            key={`${panel.eyebrow}-${i}`}
            panel={panel}
            onChange={next => setConfig(p => {
              const storyPanels = [...p.content.storyPanels];
              storyPanels[i] = next;
              return { ...p, content: { ...p.content, storyPanels } };
            })}
          />
        ))}
      </Card>

      <Card title="Specifications">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Eyebrow" value={c.specs.eyebrow} onChange={v => patch({ specs: { ...c.specs, eyebrow: v } })} />
          <Field label="Title"   value={c.specs.title}   onChange={v => patch({ specs: { ...c.specs, title: v } })} />
        </div>
        {c.specs.rows.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <Field label={`Label ${i + 1}`} value={row.label} onChange={v => setConfig(p => { const rows = [...p.content.specs.rows]; rows[i] = { ...rows[i], label: v }; return { ...p, content: { ...p.content, specs: { ...p.content.specs, rows } } }; })} />
            <Field label={`Value ${i + 1}`} value={row.value} onChange={v => setConfig(p => { const rows = [...p.content.specs.rows]; rows[i] = { ...rows[i], value: v }; return { ...p, content: { ...p.content, specs: { ...p.content.specs, rows } } }; })} />
          </div>
        ))}
      </Card>

      <Card title="CTA & footer">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Eyebrow" value={c.cta.eyebrow} onChange={v => patch({ cta: { ...c.cta, eyebrow: v } })} />
          <Field label="Title"   value={c.cta.title}   onChange={v => patch({ cta: { ...c.cta, title: v } })} />
        </div>
        <Field label="Body" value={c.cta.body} onChange={v => patch({ cta: { ...c.cta, body: v } })} multiline />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary label" value={c.cta.primaryLabel} onChange={v => patch({ cta: { ...c.cta, primaryLabel: v } })} />
          <Field label="Primary href"  value={c.cta.primaryHref}  onChange={v => patch({ cta: { ...c.cta, primaryHref: v } })} />
          <Field label="Secondary label" value={c.cta.secondaryLabel} onChange={v => patch({ cta: { ...c.cta, secondaryLabel: v } })} />
          <Field label="Secondary href"  value={c.cta.secondaryHref}  onChange={v => patch({ cta: { ...c.cta, secondaryHref: v } })} />
        </div>
        <Field label="Footer line" value={c.footer} onChange={v => patch({ footer: v })} />
      </Card>

      <Card title="Activated Print" subtitle="Bottom-of-page editorial section">
        <div className="space-y-4">
          <Toggle
            label="Show on live site"
            checked={c.activatedPrint?.enabled ?? false}
            onChange={v => patch({ activatedPrint: { ...c.activatedPrint, enabled: v } })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eyebrow" value={c.activatedPrint?.eyebrow ?? ''} onChange={v => patch({ activatedPrint: { ...c.activatedPrint, eyebrow: v } })} />
            <Field label="Title"   value={c.activatedPrint?.title ?? ''}   onChange={v => patch({ activatedPrint: { ...c.activatedPrint, title: v } })} />
          </div>
          <Field label="Body" value={c.activatedPrint?.body ?? ''} onChange={v => patch({ activatedPrint: { ...c.activatedPrint, body: v } })} multiline />
          <ModelSourceEditor
            label="Poster image"
            source={c.activatedPrint?.imageSource ?? { type: 'builtin', path: '/images/activated-print.jpg' }}
            uploadSlot="images/activated-print"
            builtinDefault="/images/activated-print.jpg"
            acceptImages
            onChange={src => patch({ activatedPrint: { ...c.activatedPrint, imageSource: src } })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Image alt text" value={c.activatedPrint?.imageAlt ?? ''} onChange={v => patch({ activatedPrint: { ...c.activatedPrint, imageAlt: v } })} />
            <Field label="CTA label (blank = no button)" value={c.activatedPrint?.ctaLabel ?? ''} onChange={v => patch({ activatedPrint: { ...c.activatedPrint, ctaLabel: v } })} />
          </div>
          <Field label="CTA href" value={c.activatedPrint?.ctaHref ?? ''} onChange={v => patch({ activatedPrint: { ...c.activatedPrint, ctaHref: v } })} />
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Theme tab
// ─────────────────────────────────────────────────────────────

function ThemeTab({ config, setConfig }: { config: SiteConfig; setConfig: (fn: (p: SiteConfig) => SiteConfig) => void }) {
  const t = config.theme;
  const set = (key: keyof typeof t, value: string) =>
    setConfig(p => ({ ...p, theme: { ...p.theme, [key]: value } }));

  return (
    <Card title="Brand colors" subtitle="Applied as CSS variables on the public site">
      <div className="space-y-3">
        {(['ink', 'carbon', 'bone', 'jcGold', 'roseGold', 'whiteGold', 'yellowGold'] as const).map(key => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={t[key]}
              onChange={e => set(key, e.target.value)}
              className="w-9 h-9 rounded-lg border border-bone/15 cursor-pointer shrink-0 bg-transparent"
            />
            <div className="flex-1 min-w-0">
              <Field label={key} value={t[key]} onChange={v => set(key, v)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────

function NavEditor({ links, onChange }: { links: { label: string; href: string }[]; onChange: (links: { label: string; href: string }[]) => void }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-bone/40">Navigation links</div>
      {links.map((link, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <Field label="Label" value={link.label} onChange={v => { const next = [...links]; next[i] = { ...next[i], label: v }; onChange(next); }} />
          <Field label="Href"  value={link.href}  onChange={v => { const next = [...links]; next[i] = { ...next[i], href: v }; onChange(next); }} />
        </div>
      ))}
    </div>
  );
}

function StoryEditor({ panel, onChange }: { panel: StoryPanelContent; onChange: (p: StoryPanelContent) => void }) {
  return (
    <div className="mb-5 pb-5 border-b border-bone/8 last:border-0 last:mb-0 last:pb-0">
      <div className="text-[10px] text-jc-gold/70 mb-2 uppercase tracking-wider">{panel.eyebrow}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Eyebrow" value={panel.eyebrow} onChange={v => onChange({ ...panel, eyebrow: v })} />
        <Field label="Title"   value={panel.title}   onChange={v => onChange({ ...panel, title: v })} />
      </div>
      <Field label="Body" value={panel.body} onChange={v => onChange({ ...panel, body: v })} multiline />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Metric value" value={panel.metric.value} onChange={v => onChange({ ...panel, metric: { ...panel.metric, value: v } })} />
        <Field label="Metric label" value={panel.metric.label} onChange={v => onChange({ ...panel, metric: { ...panel.metric, label: v } })} />
      </div>
    </div>
  );
}

function PartIconSourceEditor({ label, source, uploadSlot, builtinDefault, onChange }: {
  label: string; source: ModelSource; uploadSlot: string; builtinDefault: string; onChange: (s: ModelSource) => void;
}) {
  const preview = source.type === 'builtin' ? source.path : source.type === 'url' ? source.url : `/api/models/${source.key}`;
  return (
    <div className="mb-4 last:mb-0 pb-4 last:pb-0 border-b border-bone/8 last:border-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-jc-gold/25 bg-ink/60 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || builtinDefault} alt="" className="w-full h-full object-cover" />
        </div>
        <span className="text-[11px] text-bone/70">{label}</span>
      </div>
      <ModelSourceEditor label="Icon source" source={source} uploadSlot={uploadSlot} builtinDefault={builtinDefault} acceptImages onChange={onChange} />
    </div>
  );
}

function ModelSourceEditor({ label, source, uploadSlot, builtinDefault, acceptImages, onChange }: {
  label: string; source: ModelSource; uploadSlot: string; builtinDefault?: string; acceptImages?: boolean; onChange: (s: ModelSource) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const acceptList = acceptImages ? ['.png', '.jpg', '.jpeg', '.webp', '.svg'] : ['.glb', '.gltf'];
  const acceptAttr = acceptList.join(',');
  const acceptMime = acceptImages ? /^image\// : /(model\/gltf|application\/octet-stream|gltf|glb)/i;
  const isValidFile = (f: File) => { const ext = f.name.toLowerCase().split('.').pop(); return (ext && acceptList.includes(`.${ext}`)) || acceptMime.test(f.type); };

  const upload = async (file: File) => {
    if (!isValidFile(file)) { setError(`Wrong type — expected ${acceptList.join(' / ')}`); return; }
    setError(null); setUploading(true);
    try {
      const form = new FormData(); form.set('slot', uploadSlot); form.set('file', file);
      const res = await fetch('/api/models/upload', { method: 'POST', headers: adminHeaders(), body: form });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { error?: string }).error ?? `upload failed (${res.status})`); }
      const json = (await res.json()) as { slot?: string };
      onChange({ type: 'blob', key: json.slot ?? uploadSlot });
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const resetDrag = () => { dragDepth.current = 0; setDragOver(false); };
  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); dragDepth.current += 1; if (e.dataTransfer.types.includes('Files')) setDragOver(true); };
  const onDragOver  = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) e.dataTransfer.dropEffect = 'copy'; };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => { if (e.relatedTarget === null) { resetDrag(); return; } dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false); };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); resetDrag(); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const end = () => resetDrag();
    window.addEventListener('dragend', end); window.addEventListener('drop', end);
    return () => { window.removeEventListener('dragend', end); window.removeEventListener('drop', end); };
  }, []);

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-bone/45">{label}</span>
        <div className="flex gap-1">
          {(['builtin', 'url', 'blob'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => {
                if (type === 'builtin') onChange({ type: 'builtin', path: builtinDefault ?? '' });
                if (type === 'url')     onChange({ type: 'url', url: '' });
                if (type === 'blob')    onChange({ type: 'blob', key: uploadSlot });
              }}
              className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border transition ${
                source.type === type ? 'border-jc-gold/45 text-jc-gold bg-jc-gold/8' : 'border-bone/12 text-bone/40 hover:border-bone/25'
              }`}
            >
              {type === 'blob' ? 'upload' : type}
            </button>
          ))}
        </div>
      </div>
      {source.type === 'builtin' && (
        <input className="w-full rounded-lg bg-ink/40 border border-bone/10 px-3 py-2 text-xs text-bone focus:border-jc-gold/40 focus:outline-none" value={source.path} onChange={e => onChange({ type: 'builtin', path: e.target.value })} placeholder={acceptImages ? '/images/…' : '/models/…'} />
      )}
      {source.type === 'url' && (
        <input className="w-full rounded-lg bg-ink/40 border border-bone/10 px-3 py-2 text-xs text-bone focus:border-jc-gold/40 focus:outline-none" value={source.url} onChange={e => onChange({ type: 'url', url: e.target.value })} placeholder="https://…" />
      )}
      {source.type === 'blob' && (
        <div onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          className={`relative rounded-lg border-2 border-dashed transition px-4 py-4 text-center ${dragOver ? 'border-jc-gold/60 bg-jc-gold/8' : 'border-bone/12 bg-ink/20 hover:border-bone/25'} ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <label className="block cursor-pointer">
            <input type="file" accept={acceptAttr} className="sr-only pointer-events-none" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            <div className="text-[11px] text-bone/70">
              {uploading ? <span className="text-jc-gold">Uploading…</span> : (
                <><span className="text-jc-gold underline-offset-2 hover:underline">{acceptImages ? 'Choose image' : 'Choose file'}</span><span className="text-bone/35"> or drag & drop</span></>
              )}
            </div>
            <div className="mt-0.5 text-[9px] text-bone/30 font-mono">{acceptList.join(' · ')} · max 120 MB</div>
          </label>
          {error && <div className="mt-1.5 text-[10px] text-amber-300/80">{error}</div>}
          <div className="mt-1 text-[9px] text-bone/30 truncate font-mono">
            {source.key}
          </div>
        </div>
      )}
    </div>
  );
}

function BackgroundOptionEditor({ option, onChange, onRemove }: { option: ConfiguratorBackgroundOption; onChange: (o: ConfiguratorBackgroundOption) => void; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false);
  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.set('slot', `backgrounds/${option.id}`); form.set('file', file);
      const res = await fetch('/api/models/upload', { method: 'POST', headers: adminHeaders(), body: form });
      if (!res.ok) throw new Error('upload failed');
      const json = (await res.json()) as { slot?: string };
      onChange({ ...option, type: 'image', image: { type: 'blob', key: json.slot ?? `backgrounds/${option.id}` } });
    } finally { setUploading(false); }
  };

  return (
    <div className="mb-3 pb-3 border-b border-bone/8 last:border-0">
      <div className="flex gap-2 mb-2">
        <Field label="Id"    value={option.id}    onChange={v => onChange({ ...option, id: v })} />
        <Field label="Label" value={option.label} onChange={v => onChange({ ...option, label: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {(['color', 'image'] as const).map(type => (
          <button key={type} type="button" onClick={() => onChange({ ...option, type, color: option.color ?? '#0a0a0c' })}
            className={`px-2 py-0.5 rounded text-[9px] uppercase border ${option.type === type ? 'border-jc-gold/45 text-jc-gold' : 'border-bone/12 text-bone/40'}`}
          >{type}</button>
        ))}
        <button type="button" onClick={onRemove} className="ml-auto text-[9px] text-bone/30 hover:text-amber-300/70 transition">Remove</button>
      </div>
      {option.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input type="color" value={option.color ?? '#0a0a0c'} onChange={e => onChange({ ...option, color: e.target.value })} className="w-8 h-8 rounded-lg border-0 cursor-pointer" />
          <div className="flex-1"><Field label="Hex" value={option.color ?? '#0a0a0c'} onChange={v => onChange({ ...option, color: v })} /></div>
        </div>
      ) : (
        <label className="cursor-pointer inline-flex items-center gap-2 text-[10px] text-jc-gold border border-jc-gold/25 px-3 py-1.5 rounded-lg hover:bg-jc-gold/8 transition">
          {uploading ? 'Uploading…' : 'Upload background image'}
          <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Primitive UI components
// ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-bone/10 bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-bone/8 flex items-baseline gap-2">
        <h2 className="text-sm font-medium text-bone">{title}</h2>
        {subtitle && <span className="text-[10px] text-bone/40">{subtitle}</span>}
      </div>
      <div className="p-4 space-y-1">{children}</div>
    </section>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-8 h-4.5 rounded-full bg-bone/15 peer-checked:bg-jc-gold transition-colors duration-200" style={{ height: '1.125rem' }} />
        <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white/70 peer-checked:bg-ink transition-transform duration-200 peer-checked:translate-x-3.5 shadow-sm" />
      </div>
      <div>
        <div className="text-[13px] text-bone/80 group-hover:text-bone transition-colors leading-snug">{label}</div>
        {description && <div className="text-[10px] text-bone/40 mt-0.5 leading-relaxed">{description}</div>}
      </div>
    </label>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const cls = 'w-full rounded-lg bg-ink/50 border border-bone/10 px-3 py-2 text-[13px] text-bone placeholder-bone/25 focus:border-jc-gold/40 focus:outline-none transition-colors';
  return (
    <div className="mb-3 last:mb-0">
      <label className="text-[9px] uppercase tracking-wider text-bone/40 block mb-1">{label}</label>
      {multiline
        ? <textarea className={`${cls} min-h-[72px] resize-y`} value={value} onChange={e => onChange(e.target.value)} />
        : <input className={cls} value={value} onChange={e => onChange(e.target.value)} />
      }
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between items-center text-[10px] text-bone/50 mb-1">
        <span>{label}</span>
        <span className="tabular-nums font-mono text-bone/70">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-jc-gold h-1 rounded-full" />
    </div>
  );
}

function QualitySelect({ label, value, onChange }: { label: string; value: ModelQuality; onChange: (v: ModelQuality) => void }) {
  return (
    <div className="mb-2 last:mb-0">
      <label className="text-[9px] uppercase tracking-wider text-bone/40 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value as ModelQuality)} className="w-full rounded-lg bg-ink/50 border border-bone/10 px-3 py-2 text-[13px] text-bone focus:border-jc-gold/40 focus:outline-none">
        {(['auto', 'low', 'medium', 'high'] as const).map(q => <option key={q} value={q} className="bg-ink">{q}</option>)}
      </select>
    </div>
  );
}

function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[10px] text-bone/40 border border-bone/10 px-4 py-2 rounded-lg hover:text-bone/70 hover:border-bone/25 transition w-full">
      {label}
    </button>
  );
}
