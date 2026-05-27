'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useSiteConfig } from '@/context/SiteConfigProvider';

const WatchScene = dynamic(() => import('@/components/WatchScene'), { ssr: false });
const Configurator = dynamic(() => import('@/components/Configurator'), { ssr: false });

function PreviewFrame({
  title,
  hint,
  children,
  footer,
  tall,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <section className="glass rounded-2xl border border-bone/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-bone/10 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-jc-gold/80">{title}</span>
        {hint && <span className="text-[9px] text-bone/40 truncate">{hint}</span>}
      </div>
      <div className={`relative bg-[#0a0a0c] ${tall ? 'min-h-[320px] md:min-h-[420px] lg:min-h-[480px]' : 'min-h-[280px]'}`}>
        {children}
      </div>
      {footer && <div className="px-3 py-2 border-t border-bone/10">{footer}</div>}
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

  const effectiveExplode = Math.min(
    1,
    Math.max(0, scrollSim + config.scene.heroAnimOffset),
  );

  return (
    <PreviewFrame
      title="Hero preview"
      hint="Scroll + anim offset · live lighting"
      tall
      footer={
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] text-bone/60">
            <span className="uppercase tracking-[0.15em] shrink-0 w-14">Scroll</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={scrollSim}
              onChange={e => onScrollSim(parseFloat(e.target.value))}
              className="flex-1 accent-jc-gold"
            />
            <span className="tabular-nums w-8 text-right">{scrollSim.toFixed(2)}</span>
          </label>
          <p className="text-[9px] text-bone/40">
            Effective explode {effectiveExplode.toFixed(2)} (scroll + animation start{' '}
            {config.scene.heroAnimOffset.toFixed(2)})
          </p>
        </div>
      }
    >
      <div className="absolute inset-0">
        <WatchScene
          scrollProgress={scrollProgress}
          settings={config.scene}
          catalog={config.catalog}
          useOptimizedAssets={config.featureFlags?.useOptimizedAssets}
          showPerformanceOverlay={config.features.showPerformanceOverlay}
          className="w-full h-full"
        />
      </div>
    </PreviewFrame>
  );
}

function ConfiguratorPreview() {
  return (
    <PreviewFrame title="Configurator preview" hint="Lighting · background · quality" tall>
      <div className="absolute inset-0">
        <Configurator embedPreview />
      </div>
    </PreviewFrame>
  );
}

/** Live 3D previews for admin — updates as config changes in context. */
export default function AdminScenePreviews() {
  return (
    <div className="space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-bone/45 px-1">
        Live previews — adjust controls in the sidebar
      </p>
      <HeroPreview />
      <ConfiguratorPreview />
    </div>
  );
}
