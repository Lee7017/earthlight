import test from 'node:test';
import assert from 'node:assert/strict';
import { solarPosition, solarElevation, geographicVector } from './solar.js';

const near = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, received ${actual}`);
};

test('June solstice: subsolar latitude close to Tropic of Cancer', () => {
  const result = solarPosition(new Date('2026-06-21T12:00:00Z'));
  near(result.latitude, 23.44, 0.2, 'June solar declination');
});

test('December solstice: subsolar latitude close to Tropic of Capricorn', () => {
  const result = solarPosition(new Date('2026-12-21T12:00:00Z'));
  near(result.latitude, -23.44, 0.2, 'December solar declination');
});

test('March equinox: subsolar latitude near the equator', () => {
  const result = solarPosition(new Date('2026-03-20T15:46:00Z'));
  near(result.latitude, 0, 0.2, 'Equinox solar declination');
});

test('Subsolar longitude is near Greenwich at UTC solar noon (equation of time accounted for)', () => {
  const position = solarPosition(new Date('2026-06-21T12:00:00Z'));
  assert.ok(Math.abs(position.longitude) < 5, 'Sun should be near 0° at roughly UTC noon');
});

test('The subsolar point has 90-degree solar elevation', () => {
  const position = solarPosition(new Date('2026-11-10T12:00:00Z'));
  near(
    solarElevation(position.latitude, position.longitude, position.latitude, position.longitude),
    90, 0.00001, 'Subsolar altitude'
  );
});

test('Antipode of subsolar point has -90-degree solar elevation', () => {
  const position = solarPosition(new Date('2026-11-10T12:00:00Z'));
  const antipodeLat = -position.latitude;
  const antipodeLon = ((position.longitude + 360) % 360) - 180;
  near(solarElevation(antipodeLat, antipodeLon, position.latitude, position.longitude),
    -90, 0.00001, 'Antipodal altitude');
});

test('A 90-degree central angle from the Sun is the geometric terminator', () => {
  near(solarElevation(0, 90, 0, 0), 0, 0.00001, 'Equatorial terminator');
});

test('Coordinate mapping keeps geographic axes orthonormal', () => {
  const northPole = geographicVector(90, 0);
  const greenwich = geographicVector(0, 0);
  const east = geographicVector(0, 90);
  near(northPole[1], 1, 1e-12, 'North pole Y');
  near(greenwich[2], 1, 1e-12, 'Greenwich Z');
  near(east[0], 1, 1e-12, '90°E X');
});
