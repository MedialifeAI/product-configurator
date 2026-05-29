'use client';

/**
 * ModelSlotPreview — inline per-slot asset preview for the admin Models tab.
 *
 * GLB slots get a lazy 3D viewer: the WebGL <Canvas> is only mounted while the
 * slot is expanded, and at most ONE viewer is open at a time (enforced via
 * ModelPreviewProvider). This keeps the admin well under the browser's per-page
 * WebGL context limit even though there are ~20 model slots on screen.
 *
 * Image slots render a cheap inline <img> thumbnail (no WebGL, always shown).
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import {
  Component,
  Suspense,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Object3D } from 'three';

useGLTF.setDecoderPath?.('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

// ── Single-open coordination ─────────────────────────────────
const ModelPreviewContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>({ openId: null, setOpenId: () => {} });

export function ModelPreviewProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ModelPreviewContext.Provider value={{ openId, setOpenId }}>
      {children}
    </ModelPreviewContext.Provider>
  );
}

// ── 3D model loading ─────────────────────────────────────────
function Model({ url }: { url: string }) {
  // useGLTF caches by URL globally. A Three.js object can have only one parent,
  // so rendering gltf.scene directly would yank the node out of the live hero
  // preview when both reference the same builtin URL. Clone for isolated display
  // (geometries/materials are shared, which is fine) and leave the cache intact.
  const gltf = useGLTF(url) as { scene: Object3D };
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} />;
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ModelCanvas({ url, onError }: { url: string; onError: () => void }) {
  return (
    <Canvas
      camera={{ fov: 40, position: [0, 0, 4] }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      className="!absolute inset-0"
    >
      <PreviewErrorBoundary onError={onError}>
        <Suspense fallback={null}>
          <Stage adjustCamera={0.9} intensity={0.5} environment="studio" shadows={false}>
            <Model url={url} />
          </Stage>
        </Suspense>
      </PreviewErrorBoundary>
      <OrbitControls makeDefault enablePan={false} minDistance={1.5} maxDistance={12} />
    </Canvas>
  );
}

// ── Public component ─────────────────────────────────────────
export default function ModelSlotPreview({
  id,
  url,
  kind,
  sourceLabel,
}: {
  /** Stable unique id for single-open coordination (use the upload slot). */
  id: string;
  /** Resolved, fetchable URL of the current source — or null if not set. */
  url: string | null;
  kind: 'model' | 'image';
  /** Short caption shown under the viewer (e.g. "builtin", "upload"). */
  sourceLabel?: string;
}) {
  const { openId, setOpenId } = useContext(ModelPreviewContext);
  const expanded = openId === id;
  const [loadError, setLoadError] = useState(false);

  // Reset error state whenever the URL changes (e.g. a fresh upload).
  useEffect(() => setLoadError(false), [url]);

  if (kind === 'image') {
    if (!url) return null;
    return (
      <div className="mt-2 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="h-12 w-12 rounded-lg object-cover border border-bone/12 bg-ink/40"
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        {sourceLabel && (
          <span className="text-[9px] uppercase tracking-wider text-bone/35">{sourceLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpenId(expanded ? null : id)}
        disabled={!url}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-wider transition ${
          expanded
            ? 'border-jc-gold/45 text-jc-gold bg-jc-gold/8'
            : 'border-bone/12 text-bone/45 hover:border-bone/25 disabled:opacity-40 disabled:hover:border-bone/12'
        }`}
      >
        <span>{expanded ? 'Hide 3D preview' : 'Preview 3D'}</span>
        <span className="text-[9px]">{expanded ? '▲' : '▾'}</span>
      </button>
      {expanded && (
        <div className="relative mt-2 h-56 overflow-hidden rounded-lg border border-bone/12 bg-[#0a0a0c]">
          {loadError ? (
            <div className="absolute inset-0 grid place-items-center px-4 text-center">
              <span className="text-[10px] text-amber-300/80">
                Couldn’t load this model. Upload a file or check the path.
              </span>
            </div>
          ) : (
            url && <ModelCanvas url={url} onError={() => setLoadError(true)} />
          )}
          <span className="pointer-events-none absolute bottom-1.5 left-2 text-[8px] uppercase tracking-wider text-bone/30">
            drag to orbit · scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}
