import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined), headless: true });
try {
  const page = await browser.newPage();
  const origin = new URL(process.env.CANVAS_AUDIT_URL || 'http://127.0.0.1:3000').origin;
  const requests = [], errors = [], warnings = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/No version information|MathJax.*failed|Tracking Prevention/i.test(message.text())) warnings.push(message.text()); });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('worksheets', JSON.stringify([{
      id: 'print-test', name: 'Print local MathJax', createdAt: '2026-10-25',
      content: { chapter: 'MathJax', exercises: [{ id: 'e', title: '', statement: '', questions: [
        { text: 'FORMULE-LOCALE $\\require{cancel}\\cancel{x}+\\text{test }\\color{red}{y}$', answerHeight: 120 },
      ] }] },
    }]));
    window.printCount = 0;
    window.print = () => {
      window.printCount++;
      window.printedSvg = document.querySelectorAll('main mjx-container svg').length;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.goto(origin);
  await page.locator('article[title^="Print local MathJax"]').click();
  const header = page.locator('.latex-document-header');
  assert.equal(await header.getByRole('heading', { level: 1 }).innerText(), 'MathJax', 'the header shows the chapter, independently of the worksheet name');
  assert.equal(await header.locator('time').count(), 1);
  assert.equal(await header.locator('.worksheet-title-rule, .worksheet-title-crown').count(), 0);
  assert.ok(!/Classe|2026-2027/.test(await header.innerText()));
  const clickPrint = async () => {
    await page.getByRole('button', { name: 'Option', exact: true }).click();
    await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  };
  // First click is made without waiting for MathJax's typesetting queue.
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 1);
  assert.ok(await page.evaluate(() => window.printedSvg > 0), 'formulas must finish typesetting before print is called');
  assert.ok(!requests.some(url => /cdn\.jsdelivr\.net.*(?:mathjax|tex\/)/i.test(url)), 'standard MathJax and font must stay on the app origin');
  assert.ok(requests.some(url => url.endsWith('/mathjax/tex-svg.js')));
  assert.ok(requests.some(url => url.endsWith('/mathjax/input/tex/extensions/cancel.js')));
  assert.deepEqual(warnings, []);
  console.log('PASS local MathJax, extension loading, blocked third parties, typesetting before Print');

  // Some browsers/print integrations return without firing afterprint.
  await page.evaluate(() => {
    window.print = () => {
      window.printCount++;
      window.printedSvg = document.querySelectorAll('main mjx-container svg').length;
    };
  });
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 2);
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 3, undefined, { timeout: 3000 });
  console.log('PASS repeat Print when afterprint is missing');

  // Native printing returns immediately; retain the guard until its dialog
  // closes, but recover through media/focus when the native callback is absent.
  await page.evaluate(() => { window.AndroidNative = { printDocument: () => { window.printCount++; } }; });
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 4);
  await clickPrint();
  assert.equal(await page.evaluate(() => window.printCount), 4, 'an active native job must reject duplicate clicks');
  await page.evaluate(() => {
    window.printMediaEvents = [];
    window.matchMedia('print').addEventListener('change', event => window.printMediaEvents.push(event.matches));
  });
  await page.emulateMedia({ media: 'print' });
  await page.waitForFunction(() => window.printMediaEvents.at(-1) === true);
  await page.emulateMedia({ media: 'screen' });
  await page.waitForFunction(() => window.printMediaEvents.at(-1) === false);
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 5);
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 6);
  await page.evaluate(() => { window.dispatchEvent(new Event('worksheet-native-print-finished')); delete window.AndroidNative; });
  console.log('PASS duplicate guard, print media exit, focus return and native completion');
  await page.evaluate(() => {
    window.print = () => {
      window.printCount++;
      window.printedSvg = document.querySelectorAll('main mjx-container svg').length;
      window.dispatchEvent(new Event('afterprint'));
    };
  });

  // A font provider that never settles must not lock the button.
  await page.evaluate(() => Object.defineProperty(document.fonts, 'ready', { configurable: true, get: () => new Promise(() => {}) }));
  await clickPrint();
  await page.getByRole('status').filter({ hasText: 'Préparation' }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 7, undefined, { timeout: 6000 });
  await page.evaluate(() => delete document.fonts.ready);
  console.log('PASS hung web-font readiness uses fallback and still opens Print');

  await page.evaluate(() => {
    const image = document.images[0];
    window.originalImageDecode = image.decode;
    image.decode = () => new Promise(() => {});
  });
  await clickPrint();
  await page.getByRole('alert').filter({ hasText: 'Images du document' }).waitFor({ timeout: 12000 });
  assert.equal(await page.evaluate(() => window.printCount), 7);
  assert.ok(!await page.getByRole('status').filter({ hasText: 'Préparation' }).count());
  await page.evaluate(() => { document.images[0].decode = window.originalImageDecode; });
  await clickPrint();
  await page.waitForFunction(() => window.printCount === 8);
  assert.equal(await page.getByRole('alert').count(), 0, 'retry clears the previous preparation error');
  console.log('PASS stalled image reports a finite error, releases Print and permits retry');
  await page.getByRole('button', { name: 'Option', exact: true }).click();
  await page.getByRole('button', { name: 'Édition', exact: true }).click();
  await header.getByRole('heading', { level: 1 }).dblclick();
  await header.getByRole('textbox').fill('Logique et Raisonnements');
  await header.getByRole('textbox').press('Tab');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('worksheets'))[0].content.chapter === 'Logique et Raisonnements');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('worksheets'))[0].name), 'Print local MathJax');
  const output = resolve('tmp/header-print');
  mkdirSync(output, { recursive: true });
  await header.screenshot({ path: resolve(output, 'entete.png') });
  console.log('PASS minimal header, chapter editing preserves worksheet name');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
