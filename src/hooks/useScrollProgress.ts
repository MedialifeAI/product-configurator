'use client';

import { useEffect, useRef } from 'react';

/**
 * useScrollProgress
 * Returns a stable ref whose .current is 0..1 representing how far through
 * `targetRef` we've scrolled. The element is treated as a "scrubbable strip":
 *   0 = top of element enters viewport bottom
 *   1 = bottom of element leaves viewport top
 *
 * The ref is updated on rAF — no React state, no re-renders. Pair with
 * useFrame inside R3F to read the latest value cheaply.
 */
export function useScrollProgress(targetRef: React.RefObject<HTMLElement>) {
  const progress = useRef(0);

  useEffect(() => {
    let raf = 0;
    let mounted = true;

    function tick() {
      if (!mounted) return;
      const el = targetRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // The strip is sticky-pinned for its height. Progress is 0 when the
        // strip's top is at (or below) the viewport top — i.e. the hero is
        // showing assembled — and 1 when the strip's bottom has reached the
        // viewport bottom.
        const scrolled = -rect.top;
        const total = Math.max(el.offsetHeight - vh, 1);
        const p = Math.max(0, Math.min(1, scrolled / total));
        progress.current = p;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(raf); };
  }, [targetRef]);

  return progress;
}
