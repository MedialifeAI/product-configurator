'use client';

/**
 * Home page — the scroll-driven landing experience.
 *
 * Layout:
 *   <SiteHeader>     (fixed)
 *   <PinnedScene>    (fixed 100vh canvas — the watch)
 *   <ScrollNarrative>
 *      Hero panel      → assembled watch
 *      Dragon panel    → dragon lifts off
 *      Movement panel  → movement separates
 *      Globe/Dial panel → globe + dial separate
 *      (end of explode — full disassembly)
 *   <Configurator>    (its own canvas — assembled, interactive)
 *   <SpecsAndCTA>
 *
 * The pinned canvas reads scroll progress through a ref that's updated in
 * useScrollProgress (rAF, no React state churn).
 */

import dynamic from 'next/dynamic';
import { Suspense, useRef } from 'react';
import SiteHeader from '@/components/SiteHeader';
import StoryPanel from '@/components/StoryPanel';
import SpecsAndCTA from '@/components/SpecsAndCTA';
import { useScrollProgress } from '@/hooks/useScrollProgress';
import { SceneSettingsProvider, useSceneSettings } from '@/context/SceneSettings';

// Heavy 3D components — client-only, with their own GLB loaders
const WatchScene    = dynamic(() => import('@/components/WatchScene'),    { ssr: false });
const Configurator  = dynamic(() => import('@/components/Configurator'),  { ssr: false });
const DebugSettings = dynamic(() => import('@/components/DebugSettings'), { ssr: false });

export default function Home() {
  return (
    <SceneSettingsProvider>
      <HomeContent />
      <DebugSettings />
    </SceneSettingsProvider>
  );
}

function HomeContent() {
  const scrollStripRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useScrollProgress(scrollStripRef);
  const { settings } = useSceneSettings();

  return (
    <main className="relative bg-ink text-bone">
      <SiteHeader />

      {/*
        The scroll strip is a long vertical region. As the user scrolls
        through it, the pinned canvas behind plays the explode animation in
        sync. Story panels are stacked inside as scrollable sections.
      */}
      <section ref={scrollStripRef} id="story" className="relative">
        {/* Pinned 3D scene — stays put while sections scroll over it */}
        <div className="sticky top-0 h-screen w-full canvas-hero">
          <Suspense fallback={<SceneLoader />}>
            <WatchScene scrollProgress={scrollProgress} settings={settings} />
          </Suspense>
        </div>

        {/*
          Story sections — each occupies its own scroll window above the
          pinned canvas. Together they take ~600vh so the explode has room
          to scrub meaningfully.

          The very first section (Hero) overlaps the assembled state. The
          last sections trigger at the end of the explode where everything is
          separated. As the user moves between them, panels fade in/out and
          parts fly out behind them.
        */}
        <div className="relative -mt-screen">
          {/* Hero — first frame */}
          <section className="relative h-screen w-full flex items-center justify-center px-6 z-10 pointer-events-none">
            {/* Radial vignette pushes the watch back behind the headline so the
                gold and serifs read without competing with the case highlights. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 55% 45% at center, rgba(6,6,10,0.7) 0%, rgba(6,6,10,0.35) 45%, transparent 75%)',
              }}
            />
            <div className="relative text-center max-w-3xl">
              <p className="text-xs tracking-[0.4em] uppercase text-jc-gold/90 animate-fade-in">
                The Astronomia Collection
              </p>
              <h1
                className="font-display text-6xl md:text-8xl lg:text-9xl mt-6 leading-[0.95] animate-fade-up"
                style={{ textShadow: '0 2px 32px rgba(0,0,0,0.85)' }}
              >
                <span className="block text-bone">Astronomia</span>
                <span className="block gold-text">Dragon</span>
              </h1>
              <p
                className="mt-8 text-bone/80 max-w-xl mx-auto font-light text-base md:text-lg animate-fade-up"
                style={{ animationDelay: '0.2s', textShadow: '0 1px 16px rgba(0,0,0,0.85)' }}
              >
                A hand-engraved 18K rose-gold dragon orbits a triple-axis gravitational tourbillon — for eighteen
                people who will ever own one.
              </p>
              <div
                className="mt-16 text-xs tracking-[0.3em] uppercase text-bone/50 animate-fade-up"
                style={{ animationDelay: '0.6s' }}
              >
                Scroll to reveal ↓
              </div>
            </div>
          </section>

          {/* Storytelling panels — each takes ~120vh of scroll so the explode
              has time to scrub between them. */}
          <StoryPanel
            eyebrow="The Dragon"
            title="2,294 scales. One pair of hands."
            body="The dragon is cast in three solid parts of 18K rose gold, then engraved, polished and hand-painted by a single master artisan over several weeks. Each scale is articulated individually."
            side="right"
            metric={{ value: '2,294', label: 'Hand-engraved scales' }}
          />

          <StoryPanel
            eyebrow="The Movement"
            title="JCAM10. Gravity in three dimensions."
            body="A gravitational triple-axis tourbillon rotates on three independent axes — every 60 seconds, every 5 minutes, every 20 minutes — perpetually defying the pull of gravity on the escapement."
            side="left"
            metric={{ value: '60 h', label: 'Power reserve' }}
          />

          <StoryPanel
            eyebrow="The Cosmos in Miniature"
            title="A globe of magnesium-lacquered earth."
            body="At the heart of the dial, a faceted spherical diamond and a hand-lacquered terrestrial globe orbit the central differential, completing one revolution every minute."
            side="right"
            metric={{ value: '1 min', label: 'Globe rotation' }}
          />

          <StoryPanel
            eyebrow="The Architecture"
            title="Six sapphire crystals. No hidden faces."
            body="The cage-like 47mm rose-gold case carries six pieces of sapphire — top, bottom, caseband, and between every lug — so the mechanism is visible from any angle."
            side="left"
            metric={{ value: '47 mm', label: '18K rose-gold case' }}
          />
        </div>
      </section>

      {/* Configurator — its own canvas, assembled watch, interactive */}
      <Configurator id="configurator" settings={settings} />

      {/* Specs + CTA */}
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
