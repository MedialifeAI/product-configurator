'use client';

/**
 * WatchScene — the scroll-scrubbed 3D hero.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, useGLTF, useAnimations } from '@react-three/drei';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { WebGlContextBanner } from '@/components/WebGlContextBanner';
import { WebGlContextListener } from '@/components/WebGlContextListener';
import { getDeviceTier } from '@/lib/deviceTier';
import { resolveRenderQuality } from '@/lib/renderQuality';
import { heroWatchUrl } from '@/lib/resolveModelUrl';
import { softenPbrMaterials } from '@/lib/softenPbrMaterials';
import { DEFAULT_CATALOG, type SiteCatalog } from '@/lib/siteConfigTypes';
import { PerformanceOverlayPanel, PerformanceSampler } from '@/components/PerformanceOverlay';

useGLTF.setDecoderPath?.('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

interface WatchProps {
  scrollProgress: React.MutableRefObject<number>;
  settings: SceneSettings;
  catalog: SiteCatalog;
  useOptimizedAssets?: boolean;
  onReady?: () => void;
}

function Watch({ scrollProgress, settings, catalog, useOptimizedAssets, onReady }: WatchProps) {
  const group = useRef<THREE.Group>(null);
  const url = heroWatchUrl(catalog, settings.heroModelUrl, { useOptimizedAssets });
  const gltf = useGLTF(url) as any;
  const { actions, mixer } = useAnimations(gltf.animations, group);

  useEffect(() => () => { useGLTF.clear(url); }, [url]);

  useEffect(() => {
    softenPbrMaterials(gltf.scene);
  }, [gltf.scene]);

  const explodeClip = useMemo(
    () => gltf.animations.find((c: THREE.AnimationClip) => c.name.includes('Exploded')) ?? null,
    [gltf.animations],
  );
  const movementClip = useMemo(
    () =>
      gltf.animations.find(
        (c: THREE.AnimationClip) =>
          c.name.includes('Watch_Movement') || c.name.includes('Take 001'),
      ) ?? null,
    [gltf.animations],
  );

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const horiz = Math.max(size.x, size.z, 0.001);
    return { scale: 1.18 / horiz, center };
  }, [gltf.scene]);

  useEffect(() => {
    if (movementClip && actions[movementClip.name]) {
      const a = actions[movementClip.name]!;
      a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    }
    if (explodeClip && actions[explodeClip.name]) {
      const a = actions[explodeClip.name]!;
      a.reset().setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      a.paused = true;
    }
  }, [actions, explodeClip, movementClip]);

  const readyNotified = useRef(false);
  useEffect(() => {
    if (readyNotified.current || !gltf.scene) return;
    readyNotified.current = true;
    onReady?.();
  }, [gltf.scene, onReady]);

  useFrame((state, dt) => {
    const progress = THREE.MathUtils.clamp(
      scrollProgress.current + settings.heroAnimOffset,
      0,
      1,
    );
    if (explodeClip && actions[explodeClip.name]) {
      const a = actions[explodeClip.name]!;
      const target = explodeClip.duration * progress;
      const k = 1 - Math.exp(-10 * dt);
      a.time = THREE.MathUtils.lerp(a.time, target, k);
    }
    mixer.update(dt);

    if (group.current) {
      const calm = 1 - THREE.MathUtils.smoothstep(progress, 0.6, 1.0);
      group.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.35) * settings.heroSway * calm;
    }
  });

  const finalScale = fit.scale * settings.heroScale;
  return (
    <group ref={group} position={[0, settings.heroY, 0]}>
      <group
        position={[
          -fit.center.x * finalScale,
          -fit.center.y * finalScale,
          -fit.center.z * finalScale,
        ]}
        scale={finalScale}
      >
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

function SceneLights({ settings }: { settings: SceneSettings }) {
  return (
    <>
      <ambientLight intensity={settings.heroAmbient} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={settings.heroKey} color="#fff5e0" />
      <directionalLight position={[-3, 1.5, -2.5]} intensity={settings.heroRim} color="#b4904e" />
      <directionalLight position={[0, -2, 3]} intensity={settings.heroKicker} color="#6a8db3" />
    </>
  );
}

function ToneExposure({ value }: { value: number }) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

interface WatchSceneProps {
  scrollProgress: React.MutableRefObject<number>;
  className?: string;
  settings?: SceneSettings;
  catalog?: SiteCatalog;
  heroMounted?: boolean;
  useOptimizedAssets?: boolean;
  showPerformanceOverlay?: boolean;
  onReady?: () => void;
}

export default function WatchScene({
  scrollProgress,
  className,
  settings = DEFAULT_SETTINGS,
  catalog,
  heroMounted = true,
  useOptimizedAssets,
  showPerformanceOverlay = false,
  onReady,
}: WatchSceneProps) {
  const cat = catalog ?? DEFAULT_CATALOG;
  const tier = useMemo(() => getDeviceTier(), []);
  const perfSourceId = useId();
  const quality = resolveRenderQuality(
    settings.heroModelQuality ?? 'auto',
    tier,
    useOptimizedAssets,
  );
  const isLowTier = tier === 'low';
  const [contextLost, setContextLost] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);

  const handleContextLost = useCallback(() => setContextLost(true), []);
  const reloadCanvas = useCallback(() => {
    setContextLost(false);
    setCanvasEpoch(n => n + 1);
  }, []);

  if (!heroMounted) {
    return <div className={className} style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <div className={`${className ?? ''} relative`} style={{ width: '100%', height: '100%' }}>
      {!contextLost && (
        <Canvas
          key={canvasEpoch}
          camera={{ position: [0, 0.4, 4.2], fov: 32, near: 0.1, far: 100 }}
          dpr={quality.dpr}
          gl={{
            antialias: quality.antialias,
            alpha: true,
            powerPreference: isLowTier ? 'low-power' : 'high-performance',
          }}
          style={{ background: 'transparent' }}
        >
          <WebGlContextListener onLost={handleContextLost} />
          <PerformanceSampler enabled={showPerformanceOverlay} sourceId={perfSourceId} />
          <ToneExposure value={settings.heroExposure} />
          <SceneLights settings={settings} />
          <Environment preset="studio" environmentIntensity={settings.heroEnv} />
          <Watch
            scrollProgress={scrollProgress}
            settings={settings}
            catalog={cat}
            useOptimizedAssets={quality.useOptimizedAssets}
            onReady={onReady}
          />
          {!isLowTier && (
            <ContactShadows
              position={[0, -1.2, 0]}
              opacity={0.24}
              scale={5}
              blur={3.2}
              far={2}
            />
          )}
        </Canvas>
      )}
      <PerformanceOverlayPanel enabled={showPerformanceOverlay} sourceId={perfSourceId} />
      <WebGlContextBanner visible={contextLost} onReload={reloadCanvas} />
    </div>
  );
}
