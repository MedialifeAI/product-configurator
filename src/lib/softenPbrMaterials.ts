import * as THREE from 'three';

/** Tame embedded GLB PBR so HDR/env maps do not blow out polished metal (hero full watch). */
export function softenPbrMaterials(root: THREE.Object3D): void {
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const soften = (material: THREE.Material) => {
      const std = material as THREE.MeshStandardMaterial;
      if (!('metalness' in std)) return;

      std.metalness = Math.min(std.metalness, 0.9);
      std.roughness = Math.max(std.roughness, 0.26);
      std.envMapIntensity = Math.min(std.envMapIntensity ?? 1, 0.55);

      if (std.emissive) {
        std.emissive.setHex(0x000000);
        std.emissiveIntensity = 0;
      }

      std.needsUpdate = true;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(soften);
    } else {
      soften(mesh.material);
    }
  });
}
