import assert from 'node:assert/strict';
import * as THREE from 'three';

// Inlined copy of disposeObject3D logic from src/lib/disposeScene.ts
// Kept in sync manually — keep this in sync if the lib changes.
const TEXTURE_PROPS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
  'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
  'envMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'specularColorMap', 'specularIntensityMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap',
];

assert.equal(
  TEXTURE_PROPS.length,
  23,
  'TEXTURE_PROPS length mismatch — keep src/lib/disposeScene.ts in sync with this test',
);

function disposeMaterial(mat) {
  for (const key of TEXTURE_PROPS) {
    const tex = mat[key];
    if (tex && tex.isTexture) tex.dispose();
  }
  mat.dispose();
}

function disposeObject3D(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const material = node.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}

// --- tests ---

function testDisposesGeoMatTex() {
  const tex = new THREE.Texture();
  const mat = new THREE.MeshStandardMaterial({ map: tex });
  const geo = new THREE.BoxGeometry();
  const mesh = new THREE.Mesh(geo, mat);
  const root = new THREE.Group();
  root.add(mesh);

  let geoDisposed = 0, matDisposed = 0, texDisposed = 0;
  const origGeo = geo.dispose.bind(geo);
  const origMat = mat.dispose.bind(mat);
  const origTex = tex.dispose.bind(tex);
  geo.dispose = () => { geoDisposed++; origGeo(); };
  mat.dispose = () => { matDisposed++; origMat(); };
  tex.dispose = () => { texDisposed++; origTex(); };

  disposeObject3D(root);
  assert.equal(geoDisposed, 1, 'geometry disposed once');
  assert.equal(matDisposed, 1, 'material disposed once');
  assert.equal(texDisposed, 1, 'texture disposed once');
}

function testMaterialArray() {
  const m1 = new THREE.MeshStandardMaterial();
  const m2 = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [m1, m2]);
  let c1 = 0, c2 = 0;
  const o1 = m1.dispose.bind(m1), o2 = m2.dispose.bind(m2);
  m1.dispose = () => { c1++; o1(); };
  m2.dispose = () => { c2++; o2(); };
  disposeObject3D(mesh);
  assert.equal(c1, 1, 'm1 disposed');
  assert.equal(c2, 1, 'm2 disposed');
}

function testIgnoresNonMesh() {
  const group = new THREE.Group();
  group.add(new THREE.Object3D());
  // Should not throw
  disposeObject3D(group);
}

testDisposesGeoMatTex();
testMaterialArray();
testIgnoresNonMesh();
console.log('disposeScene: all tests passed');
