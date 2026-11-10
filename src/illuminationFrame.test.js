import test from 'node:test';
import assert from 'node:assert/strict';
import { illuminationFrame, latitudeOfHorizontalRing } from './illuminationFrame.js';

const RAD = Math.PI / 180;
const deg = x => x * 180 / Math.PI;
const july = new Date('2026-07-01T12:00:00Z');
const juneSolstice = new Date('2026-06-21T12:00:00Z');
const decemberSolstice = new Date('2026-12-21T12:00:00Z');

test('the horizontal sunlight circle is inside the inclined tropics belt', () => {
  const state = illuminationFrame(july);
  for (let i = 0; i < 360; i++) {
    const latitude = latitudeOfHorizontalRing(i * RAD, state.axisTilt);
    assert.ok(Math.abs(latitude) <= state.axisTilt + 1e-12);
  }
  assert.ok(Math.abs(deg(latitudeOfHorizontalRing(Math.PI / 2, state.axisTilt)) - 23.44) < .05);
  assert.ok(Math.abs(deg(latitudeOfHorizontalRing(3 * Math.PI / 2, state.axisTilt)) + 23.44) < .05);
});

test('daily Earth rotation does not rotate the tabletop circle or axial band', () => {
  const start = illuminationFrame(new Date('2026-11-10T00:00:00Z'));
  const later = illuminationFrame(new Date('2026-11-10T06:00:00Z'));
  assert.deepEqual(start.ringNormal, [0, 1, 0]);
  assert.deepEqual(later.ringNormal, [0, 1, 0]);
  assert.ok(Math.abs(start.axisTilt - later.axisTilt) < 1e-7);
  assert.ok(Math.abs(start.spin - later.spin) > 1);
  // The Sun's direction changes only about 1 degree per day, not 360.
  const nextDay = illuminationFrame(new Date('2026-11-11T00:00:00Z'));
  const dot = start.incomingSun.reduce((sum, x, i) => sum + x * nextDay.incomingSun[i], 0);
  assert.ok(dot > Math.cos(2 * RAD));
});

test('the direct-sun ray lies in the horizontal tabletop plane through the year', () => {
  for (const month of [0,2,5,8,11]) {
    const frame = illuminationFrame(new Date(Date.UTC(2026,month,21,12)));
    assert.ok(Math.abs(frame.incomingSun[1]) < 1e-12);
    assert.deepEqual(frame.ringNormal, [0,1,0]);
  }
});

test('northern and southern tropical latitudes are reached near solstices', () => {
  const summer = illuminationFrame(juneSolstice);
  const winter = illuminationFrame(decemberSolstice);
  assert.ok(Math.abs(summer.directLatitude - 23.44) < .2);
  assert.ok(Math.abs(winter.directLatitude + 23.44) < .2);
});
