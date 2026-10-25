import { z } from 'zod';

const GuidanceSchema = z.union([
  z.string(),
  z.object({
    instruction: z.string().optional(),
    recall: z.string().optional(),
    hints: z.array(z.string()).optional(),
    answer: z.string().optional(),
  }).passthrough(),
]);

const ImageSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    src: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
    height: z.union([z.number(), z.string()]).optional(),
    placement: z.string().optional(),
    caption: z.string().optional(),
  }).passthrough(),
]);

// Entrées volontairement permissives : la normalisation accepte aussi les
// anciennes fiches, puis le modèle interne reprend des types stricts.
export const QuestionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    statement: z.string().optional(),
    answer: z.string().optional(),
    solution: z.string().optional(),
    guidance: GuidanceSchema.optional(),
    fillBlanks: z.union([z.string(), z.array(z.string())]).optional(),
    fillBlanksDisplay: z.string().optional(),
    subquestions: z.array(z.lazy(() => QuestionSchema)).optional(),
    answerHeight: z.union([z.number(), z.string()]).optional(),
    answerSpaceHeight: z.union([z.number(), z.string()]).optional(),
    answerStyle: z.string().optional(),
    answerSpaceStyle: z.string().optional(),
    answerColor: z.string().optional(),
    answerSpaceColor: z.string().optional(),
    image: ImageSchema.optional(),
    strokes: z.array(z.unknown()).optional(),
    statementStrokes: z.array(z.unknown()).optional(),
    answersStrokes: z.record(z.string(), z.array(z.unknown())).optional(),
  }).passthrough(),
);

export const WorksheetSettingsSchema = z.object({
  showCanvas: z.boolean().optional(),
  showSolutions: z.boolean().optional(),
  presentationMode: z.boolean().optional(),
  oneQuestionPerPage: z.boolean().optional(),
  className: z.string().optional(),
  schoolYear: z.string().optional(),
  userName: z.string().optional(),
  textFont: z.string().optional(),
  mathFont: z.string().optional(),
  handwritingFont: z.string().optional(),
  textScale: z.union([z.number(), z.string()]).optional(),
  mathScale: z.union([z.number(), z.string()]).optional(),
  paperTheme: z.string().optional(),
  logoDataUrl: z.string().optional(),
  answerSpaceMinHeight: z.union([z.number(), z.string()]).optional(),
  answerSpaceStyle: z.string().optional(),
  answerSpaceColor: z.string().optional(),
}).passthrough();

export const ExerciseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  statement: z.string().optional(),
  answer: z.string().optional(),
  solution: z.string().optional(),
  guidance: GuidanceSchema.optional(),
  questions: z.array(QuestionSchema).optional(),
  statementAnswerHeight: z.union([z.number(), z.string()]).optional(),
  statementAnswerStyle: z.string().optional(),
  statementAnswerColor: z.string().optional(),
  image: ImageSchema.optional(),
  statementStrokes: z.array(z.unknown()).optional(),
  hideBadge: z.boolean().optional(),
}).passthrough();

export const WorksheetContentSchema = z.object({
  chapter: z.string().optional(),
  title: z.string().optional(),
  settings: WorksheetSettingsSchema.optional(),
  exercise: ExerciseSchema.optional(),
  exercises: z.union([ExerciseSchema, z.array(ExerciseSchema)]).optional(),
  questions: z.array(QuestionSchema).optional(),
  statement: z.string().optional(),
}).passthrough();

export const validateWorksheetWithZod = (
  data: unknown,
): { success: true; data: z.infer<typeof WorksheetContentSchema> } | { success: false; error: string } => {
  const result = WorksheetContentSchema.safeParse(data);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map(issue => `• ${issue.path.join('.') || 'racine'}: ${issue.message}`)
      .join('\n');
    return { success: false, error: `Erreur de validation Zod:\n${formattedErrors}` };
  }
  return { success: true, data: result.data };
};
