'use client';

import dynamic from 'next/dynamic';
import { Suspense, useRef } from 'react';
import SiteHeader from '@/components/SiteHeader';
import StoryPanel from '@/components/StoryPanel';
import SpecsAndCTA from '@/components/SpecsAndCTA';
import { useScrollProgress } from '@/hooks/useScrollProgress';
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

  return (
    <main className="relative bg-ink text-bone">
      <SiteHeader />

      <section ref={scrollStripRef} id="story" className="relative">
        <div className="sticky top-0 h-screen w-full canvas-hero">
          <Suspense fallback={<SceneLoader />}>
            <WatchScene scrollProgress={scrollProgress} settings={settings} catalog={config.catalog} />
          </Suspense>
        </div>

        <div className="relative -mt-screen">
          <section className="relative h-screen w-full flex items-center justify-center px-6 z-10 pointer-events-none">
            <div className="relative text-center max-w-3xl mx-auto">
              <p
                className="text-xs tracking-[0.4em] uppercase text-jc-gold/90 animate-fade-in"
                style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.65)' }}
              >
                {content.hero.eyebrow}
              </p>
              <h1
                className="font-display text-6xl md:text-8xl lg:text-9xl mt-6 leading-[0.95] animate-fade-up"
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
              <p
                className="mt-8 text-bone/90 max-w-xl mx-auto font-light text-base md:text-lg leading-relaxed animate-fade-up"
                style={{
                  animationDelay: '0.2s',
                  textShadow: '0 1px 14px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.6)',
                }}
              >
                {content.hero.body}
              </p>
              <div
                className="mt-14 text-xs tracking-[0.3em] uppercase text-bone/55 animate-fade-up"
                style={{ animationDelay: '0.6s' }}
              >
                {content.hero.scrollHint}
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

function SceneLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-2 border-jc-gold/30 border-t-jc-gold rounded-full animate-spin" />
        <div className="mt-6 text-xs tracking-[0.3em] uppercase text-bone/60">Loading the dragon…</div>
      </div>
    </div>
  );
}
