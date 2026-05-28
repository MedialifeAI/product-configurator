'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useSiteConfig } from '@/context/SiteConfigProvider';

const WatchScene = dynamic(() => import('@/components/WatchScene'), { ssr: false });
const Configurator = dynamic(() => import('@/components/Configurator'), { ssr: false });

export type PreviewMode = 'hero' | 'configurator' | 'both';

function PreviewFrame({
  title,
  hint,
  children,
  footer,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="glass rounded-xl border border-bone/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-bone/10 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-jc-gold/80">{title}</span>
        {hint && <span className="text-[9px] text-bone/35 truncate">{hint}</span>}
      </div>
      <div className="relative bg-[#0a0a0c] min-h-[300px] lg:min-h-[380px]">
        {children}
      </div>
      {footer && <div className="px-3 py-2.5 border-t border-bone/10 bg-ink/30">{footer}</div>}
    </section>
  );
}

function HeroPreview() {
  const { config } = useSiteConfig();
  const scrollProgress = useRef(0.35);
  const [scrollSim, setScrollSim] = useState(0.35);

  const onScrollSim = (v: number) => {
    setScrollSim(v);
    scrollProgress.current = v;
  };

  const effectiveExplode = Math.min(1, Math.max(0, scrollSim + config.scene.heroAnimOffset));

  return (
    <PreviewFrame
      title="Hero"
      hint="Scroll · lighting · animation"
      footer={
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[10px] text-bone/55">
            <span className="uppercase tracking-[0.12em] shrink-0 w-10">Scroll</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={scrollSim}
              onChange={e => onScrollSim(parseFloat(e.target.value))}
              className="flex-1 accent-jc-gold h-1"
            />
            <span className="tabular-nums w-8 text-right font-mono">{scrollSim.toFixed(2)}</span>
          </label>
          <p className="text-[9px] text-bone/35">
            Explode {effectiveExplode.toFixed(2)} = scroll + offset {config.scene.heroAnimOffset.toFixed(2)}
          </p>
        </div>
      }
    >
      <div className="absolute inset-0">
        <WatchScene
          scrollProgress={scrollProgress}
          settings={config.scene}
          catalog={config.catalog}
          featureFlags={config.featureFlags}
          showPerformanceOverlay={config.features.showPerformanceOverlay}
          className="w-full h-full"
        />
      </div>
    </PreviewFrame>
  );
}

function ConfiguratorPreview() {
  return (
    <PreviewFrame title="Configurator" hint="Lighting · background · quality">
      <div className="absolute inset-0">
        <Configurator embedPreview />
      </div>
    </PreviewFrame>
  );
}

/** Live 3D previews — only renders the previews relevant to the current tab. */
export default function AdminScenePreviews({ mode }: { mode: PreviewMode }) {
  return (
    <div className="space-y-3">
      <p className="text-[9px] uppercase tracking-[0.2em] text-bone/35 px-0.5">
        Live preview
      </p>
      {(mode === 'hero' || mode === 'both') && <HeroPreview />}
      {(mode === 'configurator' || mode === 'both') && <ConfiguratorPreview />}
    </div>
  );
}
