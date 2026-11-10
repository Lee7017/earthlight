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
  assert.equal(await page.$eval('.details-panel', el => el !== null).catch(() => false), false,
    'The old right-hand solar and legend panels should be removed');
  const mapLabel = await page.$eval('#map-quality', el => el.textContent);
  console.log('Desktop texture loaded:', mapLabel);
  const globeWidth = await page.$eval('#globe-stage', el => el.getBoundingClientRect().width);
  assert.ok(globeWidth > 500, 'The Earth should have a larger desktop viewport');

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
    assert.equal(await page.$eval('#focused-city-label', el => el.textContent.includes(name)), true);
    assert.equal(await page.$eval('.city-chip[data-city="' + id + '"]', el => el.getAttribute('aria-pressed')), 'true');
  }
  console.log('Six city presets navigate and show focused markers: PASS');

  await page.click('#reset-view');
  assert.equal(await page.$eval('#globe-stage', el => el.dataset.focusCity), 'beijing');
  console.log('Default Beijing camera reset: PASS');

  await page.click('#preview-toggle');
  await page.waitForFunction(
    () => document.querySelector('#preview-button-label')?.textContent === '退出预演',
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
