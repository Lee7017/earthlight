import { solarPosition } from './solar.js';

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
// Visual unit: the Earth's orbital semimajor axis, not physical object sizes.
export const ORBIT_RADIUS = 4.45;
export const EARTH_DRAW_RADIUS = 0.58;
export const SUN_DRAW_RADIUS = 0.48;
export const PERIHELION_LONGITUDE = 102.94 * RAD; // Approx. Earth heliocentric longitude at Jan perihelion.

/** Kepler ellipse with the Sun at a focus, in ecliptic x/z coordinates. */
export function orbitRadiusAt(earthEclipticLongitude, eccentricity = 0.0167) {
  return ORBIT_RADIUS * (1 - eccentricity ** 2) /
    (1 + eccentricity * Math.cos(earthEclipticLongitude - PERIHELION_LONGITUDE));
}

export function orbitalState(date = new Date()) {
  const solar = solarPosition(date);
  const longitude = ((solar.sunEclipticLongitude + 180) % 360) * RAD;
  // The actual r(t) from the same solar position calculation; this allows
  // the plotted planet to use the ellipse rather than a circular shortcut.
  const radius = ORBIT_RADIUS * solar.earthSunDistanceAU;
  const earth = [radius * Math.cos(longitude), 0, radius * Math.sin(longitude)];
  const epsilon = solar.obliquity * RAD;
  const axis = [0, Math.cos(epsilon), Math.sin(epsilon)];
  const sunDirection = [-Math.cos(longitude), 0, -Math.sin(longitude)];
  // Undo the axial tilt to find the Sun's longitude in the Earth's
  // equatorial frame. The spin then places the real UTC subsolar meridian
  // directly toward the fixed central Sun.
  const sunLocalX = sunDirection[0];
  const sunLocalZ = Math.cos(epsilon) * sunDirection[2];
  const sunEquatorialHeading = Math.atan2(sunLocalX, sunLocalZ);
  const spin = sunEquatorialHeading - solar.longitude * RAD;
  return {
    solar,
    longitude,
    radius,
    earth,
    axis,
    sunDirection,
    tiltRadians: epsilon,
    spinRadians: spin,
  };
}

export function annualOrbitPoints(count = 360, eccentricity = 0.0167) {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const angle = (i / count) * TAU;
    const r = orbitRadiusAt(angle, eccentricity);
    points.push([r * Math.cos(angle), 0, r * Math.sin(angle)]);
  }
  return points;
}
