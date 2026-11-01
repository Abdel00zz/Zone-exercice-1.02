import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import katex from 'katex';

const require = createRequire(import.meta.url);
function load(entryPoint) {
  const compiled = buildSync({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const { updateQuestion, mergeQuestionUp, mergeExerciseUp, applyAnswerBackground } = load('domain/worksheetCommands.ts');
const { copyInk, findUniqueInkIndex, rebaseInkGesture } = load('domain/inkDocument.ts');
const { allowMathCommand } = load('features/math/trust.ts');
const { resolveAnswerSpaceHeight, resolveAnswerSpaceMinimum } = load('domain/answerSpaceHeight.ts');
const stroke = x => ({ color: '#000000', width: 2, points: [{ x, y: 5, pressure: 0.6 }] });
const exercise = questions => ({ id: 'e', title: '', statement: '', questions });

test('worksheet minimum applies to existing local heights without shrinking larger answers', () => {
  assert.equal(resolveAnswerSpaceHeight(80, 300), 300);
  assert.equal(resolveAnswerSpaceHeight(500, 300), 500);
  assert.equal(resolveAnswerSpaceHeight(undefined, 300), 300);
  assert.equal(resolveAnswerSpaceHeight(80, 60), 80);
  assert.equal(resolveAnswerSpaceHeight(undefined, undefined), 120);
});

test('invalid and extreme answer heights cannot break screen or print geometry', () => {
  assert.equal(resolveAnswerSpaceMinimum(NaN), 120);
  assert.equal(resolveAnswerSpaceMinimum(-30), 40);
  assert.equal(resolveAnswerSpaceHeight(Infinity, 300), 300);
  assert.equal(resolveAnswerSpaceHeight(9000, 300), 1600);
  assert.equal(resolveAnswerSpaceHeight(100, 9000), 1600);
});

test('nested commands clone only the addressed branch and reject arbitrary paths', () => {
  const original = exercise([{ text: 'parent', subquestions: [{ text: 'a' }, { text: 'b' }] }, { text: 'other' }]);
  const updated = updateQuestion(original, ['questions', 0, 'subquestions', 1], { text: 'edited' });
  assert.equal(original.questions[0].subquestions[1].text, 'b');
  assert.equal(updated.questions[0].subquestions[1].text, 'edited');
  assert.equal(updated.questions[1], original.questions[1]);
  assert.equal(updated.questions[0].subquestions[0], original.questions[0].subquestions[0]);
  assert.equal(updateQuestion(original, ['__proto__', 0], { text: 'bad' }), original);
});

test('empty nested heading can merge without deleting annotated or populated nodes', () => {
  const original = exercise([{ text: 'parent', subquestions: [{ text: 'first' }, { text: '', subquestions: [{ text: 'child' }] }] }]);
  const merged = mergeQuestionUp(original, ['questions', 0, 'subquestions', 1]);
  assert.equal(merged.questions[0].subquestions.length, 1);
  assert.equal(merged.questions[0].subquestions[0].subquestions[0].text, 'child');
  const protectedExercise = exercise([{ text: '', strokes: [stroke(2)] }]);
  assert.equal(mergeQuestionUp(protectedExercise, ['questions', 0]), protectedExercise);
  const first = exercise([{ text: '', subquestions: [{ text: 'keep me' }] }]);
  assert.equal(mergeQuestionUp(first, ['questions', 0]).questions[0].text, 'keep me');
});

test('exercise merge never discards the first exercise questions or content', () => {
  const content = { chapter: '', exercises: [exercise([{ text: 'keep' }])] };
  assert.equal(mergeExerciseUp(content, 'e'), content);
});

test('all-zone background changes include arbitrary depth without mutating source', () => {
  const original = { chapter: '', exercises: [exercise([{ text: 'parent', subquestions: [{ text: 'nested' }] }])] };
  const updated = applyAnswerBackground(original, { styleName: 'seyes', colorName: 'cream' });
  assert.equal(updated.exercises[0].questions[0].subquestions[0].answerStyle, 'seyes');
  assert.equal(updated.exercises[0].statementAnswerColor, 'cream');
  assert.equal(original.exercises[0].questions[0].answerStyle, undefined);
});

test('ink snapshots have independent points and exclude runtime DOM caches', () => {
  const original = [{ ...stroke(10), imgElement: {} }];
  const copied = copyInk(original);
  copied[0].points[0].x = 50;
  assert.equal(original[0].points[0].x, 10);
  assert.equal('imgElement' in copied[0], false);
});

test('incoming ink during a gesture preserves additions and intended removals', () => {
  const a = stroke(10), b = stroke(20), incoming = stroke(30), added = stroke(40);
  const rebased = rebaseInkGesture([a, b], [b, added], [a, b, incoming]);
  assert.deepEqual(rebased.map(item => item.points[0].x), [20, 30, 40]);
  rebased[0].points[0].x = 100;
  assert.equal(b.points[0].x, 20);
});

test('identical repeated dots use a multiset when rebasing erasure', () => {
  const dot = stroke(10);
  const rebased = rebaseInkGesture([dot, dot], [dot], [dot, dot, stroke(20)]);
  assert.deepEqual(rebased.map(item => item.points[0].x), [10, 20]);
});

test('text draft identity follows a unique stroke through reorder and rejects ambiguity', () => {
  const original = { ...stroke(10), isText: true, text: 'draft original' };
  assert.equal(findUniqueInkIndex([stroke(20), original], original), 1);
  assert.equal(findUniqueInkIndex([original, original], original), undefined);
  assert.equal(findUniqueInkIndex([{ ...original, text: 'edited remotely' }], original), undefined);
});

test('untrusted math cannot generate executable links or arbitrary HTML styles', () => {
  assert.ok(allowMathCommand({ command: '\\href', url: 'https://example.org', protocol: 'https' }));
  assert.equal(allowMathCommand({ command: '\\href', url: 'javascript:alert(1)', protocol: 'javascript' }), false);
  const unsafe = katex.renderToString('\\href{javascript:alert(1)}{x}', { trust: allowMathCommand });
  assert.ok(!unsafe.includes('href="javascript:'));
  const safe = katex.renderToString('\\href{https://example.org}{x}', { trust: allowMathCommand });
  assert.ok(safe.includes('href="https://example.org"'));
  assert.equal(allowMathCommand({ command: '\\htmlStyle', style: 'position:fixed;inset:0' }), false);
});
