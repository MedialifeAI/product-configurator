import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { disposeObject3D } from '@/lib/disposeScene';
import { hideEmbeddedGlobeInScene } from '@/lib/hideEmbeddedGlobe';
import type { MetalOverride } from '@/lib/siteConfigTypes';

interface MetalPartProps {
  url: string;
  override: MetalOverride;
  visible?: boolean;
  dim?: boolean;
  hideMovementGlobe?: boolean;
}

/** Single metal GLB with runtime PBR tint — avoids loading 3 geometry variants per part. */
export function MetalPart({
  url,
  override,
  visible = true,
  dim = false,
  hideMovementGlobe = false,
}: MetalPartProps) {
  const { scene } = useGLTF(url) as { scene: THREE.Object3D };

  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    if (hideMovementGlobe) hideEmbeddedGlobeInScene(copy);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      const apply = (src: THREE.Material) => {
        const m = src.clone();
        const std = m as THREE.MeshStandardMaterial;
        std.color = new THREE.Color(override.color);
        std.metalness = override.metalness;
        std.roughness = override.roughness;
        if ('ior' in std && override.ior != null) {
          (std as THREE.MeshPhysicalMaterial).ior = override.ior;
        }
        if ('clearcoat' in std && override.clearcoat != null) {
          (std as THREE.MeshPhysicalMaterial).clearcoat = override.clearcoat;
        }
        if (dim) {
          m.transparent = true;
          m.opacity = 0.15;
        }
        m.needsUpdate = true;
        return m;
      };

      const mat = mesh.material;
      mesh.material = Array.isArray(mat) ? mat.map(apply) : apply(mat);
    });
    return copy;
  }, [
    scene,
    override.color,
    override.metalness,
    override.roughness,
    override.ior,
    override.clearcoat,
    dim,
    hideMovementGlobe,
  ]);

  useEffect(() => () => disposeObject3D(cloned), [cloned]);

  if (!visible) return null;
  return <primitive object={cloned} />;
}
