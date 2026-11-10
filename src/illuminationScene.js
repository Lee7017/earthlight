import * as THREE from 'three';
import { illuminationFrame } from './illuminationFrame.js';
import { geographicVector } from './solar.js';

const TAU = 2 * Math.PI;
// Identical sunlight color for the actual ray and its possible orbital directions.
export const SUNLIGHT_COLOR = 0xffb000;

function ringGeometry(radius, polarLatitude = null) {
  const vertices = [];
  for (let i = 0; i < 360; i++) {
    const a = i / 360 * TAU;
    if (polarLatitude === null) {
      vertices.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
    } else {
      const [x, y, z] = geographicVector(polarLatitude, i);
      vertices.push(new THREE.Vector3(radius * x, radius * y, radius * z));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(vertices);
}

/**
 * Earth-centered inertial/tabletop illustration.
 *
 * Y=0: the orbital (ecliptic) plane. The horizontal ring belongs to space,
 * not to the daily spinning globe. Its points represent the possible inertial
 * directions of the subsolar point over a year, NOT simultaneous illumination.
 *
 * The tropics band is aligned to Earth's tilted rotation axis. It, too, is
 * independent of the daily surface spin. The map and the city coordinates
 * alone rotate with the solid Earth. Incoming sunshine lies in Y=0.
 */
export function createIlluminationRig(scene, earth, radius) {
  const tiltGroup = new THREE.Group();
  tiltGroup.name = 'tilted-axis';
  scene.add(tiltGroup);
  const spinGroup = new THREE.Group();
  spinGroup.name = 'spinning-geographic-surface';
  tiltGroup.add(spinGroup);
  spinGroup.add(earth);

  const initial = illuminationFrame();
  const angle = initial.axisTilt;

  // A faint translucent geographical belt between both tropics.
  // The mesh is a separate child of the tilt group, NOT of spinGroup.
  const belt = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.024, 192, 42, 0, TAU,
      Math.PI / 2 - angle, 2 * angle),
    new THREE.MeshBasicMaterial({
      color: 0xb66cff, transparent: true, opacity: .17, depthWrite: false,
      side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -1,
    }),
  );
  belt.name = 'inclined-tropics-belt';
  belt.renderOrder = 2;
  tiltGroup.add(belt);

  const tropicEdges = [];
  for (const latitude of [-angle * 180 / Math.PI, angle * 180 / Math.PI]) {
    const edge = new THREE.LineLoop(
      ringGeometry(radius * 1.030, latitude),
      new THREE.LineBasicMaterial({
        color: 0xb66cff, transparent: true, opacity: .72, depthWrite: false,
      }),
    );
    edge.name = latitude < 0 ? 'tropic-capricorn' : 'tropic-cancer';
    edge.renderOrder = 3;
    tiltGroup.add(edge);
    tropicEdges.push(edge);
  }

  // The physical ecliptic-plane cut: a horizontal circle across the tilted
  // tropics belt. Fixed in scene coordinates, not inside either Earth group.
  const horizontalRing = new THREE.LineLoop(
    ringGeometry(radius * 1.043),
    new THREE.LineBasicMaterial({
      color: SUNLIGHT_COLOR, transparent: true, opacity: .78,
      depthTest: true, depthWrite: false,
    }),
  );
  horizontalRing.name = 'horizontal-ecliptic-circle';
  horizontalRing.renderOrder = 4;
  scene.add(horizontalRing);

  const rotationAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -radius * 1.28, 0),
      new THREE.Vector3(0, radius * 1.28, 0),
    ]),
    new THREE.LineDashedMaterial({
      color: 0xb9f348, transparent: true, opacity: .85, depthWrite: false,
      dashSize: .13, gapSize: .085,
    }),
  );
  rotationAxis.name = 'earth-axis';
  rotationAxis.computeLineDistances();
  tiltGroup.add(rotationAxis);

  // The ONLY sunlight ray: one arrow from outside the globe toward the
  // current subsolar point. As seen on the horizontal tabletop
  // its direction changes slowly with Earth's annual orbital motion,
  // NOT once per day with the geographic surface.
  const centerRay = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(radius * 1.93, 0, 0),
    radius * .86, SUNLIGHT_COLOR, radius * .17, radius * .085,
  );
  centerRay.name = 'direct-sunlight-arrow';
  centerRay.line.material.transparent = true;
  centerRay.line.material.opacity = .92;
  centerRay.cone.material.transparent = true;
  centerRay.cone.material.opacity = .90;
  scene.add(centerRay);

  let state = initial;
  function update(date) {
    state = illuminationFrame(date);
    tiltGroup.rotation.x = state.axisTilt;
    spinGroup.rotation.y = state.spin;
    tiltGroup.updateMatrixWorld(true);

    const sun = new THREE.Vector3(...state.incomingSun).normalize();
    centerRay.position.copy(sun).multiplyScalar(radius * 1.93);
    centerRay.setDirection(sun.clone().negate());

    return state;
  }

  function worldGeo(latitude, longitude, distance = radius) {
    const local = geographicVector(latitude, longitude);
    return spinGroup.localToWorld(new THREE.Vector3(
      local[0] * distance, local[1] * distance, local[2] * distance,
    ));
  }

  update(new Date());
  return { update, worldGeo, belt, horizontalRing, tropicEdges, rotationAxis, centerRay,
    tiltGroup, spinGroup, get state() { return state; } };
}
