'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

interface StoryPanelProps {
  eyebrow: string;
  title: string;
  body: string;
  /** "left" or "right" — which side of the watch the panel sits on */
  side?: 'left' | 'right';
  /** Optional callout metric — e.g. "2,294 hand-engraved scales" */
  metric?: { value: string; label: string };
}

/**
 * StoryPanel — a glassmorphic overlay that fades in/out as it scrolls past
 * its mid-viewport position. Sits over the pinned 3D scene.
 */
export default function StoryPanel({
  eyebrow,
  title,
  body,
  side = 'right',
  metric,
}: StoryPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Fade in 0.15..0.35, fade out 0.65..0.85
  const opacity = useTransform(scrollYProgress, [0.15, 0.35, 0.65, 0.85], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0.15, 0.35, 0.65, 0.85], [40, 0, 0, -40]);

  const align = side === 'left' ? 'items-start text-left' : 'items-end text-right ml-auto';
  const sideStyle = side === 'left' ? 'left-[6vw]' : 'right-[6vw]';

  return (
    <section ref={ref} className="relative h-[120vh] w-full">
      <motion.div
        style={{ opacity, y }}
        className={`sticky top-[20vh] max-w-md glass-gold-edge rounded-2xl p-8 md:p-10 ${sideStyle} ${align} flex flex-col gap-4`}
      >
        <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80 font-sans">
          {eyebrow}
        </span>
        <h2 className="font-display text-4xl md:text-5xl leading-[1.05] text-bone">
          {title}
        </h2>
        <p className="text-bone/70 text-base md:text-lg leading-relaxed font-light">
          {body}
        </p>
        {metric && (
          <div className="mt-4 pt-4 border-t border-jc-gold/20">
            <div className="font-display text-3xl gold-text">{metric.value}</div>
            <div className="text-xs uppercase tracking-[0.25em] text-bone/50 mt-1">
              {metric.label}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
