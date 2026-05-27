'use client';

import dynamic from 'next/dynamic';
import { Suspense, useRef, useState } from 'react';
import HeroSceneLoader from '@/components/HeroSceneLoader';
import SiteHeader from '@/components/SiteHeader';
import StoryPanel from '@/components/StoryPanel';
import SpecsAndCTA from '@/components/SpecsAndCTA';
import { useAssetLoadProgress } from '@/hooks/useAssetLoadProgress';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { scrollToConfigurator } from '@/lib/ar';
import { heroWatchUrl } from '@/lib/resolveModelUrl';
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
  const heroModelUrl = heroWatchUrl(config.catalog, settings.heroModelUrl);
  const { progress: heroProgress, done: heroAssetDone } = useAssetLoadProgress(heroModelUrl);
  const [sceneReady, setSceneReady] = useState(false);
  const showHeroLoader = !heroAssetDone || !sceneReady;

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
              onReady={() => setSceneReady(true)}
            />
          </Suspense>
        </div>

        <div className="relative -mt-screen">
          <section className="relative h-screen w-full flex flex-col items-center justify-between px-6 pt-[max(6.5rem,11vh)] pb-[max(3.5rem,8vh)] z-10 pointer-events-none">
            <div className="text-center max-w-3xl mx-auto w-full -translate-y-[4vh] sm:-translate-y-[5vh] md:-translate-y-[12vh] lg:-translate-y-[14vh]">
              <h1
                className="font-display text-6xl md:text-8xl lg:text-9xl leading-[0.95] animate-fade-up"
                style={{ textShadow: '0 2px 28px rgba(0,0,0,0.92), 0 0 48px rgba(0,0,0,0.75)' }}
              >
                <span className="block text-bone">{content.hero.titleLine1}</span>
                <span
                  className="block gold-text"
                  style={{ filter: 'drop-shadow(0 2px 20px rgba(0,0,0,0.85))' }}
                >
                  {content.hero.titleLine2}
                </span>
              </h1>
            </div>

            <div className="text-center max-w-3xl mx-auto w-full translate-y-[8vh] md:translate-y-[10vh]">
              <p
                className="text-xs tracking-[0.4em] uppercase text-jc-gold/90 animate-fade-in mb-4 md:mb-5"
                style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.65)' }}
              >
                {content.hero.eyebrow}
              </p>
              <p
                className="text-bone/90 max-w-xl mx-auto font-light text-base md:text-lg leading-relaxed animate-fade-up"
                style={{
                  animationDelay: '0.2s',
                  textShadow: '0 1px 14px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.6)',
                }}
              >
                {content.hero.body}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => scrollToConfigurator()}
                  className="text-xs tracking-[0.28em] uppercase text-jc-gold/90 hover:text-jc-gold transition animate-fade-up"
                  style={{ animationDelay: '0.5s' }}
                >
                  {content.hero.exploreConfiguratorLabel}
                </button>
                <button
                  type="button"
                  onClick={() => window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' })}
                  className="text-xs tracking-[0.3em] uppercase text-bone/55 hover:text-bone/80 transition animate-fade-up"
                  style={{ animationDelay: '0.6s' }}
                >
                  {content.hero.scrollHint}
                </button>
              </div>
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
