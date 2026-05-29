'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { getDeviceTier } from '@/lib/deviceTier';

interface PerfStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  memoryMb: number | null;
  tier: string;
}

type PerfListener = () => void;

const perfBySource = new Map<string, PerfStats>();
const listenersBySource = new Map<string, Set<PerfListener>>();

function publishPerf(sourceId: string, stats: PerfStats | null) {
  if (stats === null) {
    perfBySource.delete(sourceId);
  } else {
    perfBySource.set(sourceId, stats);
  }
  listenersBySource.get(sourceId)?.forEach(fn => fn());
}

function subscribePerf(sourceId: string, listener: PerfListener): () => void {
  if (!listenersBySource.has(sourceId)) {
    listenersBySource.set(sourceId, new Set());
  }
  listenersBySource.get(sourceId)!.add(listener);
  return () => listenersBySource.get(sourceId)?.delete(listener);
}

/** R3F child — samples renderer stats for one canvas instance. */
export function PerformanceSampler({
  enabled,
  sourceId,
}: {
  enabled: boolean;
  sourceId: string;
}) {
  const gl = useThree(s => s.gl);
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    if (!enabled) return;
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - lastTime.current;
    if (elapsed < 500) return;

    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    publishPerf(sourceId, {
      fps: Math.round((frames.current * 1000) / elapsed),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      memoryMb: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null,
      tier: getDeviceTier(),
    });
    frames.current = 0;
    lastTime.current = now;
  });

  useEffect(() => {
    if (!enabled) publishPerf(sourceId, null);
    return () => publishPerf(sourceId, null);
  }, [enabled, sourceId]);

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTri(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

type Health = 'good' | 'warn' | 'danger';

function fpsHealth(fps: number): Health {
  if (fps >= 30) return 'good';
  if (fps >= 15) return 'warn';
  return 'danger';
}

function memHealth(mb: number | null): Health {
  if (mb === null) return 'good';
  if (mb < 280) return 'good';   // iOS-safe
  if (mb < 450) return 'warn';   // borderline
  return 'danger';               // iOS crash risk
}

function drawHealth(calls: number): Health {
  if (calls < 400) return 'good';
  if (calls < 800) return 'warn';
  return 'danger';
}

const HEALTH_TEXT: Record<Health, string> = {
  good:   'text-emerald-400',
  warn:   'text-yellow-400',
  danger: 'text-red-400',
};

const HEALTH_BG: Record<Health, string> = {
  good:   'bg-emerald-400',
  warn:   'bg-yellow-400',
  danger: 'bg-red-400',
};

const HEALTH_LABEL: Record<Health, string> = {
  good:   'Good',
  warn:   'Moderate',
  danger: 'High',
};

function StatRow({
  label,
  value,
  health,
  sub,
}: {
  label: string;
  value: string;
  health: Health;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[9px] uppercase tracking-[0.12em] text-bone/40 shrink-0">{label}</span>
      <span className="text-right">
        <span className={`text-[12px] font-bold tabular-nums leading-none ${HEALTH_TEXT[health]}`}>
          {value}
        </span>
        {sub && <span className="ml-1 text-[9px] text-bone/35">{sub}</span>}
      </span>
    </div>
  );
}

/** DOM overlay — pair with PerformanceSampler via the same sourceId. */
export function PerformanceOverlayPanel({
  enabled,
  sourceId,
}: {
  enabled: boolean;
  sourceId: string;
}) {
  const [stats, setStats] = useState<PerfStats | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }

    const sync = () => {
      const next = perfBySource.get(sourceId);
      if (next) setStats({ ...next });
    };

    sync();
    const unsub = subscribePerf(sourceId, sync);
    const id = window.setInterval(sync, 500);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [enabled, sourceId]);

  if (!enabled || !stats) return null;

  const fh = fpsHealth(stats.fps);
  const mh = memHealth(stats.memoryMb);
  const dh = drawHealth(stats.drawCalls);
  const overallHealth: Health = fh === 'danger' || mh === 'danger' ? 'danger' : fh === 'warn' || mh === 'warn' ? 'warn' : 'good';

  return (
    <div
      className="pointer-events-none absolute top-3 left-3 z-20 rounded-xl border border-bone/15 bg-ink/92 px-3 pt-2.5 pb-2 font-mono backdrop-blur-md min-w-[148px] shadow-lg"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-bone/10">
        <span className="text-[8px] uppercase tracking-[0.18em] text-bone/30">Performance</span>
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_BG[overallHealth]}`} />
          <span className={`text-[8px] ${HEALTH_TEXT[overallHealth]}`}>{HEALTH_LABEL[overallHealth]}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5">
        <StatRow label="FPS"    value={String(stats.fps)}            health={fh} sub={fh === 'danger' ? 'laggy' : fh === 'warn' ? 'ok' : 'smooth'} />
        <StatRow label="Tri"    value={fmtTri(stats.triangles)}      health="good" />
        <StatRow label="Draws"  value={String(stats.drawCalls)}      health={dh} />
        {stats.memoryMb != null && (
          <StatRow label="Heap" value={`${stats.memoryMb} MB`}       health={mh} sub={mh === 'danger' ? '⚠ iOS risk' : mh === 'warn' ? 'watch' : 'safe'} />
        )}
      </div>

      {/* Health bars */}
      <div className="flex gap-1 mt-2.5 pt-2 border-t border-bone/10">
        <div className="flex-1 space-y-0.5">
          <div className="h-1 rounded-full bg-bone/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${HEALTH_BG[fh]}`}
                 style={{ width: `${Math.min(100, (stats.fps / 60) * 100)}%` }} />
          </div>
          <div className="text-[7px] text-bone/25 text-center">fps</div>
        </div>
        {stats.memoryMb != null && (
          <div className="flex-1 space-y-0.5">
            <div className="h-1 rounded-full bg-bone/10 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${HEALTH_BG[mh]}`}
                   style={{ width: `${Math.min(100, (stats.memoryMb / 600) * 100)}%` }} />
            </div>
            <div className="text-[7px] text-bone/25 text-center">mem</div>
          </div>
        )}
        <div className="flex-1 space-y-0.5">
          <div className="h-1 rounded-full bg-bone/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${HEALTH_BG[dh]}`}
                 style={{ width: `${Math.min(100, (stats.drawCalls / 1000) * 100)}%` }} />
          </div>
          <div className="text-[7px] text-bone/25 text-center">draw</div>
        </div>
      </div>

      {/* Tier chip */}
      <div className="mt-1.5 text-center">
        <span className="text-[8px] text-bone/25 uppercase tracking-wider">tier </span>
        <span className="text-[8px] text-bone/50">{stats.tier}</span>
      </div>
    </div>
  );
}
