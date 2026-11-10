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
