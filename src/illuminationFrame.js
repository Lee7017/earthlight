import { orbitalState } from './orbitPhysics.js';

// The tabletop represents the ecliptic plane (Y=0). The geographic tropics
// are anchored to Earth's tilted axis, independent of the surface's diurnal spin.
// Earth's subsolar position in inertial space lies on this horizontal circle.
export const TROPICAL_LIMIT_DEGREES = 23.44;

export function illuminationFrame(date = new Date()) {
  const state = orbitalState(date);
  return {
    axisTilt: state.tiltRadians,
    spin: state.spinRadians,
    incomingSun: state.sunDirection,
    orbitalHeading: state.longitude,
    directLatitude: state.solar.latitude,
    axis: state.axis,
    // A circle in the horizontal orbital plane; neither rotates with the
    // textured Earth's daily spin nor illuminates the whole circle at once.
    ringNormal: [0, 1, 0],
  };
}

// The tilted tropical band contains the full horizontal ring: the greatest
// latitude reached on that ring is exactly +/- the Earth's obliquity.
export function latitudeOfHorizontalRing(angle, tiltRadians) {
  const projectionOnAxis = Math.sin(tiltRadians) * Math.sin(angle);
  return Math.asin(Math.max(-1, Math.min(1, projectionOnAxis)));
}
