import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const origin = process.env.SMOKE_URL || 'http://127.0.0.1:8000';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage();
const pageErrors = [];
const failedRequests = [];
page.on('pageerror', e => pageErrors.push(e.stack || e.message));
page.on('requestfailed', r => failedRequests.push(r.url() + ': ' + (r.failure()?.errorText || 'unknown')));
page.on('console', msg => {
  if (msg.type() === 'error') console.error('BROWSER CONSOLE:', msg.text());
});

try {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#preview-toggle', { timeout: 10000 });

  // The button's presence alone does not establish that the JS module executed.
  await page.waitForFunction(() => {
    const clock = document.querySelector('#beijing-time');
    return clock?.textContent && !clock.textContent.includes('--');
  }, { timeout: 25000 });

  // This checks that actual image data loaded, not merely that a WebGL canvas exists.
  await page.waitForFunction(
    () => document.querySelector('#map-quality')?.textContent.includes('K MAP'),
    { timeout: 30000 },
  );
  assert.equal(await page.$eval('#globe-error', el => el.hidden), true,
    'Earth images should load without an error');
  assert.equal(await page.evaluate(() => document.body.textContent.includes('从太空看地球')), false,
    'The removed intro copy must stay absent');
  assert.equal(await page.evaluate(() => document.body.textContent.includes('地球从不停止转动')), false,
    'The removed bottom slogan must stay absent');
  assert.equal(await page.$eval('.details-panel', el => el !== null).catch(() => false), false,
    'The old right-hand solar and legend panels should be removed');
  const mapLabel = await page.$eval('#map-quality', el => el.textContent);
  console.log('Desktop texture loaded:', mapLabel);
  const globeWidth = await page.$eval('#globe-stage', el => el.getBoundingClientRect().width);
  assert.ok(globeWidth > 300, 'The shared Earth view should remain legible beside the orbit');
  assert.ok(await page.$('#orbit-mount canvas'), 'Heliocentric orbit must render its own interactive 3D canvas');
  assert.equal(await page.$eval('#visualization-layout', el => el.dataset.view), 'dual');

  // Visual layout regression: the screenshot issue was a stale stylesheet
  // and a globe viewport allowed to exceed the available desktop height.
  const desktopSizes = [
    [1568, 890],
    [1440, 820],
    [1024, 768],
  ];
  for (const [width, height] of desktopSizes) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await new Promise(resolve => setTimeout(resolve, 180));
    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const button = document.querySelector('.city-chip');
      return {
        innerWidth, innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        topbar: rect('.topbar'),
        stage: rect('#globe-stage'),
        footer: rect('.footer'),
        cityNav: rect('.city-presets'),
        controls: rect('.globe-bottom'),
        chipRadius: getComputedStyle(button).borderTopLeftRadius,
        cssUrl: document.querySelector('link[rel="stylesheet"]').getAttribute('href'),
      };
    });
    assert.ok(layout.cssUrl.startsWith('./assets/styles-'), 'Stylesheet URL must include its content hash');
    assert.ok(parseFloat(layout.chipRadius) >= 20, 'The city chips should load the new rounded styling');
    assert.ok(layout.scrollWidth <= width + 2, 'Desktop has unexpected horizontal overflow: ' + JSON.stringify(layout));
    assert.ok(layout.scrollHeight <= height + 2, 'Desktop is too tall and clips controls: ' + JSON.stringify(layout));
    assert.ok(layout.topbar.top >= -1 && layout.footer.bottom <= height + 2,
      'Header/footer should both remain visible: ' + JSON.stringify(layout));
    assert.ok(layout.cityNav.bottom <= layout.stage.top + 2, 'City controls overlap the globe');
    assert.ok(layout.stage.bottom <= layout.controls.top + 2, 'Globe overlaps the control toolbar');
    assert.ok(layout.stage.height >= 325, 'Globe has insufficient viewport height: ' + JSON.stringify(layout));
    console.log('Desktop layout fits without clipping:', width, 'x', height,
      'globe stage', Math.round(layout.stage.width), 'x', Math.round(layout.stage.height));
  }
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  const canvas = await page.$('#globe-mount canvas');
  assert.ok(canvas, 'Three.js should create a globe canvas');

  // Both displays share UTC time, while the Sun stays fixed at the center of
  // the second scene. Switching modes must not reset the global time.
  for (const mode of ['orbit', 'earth', 'dual']) {
    await page.click('.mode-button[data-view="' + mode + '"]');
    assert.equal(await page.$eval('#visualization-layout', el => el.dataset.view), mode);
    assert.equal(await page.$eval('.mode-button[data-view="' + mode + '"]', el => el.getAttribute('aria-pressed')), 'true');
  }
  console.log('Earth, orbit and synchronized dual modes: PASS');
  const orbitBefore = await page.$eval('#orbit-stage', el => ({
    longitude: Number(el.dataset.orbitLongitude), spin: Number(el.dataset.earthRotation),
    time: el.dataset.simulationUtc,
  }));
  assert.ok(Number.isFinite(orbitBefore.longitude) && Number.isFinite(orbitBefore.spin));

  await page.click('#year-preview-toggle');
  await page.waitForFunction(() => document.body.dataset.timeMode === 'year', { timeout: 5000 });
  await page.waitForFunction(
    (startTime) => Date.parse(document.querySelector('#orbit-stage')?.dataset.simulationUtc) > Date.parse(startTime) + 86400000,
    { timeout: 12000 }, orbitBefore.time,
  );
  const orbitDuring = await page.$eval('#orbit-stage', el => ({
    longitude: Number(el.dataset.orbitLongitude),
    time: el.dataset.simulationUtc,
  }));
  assert.ok(Math.abs(orbitDuring.longitude - orbitBefore.longitude) > .008,
    'Earth must physically move along its orbit during seasonal playback');
  assert.ok(Date.parse(orbitDuring.time) > Date.parse(orbitBefore.time) + 86400000,
    'Seasonal preview must advance simulated UTC date');
  assert.equal(await page.$eval('#preview-heading', el => el.textContent), '365D / 12 MIN · SEASONS');
  await page.click('#year-preview-toggle');
  await page.waitForFunction(() => document.body.dataset.timeMode === 'live', { timeout: 5000 });
  assert.equal(await page.$eval('#year-preview-label', el => el.textContent), '365 天 · 四季预演');
  console.log('Seasonal year playback, synchronized orbit and return to live: PASS');

  // Real browser test of six geographic camera targets, including both hemispheres.
  const cityChecks = [
    ['beijing', '北京'],
    ['xiongan', '雄安'],
    ['xian', '西安'],
    ['urumqi', '乌鲁木齐'],
    ['london', '伦敦'],
    ['silicon-valley', '硅谷'],
  ];
  assert.equal(await page.evaluate(() => document.querySelectorAll('.city-chip').length), 6);
  assert.equal(await page.$eval('#globe-stage', el => el.dataset.focusCity), 'beijing');
  for (const [id, name] of cityChecks) {
    await page.click('.city-chip[data-city="' + id + '"]');
    await page.waitForFunction(
      (expectedId) => document.querySelector('#globe-stage')?.dataset.focusCity === expectedId,
      { timeout: 3000 },
      id,
    );
    await page.waitForFunction(
      (expectedId) => {
        const dot = document.querySelector('.map-city-dot[data-city="' + expectedId + '"]');
        const marker = document.querySelector('#city-pin');
        return dot?.classList.contains('is-selected') && parseFloat(marker.style.opacity || '0') > .8;
      },
      { timeout: 3500 },
      id,
    );
    // The previously visible selected dot and the labeled pin represented
    // the same city, but CSS shifted the pin. Keep exactly one highlight,
    // centered on the projected geographic point.
    const pinAlignment = await page.evaluate((expectedId) => {
      const stage = document.querySelector('#globe-stage');
      const pin = document.querySelector('#city-pin');
      const node = pin.querySelector('.pin-node');
      const originalDot = document.querySelector('.map-city-dot[data-city="' + expectedId + '"]');
      const stageRect = stage.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      return {
        duplicateHidden: getComputedStyle(originalDot).display === 'none',
        offsetX: Math.abs(nodeRect.left + nodeRect.width / 2 - (stageRect.left + parseFloat(pin.style.left))),
        offsetY: Math.abs(nodeRect.top + nodeRect.height / 2 - (stageRect.top + parseFloat(pin.style.top))),
      };
    }, id);
    assert.equal(pinAlignment.duplicateHidden, true, id + ' must not have a duplicate colored dot');
    assert.ok(pinAlignment.offsetX <= 1.5 && pinAlignment.offsetY <= 1.5,
      id + ' marker must match its projected location: ' + JSON.stringify(pinAlignment));
    assert.equal(await page.$eval('#focused-city-label', el => el.textContent.includes(name)), true);
    assert.equal(await page.$eval('.city-chip[data-city="' + id + '"]', el => el.getAttribute('aria-pressed')), 'true');
  }
  console.log('Six city presets navigate and show focused markers: PASS');

  await page.click('#reset-view');
  assert.equal(await page.$eval('#globe-stage', el => el.dataset.focusCity), 'beijing');
  console.log('Default Beijing camera reset: PASS');

  await page.click('#preview-toggle');
  await page.waitForFunction(
    () => document.querySelector('#preview-button-label')?.textContent === '退出 24 小时预演',
    { timeout: 5000 },
  );
  assert.equal(await page.$eval('#preview-overlay', el => el.hidden), false);

  await page.waitForFunction(
    () => Number(document.querySelector('#preview-track')?.getAttribute('aria-valuenow')) >= 4,
    { timeout: 7000 },
  );
  const progress = await page.$eval('#preview-track', el => Number(el.getAttribute('aria-valuenow')));
  console.log('Preview advances:', progress + '%');

  await page.click('#preview-toggle');
  await page.waitForFunction(
    () => document.querySelector('#preview-button-label')?.textContent === '24 小时预演',
    { timeout: 5000 },
  );
  assert.equal(await page.$eval('#preview-overlay', el => el.hidden), true);
  assert.equal(await page.$eval('#clock-mode-label', el => el.textContent), '当前时刻');
  console.log('Preview exits to live time: PASS');
  // Mobile should use lower GPU memory without sacrificing the 2K asset tier.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('#map-quality')?.textContent.includes('2K MAP'),
    { timeout: 30000 },
  );
  assert.equal(await page.$eval('#globe-error', el => el.hidden), true);
  console.log('Mobile texture loaded:', await page.$eval('#map-quality', el => el.textContent));
  assert.equal(await page.evaluate(() => document.querySelectorAll('.city-chip').length), 6);
  await page.click('.city-chip[data-city="london"]');
  await page.waitForFunction(() => document.querySelector('#globe-stage')?.dataset.focusCity === 'london',
    { timeout: 3000 });
  assert.equal(await page.$eval('.city-chip[data-city="london"]', el => el.getAttribute('aria-pressed')), 'true');
  console.log('Mobile city picker: PASS');
  if (pageErrors.length) throw new Error('Browser JS errors:\n' + pageErrors.join('\n'));
  console.log('PASS: browser button, simulated time, manual exit and globe canvas');
} catch (err) {
  console.error('BROWSER SMOKE TEST FAILED:', err.stack || err);
  console.error('PAGE ERRORS:', pageErrors);
  console.error('FAILED REQUESTS:', failedRequests.slice(0, 30));
  await page.screenshot({ path: '/tmp/earthlight-smoke-failed.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
