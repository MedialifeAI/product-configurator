'use client';

import { useEffect, useState } from 'react';

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'py-3 backdrop-blur-md bg-ink/60 border-b border-bone/10' : 'py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        <a href="#" className="font-display text-xl md:text-2xl tracking-wider gold-text">
          JACOB &amp; CO
        </a>
        <nav className="hidden md:flex items-center gap-10 text-xs tracking-[0.25em] uppercase text-bone/80">
          <a href="#story"        className="hover:text-jc-gold transition">The Dragon</a>
          <a href="#configurator" className="hover:text-jc-gold transition">Configurator</a>
          <a href="#specs"        className="hover:text-jc-gold transition">Specifications</a>
          <a href="#inquire"      className="hover:text-jc-gold transition">Inquire</a>
        </nav>
        <a
          href="#inquire"
          className="text-xs tracking-[0.25em] uppercase border border-jc-gold/40 text-bone px-5 py-2 rounded-full hover:bg-jc-gold/10 transition"
        >
          Reserve
        </a>
      </div>
    </header>
  );
}
