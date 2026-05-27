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
import { AR_SESSION_EVENT } from '@/lib/ar';
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
  const [arSessionOpen, setArSessionOpen] = useState(false);
  const showHeroLoader = !heroAssetDone || !sceneReady;

  useEffect(() => {
    const onArSession = (event: Event) => {
      const open = (event as CustomEvent<{ open: boolean }>).detail?.open;
      if (typeof open === 'boolean') setArSessionOpen(open);
    };
    window.addEventListener(AR_SESSION_EVENT, onArSession);
    return () => window.removeEventListener(AR_SESSION_EVENT, onArSession);
  }, []);

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
              heroMounted={!configuratorInView && !arSessionOpen}
              useOptimizedAssets={config.featureFlags?.useOptimizedAssets}
              showPerformanceOverlay={config.features.showPerformanceOverlay}
              onReady={() => setSceneReady(true)}
            />
          </Suspense>
        </div>

        <div className="relative -mt-screen">
          <section className="relative h-screen w-full flex flex-col items-center justify-between px-3 sm:px-5 pt-[max(6.75rem,12vh)] md:pt-[max(6.5rem,11vh)] pb-[max(1.25rem,3vh)] md:pb-[max(0.75rem,1.5vh)] z-10 pointer-events-none">
            <div className="text-center max-w-5xl mx-auto w-full shrink-0 overflow-visible -translate-y-[6vh] sm:-translate-y-[2vh] md:-translate-y-[1vh] lg:-translate-y-[2vh] px-2 pt-1 sm:pt-0">
              <h1
                className="font-display text-6xl md:text-7xl lg:text-8xl xl:text-[5.75rem] leading-[1.08] md:leading-[1.02] md:whitespace-nowrap overflow-visible animate-fade-up"
                style={{ textShadow: '0 2px 28px rgba(0,0,0,0.92), 0 0 48px rgba(0,0,0,0.75)' }}
              >
                <span className="block md:inline text-bone">{content.hero.titleLine1}</span>
                <span className="hidden md:inline">&nbsp;</span>
                <span
                  className="block md:inline gold-text hero-title-accent"
                  style={{ filter: 'drop-shadow(0 2px 20px rgba(0,0,0,0.85))' }}
                >
                  {content.hero.titleLine2}
                </span>
              </h1>
            </div>

            <div className="w-full max-w-none sm:max-w-[40rem] md:max-w-[44rem] mx-auto mb-[2vh] md:mb-[0.75vh] px-1 sm:px-3">
              <HeroCollectionPanel>
                <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-jc-gold/90 mb-2 sm:mb-2.5">
                  {content.hero.eyebrow}
                </p>
                <p className="text-bone/90 font-light text-xs sm:text-sm md:text-base leading-snug max-w-none md:max-w-[36rem] md:mx-auto">
                  {content.hero.body}
                </p>
                <button
                  type="button"
                  onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })}
                  className="mt-3 sm:mt-4 text-[10px] sm:text-xs tracking-[0.26em] uppercase text-jc-gold/90 hover:text-jc-gold transition"
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
