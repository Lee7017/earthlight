import test from 'node:test';
import assert from 'node:assert/strict';
import { BEIJING } from './cities.js';
import { geographicVector } from './solar.js';

test('Beijing is the only supported city and uses verified coordinates', () => {
  assert.deepEqual(BEIJING, {
    id: 'beijing',
    name: '北京',
    country: '中国',
    latitude: 39.9042,
    longitude: 116.4074,
  });
});

test('Beijing has valid geographic coordinates on the Earth surface', () => {
  assert.ok(BEIJING.latitude >= -90 && BEIJING.latitude <= 90);
  assert.ok(BEIJING.longitude >= -180 && BEIJING.longitude <= 180);
  const [x, y, z] = geographicVector(BEIJING.latitude, BEIJING.longitude);
  assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-12);
});

test('Beijing preset remains immutable', () => {
  assert.equal(Object.isFrozen(BEIJING), true);
});
