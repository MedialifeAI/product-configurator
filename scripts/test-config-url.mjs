import assert from 'node:assert/strict';

const DRAGONS = new Set(['v1', 'v2', 'v3', 'v4']);
const METALS = new Set(['rose_gold', 'white_gold', 'yellow_gold']);

function buildConfigShareUrl(baseHref, state, hash = '#configurator') {
  const u = new URL(baseHref);
  const params = new URLSearchParams(u.search);
  params.delete('ar');
  params.set('dragon', state.dragon);
  params.set('metal', state.metal);
  u.search = params.toString() ? `?${params.toString()}` : '';
  u.hash = hash;
  return u.toString();
}

const shared = buildConfigShareUrl('https://example.com/page', {
  dragon: 'v2',
  metal: 'white_gold',
});
assert.ok(shared.includes('dragon=v2'));
assert.ok(shared.includes('metal=white_gold'));
assert.ok(shared.includes('#configurator'));
assert.ok(!shared.includes('ar=1'));

console.log('configUrl tests passed');
