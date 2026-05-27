'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/** Pauses the scene when Safari drops the WebGL context under memory pressure. */
export function WebGlContextListener({ onLost }: { onLost: () => void }) {
  const gl = useThree(s => s.gl);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    gl.domElement.addEventListener('webglcontextlost', handler);
    return () => gl.domElement.removeEventListener('webglcontextlost', handler);
  }, [gl, onLost]);

  return null;
}
