/**
 * Maps one short, real-time playback onto the next 24 hours.
 * The snapshot stays anchored to the instant the user pressed Play.
 * The caller uses performance.now() so animation speed is immune to
 * wall-clock adjustments and browser timezone settings.
 */
export const PREVIEW_HOURS = 24;
export const PREVIEW_SPAN_MS = PREVIEW_HOURS * 60 * 60 * 1000;
export const PREVIEW_DURATION_MS = 24 * 1000;

export function previewFrame(realStartEpochMs, animationStartMs, animationNowMs, durationMs = PREVIEW_DURATION_MS) {
  if (![realStartEpochMs, animationStartMs, animationNowMs, durationMs].every(Number.isFinite) || durationMs <= 0) {
    throw new RangeError('Preview requires finite times and a positive duration');
  }
  const progress = Math.max(0, Math.min(1, (animationNowMs - animationStartMs) / durationMs));
  return {
    date: new Date(realStartEpochMs + progress * PREVIEW_SPAN_MS),
    progress,
    complete: progress >= 1,
  };
}

/**
 * A tropical year is the seasonal cycle, slightly different from 365 calendar days.
 * The preview moves forward through one full cycle and returns to live UTC.
 */
export const TROPICAL_YEAR_DAYS = 365.2422;
export const YEAR_PREVIEW_SPAN_MS = TROPICAL_YEAR_DAYS * 86400000;
export const YEAR_PREVIEW_DURATION_MS = 36 * 1000;

export function yearPreviewFrame(realStartEpochMs, animationStartMs, animationNowMs,
  durationMs = YEAR_PREVIEW_DURATION_MS) {
  if (![realStartEpochMs, animationStartMs, animationNowMs, durationMs].every(Number.isFinite)
    || durationMs <= 0) {
    throw new RangeError('Year preview requires finite times and a positive duration');
  }
  const progress = Math.max(0, Math.min(1, (animationNowMs - animationStartMs) / durationMs));
  return {
    date: new Date(realStartEpochMs + progress * YEAR_PREVIEW_SPAN_MS),
    progress,
    complete: progress >= 1,
  };
}
