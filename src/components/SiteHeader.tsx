'use client';

import { useEffect, useState } from 'react';
import { useSiteConfig } from '@/context/SiteConfigProvider';

export default function SiteHeader() {
  const { config } = useSiteConfig();
  const { header } = config.content;
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
        scrolled
          ? 'py-2 md:py-3 backdrop-blur-md bg-ink/60 border-b border-bone/10'
          : 'py-4 md:py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-12 flex items-center">
        <a
          href="#"
          className="font-display text-[26px] md:text-[30px] leading-none tracking-wider text-bone"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.85)' }}
        >
          {header.brand}
        </a>
      </div>
    </header>
  );
}
