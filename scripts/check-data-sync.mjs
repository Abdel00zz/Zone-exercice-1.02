import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const compiled = buildSync({ entryPoints: [resolve('domain/worksheetSync.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports);
const { mergeCloudWorksheets, SyncRequestScope } = module.exports;
const schemaCompiled = buildSync({ entryPoints: [resolve('domain/worksheetSchema.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const schemaModule = { exports: {} };
new Function('require', 'module', 'exports', schemaCompiled.outputFiles[0].text)(require, schemaModule, schemaModule.exports);
const { parseCloudWorksheets } = schemaModule.exports;
const importCompiled = buildSync({ entryPoints: [resolve('utils/worksheetImport.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const importModule = { exports: {} };
new Function('require', 'module', 'exports', importCompiled.outputFiles[0].text)(require, importModule, importModule.exports);
const { normalizeWorksheetJson, normalizeWorksheetBackup } = importModule.exports;
const authCompiled = buildSync({ entryPoints: [resolve('api/_lib/auth.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
const authModule = { exports: {} };
new Function('require', 'module', 'exports', authCompiled.outputFiles[0].text)(require, authModule, authModule.exports);

const ink = (label) => [{ points: [{ x: 2, y: 3, pressure: 0.5 }], color: label, width: 2 }];
const question = (text, patch = {}) => ({ text, ...patch });
const worksheet = (questions, id = 'shared') => ({
  id, name: id, createdAt: '2026-10-25',
  content: { chapter: 'Chapitre', exercises: [{ id: 'ex1', title: '', statement: '', questions }] },
});
const questionsOf = (worksheets) => worksheets[0].content.exercises[0].questions;

test('gallery helpers and merge domain do not import the validation runtime at startup', () => {
  const result = buildSync({ entryPoints: [resolve('utils/worksheetUtils.ts'), resolve('domain/worksheetSync.ts')], outdir: 'unused', bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every((path) => !path.includes('zod') && !path.includes('worksheetSchema') && !path.includes('worksheetImport')));
});

test('legacy reorder and insertion keep each answer attached to its own question', () => {
  const local = [worksheet([question('A', { strokes: ink('a') }), question('B', { strokes: ink('b') })])];
  const remote = [worksheet([question('C'), question('B'), question('A')])];
  const result = questionsOf(mergeCloudWorksheets(local, remote));
  assert.equal(result[0].strokes, undefined);
  assert.deepEqual(result[1].strokes, ink('b'));
  assert.deepEqual(result[2].strokes, ink('a'));
  assert.deepEqual(local[0].content.exercises[0].questions[0].strokes, ink('a'));
});

test('stable identity preserves ink through edits and nested sibling reorder', () => {
  const local = [worksheet([question('Old title', { id: 'parent', strokes: [], subquestions: [question('a', { id: 1, strokes: ink('a') }), question('b', { id: 2, strokes: ink('b') })] })])];
  const remote = [worksheet([question('Edited title', { id: 'parent', strokes: ink('remote'), subquestions: [question('edited b', { id: 2 }), question('edited a', { id: 1 })] })])];
  const result = questionsOf(mergeCloudWorksheets(local, remote))[0];
  assert.deepEqual(result.strokes, [], 'an intentional local erase must survive');
  assert.deepEqual(result.subquestions[0].strokes, ink('b'));
  assert.deepEqual(result.subquestions[1].strokes, ink('a'));
  assert.equal(result.text, 'Edited title');
});

test('ambiguous legacy duplicates never borrow a different answer by position', () => {
  const local = [worksheet([question('Same', { strokes: ink('a') }), question('Same', { strokes: ink('b') })])];
  const remote = [worksheet([question('Same'), question('Same')])];
  const merged = mergeCloudWorksheets(local, remote);
  const result = questionsOf(merged);
  assert.ok(result.every((item) => item.strokes === undefined));
  assert.equal(merged.length, 2, 'ambiguous ink must be saved in a recovery worksheet');
  assert.deepEqual(merged[1].content, local[0].content);
  assert.match(merged[1].name, /copie locale/);
  assert.equal(mergeCloudWorksheets(merged, remote).length, 2, 'repeated polling must not duplicate the recovery');
});

test('removing a nested annotated question or exercise preserves its original document in recovery', () => {
  const original = worksheet([question('Parent', { id: 'p', subquestions: [question('Child', { strokes: ink('child') })] })]);
  const withoutChild = worksheet([question('Parent', { id: 'p' })]);
  const merged = mergeCloudWorksheets([original], [withoutChild]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[1].content, original.content);
  const withoutExercise = { ...withoutChild, content: { ...withoutChild.content, exercises: [] } };
  const removedExercise = mergeCloudWorksheets([original], [withoutExercise]);
  assert.equal(removedExercise.length, 2);
  assert.deepEqual(removedExercise[1].content, original.content);
});

test('a shared snapshot cannot delete unrelated local worksheets, including an empty snapshot', () => {
  const privateWorksheet = worksheet([], 'private');
  const local = [worksheet([question('A')]), privateWorksheet];
  assert.equal(mergeCloudWorksheets(local, [worksheet([])])[1], privateWorksheet);
  assert.deepEqual(mergeCloudWorksheets(local, []), local);
});

test('network validation rejects malformed nested documents and duplicate identities', () => {
  const good = worksheet([question('A', { strokes: ink('a') })]);
  assert.deepEqual(parseCloudWorksheets([good]), [good]);
  for (const bad of [null, {}, [good, good], [worksheet([{ text: 5 }])], [worksheet([question('A', { strokes: [{ points: null }] })])], [worksheet([question('A', { guidance: { hints: 'invalid' } })])], [{ ...good, content: { ...good.content, settings: { className: 42 } } }]]) {
    assert.throws(() => parseCloudWorksheets(bad));
  }
});

test('legacy imports normalize nested questions without mutating the source, and survive roundtrip', () => {
  const input = {
    title: 'Legacy', settings: { answerSpaceMinHeight: '250', textScale: '1.1', answerSpaceStyle: 'ardoise' },
    exercise: { id: 0, text: 'Énoncé', questions: [{ statement: 'Parent', guidance: 'Consigne', subquestions: [{ title: 'Calculer', answerSpaceHeight: '300px', answerSpaceStyle: 'seyès', image: 'data:image/png;base64,a', strokes: ink('a') }] }] },
  };
  const before = JSON.stringify(input);
  const result = normalizeWorksheetJson(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.settings.answerSpaceMinHeight, 250);
  assert.equal(result.settings.answerSpaceStyle, 'slate');
  assert.equal(result.exercises[0].id, '0');
  assert.equal(result.exercises[0].statement, 'Énoncé');
  assert.equal(result.exercises[0].questions[0].text, 'Parent');
  const child = result.exercises[0].questions[0].subquestions[0];
  assert.equal(child.text, 'Calculer');
  assert.equal(child.answerHeight, 300);
  assert.equal(child.answerStyle, 'seyes');
  assert.deepEqual(child.strokes, ink('a'));
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeWorksheetJson(result))), JSON.parse(JSON.stringify(result)));
});

test('canonical exercises outrank a stale root exercise alias on reimport', () => {
  const result = normalizeWorksheetJson({ chapter: 'Saved', exercise: { title: 'Old' }, exercises: [{ id: 'new', title: 'Edited', questions: [{ text: 'Edited question' }] }] });
  assert.equal(result.exercises[0].title, 'Edited');
  assert.equal('exercise' in result, false);
});

test('backup validation is atomic, preserves metadata, allows explicit empty worksheets and rejects corrupt ink', () => {
  const good = worksheet([question('A')]);
  assert.equal(normalizeWorksheetBackup([good])[0].id, good.id);
  const empty = { ...good, content: { ...good.content, exercises: [] } };
  assert.equal(normalizeWorksheetBackup([empty])[0].content.exercises.length, 0);
  assert.throws(() => normalizeWorksheetBackup([good, { ...good, id: 'bad', content: {} }]));
  assert.throws(() => normalizeWorksheetBackup([good, good]));
  assert.throws(() => normalizeWorksheetJson({ exercise: { questions: [{ text: 'A', subquestions: [{ text: 'B', strokes: [{ points: null }] }] }] } }));
});

test('request scopes reject overlap and revoke stale responses after code/role changes', () => {
  const scope = new SyncRequestScope();
  const oldRequest = scope.begin();
  assert.ok(oldRequest.isCurrent());
  assert.equal(scope.begin(), null);
  scope.invalidate();
  assert.equal(oldRequest.isCurrent(), false);
  assert.equal(oldRequest.signal.aborted, true);
  const newRequest = scope.begin();
  oldRequest.finish();
  assert.equal(scope.begin(), null, 'old completion must not release the new session lock');
  assert.equal(newRequest.isCurrent(), true);
  newRequest.finish();
  assert.ok(scope.begin());
});

function mountStorageHook(initialValue, options = {}) {
  const effects = [];
  const stateUpdates = [];
  const values = new Map();
  const events = [];
  let failing = !!options.failing;
  const fakeReact = {
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, (value) => stateUpdates.push(value)],
    useRef: (value) => ({ current: value }),
    useCallback: (callback) => callback,
    useEffect: (effect) => effects.push(effect),
  };
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const window = new EventTarget();
  const document = new EventTarget();
  window.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (failing || (options.metadataFail && key.endsWith(':meta'))) throw new Error('QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  window.setTimeout = () => 1;
  window.clearTimeout = () => {};
  for (const type of ['storage-save-error', 'storage-save-success', 'storage-save-conflict']) window.addEventListener(type, () => events.push(type));
  globalThis.window = window;
  globalThis.document = document;
  const compiled = buildSync({ entryPoints: [resolve('hooks/useLocalStorage.ts')], bundle: true, external: ['react'], platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)((id) => id === 'react' ? fakeReact : require(id), module, module.exports);
  module.exports.default('test', initialValue);
  const cleanups = effects.map((effect) => effect());
  return {
    window, values, events, stateUpdates,
    recover: () => { failing = false; },
    dispose: () => {
      cleanups.forEach((cleanup) => cleanup?.());
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    },
  };
}

test('failed local snapshot remains dirty and is retried when focus returns', () => {
  const hook = mountStorageHook({ ink: 'pending' }, { failing: true });
  const previousError = console.error;
  console.error = () => {};
  try {
    hook.window.dispatchEvent(new Event('pagehide'));
    assert.deepEqual(hook.events, ['storage-save-error']);
    assert.equal(hook.values.has('test'), false);
    hook.recover();
    hook.window.dispatchEvent(new Event('focus'));
    assert.equal(hook.values.get('test'), JSON.stringify({ ink: 'pending' }));
    assert.equal(hook.events.at(-1), 'storage-save-success');
  } finally {
    hook.dispose();
    console.error = previousError;
  }
});

test('a second tab cannot overwrite dirty local ink; optional metadata quota does not fail the saved snapshot', () => {
  const hook = mountStorageHook({ ink: 'mine' }, { metadataFail: true });
  try {
    hook.window.dispatchEvent(Object.assign(new Event('storage'), { key: 'test', newValue: '{"ink":"other tab"}' }));
    assert.equal(hook.stateUpdates.length, 0);
    assert.deepEqual(hook.events, ['storage-save-conflict']);
    hook.window.dispatchEvent(new Event('pagehide'));
    assert.equal(hook.values.get('test'), '{"ink":"mine"}');
    assert.equal(hook.events.at(-1), 'storage-save-success');
    assert.equal(hook.events.includes('storage-save-error'), false);
  } finally { hook.dispose(); }
});

test('auth rejects malformed cookies and noncanonical or tampered session tokens', async () => {
  const { parseCookie, createSessionToken, verifySessionToken } = authModule.exports;
  assert.equal(parseCookie('fx_session=%invalid', 'fx_session'), null);
  const token = await createSessionToken('unit-test-secret');
  assert.equal(await verifySessionToken(token, 'unit-test-secret'), true);
  assert.equal(await verifySessionToken(`${token}.extra`, 'unit-test-secret'), false);
  assert.equal(await verifySessionToken(token, 'different-secret'), false);
});
