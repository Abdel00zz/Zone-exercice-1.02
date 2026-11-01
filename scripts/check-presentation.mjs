import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const output = resolve(process.env.PRESENTATION_AUDIT_OUTPUT || 'tmp/presentation-audit');
mkdirSync(output, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const worksheets = ['pages', 'slides', 'continuous'].map(mode => ({
    id: mode, name: `Audit ${mode}`, createdAt: '2026-10-25', content: {
      chapter: `Audit ${mode}`,
      settings: { oneQuestionPerPage: mode === 'pages', presentationMode: mode === 'slides', answerSpaceStyle: 'grid' },
      exercises: [{ id: 'ex1', title: 'PREMIER EXERCICE', statement: 'CONTEXTE-EX1', questions: [
        { id: 'parent', text: 'PARENT-INTRO \\pause PARENT-DETAIL', subquestions: [
          { id: 'a', text: 'LEAF-A \\pause LEAF-A-STEP2 \\only<2>{ONLY-SECOND}', solution: 'SECRET-CORRECTION-A', answerHeight: 120 },
          { id: 'silent', text: '', subquestions: [{ id: 'deep', text: 'DEEP-I', answerHeight: 120 }] },
        ] },
        { id: 'b', text: 'LEAF-B', answerHeight: 120 },
      ] }, { id: 'ex2', title: 'EXERCICE SANS QUESTIONS', statement: 'CONTEXTE-ONLY', questions: [] }],
    },
  }));
  await page.addInitScript(worksheets => localStorage.setItem('worksheets', JSON.stringify(worksheets)), worksheets);
  await page.goto(process.env.CANVAS_AUDIT_URL || 'http://127.0.0.1:3000/');
  await page.locator('article[title^="Audit pages"]').click();
  assert.equal(await page.locator('[data-question-page]').count(), 5, 'all significant nodes including the exercise introduction must be pages');
  assert.equal(await page.locator('.question-page-break').count(), 3);
  await page.evaluate(async () => { await (await import('/utils/worksheetPrint.ts')).prepareWorksheetPrint(); });
  const pdf = resolve(output, 'questions-par-page.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const info = execFileSync(process.env.PDFINFO || 'pdfinfo', [pdf], { encoding: 'utf8' });
  assert.match(info, /Pages:\s+5\b/, 'each logical question must fit its own page in this short fixture');
  const text = process.env.PDF_PYTHON
    ? execFileSync(process.env.PDF_PYTHON, ['-c', "import sys; from pypdf import PdfReader; sys.stdout.reconfigure(encoding='utf-8'); print('\\f'.join(p.extract_text() or '' for p in PdfReader(sys.argv[1]).pages))", pdf], { encoding: 'utf8' })
    : execFileSync(process.env.PDFTOTEXT || 'pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const printed = text.split('\f').filter(part => part.trim());
  assert.equal(printed.length, 5);
  assert.ok(printed[1].includes('LEAF-A-STEP2') && printed[1].includes('ONLY-SECOND'), 'print must reveal every statement overlay');
  assert.ok(printed[1].includes('PARENT-DETAIL') && printed[2].includes('PARENT-DETAIL'), 'subquestions retain their parent context');
  assert.ok(printed[2].includes('DEEP-I'));
  assert.ok(printed[3].includes('LEAF-B'));
  assert.ok(printed[4].includes('CONTEXTE-ONLY'));
  assert.ok(!text.includes('SECRET-CORRECTION-A'), 'closed corrections must stay closed when printing');
  console.log('PASS PDF: five pages, nested questions, full overlays, closed corrections');

  await page.reload();
  await page.locator('article[title^="Audit slides"]').click();
  const visiblePages = () => page.locator('[data-question-page]:visible');
  await page.getByRole('navigation', { name: 'Navigation du diaporama' }).waitFor();
  assert.equal(await visiblePages().count(), 1);
  await page.getByRole('button', { name: 'Question suivante', exact: true }).click();
  await page.waitForTimeout(100);
  assert.match(await visiblePages().innerText(), /LEAF-A/);
  assert.ok(!(await visiblePages().innerText()).includes('LEAF-A-STEP2'));
  await visiblePages().locator('.question-beamer-scope').focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await visiblePages().innerText(), /LEAF-A-STEP2/);
  assert.match(await page.getByRole('status').innerText(), /2 \/ 5/);
  await page.keyboard.press('ArrowRight');
  assert.match(await visiblePages().innerText(), /DEEP-I/);
  await page.keyboard.press('PageDown');
  assert.match(await visiblePages().innerText(), /LEAF-B/);
  await page.keyboard.press('End');
  assert.match(await visiblePages().innerText(), /CONTEXTE-ONLY/);
  await page.keyboard.press('Home');
  assert.match(await visiblePages().innerText(), /PARENT-INTRO/);
  await page.screenshot({ path: resolve(output, 'diaporama.png') });
  console.log('PASS slides: one active page, controls, local overlays and global keyboard navigation');

  await page.evaluate(async () => { await (await import('/utils/worksheetPrint.ts')).prepareWorksheetPrint(); });
  const slidePdf = resolve(output, 'diaporama-impression.pdf');
  await page.pdf({ path: slidePdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  assert.match(execFileSync('pdfinfo', [slidePdf], { encoding: 'utf8' }), /Pages:\s+5\b/);
  assert.equal(await page.locator('[data-question-page]:visible').count(), 1, 'printing returns to the selected slide');
  assert.deepEqual(errors, []);
  console.log('PASS print all slides and restore screen, no browser errors');
} finally {
  await browser.close();
}
