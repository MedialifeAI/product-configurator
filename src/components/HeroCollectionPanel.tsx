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

/** Hero glass card — fades out on scroll; matches StoryPanel glass styling. */
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
      className="relative w-full glass-gold-edge rounded-2xl p-8 md:p-10 flex flex-col gap-4 items-center text-center pointer-events-auto"
    >
      {children}
    </motion.div>
  );
}
