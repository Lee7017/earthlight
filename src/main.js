import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { solarPosition, geographicVector, formatCoordinate } from './solar.js';
import { previewFrame, yearPreviewFrame, TROPICAL_YEAR_DAYS } from './preview.js';
import { createOrbitViewer } from './orbitViewer.js';
import { CITIES, getCityById } from './cities.js';

const $ = (id) => document.getElementById(id);
const GLOBE_RADIUS = 2;
const DEFAULT_CITY = CITIES[0];
const textureBase = './textures/'; // Built site includes both textures locally.

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const stage = $('globe-stage');
const mount = $('globe-mount');
mount.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.78;
controls.minDistance = 3.15;
controls.maxDistance = 10;
controls.minPolarAngle = 0.075;
controls.maxPolarAngle = Math.PI - 0.075;

function geoVector(latitude, longitude, radius = 1) {
  const [x, y, z] = geographicVector(latitude, longitude);
  return new THREE.Vector3(x * radius, y * radius, z * radius);
}

// City selection changes camera direction; it never changes the solar clock.
let activeCity = DEFAULT_CITY;
let cityCameraMotion = null;
let defaultCameraDistance = 6.55;
let initialFramingDone = false;
const cityDots = CITIES.map((city) => {
  const dot = document.createElement('span');
  dot.className = 'map-city-dot';
  dot.dataset.city = city.id;
  dot.setAttribute('aria-hidden', 'true');
  stage.appendChild(dot);
  return { city, element: dot };
});

