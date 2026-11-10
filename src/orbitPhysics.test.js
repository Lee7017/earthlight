import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitalState, orbitRadiusAt, annualOrbitPoints, ORBIT_RADIUS } from './orbitPhysics.js';
import { geographicVector } from './solar.js';

const approx = (actual, expected, maxError = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < maxError, `Expected ${actual} to be close to ${expected}`);

test('Sun is the fixed focus of the real-eccentricity heliocentric ellipse', () => {
  const peri = orbitRadiusAt(102.94 * Math.PI / 180);
  const aphelion = orbitRadiusAt((102.94 + 180) * Math.PI / 180);
  assert.ok(peri < ORBIT_RADIUS);
  assert.ok(aphelion > ORBIT_RADIUS);
  assert.ok(aphelion / peri > 1.03 && aphelion / peri < 1.04);
  assert.equal(annualOrbitPoints(96).length, 97);
});

test('the direction to the stationary Sun is opposite the Earth orbital radius', () => {
  for (const date of ['2026-03-20T12:00:00Z', '2026-06-21T12:00:00Z',
    '2026-09-23T12:00:00Z', '2026-12-21T12:00:00Z']) {
    const state = orbitalState(new Date(date));
    const [x,,z] = state.earth;
    const [sx,,sz] = state.sunDirection;
    approx(x / state.radius, -sx);
    approx(z / state.radius, -sz);
  }
});

test('Earth north axis stays approximately fixed in ecliptic space through seasons', () => {
  const a = orbitalState(new Date('2026-03-20T12:00:00Z'));
  const b = orbitalState(new Date('2026-12-21T12:00:00Z'));
  assert.ok(Math.abs(a.solar.obliquity - 23.44) < .05);
  approx(a.axis[0], 0);
  assert.ok(Math.abs(a.axis[1] - b.axis[1]) < .00002);
  assert.ok(Math.abs(a.axis[2] - b.axis[2]) < .00002);
});

test('axial tilt gives opposite northern summer and winter irradiance', () => {
  const june = orbitalState(new Date('2026-06-21T12:00:00Z'));
  const dec = orbitalState(new Date('2026-12-21T12:00:00Z'));
  const dot = a => a.axis[0] * a.sunDirection[0] + a.axis[1] * a.sunDirection[1] +
    a.axis[2] * a.sunDirection[2];
  assert.ok(dot(june) > .39);
  assert.ok(dot(dec) < -.39);
});

test('Earth map rotates to face the Sun at the subsolar longitude', () => {
  for (const date of ['2026-03-20T12:00:00Z', '2026-06-21T12:00:00Z',
    '2026-11-10T13:00:00Z']) {
    const state = orbitalState(new Date(date));
    const [x,y,z] = geographicVector(state.solar.latitude, state.solar.longitude);
    const t = state.spinRadians, epsilon = state.tiltRadians;
    // Local Y spin followed by the fixed obliquity tilt about X.
    const rx = Math.cos(t) * x + Math.sin(t) * z;
    const ry = y;
    const rz = -Math.sin(t) * x + Math.cos(t) * z;
    const tx = rx;
    const ty = Math.cos(epsilon) * ry - Math.sin(epsilon) * rz;
    const tz = Math.sin(epsilon) * ry + Math.cos(epsilon) * rz;
    approx(tx, state.sunDirection[0], 1e-8);
    approx(ty, state.sunDirection[1], 1e-8);
    approx(tz, state.sunDirection[2], 1e-8);
  }
});

test('Earth spins about a quarter turn during six UTC hours', () => {
  const a = orbitalState(new Date('2026-11-10T00:00:00Z'));
  const b = orbitalState(new Date('2026-11-10T06:00:00Z'));
  const raw = b.spinRadians - a.spinRadians;
  const wrapped = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const closest = Math.min(Math.abs(wrapped - Math.PI / 2), Math.abs(wrapped - 3 * Math.PI / 2));
  assert.ok(closest < .05, 'Six hours should cover roughly 90 degrees of spin');
});

test('orbital position returns close to its starting point after a tropical year', () => {
  const start = new Date('2026-11-10T00:00:00Z');
  const end = new Date(start.getTime() + 365.2422 * 86400000);
  const a = orbitalState(start);
  const b = orbitalState(end);
  assert.ok(Math.hypot(a.earth[0] - b.earth[0], a.earth[2] - b.earth[2]) < .03);
});
