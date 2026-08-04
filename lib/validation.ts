import { z } from 'zod';

// Schema validation pour les types de l'application
export const ImageConfigSchema = z.object({
  id: z.string(),
  src: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  placement: z.enum(['left', 'center', 'right']).optional(),
  caption: z.string().optional(),
});

export const QuestionPartSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    text: z.string(),
    subquestions: z.array(QuestionPartSchema).optional(),
    answerHeight: z.number().optional(),
    answerStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
    answerColor: z.enum(['black', 'green', 'blue', 'white', 'cream']).optional(),
    image: ImageConfigSchema.optional(),
  })
);

export const ExerciseSchema = z.object({
  id: z.string(),
  title: z.string(),
  statement: z.string(),
  questions: z.array(QuestionPartSchema),
  statementAnswerHeight: z.number().optional(),
  statementAnswerStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
  statementAnswerColor: z.enum(['black', 'green', 'blue', 'white', 'cream']).optional(),
  image: ImageConfigSchema.optional(),
});

export const WorksheetSettingsSchema = z.object({
  showCanvas: z.boolean().optional(),
  answerSpaceMinHeight: z.number().optional(),
  answerSpaceStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
  answerSpaceColor: z.enum(['black', 'green', 'blue', 'white', 'cream']).optional(),
  presentationMode: z.boolean().optional(),
  oneQuestionPerPage: z.boolean().optional(),
  className: z.string().optional(),
  schoolYear: z.string().optional(),
  logoDataUrl: z.string().optional(),
});

export const WorksheetContentSchema = z.object({
  chapter: z.string(),
  exercises: z.array(ExerciseSchema),
  version: z.string().optional(),
  settings: WorksheetSettingsSchema.optional(),
});

export const WorksheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  content: WorksheetContentSchema,
});

// Types dérivés des schemas Zod
export type ImageConfigInput = z.input<typeof ImageConfigSchema>;
export type QuestionPartInput = z.input<typeof QuestionPartSchema>;
export type ExerciseInput = z.input<typeof ExerciseSchema>;
export type WorksheetSettingsInput = z.input<typeof WorksheetSettingsSchema>;
export type WorksheetContentInput = z.input<typeof WorksheetContentSchema>;
export type WorksheetInput = z.input<typeof WorksheetSchema>;

// Fonctions utilitaires de validation
export function validateWorksheet(data: unknown): { success: boolean; data?: any; error?: string } {
  const result = WorksheetSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
    };
  }
  return { success: true, data: result.data };
}

export function validateWorksheetContent(data: unknown): { success: boolean; data?: any; error?: string } {
  const result = WorksheetContentSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
    };
  }
  return { success: true, data: result.data };
}
