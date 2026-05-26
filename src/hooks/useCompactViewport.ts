'use client';

import { useEffect, useState } from 'react';

/** True on phones / narrow tablets where configurator should stack and shrink. */
export function useCompactViewport(breakpointPx = 1024) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpointPx]);

  return compact;
}
