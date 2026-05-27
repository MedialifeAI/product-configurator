'use client';

import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'framer-motion';
import { useRef, type ReactNode } from 'react';

interface HeroCollectionPanelProps {
  children: ReactNode;
}

/** Hero glass card — fades out immediately on scroll so the 3D watch stays visible. */
export default function HeroCollectionPanel({ children }: HeroCollectionPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();

  const opacity = useTransform(scrollY, [0, 64], [1, 0]);

  useMotionValueEvent(scrollY, 'change', y => {
    const panel = panelRef.current;
    if (panel) {
      panel.style.pointerEvents = y > 12 ? 'none' : 'auto';
    }
  });

  return (
    <motion.div
      ref={panelRef}
      style={{ opacity }}
      className="relative w-full glass-gold-edge rounded-lg sm:rounded-xl md:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3.5 md:px-7 md:py-5 pointer-events-auto text-center"
    >
      {children}
    </motion.div>
  );
}
