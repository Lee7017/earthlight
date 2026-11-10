import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, getCityById } from './cities.js';
import { geographicVector, solarPosition, solarElevation } from './solar.js';

test('all six requested preset destinations are present once', () => {
  assert.deepEqual(CITIES.map(({ id }) => id), [
    'beijing', 'xiongan', 'xian', 'urumqi', 'london', 'silicon-valley',
  ]);
  assert.equal(new Set(CITIES.map((city) => city.id)).size, 6);
});

test('each city uses valid finite geographic coordinates', () => {
  for (const city of CITIES) {
    assert.ok(Number.isFinite(city.latitude) && city.latitude >= -90 && city.latitude <= 90);
    assert.ok(Number.isFinite(city.longitude) && city.longitude >= -180 && city.longitude <= 180);
    const [x, y, z] = geographicVector(city.latitude, city.longitude);
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-12);
  }
});

test('default city is Beijing; destinations include correct hemispheres', () => {
  assert.equal(CITIES[0].id, 'beijing');
  assert.ok(getCityById('london').longitude < 0);
  assert.ok(getCityById('silicon-valley').longitude < -100);
  assert.ok(getCityById('urumqi').longitude > 80);
  assert.equal(getCityById('missing'), null);
});

test('different city solar altitudes derive from one UTC instant', () => {
  const sun = solarPosition(new Date('2026-11-10T12:00:00Z'));
  const beijing = getCityById('beijing');
  const london = getCityById('london');
  const beijingAlt = solarElevation(beijing.latitude, beijing.longitude, sun.latitude, sun.longitude);
  const londonAlt = solarElevation(london.latitude, london.longitude, sun.latitude, sun.longitude);
  assert.ok(Math.abs(beijingAlt - londonAlt) > 10);
});
