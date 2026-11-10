/**
 * Approximate solar ephemeris using the NOAA/Meeus equations.
 * All inputs/outputs are independent of the visitor's timezone.
 * Typical accuracy of the Sun's position is within about 0.01°-0.1°.
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const wrap360 = (value) => ((value % 360) + 360) % 360;
const wrap180 = (value) => wrap360(value + 180) - 180;
const sin = (degrees) => Math.sin(degrees * RAD);
const cos = (degrees) => Math.cos(degrees * RAD);

export function solarPosition(date = new Date()) {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const t = (julianDay - 2451545.0) / 36525;
  const meanLongitude = wrap360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const meanAnomaly = wrap360(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const eccentricity = 0.016708634 - t * (0.000042037 + t * 0.0000001267);

  const center =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289;

  const trueLongitude = meanLongitude + center;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * sin(omega);
  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) * DEG;

  const y = Math.tan((obliquity * RAD) / 2) ** 2;
  const equationOfTime = 4 * DEG * (
    y * Math.sin(2 * meanLongitude * RAD) -
    2 * eccentricity * Math.sin(meanAnomaly * RAD) +
    4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLongitude * RAD) -
    0.5 * y * y * Math.sin(4 * meanLongitude * RAD) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD)
  );

  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  const longitude = wrap180((720 - utcMinutes - equationOfTime) / 4);

  return {
    latitude: declination,
    longitude,
    equationOfTime,
    julianDay,
  };
}

/** ECEF-like unit vector in the globe's Three.js coordinate system.
 * Greenwich meridian faces -Z; 90°E faces +X; north is +Y.
 */
export function geographicVector(latitude, longitude) {
  const phi = latitude * RAD;
  const lambda = longitude * RAD;
  return [
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
    -Math.cos(phi) * Math.cos(lambda),
  ];
}

export function solarElevation(latitude, longitude, sunLatitude, sunLongitude) {
  const a = geographicVector(latitude, longitude);
  const b = geographicVector(sunLatitude, sunLongitude);
  const sine = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.asin(sine) * DEG;
}

export function formatCoordinate(degrees, kind) {
  const positive = kind === 'lat' ? 'N' : 'E';
  const negative = kind === 'lat' ? 'S' : 'W';
  return `${Math.abs(degrees).toFixed(2)}° ${degrees < 0 ? negative : positive}`;
}
