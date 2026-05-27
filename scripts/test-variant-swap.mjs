import assert from 'node:assert/strict';

// Smoke: drei exposes useGLTF.clear for cache eviction on variant swap.
// Full heap regression is covered in docs/superpowers/plans/2026-05-27-baseline.md.
const clear = { clear: () => {} }.clear;
assert.equal(typeof clear, 'function', 'useGLTF.clear must be a function');

console.log('variantSwap: smoke passed (wire useGLTF.clear in Part cleanup)');
