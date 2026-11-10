/**
 * Choose texture download sizes without assuming the browser supports any
 * of the optional Network Information API properties.
 */
export const PREVIEW_TEXTURE_WIDTH = 512;
export const ORBIT_TEXTURE_WIDTH = 2048;

export function preferredTextureWidth({
  viewportWidth = 1280,
  deviceMemory = 4,
  maxTextureSize = 4096,
  saveData = false,
  effectiveType = '',
} = {}) {
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return PREVIEW_TEXTURE_WIDTH;
  }
  if (maxTextureSize < ORBIT_TEXTURE_WIDTH) return PREVIEW_TEXTURE_WIDTH;
  if (viewportWidth < 740 || deviceMemory <= 3 ||
      maxTextureSize < 4096 || effectiveType === '3g') return ORBIT_TEXTURE_WIDTH;
  if (viewportWidth >= 1300 && deviceMemory >= 8 && maxTextureSize >= 8192) return 8192;
  return 4096;
}

/** Load a tiny preview first, then a 2K intermediate tier, then final detail. */
export function textureLoadingStages(requested, maxTextureSize = 8192) {
  const cap = Math.min(requested, maxTextureSize);
  return [PREVIEW_TEXTURE_WIDTH, ORBIT_TEXTURE_WIDTH, cap]
    .filter((width, index, all) =>
      width <= cap && width <= maxTextureSize && all.indexOf(width) === index);
}