function syncCityUI() {
  document.querySelectorAll('.city-chip').forEach((button) => {
    const selected = button.dataset.city === activeCity.id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  for (const marker of cityDots) {
    marker.element.classList.toggle('is-selected', marker.city.id === activeCity.id);
  }
  $('focused-city-label').textContent = activeCity.country + ' · ' + activeCity.name;
  stage.dataset.focusCity = activeCity.id;
}

function snapCameraTo(city, distance = defaultCameraDistance) {
  camera.position.copy(geoVector(city.latitude, city.longitude, distance));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

function resetCamera() {
  activeCity = DEFAULT_CITY;
  cityCameraMotion = null;
  snapCameraTo(DEFAULT_CITY);
  syncCityUI();
}
resetCamera();
$('reset-view').addEventListener('click', resetCamera);

function focusCity(id) {
  const city = getCityById(id);
  if (!city) return;
  activeCity = city;
  syncCityUI();
  const distance = camera.position.length();
  const from = camera.position.clone().normalize();
  const to = geoVector(city.latitude, city.longitude).normalize();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    cityCameraMotion = null;
    snapCameraTo(city, distance);
    return;
  }
  cityCameraMotion = {
    from,
    rotation: new THREE.Quaternion().setFromUnitVectors(from, to),
    distance,
    start: performance.now(),
    duration: 1050,
  };
}

document.querySelectorAll('.city-chip').forEach((button) => {
  button.addEventListener('click', () => focusCity(button.dataset.city));
});
controls.addEventListener('start', () => { cityCameraMotion = null; });

function animateCityCamera(timestamp) {
  if (!cityCameraMotion) return;
  const flight = cityCameraMotion;
  const progress = THREE.MathUtils.clamp((timestamp - flight.start) / flight.duration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const rotation = new THREE.Quaternion().identity().slerp(flight.rotation, eased);
  camera.position.copy(flight.from).applyQuaternion(rotation).multiplyScalar(flight.distance);
  camera.lookAt(0, 0, 0);
  if (progress >= 1) cityCameraMotion = null;
}

const stars = new THREE.BufferGeometry();
const starCoordinates = [];
let randomSeed = 1907;
function random() {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}
for (let i = 0; i < 750; i++) {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);
  const distance = 34 + random() * 36;
  starCoordinates.push(
    Math.cos(angle) * radius * distance,
    z * distance,
    Math.sin(angle) * radius * distance
  );
}
stars.setAttribute('position', new THREE.Float32BufferAttribute(starCoordinates, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({
  color: 0x7c9aaf,
  size: 0.065,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
})));

const sunUniform = { value: new THREE.Vector3(0, 0, 1) };
const earthGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 192, 128);
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayMap: { value: null },
    nightMap: { value: null },
    sunDirection: sunUniform,
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3 sunDirection;
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    void main() {
      vec3 n = normalize(vWorldNormal);
      float sunshine = dot(n, normalize(sunDirection));
      // The geometric terminator is exactly sunshine == 0.
      float daylight = smoothstep(-0.025, 0.045, sunshine);
      vec3 dayColor = texture2D(dayMap, vUv).rgb;
      vec3 nightLights = texture2D(nightMap, vUv).rgb;
      float illuminated = 0.24 + 0.76 * max(sunshine, 0.0);
      vec3 sunlightColor = dayColor * illuminated;
      vec3 darknessColor = vec3(0.006, 0.018, 0.035) + nightLights * 0.87;
      vec3 finalColor = mix(darknessColor, sunlightColor, daylight);
      gl_FragColor = vec4(finalColor, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
// SphereGeometry's equirectangular u=0.5 points toward +X.
// Rotate Greenwich to +Z; the geographic axes then match src/solar.js.
earth.rotation.y = -Math.PI / 2;
scene.add(earth);

// The orbit view uses the identical Earth shader and UTC ephemeris, but
// positions the Earth relative to a stationary Sun in ecliptic space.
const orbitViewer = createOrbitViewer($('orbit-stage'), $('orbit-mount'), earthMaterial);
let currentView = 'dual';
const viewLayout = $('visualization-layout');

function switchView(nextView) {
  if (!['earth', 'orbit', 'dual'].includes(nextView)) return;
  currentView = nextView;
  viewLayout.dataset.view = nextView;
  viewLayout.classList.toggle('is-dual', nextView === 'dual');
  document.querySelectorAll('.mode-button').forEach(button => {
    const selected = button.dataset.view === nextView;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  requestAnimationFrame(() => { layout(); orbitViewer.resize(); });
}
document.querySelectorAll('.mode-button').forEach(button => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

// A faint limb glow, kept deliberately separate from the day/night geometry.
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_RADIUS * 1.032, 96, 64),
  new THREE.ShaderMaterial({
    uniforms: { sunDirection: sunUniform },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vEye;
      varying vec3 vWorld;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorld = worldPosition.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vEye = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      varying vec3 vNormal;
      varying vec3 vEye;
      varying vec3 vWorld;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vEye)), 0.0), 3.5);
        float lit = smoothstep(-0.4, 0.8, dot(normalize(vNormal), normalize(sunDirection)));
        vec3 color = mix(vec3(0.04, 0.18, 0.30), vec3(0.17, 0.54, 0.73), lit);
        gl_FragColor = vec4(color, rim * (0.18 + 0.25 * lit));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })
);
scene.add(atmosphere);

const terminatorPoints = new Array(360).fill(null).map(() => new THREE.Vector3());
const terminatorGeometry = new THREE.BufferGeometry().setFromPoints(terminatorPoints);
const terminator = new THREE.LineLoop(terminatorGeometry, new THREE.LineBasicMaterial({
  color: 0xb3f6e6,
  transparent: true,
  opacity: 0.76,
  depthTest: true,
  depthWrite: false,
}));
terminator.renderOrder = 3;
scene.add(terminator);
let terminatorVisible = true;

$('terminator-toggle').addEventListener('click', () => {
  terminatorVisible = !terminatorVisible;
  terminator.visible = terminatorVisible;
  $('terminator-toggle').classList.toggle('selected', terminatorVisible);
  $('terminator-toggle').setAttribute('aria-pressed', String(terminatorVisible));
});

const subsolarMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd39b })
);
scene.add(subsolarMarker);
const sunIndicator = new THREE.Mesh(
  new THREE.SphereGeometry(0.087, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xffca87 })
);
scene.add(sunIndicator);
const glowCanvas = document.createElement('canvas');
glowCanvas.width = 128;
glowCanvas.height = 128;
const glowContext = glowCanvas.getContext('2d');
const gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
gradient.addColorStop(0, 'rgba(255,218,156,0.8)');
gradient.addColorStop(0.25, 'rgba(255,183,101,0.28)');
gradient.addColorStop(1, 'rgba(255,171,93,0)');
glowContext.fillStyle = gradient;
glowContext.fillRect(0, 0, 128, 128);
const glowMap = new THREE.CanvasTexture(glowCanvas);
glowMap.colorSpace = THREE.SRGBColorSpace;
const sunAura = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowMap,
  opacity: 0.67,
  transparent: true,
  depthWrite: false,
}));
sunAura.scale.set(0.52, 0.52, 1);
scene.add(sunAura);
// The tiny near-Earth sun from the original visualization would imply that
// the Sun orbits our planet. In the physical overview the Sun is at the focus.
sunIndicator.visible = false;
sunAura.visible = false;

const loader = new THREE.TextureLoader();
const MAX_TEXTURE = renderer.capabilities.maxTextureSize || 2048;
function preferredQuality() {
  // A compressed JPEG expands into full RGBA texture memory on the GPU.
  // Do not load 8K into phones or low-memory devices.
  const memory = navigator.deviceMemory || 4;
  if (window.innerWidth < 740 || memory <= 3 || MAX_TEXTURE < 4096) return 2048;
  if (window.innerWidth >= 1300 && memory >= 8 && MAX_TEXTURE >= 8192) return 8192;
  return 4096;
}

function loadMap(name) {
  return new Promise((resolve, reject) => {
    loader.load(textureBase + name, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      resolve(texture);
    }, undefined, reject);
  });
}

async function initTextures() {
  const requested = preferredQuality();
  const candidates = [...new Set([requested, 4096, 2048])]
    .filter(size => size <= requested && size <= MAX_TEXTURE);
  for (const size of candidates) {
    let maps = [];
    try {
      maps = await Promise.all([
        loadMap('day_' + size + '.jpg'),
        loadMap('night_' + size + '.jpg'),
      ]);
      // Keep the day and night maps aligned, including along the terminator.
      earthMaterial.uniforms.dayMap.value = maps[0];
      earthMaterial.uniforms.nightMap.value = maps[1];
      earthMaterial.needsUpdate = true;
      // A second WebGL context needs its own GPU texture upload.
      // Prefer 2K for the miniature Earth to avoid doubling 4K/8K VRAM use.
      if (size === 2048) {
        orbitViewer.setTextures(maps[0], maps[1]);
      } else {
        Promise.all([loadMap('day_2048.jpg'), loadMap('night_2048.jpg')])
          .then(([day, night]) => orbitViewer.setTextures(day, night))
          .catch(error => {
            console.warn('2K orbit textures unavailable, reusing Earth maps:', error);
            orbitViewer.setTextures(maps[0], maps[1]);
          });
      }
      $('map-quality').textContent = '01 / EARTH VIEW · ' + (size / 1024) + 'K MAP';
      $('loading-overlay').classList.add('is-hidden');
      return;
    } catch (error) {
      for (const map of maps) map?.dispose();
      console.warn('Earth map quality ' + size + ' failed, falling back:', error);
    }
  }
  $('loading-overlay').classList.add('is-hidden');
  const errorElement = $('globe-error');
  errorElement.hidden = false;
  errorElement.textContent = '地球贴图暂时无法加载，请检查网络并刷新页面。时间和太阳位置仍在持续计算。';
}
initTextures();

