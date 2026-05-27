import * as THREE from 'three';

const TEXTURE_PROPS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
  'envMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'specularColorMap', 'specularIntensityMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap',
] as const;

function disposeMaterial(mat: THREE.Material) {
  for (const key of TEXTURE_PROPS) {
    const tex = (mat as unknown as Record<string, unknown>)[key];
    if (tex instanceof THREE.Texture) tex.dispose();
  }
  mat.dispose();
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}
