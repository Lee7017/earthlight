import * as THREE from 'three';
import {
  annualOrbitPoints, orbitalState, orbitRadiusAt,
  EARTH_DRAW_RADIUS, SUN_DRAW_RADIUS,
} from './orbitPhysics.js';

const RAD = Math.PI / 180;
const QUARTERS = [
  { id: 'march', label: '春分 · 3月', earthLongitude: 180 },
  { id: 'june', label: '夏至 · 6月', earthLongitude: 270 },
  { id: 'september', label: '秋分 · 9月', earthLongitude: 0 },
  { id: 'december', label: '冬至 · 12月', earthLongitude: 90 },
];

function lineFromCoordinates(points, color, opacity = 1) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,225,155,1)');
  gradient.addColorStop(0.22, 'rgba(255,184,92,.45)');
  gradient.addColorStop(1, 'rgba(255,160,64,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * A heliocentric inset. The Sun is fixed at (0,0,0).
 * Earth's orbit, axial orientation and spin share the exact same UTC clock
 * used by the main Earth day/night shader.
 *
 * Orbital distance/ellipticity are represented; body sizes are
 * intentionally exaggerated so Earth and its axial tilt are legible.
 */
export function createOrbitViewer(stage, mount, sourceEarthMaterial) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 120);
  const renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, powerPreference: 'default',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const track = lineFromCoordinates(annualOrbitPoints(), 0x447b8a, .68);
  track.geometry.computeBoundingSphere();
  scene.add(track);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_DRAW_RADIUS, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc679 }),
  );
  sun.position.set(0, 0, 0);
  scene.add(sun);

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .65,
  }));
  sunGlow.scale.set(2.6, 2.6, 1);
  scene.add(sunGlow);

  // Season landmarks are where the Sun's apparent ecliptic longitude
  // reaches 0°, 90°, 180°, 270° (dates vary slightly from year to year).
  const seasonPositions = {};
  for (const q of QUARTERS) {
    const theta = q.earthLongitude * RAD;
    const radius = orbitRadiusAt(theta);
    const point = new THREE.Vector3(radius * Math.cos(theta), 0, radius * Math.sin(theta));
    seasonPositions[q.id] = point;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(.08, 16, 12),
      new THREE.MeshBasicMaterial({ color: q.id === 'june' || q.id === 'december' ? 0xd5b587 : 0x68c6c4 }),
    );
    marker.position.copy(point);
    scene.add(marker);
  }

  const earthCarrier = new THREE.Group();
  scene.add(earthCarrier);

  const tiltGroup = new THREE.Group();
  earthCarrier.add(tiltGroup);
  const spinGroup = new THREE.Group();
  tiltGroup.add(spinGroup);

  // Same shader/texture orientation as the full-size geographic Earth.
  const material = sourceEarthMaterial.clone();
  material.uniforms.sunDirection.value = new THREE.Vector3(0, 0, 1);
  const surface = new THREE.Mesh(new THREE.SphereGeometry(EARTH_DRAW_RADIUS, 96, 64), material);
  surface.rotation.y = -Math.PI / 2;
  spinGroup.add(surface);

  const axis = lineFromCoordinates([[0, -.94, 0], [0, .94, 0]], 0xf2d198, .95);
  tiltGroup.add(axis);
  const northCap = new THREE.Mesh(
    new THREE.ConeGeometry(.065, .17, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd39c }),
  );
  northCap.position.y = 1.03;
  tiltGroup.add(northCap);

  // A thin rotating-equator guide makes the spin axis physically visible.
  const equatorialRing = new THREE.Mesh(
    new THREE.TorusGeometry(.80, .008, 5, 100),
    new THREE.MeshBasicMaterial({ color: 0x7ad3cd, transparent: true, opacity: .44 }),
  );
  equatorialRing.rotation.x = Math.PI / 2;
  tiltGroup.add(equatorialRing);
  const spinArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(.8, 0, 0),
    .35, 0x9ae4da, .17, .095,
  );
  tiltGroup.add(spinArrow);

  const orbitArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(), .66,
    0x7bdcc6, .23, .12,
  );
  scene.add(orbitArrow);

  const sunRay = lineFromCoordinates([[0, 0, 0], [0, 0, 0]], 0xffc182, .5);
  sunRay.material.depthWrite = false;
  scene.add(sunRay);

  function setTextures(dayMap, nightMap) {
    material.uniforms.dayMap.value = dayMap;
    material.uniforms.nightMap.value = nightMap;
    material.needsUpdate = true;
  }

  let lastState = null;
  function update(date) {
    const state = orbitalState(date);
    lastState = state;
    earthCarrier.position.set(...state.earth);
    tiltGroup.rotation.x = state.tiltRadians;
    spinGroup.rotation.y = state.spinRadians;
    material.uniforms.sunDirection.value.set(...state.sunDirection);
    orbitArrow.position.set(
      state.earth[0] * 1.03, .08, state.earth[2] * 1.03,
    );
    orbitArrow.setDirection(new THREE.Vector3(-Math.sin(state.longitude), 0, Math.cos(state.longitude)));

    const ray = sunRay.geometry.attributes.position;
    ray.setXYZ(0, 0, 0, 0);
    ray.setXYZ(1, state.earth[0], state.earth[1], state.earth[2]);
    ray.needsUpdate = true;
    sunRay.geometry.computeBoundingSphere();

    stage.dataset.orbitLongitude = String(state.longitude);
    stage.dataset.earthRotation = String(state.spinRadians);
    stage.dataset.axisTilt = state.solar.obliquity.toFixed(4);
    stage.dataset.simulationUtc = date.toISOString();
    const dateLabel = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
    const dateNode = document.getElementById('orbit-date');
    if (dateNode) dateNode.textContent = dateLabel;
    const tiltNode = document.getElementById('orbit-tilt');
    if (tiltNode) tiltNode.textContent = state.solar.obliquity.toFixed(2) + '°';
  }

  function positionLabel(id, point, xOffset = 0, yOffset = 0) {
    const node = document.getElementById(id);
    if (!node) return;
    const screen = point.clone().project(camera);
    const x = (screen.x * .5 + .5) * stage.clientWidth + xOffset;
    const y = (-screen.y * .5 + .5) * stage.clientHeight + yOffset;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
  }

  function render() {
    if (stage.clientWidth < 1 || stage.clientHeight < 1) return;
    renderer.render(scene, camera);
    for (const q of QUARTERS) {
      positionLabel('season-' + q.id, seasonPositions[q.id], 0, -14);
    }
    if (lastState) {
      positionLabel('orbit-earth-label', earthCarrier.position, 0, -32);
    }
  }

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    camera.aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(camera.fov * .5);
    const distance = Math.max(
      13.2,
      5.8 / Math.tan(halfFov),
      5.8 / (Math.tan(halfFov) * camera.aspect),
    );
    camera.position.set(distance * .24, distance * .58, distance * .78);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  new ResizeObserver(resize).observe(stage);
  resize();
  update(new Date());

  return { update, render, resize, setTextures };
}