function updateTerminator(direction) {
  const arbitrary = Math.abs(direction.y) < 0.94
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(arbitrary, direction).normalize();
  const v = new THREE.Vector3().crossVectors(direction, u).normalize();
  const positions = terminator.geometry.attributes.position;
  const radius = GLOBE_RADIUS * 1.008;
  for (let i = 0; i < positions.count; i++) {
    const angle = (i / positions.count) * Math.PI * 2;
    const point = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).multiplyScalar(radius);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  terminator.geometry.computeBoundingSphere();
}

function updateClock(now) {
  const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const formatted = timeFormatter.format(now);
  const parts = formatted.split(':');
  $('beijing-time').innerHTML = `${parts[0]}:${parts[1]}<span>:${parts[2]}</span>`;
  $('beijing-date').textContent = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(now);
  $('utc-time').textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now);
}

let currentSun = new THREE.Vector3();
function updateAstronomy(now) {
  const subsolar = solarPosition(now);
  currentSun.copy(geoVector(subsolar.latitude, subsolar.longitude)).normalize();
  sunUniform.value.copy(currentSun);
  subsolarMarker.position.copy(currentSun).multiplyScalar(GLOBE_RADIUS * 1.012);
  sunIndicator.position.copy(currentSun).multiplyScalar(3.15);
  sunAura.position.copy(sunIndicator.position);
  updateTerminator(currentSun);

  $('sun-latitude').textContent = formatCoordinate(subsolar.latitude, 'lat');
  $('sun-longitude').textContent = formatCoordinate(subsolar.longitude, 'lon');
  $('updated-at').textContent = `${previewState ? '预演时刻' : '太阳位置更新于'} ${new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Shanghai', hour12: false
  }).format(now)}`;
}

function updatePin(element, position) {
  const directionToCamera = camera.position.clone().normalize();
  const normal = position.clone().normalize();
  // Only label the near hemisphere, avoiding labels floating through the globe.
  if (normal.dot(directionToCamera) < 0.18) {
    element.style.opacity = '0';
    return;
  }
  const projected = position.clone().project(camera);
  if (projected.z > 1 || projected.z < -1) {
    element.style.opacity = '0';
    return;
  }
  const x = (projected.x * 0.5 + 0.5) * stage.clientWidth;
  const y = (-projected.y * 0.5 + 0.5) * stage.clientHeight;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.opacity = x > 10 && x < stage.clientWidth - 30 && y > 15 && y < stage.clientHeight - 15 ? '1' : '0';
}

function layout() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Frame the complete globe within the smaller stage dimension.
  // The geometry, not the screen resolution or texture, determines the fit.
  const targetDiameter = Math.min(width, height) * (width < 600 ? 0.78 : 0.84);
  const verticalHalfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const halfAngle = Math.atan(verticalHalfTan * targetDiameter / height);
  defaultCameraDistance = Math.max(5.2, Math.min(10, GLOBE_RADIUS / Math.sin(halfAngle)));
  const distance = camera.position.length();
  if (!initialFramingDone || distance < defaultCameraDistance) {
    camera.position.normalize().multiplyScalar(defaultCameraDistance);
    controls.update();
  }
  initialFramingDone = true;
  renderer.setSize(width, height, false);
}
new ResizeObserver(layout).observe(stage);
window.addEventListener('resize', layout);
layout();

let previewState = null;
let lastLiveSecond = -1;

function renderAt(date) {
  updateClock(date);
  updateAstronomy(date);
  orbitViewer.update(date);
  document.body.dataset.timeMode = previewState?.type || 'live';
}

