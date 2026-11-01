import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(edge) ? edge : undefined), headless: true });
const output = resolve(process.env.VECTOR_AUDIT_OUTPUT || 'tmp/vector-print-audit');
mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CANVAS_AUDIT_URL || 'http://127.0.0.1:3000');
  const parity = await page.evaluate(async () => {
    const { renderPrintInk } = await import('/components/canvas/printSvg.ts');
    const { drawStroke } = await import('/components/canvas/renderUtils.ts');
    const ns = 'http://www.w3.org/2000/svg';
    const point = (x, y, pressure = 0.6) => ({ x, y, pressure });
    const base = { color: '#1e293b', width: 3, points: [point(25, 25), point(120, 90)] };
    const shapes = ['line', 'arrow', 'double-arrow', 'angle', 'axes', 'rectangle', 'circle', 'triangle', 'right-triangle', 'diamond', 'parallelogram', 'pentagon', 'hexagon', 'freeform'];
    const samples = shapes.map(shapeType => ({ name: shapeType, strokes: [{ ...base, shapeType }] }));
    for (const penType of ['ballpoint', 'fountain', 'marker', 'pencil', 'brush', 'calligraphy']) samples.push({ name: penType, strokes: [{ ...base, penType, points: [point(20, 30, 0.2), point(40, 60, 0.8), point(80, 35, 0.7), point(120, 90, 0.4)] }] });
    for (const lineStyle of ['dashed', 'dotted']) samples.push({ name: lineStyle, strokes: [{ ...base, lineStyle }] });
    for (const highlighterType of ['chisel', 'round']) samples.push({ name: highlighterType, strokes: [{ ...base, color: '#fde047', width: 22, isHighlighter: true, highlighterType }] });
    samples.push({ name: 'point', strokes: [{ ...base, points: [point(50, 50)], penType: 'fountain' }] });
    samples.push({ name: 'eraser-order', strokes: [
      { ...base, width: 15, shapeType: 'line', points: [point(20, 60), point(135, 60)] },
      { ...base, width: 35, isEraser: true, points: [point(70, 20), point(70, 100)] },
      { ...base, color: '#2563eb', width: 5, shapeType: 'line', points: [point(70, 40), point(70, 80)] },
    ] });
    const results = [];
    for (const sample of samples) {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
      sample.strokes.forEach(stroke => drawStroke(ctx, stroke));
      const paper = document.createElementNS(ns, 'svg');
      paper.setAttribute('width', '320'); paper.setAttribute('height', '240'); paper.setAttribute('viewBox', '0 0 160 120');
      const group = document.createElementNS(ns, 'g'); paper.append(group);
      renderPrintInk(group, sample.strokes, 160, 120, `sample-${sample.name}`);
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(paper));
      await image.decode();
      const actual = document.createElement('canvas'); actual.width = 320; actual.height = 240;
      const actualCtx = actual.getContext('2d'); actualCtx.drawImage(image, 0, 0);
      const expectedPixels = ctx.getImageData(0, 0, 320, 240).data;
      const actualPixels = actualCtx.getImageData(0, 0, 320, 240).data;
      // Compare on white paper, including opacity and erasure, with a small
      // tolerance for the different antialiasing of native SVG and canvas.
      let difference = 0, inkPixels = 0;
      for (let pixel = 0; pixel < expectedPixels.length; pixel += 4) {
        if (expectedPixels[pixel + 3] || actualPixels[pixel + 3]) inkPixels++;
        for (let channel = 0; channel < 3; channel++) {
          const white = (pixels) => 255 - (255 - pixels[pixel + channel]) * pixels[pixel + 3] / 255;
          difference += Math.abs(white(expectedPixels) - white(actualPixels));
        }
      }
      results.push({ name: sample.name, meanError: difference / Math.max(1, inkPixels * 3), paths: paper.querySelectorAll('path').length });
    }
    return results;
  });
  for (const result of parity) {
    assert.ok(result.paths > 0, `${result.name} must export native SVG paths`);
    // Graphite's explicit SVG grains have sharper edges than the screen's
    // filtered texture tile; its pressure contour is shared and unchanged.
    const tolerance = result.name === 'pencil' ? 16 : 12;
    assert.ok(result.meanError < tolerance, `${result.name} differs from screen rendering: ${result.meanError.toFixed(2)}/255`);
  }
  console.log(`PASS ${parity.length} canvas/SVG parity cases, pressure profiles, every shape, dash, highlighter, eraser ordering and pencil texture`);

  // A real worksheet PDF must retain vector paths, not a screenshot per zone.
  await page.evaluate(() => {
    const point = (x, y, pressure = 0.6) => ({ x, y, pressure });
    const base = { color: '#ffffff', width: 3, points: [point(20, 80, 0.2), point(90, 100, 0.8), point(180, 90, 0.4), point(300, 110, 0.7)], penType: 'fountain', usesRealPressure: true };
    localStorage.setItem('worksheets', JSON.stringify([{
      id: 'vector', name: 'Qualité PDF vectorielle', createdAt: '2026-10-26', content: {
        chapter: 'Qualité PDF vectorielle', settings: { answerSpaceMinHeight: 220, showSolutions: true },
        exercises: [{ id: 'e', title: '', statement: '', questions: [
          { text: 'Ardoise : écriture, géométrie et texte $x^2+1$.', answerStyle: 'slate', solution: 'Corrigé : $x^2+1$ est positif.', strokes: [base,
            { ...base, penType: 'ballpoint', color: '#2563eb', shapeType: 'circle', points: [point(360, 60), point(440, 140)] },
            { ...base, isText: true, text: 'Texte net et sélectionnable $\\frac{1}{2}$', fontSize: 20, points: [point(20, 170)] },
          ] },
          { text: 'Papier Seyès : crayon avec grain vectoriel.', answerStyle: 'seyes', strokes: [{ ...base, color: '#1e293b', penType: 'pencil' }] },
          { text: 'Quadrillage : surligneur et traits pointillés.', answerStyle: 'grid', strokes: [
            { ...base, isHighlighter: true, color: '#fde047', width: 18, highlighterType: 'chisel' },
            { ...base, color: '#1e293b', shapeType: 'line', lineStyle: 'dotted', points: [point(20, 150), point(400, 150)] },
          ] },
        ] }],
      },
    }]));
  });
  await page.reload();
  await page.locator('article[title^="Qualité PDF vectorielle"]').click();
  await page.evaluate(async () => {
    await (await import('/features/math/runtime.ts')).waitForMathTypesetting();
    await (await import('/utils/worksheetPrint.ts')).prepareWorksheetPrint();
  });
  const pdf = resolve(output, 'qualite-vectorielle.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (process.env.PDF_PYTHON) {
    const report = JSON.parse(execFileSync(process.env.PDF_PYTHON, ['-c', `import sys,json
from pypdf import PdfReader
r=PdfReader(sys.argv[1])
def images(resources):
    count=0
    for category in ['/XObject','/Pattern']:
        for obj in resources[category].get_object().values() if resources.get(category) else []:
            obj=obj.get_object()
            if obj.get('/Subtype')=='/Image': count+=1
            elif obj.get('/Resources'): count+=images(obj['/Resources'])
    return count
print(json.dumps({'images':sum(images(p.get('/Resources') or {}) for p in r.pages),'text':' '.join(p.extract_text() or '' for p in r.pages),'pages':len(r.pages)}))`, pdf], { encoding: 'utf8' }));
    assert.equal(report.images, 0, 'freehand, shapes, pencil texture, highlighter, text and math must survive as PDF vectors/text');
    assert.match(report.text, /Texte net et/);
    console.log(`PASS real PDF: ${report.pages} pages, zero raster images, selectable canvas text`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
