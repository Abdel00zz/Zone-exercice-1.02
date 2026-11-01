import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Compile les vrais modules TypeScript sans ajouter un second moteur de tests.
const bundled = await build({
  stdin: {
    contents: `export * from './utils/questionLayout'; export { getBeamerMaxStep, matchesOverlaySpec } from './components/BeamerPresentation';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const {
  buildQuestionPagePlan, buildWorksheetPagePlan, computeQuestionLayout,
  formatNumbering, getBeamerMaxStep, matchesOverlaySpec,
} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('chaque question et sous-question a une page préordre avec chemin source et contexte', () => {
  const questions = [{ text: 'Parent', subquestions: [
    { text: 'A', subquestions: [{ text: 'i', subquestions: [{ text: 'Alpha', subquestions: [{ text: 'Profond' }] }] }] },
    { text: 'B' },
  ] }, { text: 'Question 2' }];
  const before = JSON.stringify(questions);
  const pages = buildQuestionPagePlan(questions, 'ex/1');
  assert.deepEqual(pages.map(page => page.question.text), ['Parent', 'A', 'i', 'Alpha', 'Profond', 'B', 'Question 2']);
  assert.deepEqual(pages[5].path, ['questions', 0, 'subquestions', 1]);
  assert.equal(pages[5].label, 'b.');
  assert.equal(pages[4].level, 4);
  assert.equal(pages[4].ancestors.length, 4);
  assert.equal(new Set(pages.map(page => page.id)).size, pages.length);
  assert.equal(pages[0].id, 'question-page-ex%2F1-questions-0');
  assert.equal(pages[5].question, questions[0].subquestions[1]);
  assert.equal(JSON.stringify(questions), before);
});

test('les conteneurs silencieux préservent le contexte sans produire de pages vides', () => {
  const pages = buildQuestionPagePlan([{ text: '\\quad', subquestions: [
    { text: '   ', subquestions: [{ text: 'Feuille' }] },
  ] }], 'x');
  assert.equal(pages.length, 1);
  assert.equal(pages[0].label, 'i.');
  assert.deepEqual(pages[0].ancestors.map(parent => parent.label), ['1.', 'a.']);
  assert.deepEqual(pages[0].path, ['questions', 0, 'subquestions', 0, 'subquestions', 0]);
});

test('une identité auteur unique survit à l’insertion et les doublons gardent des pages distinctes', () => {
  const source = [{ id: 'stable/a', text: 'A' }, { id: 'stable/b', text: 'B' }];
  const before = buildQuestionPagePlan(source, 'x');
  const after = buildQuestionPagePlan([{ text: 'Nouvelle' }, ...source], 'x');
  assert.equal(before[1].id, after[2].id);
  assert.deepEqual(after[2].path, ['questions', 2]);
  const duplicates = buildQuestionPagePlan([{ id: 1, text: 'A' }, { id: '1', text: 'B' }], 'x');
  assert.equal(new Set(duplicates.map(page => page.id)).size, 2);
  assert.equal(duplicates[0].id, 'question-page-x-questions-0');
});

test('image, corrigé, aide et encre propres au parent restent des pages et réponses autonomes', () => {
  const properties = [
    { image: { id: 'im', src: 'data:image/png;base64,AA' } },
    { answer: '42' }, { solution: 'Preuve' }, { strokes: [{ points: [] }] },
    { guidance: { hints: ['Indice'] } }, { answerHeight: 260 },
  ];
  for (const own of properties) {
    const question = { text: '', subquestions: [{ text: 'Enfant' }], ...own };
    assert.equal(buildQuestionPagePlan([question], 'x').length, 2);
    const layout = computeQuestionLayout(question, { level: 0, index: 0, showCanvas: true });
    assert.equal(layout.collapsed, false);
    assert.equal(layout.showsAnswerSpace, !own.image);
  }
});

test('appliquer un fond à tous les nœuds ne crée aucune page ou réponse artificielle', () => {
  const question = { text: '', answerStyle: 'seyes', answerColor: 'cream', subquestions: [{ text: 'Feuille' }] };
  assert.equal(buildQuestionPagePlan([question], 'x').length, 1);
  const layout = computeQuestionLayout(question, { level: 0, index: 0, showCanvas: true });
  assert.equal(layout.collapsed, true);
  assert.equal(layout.showsAnswerSpace, false);
});

test('un parent énoncé seul est une introduction, une feuille a sa zone de réponse', () => {
  const parent = { text: 'Contexte', subquestions: [{ text: 'Calculer' }] };
  assert.equal(computeQuestionLayout(parent, { level: 0, index: 0, showCanvas: true }).showsAnswerSpace, false);
  assert.equal(computeQuestionLayout(parent.subquestions[0], { level: 1, index: 0, showCanvas: true }).showsAnswerSpace, true);
  assert.equal(computeQuestionLayout(parent.subquestions[0], { level: 1, index: 0, showCanvas: false }).showsAnswerSpace, false);
});

test('toutes les profondeurs et les feuilles sont des diapositives en mode présentation', () => {
  for (let level = 0; level < 7; level++) {
    assert.equal(computeQuestionLayout({ text: 'Q' }, { level, index: 0, presentationMode: true }).isSlide, true);
    assert.equal(computeQuestionLayout({ text: 'Q' }, { level, index: 0 }).isSlide, false);
  }
});

test('la navigation globale conserve aussi les exercices sans questions', () => {
  const pages = buildWorksheetPagePlan([
    { id: 'intro', title: '', statement: 'Énoncé seul', questions: [] },
    { id: 'quiz', title: '', statement: '', questions: [{ text: 'Question' }] },
  ]);
  assert.deepEqual(pages.map(page => page.kind), ['exercise', 'question']);
  assert.equal(pages[0].id, 'exercise-page-intro');
  assert.deepEqual(pages[0].path, []);
  assert.equal(pages[1].exerciseId, 'quiz');
});

test('la numérotation alphabétique dépasse z et conserve les autres niveaux', () => {
  assert.equal(formatNumbering(26, 1), 'aa.');
  assert.equal(formatNumbering(3, 2), 'iv.');
  assert.equal(formatNumbering(0, 3), 'α.');
});

test('les étapes Beamer explicites, pauses et listes progressives sont atteignables', () => {
  assert.equal(getBeamerMaxStep('A \\pause B \\pause C'), 3);
  assert.equal(getBeamerMaxStep('\\only<2,5-7>{T}'), 7);
  assert.equal(getBeamerMaxStep('\\begin{enumerate}[<+->]\\item A\\item B\\item C\\end{enumerate}'), 3);
  assert.equal(getBeamerMaxStep('\\begin{itemize}\\item<+-> A\\item<+-> B\\item<+-> C\\item<+-> D\\end{itemize}'), 4);
  assert.equal(getBeamerMaxStep({ text: 'A', subquestions: [{ solution: '\\only<9>{B}' }] }), 9);
  assert.equal(matchesOverlaySpec('2,4-6', 3), false);
  assert.equal(matchesOverlaySpec('+-', 3, 2), true);
});
