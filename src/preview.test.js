import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewFrame, PREVIEW_DURATION_MS, PREVIEW_SPAN_MS,
  yearPreviewFrame, TROPICAL_YEAR_DAYS, YEAR_PREVIEW_SPAN_MS, YEAR_PREVIEW_DURATION_MS,
} from './preview.js';
import { solarPosition, solarElevation } from './solar.js';

const start = Date.parse('2026-11-10T12:00:00Z');
const tick = 2000;

test('preview starts at the actual click-time snapshot', () => {
  const frame = previewFrame(start, tick, tick);
  assert.equal(frame.date.toISOString(), '2026-11-10T12:00:00.000Z');
  assert.equal(frame.progress, 0);
  assert.equal(frame.complete, false);
});

test('halfway through playback represents 12 future hours', () => {
  const frame = previewFrame(start, tick, tick + PREVIEW_DURATION_MS / 2);
  assert.equal(frame.progress, 0.5);
  assert.equal(frame.date.getTime(), start + PREVIEW_SPAN_MS / 2);
  assert.equal(frame.complete, false);
});

test('end of playback reaches exactly 24 future hours', () => {
  const frame = previewFrame(start, tick, tick + PREVIEW_DURATION_MS);
  assert.equal(frame.date.getTime(), start + PREVIEW_SPAN_MS);
  assert.equal(frame.progress, 1);
  assert.equal(frame.complete, true);
});

test('background-tab delay cannot overshoot the 24-hour range', () => {
  const frame = previewFrame(start, tick, tick + PREVIEW_DURATION_MS * 17);
  assert.equal(frame.date.getTime(), start + PREVIEW_SPAN_MS);
  assert.equal(frame.progress, 1);
  assert.equal(frame.complete, true);
});

test('negative timestamps clamp to the preview start', () => {
  const frame = previewFrame(start, tick, tick - 1000);
  assert.equal(frame.date.getTime(), start);
  assert.equal(frame.progress, 0);
});

test('invalid playback durations are rejected', () => {
  assert.throws(() => previewFrame(start, tick, tick + 500, 0), RangeError);
  assert.throws(() => previewFrame(start, tick, NaN), RangeError);
});

test('solar computation moves subsolar longitude about one revolution in 24 hours', () => {
  const a = solarPosition(new Date(start));
  const b = solarPosition(new Date(start + PREVIEW_SPAN_MS));
  const longitudeDifference = ((b.longitude - a.longitude + 540) % 360) - 180;
  assert.ok(Math.abs(longitudeDifference) < 5, 'Sun longitude should nearly repeat after 24h');
  const midday = solarPosition(new Date(start + PREVIEW_SPAN_MS / 2));
  const altitudeStart = solarElevation(35, 105, a.latitude, a.longitude);
  const altitudeMid = solarElevation(35, 105, midday.latitude, midday.longitude);
  assert.ok(Math.abs(altitudeStart - altitudeMid) > 5, 'Sun height should change visibly during a 12h segment');
});

test('seasonal playback traverses one tropical year in 720 seconds', () => {
  assert.equal(TROPICAL_YEAR_DAYS, 365.2422);
  assert.equal(YEAR_PREVIEW_DURATION_MS, 720000);
  const first = yearPreviewFrame(start, tick, tick);
  const middle = yearPreviewFrame(start, tick, tick + YEAR_PREVIEW_DURATION_MS / 2);
  const last = yearPreviewFrame(start, tick, tick + YEAR_PREVIEW_DURATION_MS);
  assert.equal(first.date.getTime(), start);
  assert.equal(middle.date.getTime(), start + YEAR_PREVIEW_SPAN_MS / 2);
  assert.equal(last.date.getTime(), start + YEAR_PREVIEW_SPAN_MS);
  assert.equal(last.complete, true);
});
test('seasonal speed shows one full solar day every ~1.97 seconds', () => {
  const secondsPerDay = YEAR_PREVIEW_DURATION_MS / 1000 / TROPICAL_YEAR_DAYS;
  assert.ok(secondsPerDay > 1.96 && secondsPerDay < 1.98);
  const twoSeconds = yearPreviewFrame(start, tick, tick + 2000);
  const elapsedDays = (twoSeconds.date.getTime() - start) / 86400000;
  assert.ok(elapsedDays > 1.0 && elapsedDays < 1.03);
});

test('seasonal playback cannot overshoot when backgrounded', () => {
  const frame = yearPreviewFrame(start, tick, tick + YEAR_PREVIEW_DURATION_MS * 5);
  assert.equal(frame.progress, 1);
  assert.equal(frame.date.getTime(), start + YEAR_PREVIEW_SPAN_MS);
  assert.throws(() => yearPreviewFrame(start, tick, NaN), RangeError);
});
