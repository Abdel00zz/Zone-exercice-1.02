import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const html = readFileSync('dist/index.html', 'utf8');
const worker = readFileSync('dist/sw.js', 'utf8');
assert.ok(!html.includes('cdn.tailwindcss.com'), 'Tailwind must be compiled locally');
assert.ok(!worker.includes('__BUILD_ID__'), 'service worker must have a build fingerprint');
assert.ok(!worker.includes('__PRECACHE_ASSETS__'), 'service worker must have a precache manifest');

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined),
  headless: true,
});
try {
  const origin = new URL(process.env.OFFLINE_AUDIT_URL || 'http://127.0.0.1:4173').origin;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // A fresh profile starts with no browser HTTP cache, fonts or CDN resources.
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelectorAll('button').length > 5);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cachedPaths = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('mathplus-fiches-'));
    const cache = await caches.open(names.at(-1));
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  const localAssets = [...html.matchAll(/(?:href|src)="(\/assets\/[^"\s]+)"/g)].map((match) => match[1]);
  assert.ok(localAssets.some((asset) => asset.endsWith('.css')), 'build must include local CSS');
  for (const asset of localAssets) assert.ok(cachedPaths.includes(asset), `${asset} must be precached`);
  const lazyChunk = cachedPaths.find((asset) => /ConfigurationModal-.*\.js$/.test(asset));
  assert.ok(lazyChunk, 'unopened settings chunk must be installed in the offline shell');
  const initial = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'fixed flex';
    document.body.append(probe);
    const result = { display: getComputedStyle(probe).display, position: getComputedStyle(probe).position };
    probe.remove();
    return result;
  });
  assert.deepEqual(initial, { display: 'flex', position: 'fixed' }, 'utilities must work with all CDNs blocked');
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto(origin, { waitUntil: 'domcontentloaded' });
  await offline.waitForFunction(() => document.querySelectorAll('button').length > 5);
  assert.equal(await offline.evaluate(async (asset) => (await fetch(asset)).ok, lazyChunk), true,
    'a never-opened modal must be loadable offline');
  const offlineStyle = await offline.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'fixed flex';
    document.body.append(probe);
    return { display: getComputedStyle(probe).display, position: getComputedStyle(probe).position };
  });
  assert.deepEqual(offlineStyle, initial, 'offline relaunch must keep local utility CSS');
  const before = await offline.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find((name) => name.startsWith('mathplus-fiches-')));
    return (await cache.keys()).length;
  });
  await offline.evaluate(async () => { try { await fetch('/api/sync/pull'); } catch { /* expected offline */ } });
  const after = await offline.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find((name) => name.startsWith('mathplus-fiches-')));
    return (await cache.keys()).length;
  });
  assert.equal(after, before, 'cloud API must never be added to the offline cache');
  console.log(`PASS offline cold profile, blocked CDNs, ${cachedPaths.length} precached files, local CSS, lazy chunk, cloud bypass`);
  await context.close();
} finally {
  await browser.close();
}
