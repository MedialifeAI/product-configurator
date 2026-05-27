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

  return (
    <div
      className="pointer-events-none absolute top-2 left-2 z-20 rounded-md border border-bone/15 bg-ink/80 px-2 py-1.5 font-mono text-[9px] leading-relaxed text-bone/75 backdrop-blur-sm"
      aria-live="polite"
    >
      <div>FPS {stats.fps}</div>
      <div>Draw {stats.drawCalls} · Tri {stats.triangles.toLocaleString()}</div>
      {stats.memoryMb != null && <div>Heap {stats.memoryMb} MB</div>}
      <div>Tier {stats.tier}</div>
    </div>
  );
}
