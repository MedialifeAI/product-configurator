import assert from 'node:assert/strict';

function getDeviceTier(nav) {
  const ua = nav.userAgent ?? '';
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Mac/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const mem = nav.deviceMemory ?? 4;
  const cores = nav.hardwareConcurrency ?? 4;
  if (isIOS) return 'low';
  if (mem <= 4 || cores <= 4) return 'mid';
  return 'high';
}

assert.equal(
  getDeviceTier({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }),
  'low',
);
assert.equal(
  getDeviceTier({ userAgent: 'iPad', deviceMemory: 4 }),
  'low',
);
assert.equal(
  getDeviceTier({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0)',
    hardwareConcurrency: 8,
    deviceMemory: 8,
  }),
  'high',
);
console.log('deviceTier: all tests passed');
