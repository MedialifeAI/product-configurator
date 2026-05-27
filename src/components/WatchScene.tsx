'use client';

/**
 * WatchScene — the scroll-scrubbed 3D hero.
 *
 * Design notes:
 *   - We load the full watch GLB which carries TWO NLA animations:
 *       * NLA_Exploded_View   → parts fly apart (scrub by scroll)
 *       * NLA_Watch_Movement  → tourbillon / gears (loop forever)
 *   - The hero is pinned: we render <Canvas> at fixed inset and let the page
 *     scroll above it. Scroll position drives the explode mixer time.
 *   - A slow yaw rotation gives the watch life even when scroll is idle.
 *   - DRACOLoader is wired up because all our /models GLBs are Draco-compressed.
 *   - HDR environment + a key & rim light produce a believable luxury render.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SceneSettings } from '@/context/SceneSettings';
import { DEFAULT_SETTINGS } from '@/context/SceneSettings';
import { heroWatchUrl } from '@/lib/resolveModelUrl';
import { DEFAULT_CATALOG, type SiteCatalog } from '@/lib/siteConfigTypes';

useGLTF.setDecoderPath?.('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

interface WatchProps {
  scrollProgress: React.MutableRefObject<number>;
  settings: SceneSettings;
  catalog: SiteCatalog;
  onReady?: () => void;
}

function Watch({ scrollProgress, settings, catalog, onReady }: WatchProps) {
  const group = useRef<THREE.Group>(null);
  const url = heroWatchUrl(catalog, settings.heroModelUrl);
  const gltf = useGLTF(url) as any;
  const { actions, mixer } = useAnimations(gltf.animations, group);

  // Find the two NLA tracks we care about
  const explodeClip = useMemo(
    () => gltf.animations.find((c: THREE.AnimationClip) => c.name.includes('Exploded')) ?? null,
    [gltf.animations]
  );
  const movementClip = useMemo(
    () => gltf.animations.find((c: THREE.AnimationClip) =>
      c.name.includes('Watch_Movement') || c.name.includes('Take 001')
    ) ?? null,
    [gltf.animations]
  );

  // Auto-fit: the strap is fully laid out along Y and dwarfs the case in the
  // bounding box. Scale by the case's horizontal dimensions (max of X,Z) so the
  // watch face/dragon dominate the frame; the strap extends out of view.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    // Fit by the model's horizontal extent. The strap is fully laid out along Y
    // and dwarfs the case, so ignoring Y keeps the case as the centerpiece.
    const horiz = Math.max(size.x, size.z, 0.001);
    // Target ~5% smaller than before so the headline copy has breathing room.
    return { scale: 1.18 / horiz, center };
  }, [gltf.scene]);

  // Start the watch movement loop on mount; pause the explode at frame 0
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
      a.paused = true; // we'll drive time manually
    }
  }, [actions, explodeClip, movementClip]);

  const readyNotified = useRef(false);
  useEffect(() => {
    if (readyNotified.current || !gltf.scene) return;
    readyNotified.current = true;
    onReady?.();
  }, [gltf.scene, onReady]);

  // Each frame: ease the explode action toward the scroll target so micro-scroll
  // jitter doesn't translate 1:1 into frame jumps. Advance the mixer for the
  // looping movement.
  useFrame((state, dt) => {
    const progress = THREE.MathUtils.clamp(
      scrollProgress.current + settings.heroAnimOffset, 0, 1,
    );
    if (explodeClip && actions[explodeClip.name]) {
      const a = actions[explodeClip.name]!;
      const target = explodeClip.duration * progress;
      const k = 1 - Math.exp(-10 * dt); // ~100ms time-constant; framerate-independent
      a.time = THREE.MathUtils.lerp(a.time, target, k);
    }
    mixer.update(dt);

    if (group.current) {
      // Gentle showcase sway around the dial-facing pose — calms to zero as the
      // viewer approaches the configurator so handoff feels deliberate.
      const calm = 1 - THREE.MathUtils.smoothstep(progress, 0.6, 1.0);
      group.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.35) * settings.heroSway * calm;
    }
  });

  // Outer group rotates around the case center (the strap is symmetric on Y so
  // it stays visually vertical under Y-axis spin). Inner group applies the
  // bbox-derived scale and re-centers the case at world origin.
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
      {/* Soft fill so blacks read but don't lift the case off the page */}
      <ambientLight intensity={settings.heroAmbient} />

      {/* Key from upper front-left — gentler so the rose gold doesn't blow out */}
      <directionalLight
        position={[3, 4, 5]}
        intensity={settings.heroKey}
        color="#fff5e0"
        castShadow={false}
      />

      {/* Warm rim from behind to catch the gold */}
      <directionalLight
        position={[-4, 2, -3]}
        intensity={settings.heroRim}
        color="#b4904e"
      />

      {/* Cool kicker so the white-gold variants don't go flat */}
      <directionalLight
        position={[0, -2, 3]}
        intensity={settings.heroKicker}
        color="#6a8db3"
      />
    </>
  );
}

/** Reactively bind toneMappingExposure to the live settings value. */
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
  onReady?: () => void;
}

export default function WatchScene({
  scrollProgress,
  className,
  settings = DEFAULT_SETTINGS,
  catalog,
  onReady,
}: WatchSceneProps) {
  const cat = catalog ?? DEFAULT_CATALOG;
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.4, 4.2], fov: 32, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        // Transparent canvas — the page background shows through
        style={{ background: 'transparent' }}
      >
        <ToneExposure value={settings.heroExposure} />
        <SceneLights settings={settings} />
        {/* Studio HDR — drives PBR reflections for the metallic case + dragon.
            Dialed down so the headline copy reads cleanly over the watch. */}
        <Environment preset="studio" environmentIntensity={settings.heroEnv} />
        <Watch scrollProgress={scrollProgress} settings={settings} catalog={cat} onReady={onReady} />
        {/* Subtle product-photography shadow to ground the watch */}
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.45}
          scale={5}
          blur={2.6}
          far={2}
        />
      </Canvas>
    </div>
  );
}

