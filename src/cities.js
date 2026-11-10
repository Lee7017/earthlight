/**
 * Preset camera targets. The Silicon Valley area is represented by
 * Mountain View because Silicon Valley is a region, not a single city.
 * Xiong'an uses the center of the Xiong'an New Area.
 */
export const CITIES = Object.freeze([
  Object.freeze({ id: 'beijing', name: '北京', country: '中国', latitude: 39.9042, longitude: 116.4074 }),
  Object.freeze({ id: 'xiongan', name: '雄安', country: '中国', latitude: 39.0485, longitude: 115.9037 }),
  Object.freeze({ id: 'xian', name: '西安', country: '中国', latitude: 34.3416, longitude: 108.9398 }),
  Object.freeze({ id: 'urumqi', name: '乌鲁木齐', country: '中国', latitude: 43.8256, longitude: 87.6168 }),
  Object.freeze({ id: 'london', name: '伦敦', country: '英国', latitude: 51.5074, longitude: -0.1278 }),
  Object.freeze({ id: 'silicon-valley', name: '硅谷', country: '美国', latitude: 37.3861, longitude: -122.0839 }),
]);

export function getCityById(id) {
  return CITIES.find((city) => city.id === id) ?? null;
}
