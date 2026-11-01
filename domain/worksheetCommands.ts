import type { Exercise, QuestionPart, Worksheet, WorksheetContent } from '../types';

export type QuestionPath = readonly (string | number)[];
export type AnswerBackground = {
  styleName?: QuestionPart['answerStyle'];
  colorName?: QuestionPart['answerColor'] | '';
};

/** Paths are document paths, never arbitrary object properties. */
function questionIndexes(path: QuestionPath): number[] | null {
  if (path[0] !== 'questions' || path.length < 2 || path.length % 2 !== 0) return null;
  const indexes: number[] = [];
  for (let position = 1; position < path.length; position += 2) {
    const index = path[position];
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null;
    if (position > 1 && path[position - 1] !== 'subquestions') return null;
    indexes.push(index);
  }
  return indexes;
}

function updateQuestionList(
  questions: QuestionPart[], indexes: number[], transform: (questions: QuestionPart[], index: number) => QuestionPart[],
): QuestionPart[] {
  const [index, ...remaining] = indexes;
  if (!questions[index]) return questions;
  if (!remaining.length) return transform(questions, index);
  const question = questions[index];
  if (!question.subquestions) return questions;
  const children = updateQuestionList(question.subquestions, remaining, transform);
  if (children === question.subquestions) return questions;
  return questions.map((item, position) => position === index ? { ...item, subquestions: children } : item);
}

export function updateQuestion(exercise: Exercise, path: QuestionPath, patch: Partial<QuestionPart>): Exercise {
  const indexes = questionIndexes(path);
  if (!indexes) return exercise;
  const questions = updateQuestionList(exercise.questions, indexes, (items, index) =>
    items.map((question, position) => position === index ? { ...question, ...patch } : question));
  return questions === exercise.questions ? exercise : { ...exercise, questions };
}

export function updateExerciseInCollection(
  worksheets: Worksheet[], worksheetId: string | null, exerciseId: string, transform: (exercise: Exercise) => Exercise,
): Worksheet[] {
  return worksheets.map(worksheet => {
    if (worksheet.id !== worksheetId) return worksheet;
    const index = worksheet.content.exercises.findIndex(exercise => exercise.id === exerciseId);
    if (index < 0) return worksheet;
    const original = worksheet.content.exercises[index];
    const updated = transform(original);
    if (original === updated) return worksheet;
    const exercises = worksheet.content.exercises.slice();
    exercises[index] = updated;
    return { ...worksheet, content: { ...worksheet.content, exercises } };
  });
}

export function applyAnswerBackground(content: WorksheetContent, { styleName, colorName }: AnswerBackground): WorksheetContent {
  const style = styleName === undefined ? {} : { answerStyle: styleName };
  const color = colorName === undefined ? {} : { answerColor: colorName || undefined };
  const visit = (question: QuestionPart): QuestionPart => ({
    ...question, ...style, ...color,
    ...(question.subquestions ? { subquestions: question.subquestions.map(visit) } : {}),
  });
  return {
    ...content,
    settings: {
      ...content.settings,
      ...(styleName === undefined ? {} : { answerSpaceStyle: styleName }),
      ...(colorName === undefined ? {} : { answerSpaceColor: colorName || undefined }),
    },
    exercises: content.exercises.map(exercise => ({
      ...exercise,
      ...(styleName === undefined ? {} : { statementAnswerStyle: styleName }),
      ...(colorName === undefined ? {} : { statementAnswerColor: colorName || undefined }),
      questions: exercise.questions.map(visit),
    })),
  };
}

function hasQuestionContent(question: QuestionPart): boolean {
  return Boolean(question.text.trim() || question.image?.src || question.answer || question.solution
    || question.strokes?.length || question.guidance?.instruction || question.guidance?.recall
    || question.guidance?.hints?.some(Boolean) || question.guidance?.answer);
}

/** Backspace on an empty heading must never delete its answers or descendants. */
export function mergeQuestionUp(exercise: Exercise, path: QuestionPath): Exercise {
  const indexes = questionIndexes(path);
  if (!indexes) return exercise;
  const questions = updateQuestionList(exercise.questions, indexes, (items, index) => {
    const current = items[index];
    if (hasQuestionContent(current)) return items;
    const result = items.slice();
    if (index === 0) result.splice(index, 1, ...(current.subquestions || []));
    else {
      const previous = items[index - 1];
      result[index - 1] = current.subquestions?.length
        ? { ...previous, subquestions: [...(previous.subquestions || []), ...current.subquestions] }
        : previous;
      result.splice(index, 1);
    }
    return result;
  });
  return questions === exercise.questions ? exercise : { ...exercise, questions };
}

export function mergeExerciseUp(content: WorksheetContent, exerciseId: string): WorksheetContent {
  const index = content.exercises.findIndex(exercise => exercise.id === exerciseId);
  if (index < 0) return content;
  const exercise = content.exercises[index];
  // This command is only for empty headings, not an implicit delete operation.
  if (exercise.title.trim() || exercise.statement.trim() || exercise.image?.src || exercise.answer
    || exercise.solution || exercise.statementStrokes?.length || exercise.guidance) return content;
  if (index === 0 && exercise.questions.length) return content;
  const exercises = content.exercises.slice();
  if (index > 0) exercises[index - 1] = {
    ...exercises[index - 1], questions: [...exercises[index - 1].questions, ...exercise.questions],
  };
  exercises.splice(index, 1);
  return { ...content, exercises };
}
