'use client';

import { useEffect, useState } from 'react';

/** Tracks download progress for a single static asset (e.g. hero GLB). */
export function useAssetLoadProgress(url: string | null) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(!url);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setProgress(0);
      setDone(true);
      setError(false);
      return;
    }

    let cancelled = false;
    setProgress(0);
    setDone(false);
    setError(false);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = event => {
      if (cancelled || !event.lengthComputable) return;
      setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (cancelled) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        setDone(true);
      } else {
        setError(true);
        setDone(true);
      }
    };

    xhr.onerror = () => {
      if (cancelled) return;
      setError(true);
      setDone(true);
    };

    xhr.send();

    return () => {
      cancelled = true;
      xhr.abort();
    };
  }, [url]);

  return { progress, done, error };
}
