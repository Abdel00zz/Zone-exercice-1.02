import type { Exercise, QuestionPart, Worksheet, WorksheetContent } from '../types';

function questionKey(question: QuestionPart): string {
  if (question.id !== undefined) return `id:${String(question.id)}`;
  // No array position: inserting or reordering a sibling must never move a student's ink.
  return `legacy:${JSON.stringify([question.text, question.image?.src ?? '', question.text.trim() ? [] : question.subquestions?.map(questionKey) ?? []])}`;
}

interface MergeContext { orphanedInk: boolean }

function hasQuestionInk(question: QuestionPart): boolean {
  return !!question.strokes?.length || !!question.subquestions?.some(hasQuestionInk);
}

function mergeQuestions(local: QuestionPart[] = [], remote: QuestionPart[] = [], context: MergeContext): QuestionPart[] {
  const candidates = new Map<string, QuestionPart[]>();
  const remoteCounts = new Map<string, number>();
  local.forEach((question) => {
    const key = questionKey(question);
    candidates.set(key, [...(candidates.get(key) ?? []), question]);
  });
  remote.forEach((question) => {
    const key = questionKey(question);
    remoteCounts.set(key, (remoteCounts.get(key) ?? 0) + 1);
  });
  candidates.forEach((matches, key) => {
    if ((matches.length !== 1 || remoteCounts.get(key) !== 1) && matches.some(hasQuestionInk)) context.orphanedInk = true;
  });
  return remote.map((question) => {
    const key = questionKey(question);
    const matches = candidates.get(key);
    // Ambiguous legacy duplicates are deliberately not paired: no trustworthy identity exists.
    const previous = matches?.length === 1 && remoteCounts.get(key) === 1 ? matches[0] : undefined;
    const subquestions = mergeQuestions(previous?.subquestions, question.subquestions ?? [], context);
    return {
      ...question,
      strokes: previous?.strokes ?? question.strokes,
      subquestions: question.subquestions ? subquestions : undefined,
    };
  });
}

function mergeExercise(local: Exercise | undefined, remote: Exercise, context: MergeContext): Exercise {
  return {
    ...remote,
    statementStrokes: local?.statementStrokes ?? remote.statementStrokes,
    questions: mergeQuestions(local?.questions, remote.questions, context),
  };
}

function mergeContent(local: WorksheetContent, remote: WorksheetContent, context: MergeContext): WorksheetContent {
  const exercisesById = new Map(local.exercises.map((exercise) => [exercise.id, exercise]));
  const remoteIds = new Set(remote.exercises.map((exercise) => exercise.id));
  if (local.exercises.some((exercise) => !remoteIds.has(exercise.id) && (exercise.statementStrokes?.length || exercise.questions.some(hasQuestionInk)))) context.orphanedInk = true;
  return { ...remote, exercises: remote.exercises.map((exercise) => mergeExercise(exercisesById.get(exercise.id), exercise, context)) };
}

function recoveryId(worksheet: Worksheet): string {
  // Stable per snapshot: polling must not generate another recovery copy each time.
  const serialized = JSON.stringify(worksheet);
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i += 1) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return `${worksheet.id}:local-recovery:${(hash >>> 0).toString(36)}`;
}

/** Author controls shared content; this device owns its ink and its unrelated local worksheets. */
export function mergeCloudWorksheets(local: Worksheet[], remote: Worksheet[]): Worksheet[] {
  const localById = new Map(local.map((worksheet) => [worksheet.id, worksheet]));
  const remoteIds = new Set(remote.map((worksheet) => worksheet.id));
  const recoveries: Worksheet[] = [];
  const ids = new Set([...localById.keys(), ...remoteIds]);
  return [
    ...remote.map((worksheet) => {
      const previous = localById.get(worksheet.id);
      if (!previous) return worksheet;
      const context: MergeContext = { orphanedInk: false };
      const content = mergeContent(previous.content, worksheet.content, context);
      if (context.orphanedInk) {
        const baseId = recoveryId(previous);
        let id = baseId;
        let suffix = 1;
        while (ids.has(id) && JSON.stringify(localById.get(id)?.content) !== JSON.stringify(previous.content)) id = `${baseId}:${suffix++}`;
        if (!ids.has(id)) {
          ids.add(id);
          recoveries.push({ ...previous, id, name: `${previous.name} (copie locale avant synchronisation)` });
        }
      }
      return { ...worksheet, content };
    }),
    ...local.filter((worksheet) => !remoteIds.has(worksheet.id)),
    ...recoveries,
  ];
}

/** A generation is revoked immediately when a session changes or the hook is disposed. */
export class SyncRequestScope {
  private generation = 0;
  private request: AbortController | null = null;

  invalidate(): void {
    this.generation += 1;
    this.request?.abort();
    this.request = null;
  }

  begin(): { signal: AbortSignal; isCurrent: () => boolean; finish: () => void } | null {
    if (this.request) return null;
    const generation = this.generation;
    const controller = new AbortController();
    this.request = controller;
    return {
      signal: controller.signal,
      isCurrent: () => generation === this.generation && !controller.signal.aborted,
      finish: () => { if (this.request === controller) this.request = null; },
    };
  }
}
