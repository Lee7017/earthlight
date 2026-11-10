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

  const canvas = await page.$('#globe-mount canvas');
  assert.ok(canvas, 'Three.js should create a globe canvas');

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