function setPreviewUI() {
  const type = previewState?.type || null;
  const active = Boolean(type);
  $('preview-overlay').hidden = !active;

  const dayActive = type === 'day';
  const yearActive = type === 'year';
  $('preview-toggle').classList.toggle('selected', dayActive);
  $('preview-toggle').setAttribute('aria-pressed', String(dayActive));
  $('preview-button-label').textContent = dayActive ? '退出 24 小时预演' : '24 小时预演';
  $('preview-icon').textContent = dayActive ? '■' : '▶';

  $('year-preview-toggle').classList.toggle('selected', yearActive);
  $('year-preview-toggle').setAttribute('aria-pressed', String(yearActive));
  $('year-preview-label').textContent = yearActive ? '退出四季预演' : '365 天 · 四季预演';
  $('year-preview-icon').textContent = yearActive ? '■' : '◉';

  $('clock-mode-label').textContent = active ? '预演时刻' : '当前时刻';
  $('globe-mode-label').textContent = yearActive ? 'SEASONS · 1 YEAR' : dayActive ? '24H TIME-LAPSE' : 'LIVE ILLUMINATION';
  $('globe-mode').classList.toggle('is-preview', active);
  $('header-status').classList.toggle('is-preview', active);
  $('header-status-label').textContent = yearActive ? 'PREVIEW · +1 YEAR' :
    dayActive ? 'PREVIEW · +24H' : 'LIVE · REAL TIME';

  $('preview-heading').textContent = yearActive ? '365D / SEASONS' : '24H / TIME-LAPSE';
  $('preview-start-label').textContent = '从当前时刻开始';
  $('preview-end-label').textContent = yearActive ? '未来一个回归年' : '未来 24 小时';
}

function showPreviewProgress(progress) {
  if (previewState?.type === 'year') {
    const days = Math.floor(progress * TROPICAL_YEAR_DAYS);
    $('preview-elapsed').textContent = '+' + String(days).padStart(3, '0') + ' 天 / 365 天';
  } else {
    const elapsedMinutes = Math.floor(progress * 1440);
    const hours = String(Math.floor(elapsedMinutes / 60)).padStart(2, '0');
    const minutes = String(elapsedMinutes % 60).padStart(2, '0');
    $('preview-elapsed').textContent = '+' + hours + ':' + minutes + ' / +24:00';
  }
  $('preview-track-fill').style.width = (progress * 100).toFixed(2) + '%';
  $('preview-track').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}

function stopPreview() {
  previewState = null;
  setPreviewUI();
  lastLiveSecond = -1;
  renderAt(new Date());
}

function startPreview(type) {
  if (previewState?.type === type) {
    stopPreview();
    return;
  }
  const now = new Date();
  previewState = {
    type, realStartEpochMs: now.getTime(),
    animationStartMs: performance.now(), lastRenderedAt: -Infinity,
  };
  setPreviewUI();
  showPreviewProgress(0);
  renderAt(now);
}

$('preview-toggle').addEventListener('click', () => startPreview('day'));
$('year-preview-toggle').addEventListener('click', () => startPreview('year'));

function animate(timestamp) {
  requestAnimationFrame(animate);
  controls.update();
  animateCityCamera(timestamp);

  if (previewState) {
    const timeFunction = previewState.type === 'year' ? yearPreviewFrame : previewFrame;
    const frame = timeFunction(previewState.realStartEpochMs, previewState.animationStartMs, timestamp);
    if (frame.complete) {
      stopPreview();
    } else if (timestamp - previewState.lastRenderedAt >= (previewState.type === 'year' ? 16 : 50)) {
      previewState.lastRenderedAt = timestamp;
      renderAt(frame.date);
      showPreviewProgress(frame.progress);
    }
  } else {
    const now = new Date();
    const second = Math.floor(now.getTime() / 1000);
    if (second !== lastLiveSecond) {
      lastLiveSecond = second;
      renderAt(now);
    }
  }

  updatePin($('city-pin'), geoVector(activeCity.latitude, activeCity.longitude, GLOBE_RADIUS * 1.018));
  for (const marker of cityDots) {
    updatePin(marker.element, geoVector(marker.city.latitude, marker.city.longitude, GLOBE_RADIUS * 1.019));
  }
  updatePin($('sun-pin'), currentSun.clone().multiplyScalar(GLOBE_RADIUS * 1.018));
  if (currentView !== 'orbit') renderer.render(scene, camera);
  if (currentView !== 'earth') orbitViewer.render();
}
requestAnimationFrame(animate);
