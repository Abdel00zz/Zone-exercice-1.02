import { z } from 'zod';
import type { Worksheet } from '../types';
import { WorksheetSettingsSchema } from '../utils/worksheetValidation';

const finiteNumber = z.number().finite();
const strokeSchema = z.object({
  points: z.array(z.object({ x: finiteNumber, y: finiteNumber, pressure: finiteNumber })),
  color: z.string(),
  width: finiteNumber.nonnegative(),
  opacity: finiteNumber.optional(),
  fontSize: finiteNumber.optional(),
  text: z.string().optional(),
  imgSrc: z.string().optional(),
}).passthrough();

const guidanceSchema = z.union([
  z.string(), // Existing imported documents may still carry the legacy shorthand.
  z.object({
    instruction: z.string().optional(), recall: z.string().optional(),
    hints: z.array(z.string()).optional(), answer: z.string().optional(),
  }).passthrough(),
]);
const imageSchema = z.union([
  z.string(),
  z.object({
    src: z.string().optional(), id: z.string().optional(), caption: z.string().optional(),
    width: z.union([finiteNumber, z.string()]).optional(), height: z.union([finiteNumber, z.string()]).optional(),
  }).passthrough(),
]);

// Cloud snapshots are already normalized internal documents, unlike legacy JSON imports.
const questionSchema: z.ZodType = z.lazy(() => z.object({
  id: z.union([z.string(), z.number()]).optional(),
  text: z.string(),
  answer: z.string().optional(),
  solution: z.string().optional(),
  guidance: guidanceSchema.optional(),
  image: imageSchema.optional(),
  strokes: z.array(strokeSchema).optional(),
  subquestions: z.array(questionSchema).optional(),
}).passthrough());

const worksheetSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  content: z.object({
    chapter: z.string(),
    settings: WorksheetSettingsSchema.optional(),
    exercises: z.array(z.object({
      id: z.string().min(1),
      title: z.string(),
      statement: z.string(),
      answer: z.string().optional(), solution: z.string().optional(),
      guidance: guidanceSchema.optional(), image: imageSchema.optional(),
      questions: z.array(questionSchema),
      statementStrokes: z.array(strokeSchema).optional(),
    }).passthrough()),
  }).passthrough(),
}).passthrough();

const worksheetListSchema = z.array(worksheetSchema).superRefine((worksheets, ctx) => {
  const ids = new Set<string>();
  worksheets.forEach((worksheet, index) => {
    if (ids.has(worksheet.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'Identifiant de fiche dupliqué.' });
    ids.add(worksheet.id);
    const exerciseIds = new Set<string>();
    worksheet.content.exercises.forEach((exercise, exerciseIndex) => {
      if (exerciseIds.has(exercise.id)) ctx.addIssue({ code: 'custom', path: [index, 'content', 'exercises', exerciseIndex, 'id'], message: 'Identifiant d’exercice dupliqué.' });
      exerciseIds.add(exercise.id);
    });
  });
});

/** Validate once at both network boundaries before a snapshot may reach the document store. */
export function parseCloudWorksheets(value: unknown): Worksheet[] {
  const result = worksheetListSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Fiches de synchronisation invalides (${issue.path.join('.') || 'racine'} : ${issue.message}).`);
  }
  return result.data as Worksheet[];
}
