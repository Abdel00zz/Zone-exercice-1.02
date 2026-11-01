import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined), headless: true });
const output = resolve(process.env.SETTINGS_AUDIT_OUTPUT || 'tmp/settings-audit');
mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(process.env.CANVAS_AUDIT_URL || 'http://127.0.0.1:3000').origin;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('settings-regression-seeded')) {
      const ink = [{ color: '#2563eb', width: 3, points: [{ x: 20, y: 20, pressure: 0.6 }, { x: 80, y: 30, pressure: 0.6 }] }];
      localStorage.setItem('worksheets', JSON.stringify([{
        id: 'settings', name: 'Réglages test', createdAt: '2026-10-25', content: {
          chapter: 'Branchements', exercises: [
            { id: 'e1', title: '', statement: 'Énoncé annoté', statementStrokes: ink, questions: [
              { id: 'p', text: 'Parent', answerHeight: 80, subquestions: [
                { id: 'a', text: 'Petite réponse', answerHeight: 70, strokes: ink, solution: 'CORRIGE-IMPRIMABLE' },
                { id: 'b', text: 'Grande réponse', answerHeight: 500, answerStyle: 'grid', answerColor: 'blue', subquestions: [
                  { id: 'deep', text: 'Sous-question profonde', answerHeight: 80 },
                ] },
              ] },
              { id: 'fallback', text: 'Hauteur héritée' },
            ] },
            { id: 'e2', title: '', statement: 'Sans questions', questions: [] },
          ],
        },
      }]));
      localStorage.setItem('app-configuration', JSON.stringify({ userName: 'Prof test', schoolYear: '2030-2031', textFont: 'serif', mathFont: 'mathjax-newcm', handwritingFont: 'cursive', textScale: 110, mathScale: 100, paperTheme: 'classic' }));
      localStorage.setItem('settings-regression-seeded', '1');
    }
    window.print = () => {
      window.printHeights = [...document.querySelectorAll('[data-answer-space-surface]')].map(el => el.getBoundingClientRect().height);
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.goto(origin);
  const openWorksheet = () => page.locator('article[title^="Réglages test"]').click();
  await openWorksheet();
  const surfaces = page.locator('[data-answer-space-surface]');
  const heights = () => surfaces.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('worksheets'))[0].content);
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Option', exact: true }).click();
    await page.getByRole('button', { name: 'Configuration', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    return page.getByRole('dialog');
  };
  const save = async dialog => {
    await page.evaluate(() => {
      window.settingsSaved = false;
      const onSave = event => {
        if (event.detail?.key !== 'worksheets') return;
        window.settingsSaved = true;
        window.removeEventListener('storage-save-success', onSave);
      };
      window.addEventListener('storage-save-success', onSave);
    });
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.settingsSaved);
  };
  const setMinimum = async (dialog, minimum) => {
    const input = dialog.getByRole('slider', { name: /Hauteur minimale/ });
    await input.fill(String(minimum));
  };
  await page.waitForFunction(() => document.querySelectorAll('[data-answer-space-surface]').length === 7);
  assert.ok((await heights()).every(height => height >= 120));
  let dialog = await openSettings();
  await setMinimum(dialog, 300);
  await save(dialog);
  assert.deepEqual(await heights(), [300, 300, 300, 500, 300, 300, 300]);
  // Rendering a minimum must not destructively replace the saved local height.
  assert.equal((await stored()).exercises[0].questions[0].subquestions[0].answerHeight, 70);
  assert.equal((await stored()).settings.schoolYear, undefined);
  assert.ok(!(await page.locator('.latex-document-header').innerText()).includes('2030-2031'));
  const small = page.locator('#worksheet-search-exercise-e1-questions-0-subquestions-0 > .answer-space');
  const handle = small.getByRole('slider');
  assert.equal(await handle.getAttribute('aria-valuemin'), '300');
  await handle.focus();
  await handle.press('Home');
  await handle.press('ArrowUp');
  assert.equal(await small.locator('[data-answer-space-surface]').evaluate(el => el.getBoundingClientRect().height), 300);
  const bounds = await handle.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 250, { steps: 8 });
  await page.mouse.up();
  assert.equal(await small.locator('[data-answer-space-surface]').evaluate(el => el.getBoundingClientRect().height), 300);
  await small.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const surface = document.querySelector('#worksheet-search-exercise-e1-questions-0-subquestions-0 [data-answer-space-surface]');
    const canvas = surface.querySelector('canvas');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && Math.abs(canvas.height / (canvas.width / rect.width) - rect.height) < 2;
  });
  console.log('PASS minimum: existing heights, nested questions, statement ink, mouse, keyboard and bitmap');

  await page.reload();
  await openWorksheet();
  assert.deepEqual(await heights(), [300, 300, 300, 500, 300, 300, 300]);
  dialog = await openSettings();
  await setMinimum(dialog, 60);
  await save(dialog);
  assert.deepEqual(await heights(), [60, 70, 80, 500, 80, 60, 60]);
  assert.equal((await stored()).exercises[0].statementStrokes.length, 1);
  console.log('PASS persistence, lowering the minimum, larger local answers and ink preservation');

  dialog = await openSettings();
  await dialog.getByLabel('Style de lignes / quadrillage').selectOption('seyes');
  const preview = dialog.locator('[data-answer-space-preview]');
  assert.equal(await preview.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await preview.locator('svg').first().locator('pattern line').count(), 5);
  await save(dialog);
  assert.equal(await surfaces.nth(3).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(30, 58, 138)', 'local custom background must be retained');
  assert.equal(await surfaces.first().locator('svg').first().locator('pattern line').count(), 5);
  dialog = await openSettings();
  await dialog.getByLabel('Couleur de fond du canevas').selectOption('cream');
  await dialog.getByRole('checkbox', { name: /Appliquer ce style et cette couleur/ }).check();
  await save(dialog);
  assert.ok((await surfaces.evaluateAll(elements => elements.map(el => getComputedStyle(el).backgroundColor))).every(color => color === 'rgb(254, 243, 199)'));
  assert.equal((await stored()).exercises[0].questions[0].subquestions[1].subquestions[0].answerStyle, 'seyes');
  console.log('PASS shared preview, style/color inheritance and explicit application at every depth');

  const inkBefore = (await stored()).exercises[0].questions[0].subquestions[0].strokes;
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Afficher les zones de réponse/ }).uncheck();
  await save(dialog);
  assert.equal(await surfaces.count(), 0);
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Afficher les zones de réponse/ }).check();
  await dialog.getByRole('checkbox', { name: /Une question par page/ }).check();
  await setMinimum(dialog, 300);
  await dialog.getByLabel('Thème de la page').selectOption('rose');
  await dialog.getByLabel('Année scolaire').fill('2040-2041');
  await save(dialog);
  assert.equal(await surfaces.count(), 7);
  assert.equal(await page.locator('[data-question-page]').count(), 6);
  assert.equal(await page.locator('.worksheet-typography').getAttribute('data-paper-theme'), 'rose');
  assert.equal((await stored()).settings.schoolYear, '2040-2041');
  assert.deepEqual((await stored()).exercises[0].questions[0].subquestions[0].strokes, inkBefore);
  const correction = page.getByText('CORRIGE-IMPRIMABLE', { exact: true });
  assert.equal(await correction.count(), 0);
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Ouvrir les corrigés/ }).check();
  await save(dialog);
  await correction.waitFor({ state: 'visible' });
  assert.equal((await stored()).settings.showSolutions, true);
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Ouvrir les corrigés/ }).uncheck();
  await save(dialog);
  assert.equal(await correction.count(), 0);
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Mode Diaporama/ }).check();
  await save(dialog);
  await page.getByRole('navigation', { name: 'Navigation du diaporama' }).waitFor();
  assert.equal(await page.locator('[data-question-page]:visible').count(), 1);
  await page.getByRole('button', { name: 'Question suivante', exact: true }).click();
  assert.match(await page.locator('[data-question-page]:visible').innerText(), /Petite réponse/);
  dialog = await openSettings();
  await dialog.getByRole('checkbox', { name: /Mode Diaporama/ }).uncheck();
  await dialog.getByLabel('Année scolaire').fill('');
  await save(dialog);
  assert.equal((await stored()).settings.schoolYear, undefined);
  dialog = await openSettings();
  assert.equal(await dialog.getByLabel('Année scolaire').getAttribute('placeholder'), '2030-2031');
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.getByRole('button', { name: 'Option', exact: true }).click();
  await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
  await page.waitForFunction(() => window.printHeights?.length === 7);
  assert.ok((await page.evaluate(() => window.printHeights)).every(height => height >= 300));
  await page.emulateMedia({ media: 'print' });
  assert.ok((await heights()).every(height => height >= 300));
  await page.pdf({ path: resolve(output, 'reglages-impression.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  assert.deepEqual(errors, []);
  console.log('PASS canvas visibility, corrections, page theme, school-year inheritance, pagination, slideshow and Print');
} finally {
  await browser.close();
}
