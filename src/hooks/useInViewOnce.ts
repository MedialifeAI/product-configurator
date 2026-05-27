import { useEffect, useState, type RefObject } from 'react';

/** Flip to true the first time `ref` intersects the viewport (stays true). */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px', ...options },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, ref, options?.root, options?.rootMargin, options?.threshold]);

  return inView;
}
