import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Exercise, QuestionPart, Worksheet } from '../../types';
import { applyAnswerBackground, mergeExerciseUp, mergeQuestionUp, updateExerciseInCollection, updateQuestion, type AnswerBackground } from '../../domain/worksheetCommands';

/** React is an adapter: document transformations remain pure and testable. */
export function useWorksheetCommands(
  worksheetId: string | null, setWorksheets: Dispatch<SetStateAction<Worksheet[]>>,
) {
  const updateExercise = useCallback((exerciseId: string, transform: (exercise: Exercise) => Exercise) => {
    setWorksheets(current => updateExerciseInCollection(current, worksheetId, exerciseId, transform));
  }, [setWorksheets, worksheetId]);
  const handleQuestionUpdate = useCallback((exerciseId: string, path: (string | number)[], patch: Partial<QuestionPart>) => {
    updateExercise(exerciseId, exercise => updateQuestion(exercise, path, patch));
  }, [updateExercise]);
  const handleExerciseUpdate = useCallback((exerciseId: string, patch: Partial<Exercise>) => {
    updateExercise(exerciseId, exercise => ({ ...exercise, ...patch }));
  }, [updateExercise]);
  const handleQuestionMergeUp = useCallback((exerciseId: string, path: (string | number)[]) => {
    updateExercise(exerciseId, exercise => mergeQuestionUp(exercise, path));
  }, [updateExercise]);
  const handleExerciseMergeUp = useCallback((exerciseId: string) => {
    setWorksheets(current => current.map(worksheet => worksheet.id === worksheetId
      ? { ...worksheet, content: mergeExerciseUp(worksheet.content, exerciseId) } : worksheet));
  }, [setWorksheets, worksheetId]);
  const applyBackgroundToAll = useCallback((background: AnswerBackground) => {
    setWorksheets(current => current.map(worksheet => worksheet.id === worksheetId
      ? { ...worksheet, content: applyAnswerBackground(worksheet.content, background) } : worksheet));
  }, [setWorksheets, worksheetId]);
  return { handleQuestionUpdate, handleExerciseUpdate, handleQuestionMergeUp, handleExerciseMergeUp, applyBackgroundToAll };
}
