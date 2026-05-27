'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import HeroCollectionPanel from '@/components/HeroCollectionPanel';
import HeroSceneLoader from '@/components/HeroSceneLoader';
import SiteHeader from '@/components/SiteHeader';
import StoryPanel from '@/components/StoryPanel';
import SpecsAndCTA from '@/components/SpecsAndCTA';
import { useAssetLoadProgress } from '@/hooks/useAssetLoadProgress';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { getDeviceTier } from '@/lib/deviceTier';
import { heroWatchUrl } from '@/lib/resolveModelUrl';
import { resolveRenderQuality } from '@/lib/renderQuality';
import { SiteConfigProvider, useSiteConfig } from '@/context/SiteConfigProvider';

const WatchScene    = dynamic(() => import('@/components/WatchScene'),    { ssr: false });
const Configurator  = dynamic(() => import('@/components/Configurator'),  { ssr: false });
const DebugSettings = dynamic(() => import('@/components/DebugSettings'), { ssr: false });

export default function Home() {
  return (
    <SiteConfigProvider>
      <HomeContent />
      <SceneControlsGate />
    </SiteConfigProvider>
  );
}

function SceneControlsGate() {
  const { config } = useSiteConfig();
  if (!config.features.showSceneControls) return null;
  return <DebugSettings />;
}

function HomeContent() {
  const scrollStripRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useScrollProgress(scrollStripRef);
  const { config, settings } = useSiteConfig();
  const { content } = config;
  const tier = useMemo(() => getDeviceTier(), []);
  const heroRenderQuality = useMemo(
    () =>
      resolveRenderQuality(
        settings.heroModelQuality ?? 'auto',
        tier,
        config.featureFlags?.useOptimizedAssets,
      ),
    [settings.heroModelQuality, tier, config.featureFlags?.useOptimizedAssets],
  );
  const heroModelUrl = heroWatchUrl(config.catalog, settings.heroModelUrl, {
    useOptimizedAssets: heroRenderQuality.useOptimizedAssets,
  });
  const { progress: heroProgress, done: heroAssetDone } = useAssetLoadProgress(heroModelUrl);
  const [sceneReady, setSceneReady] = useState(false);
  const [configuratorInView, setConfiguratorInView] = useState(false);
  const showHeroLoader = !heroAssetDone || !sceneReady;

  useEffect(() => {
    const el = document.getElementById('configurator');
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setConfiguratorInView(entry?.isIntersecting ?? false),
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <main className="relative bg-ink text-bone">
      <SiteHeader />

      <section ref={scrollStripRef} id="story" className="relative">
        <div className="sticky top-0 h-screen w-full canvas-hero">
          {showHeroLoader && (
            <HeroSceneLoader
              progress={heroAssetDone ? (sceneReady ? 100 : 92) : heroProgress}
              label={content.hero.loadingTitle}
              sublabel={content.hero.loadingSubtitle}
            />
          )}
          <Suspense fallback={null}>
            <WatchScene
              scrollProgress={scrollProgress}
              settings={settings}
              catalog={config.catalog}
              heroMounted={!configuratorInView}
              useOptimizedAssets={config.featureFlags?.useOptimizedAssets}
              showPerformanceOverlay={config.features.showPerformanceOverlay}
              onReady={() => setSceneReady(true)}
            />
          </Suspense>
        </div>

        <div className="relative -mt-screen">
          <section className="relative h-screen w-full flex flex-col items-center justify-between px-3 sm:px-5 pt-[max(5.25rem,9vh)] md:pt-[max(6rem,10vh)] pb-[max(1rem,2.5vh)] md:pb-[max(2rem,5vh)] z-10 pointer-events-none">
            <div className="text-center max-w-3xl mx-auto w-full shrink-0 overflow-visible -translate-y-[6vh] sm:-translate-y-[5vh] md:-translate-y-[4vh] lg:-translate-y-[5vh] px-2">
              <h1
                className="font-display text-[2.65rem] sm:text-6xl md:text-7xl lg:text-8xl leading-[1.08] md:leading-[1.05] overflow-visible animate-fade-up"
                style={{ textShadow: '0 2px 28px rgba(0,0,0,0.92), 0 0 48px rgba(0,0,0,0.75)' }}
              >
                <span className="block text-bone">{content.hero.titleLine1}</span>
                <span
                  className="block gold-text hero-title-accent"
                  style={{ filter: 'drop-shadow(0 2px 20px rgba(0,0,0,0.85))' }}
                >
                  {content.hero.titleLine2}
                </span>
              </h1>
            </div>

            <div className="w-full max-w-none sm:max-w-[40rem] md:max-w-[44rem] mx-auto translate-y-[5vh] md:translate-y-[6vh] px-0.5 sm:px-3">
              <HeroCollectionPanel>
                <p className="text-[9px] sm:text-xs tracking-[0.28em] uppercase text-jc-gold/90 mb-1 sm:mb-2">
                  {content.hero.eyebrow}
                </p>
                <p className="text-bone/90 font-light text-[11px] sm:text-sm md:text-base leading-[1.35] sm:leading-snug max-w-none md:max-w-[36rem] md:mx-auto">
                  {content.hero.body}
                </p>
                <button
                  type="button"
                  onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })}
                  className="mt-2 sm:mt-3 text-[9px] sm:text-xs tracking-[0.26em] uppercase text-jc-gold/90 hover:text-jc-gold transition"
                >
                  {content.hero.scrollHint}
                </button>
              </HeroCollectionPanel>
            </div>
          </section>


          {content.storyPanels.map((panel, i) => (
            <StoryPanel
              key={`${panel.eyebrow}-${i}`}
              eyebrow={panel.eyebrow}
              title={panel.title}
              body={panel.body}
              side={panel.side}
              metric={panel.metric}
            />
          ))}
        </div>
      </section>

      <Configurator id="configurator" settings={settings} />

      <SpecsAndCTA />
    </main>
  );
}
