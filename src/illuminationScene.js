import * as THREE from 'three';
import { illuminationFrame } from './illuminationFrame.js';
import { geographicVector } from './solar.js';

const TAU = 2 * Math.PI;

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
      color: 0xe4b77f, transparent: true, opacity: .10, depthWrite: false,
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
        color: 0xe9b981, transparent: true, opacity: .56, depthWrite: false,
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
      color: 0x88e5d6, transparent: true, opacity: .90,
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
    new THREE.LineBasicMaterial({
      color: 0xffd39b, transparent: true, opacity: .65, depthWrite: false,
    }),
  );
  rotationAxis.name = 'earth-axis';
  tiltGroup.add(rotationAxis);

  // An arrow for the current sunlight. As seen on the horizontal tabletop
  // its direction changes slowly with Earth's annual orbital motion,
  // NOT once per day with the geographic surface.
  const centerRay = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(radius * 1.93, 0, 0),
    radius * .86, 0xffc57b, radius * .17, radius * .085,
  );
  centerRay.name = 'direct-sunlight-arrow';
  centerRay.line.material.transparent = true;
  centerRay.line.material.opacity = .92;
  centerRay.cone.material.transparent = true;
  centerRay.cone.material.opacity = .90;
  scene.add(centerRay);

  const parallelRays = [];
  for (const side of [-1, 1]) {
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ]),
      new THREE.LineBasicMaterial({
        color: 0xffd2a1, opacity: .35, transparent: true, depthWrite: false,
      }),
    );
    ray.name = 'parallel-sunlight-ray';
    scene.add(ray);
    parallelRays.push({ray,side});
  }

  let state = initial;
  function update(date) {
    state = illuminationFrame(date);
    tiltGroup.rotation.x = state.axisTilt;
    spinGroup.rotation.y = state.spin;
    tiltGroup.updateMatrixWorld(true);

    const sun = new THREE.Vector3(...state.incomingSun).normalize();
    centerRay.position.copy(sun).multiplyScalar(radius * 1.93);
    centerRay.setDirection(sun.clone().negate());

    const sideways = new THREE.Vector3().crossVectors(sun, new THREE.Vector3(0, 1, 0)).normalize();
    for (const {ray,side} of parallelRays) {
      const offset = sideways.clone().multiplyScalar(side * radius * .24);
      const reach = Math.sqrt(1 - .24 * .24);
      const start = sun.clone().multiplyScalar(radius * 1.9).add(offset);
      const end = sun.clone().multiplyScalar(radius * (reach + .06)).add(offset);
      const attribute = ray.geometry.attributes.position;
      attribute.setXYZ(0, start.x, start.y, start.z);
      attribute.setXYZ(1, end.x, end.y, end.z);
      attribute.needsUpdate = true;
      ray.geometry.computeBoundingSphere();
    }
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
