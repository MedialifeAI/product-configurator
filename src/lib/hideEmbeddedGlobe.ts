import type * as THREE from 'three';

/** Blender object names for the terrestrial globe rig (loaded separately as parts/globe_*.glb). */
const GLOBE_ROOT_NAMES = new Set(['globe', 'globe_earth']);

function isEmbeddedGlobeRoot(name: string): boolean {
  if (GLOBE_ROOT_NAMES.has(name)) return true;
  const lower = name.toLowerCase();
  return lower === 'globe' || lower === 'globe_earth';
}

function isDescendantOfEmbeddedGlobe(obj: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = obj;
  while (node) {
    if (isEmbeddedGlobeRoot(node.name)) return true;
    node = node.parent;
  }
  return false;
}

/**
 * Movement GLBs may still include the globe mesh until re-exported without it.
 * Hide those nodes so only the separate globe part (with optional metal lock) is visible.
 */
export function hideEmbeddedGlobeInScene(root: THREE.Object3D): void {
  root.traverse(obj => {
    if (isDescendantOfEmbeddedGlobe(obj)) {
      obj.visible = false;
    }
  });
}
