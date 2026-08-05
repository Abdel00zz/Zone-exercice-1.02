import { z } from 'zod';
import type { Worksheet, WorksheetContent, Exercise } from '../types';

// Schéma Zod récursif pour les questions et sous-questions
export const QuestionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    statement: z.string().optional(),
    answer: z.string().optional(),
    solution: z.string().optional(),
    guidance: z.string().optional(),
    fillBlanks: z.union([z.string(), z.array(z.string())]).optional(),
    fillBlanksDisplay: z.string().optional(),
    subquestions: z.array(z.lazy(() => QuestionSchema)).optional(),
    answerSpaceHeight: z.number().optional(),
    answerSpaceStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
    answerSpaceColor: z.string().optional(),
    image: z.string().optional(),
    statementStrokes: z.array(z.any()).optional(),
    answersStrokes: z.record(z.string(), z.array(z.any())).optional(),
  })
);

// Schéma Zod pour les paramètres de la fiche
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
  textScale: z.number().optional(),
  mathScale: z.number().optional(),
  logoDataUrl: z.string().optional(),
  answerSpaceMinHeight: z.number().optional(),
  answerSpaceStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
  answerSpaceColor: z.string().optional(),
});

// Schéma Zod pour un exercice
export const ExerciseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  statement: z.string().optional(),
  answer: z.string().optional(),
  solution: z.string().optional(),
  guidance: z.string().optional(),
  questions: z.array(QuestionSchema).optional(),
  statementAnswerHeight: z.number().optional(),
  statementAnswerStyle: z.enum(['seyes', 'slate', 'grid', 'dotted', 'blank']).optional(),
  statementAnswerColor: z.string().optional(),
  image: z.string().optional(),
  statementStrokes: z.array(z.any()).optional(),
  hideBadge: z.boolean().optional(),
});

// Schéma Zod pour le contenu complet de la fiche
export const WorksheetContentSchema = z.object({
  chapter: z.string().optional(),
  title: z.string().optional(),
  settings: WorksheetSettingsSchema.optional(),
  exercise: ExerciseSchema.optional(),
  exercises: z.union([ExerciseSchema, z.array(ExerciseSchema)]).optional(),
  questions: z.array(QuestionSchema).optional(),
  statement: z.string().optional(),
}).passthrough();

/**
 * Valide un objet avec Zod et retourne les éventuelles erreurs sous forme d'une chaîne lisible.
 */
export const validateWorksheetWithZod = (data: unknown): { success: true; data: z.infer<typeof WorksheetContentSchema> } | { success: false; error: string } => {
  const result = WorksheetContentSchema.safeParse(data);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map(issue => `• ${issue.path.join('.') || 'racine'}: ${issue.message}`)
      .join('\n');
    return { success: false, error: `Erreur de validation Zod:\n${formattedErrors}` };
  }
  return { success: true, data: result.data };
};

export type TreeFilter = 
    | { type: 'class'; className: string } 
    | { type: 'chapter'; className: string; chapterName: string } 
    | { type: 'worksheet'; worksheetId: string } 
    | null;

export interface WorksheetTreeChapter {
    chapterName: string;
    worksheets: Worksheet[];
}

export interface WorksheetTreeClass {
    className: string;
    worksheetCount: number;
    chapters: WorksheetTreeChapter[];
}

/**
 * Traite et normalise intelligemment tout JSON de fiche ou d'exercice.
 * - Supporte le paramètre unique "exercise" ou le tableau/objet "exercises".
 * - Si le JSON ne contient qu'un seul exercice, masque le badge "Exercice 1".
 */
export const normalizeWorksheetJson = (jsonData: any): WorksheetContent => {
    if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('Le JSON fourni est invalide ou vide.');
    }

    let rawExercises: any[] = [];
    let chapter = jsonData.chapter || jsonData.title || '';

    // Si le JSON contient la clé "exercise" (un seul exercice sous forme d'objet)
    if (jsonData.exercise && typeof jsonData.exercise === 'object') {
        rawExercises = [jsonData.exercise];
        if (!chapter) {
            chapter = jsonData.exercise.title || 'Exercice';
        }
    } 
    // Si le JSON contient la clé "exercises" (tableau ou objet unique)
    else if (jsonData.exercises) {
        if (Array.isArray(jsonData.exercises)) {
            rawExercises = jsonData.exercises;
        } else if (typeof jsonData.exercises === 'object') {
            rawExercises = [jsonData.exercises];
        }
    } 
    // Si le JSON est directement un objet exercice (possède 'questions', 'statement' ou 'title')
    else if (Array.isArray(jsonData.questions) || jsonData.statement || jsonData.title) {
        rawExercises = [jsonData];
        if (!chapter) {
            chapter = jsonData.title || 'Exercice';
        }
    }

    if (!Array.isArray(rawExercises) || rawExercises.length === 0) {
        throw new Error('Le JSON doit contenir au moins un exercice ("exercises" ou "exercise").');
    }

    const isSingleExercise = rawExercises.length === 1;

    const normalizedExercises: Exercise[] = rawExercises.map((ex, index) => {
        return {
            id: ex.id || `ex_${index + 1}`,
            title: ex.title || '',
            statement: ex.statement || '',
            answer: ex.answer,
            solution: ex.solution,
            guidance: ex.guidance,
            questions: Array.isArray(ex.questions) ? ex.questions : [],
            statementAnswerHeight: ex.statementAnswerHeight,
            statementAnswerStyle: ex.statementAnswerStyle,
            statementAnswerColor: ex.statementAnswerColor,
            image: ex.image,
            statementStrokes: ex.statementStrokes,
            // Si le JSON ne contient qu'un seul exercice, masquer automatiquement le badge "Exercice 1"
            hideBadge: ex.hideBadge !== undefined ? ex.hideBadge : isSingleExercise,
        };
    });

    if (!chapter || typeof chapter !== 'string') {
        chapter = normalizedExercises[0]?.title || 'Fiche d\'Exercices';
    }

    const settings = jsonData.settings || {};
    settings.presentationMode = settings.presentationMode ?? false;

    return {
        ...jsonData,
        settings,
        chapter,
        exercises: normalizedExercises,
    };
};

export const getWorksheetClassName = (worksheet: Worksheet): string => {
    return worksheet.content?.settings?.className?.trim() || 'Non classé';
};

export const getWorksheetChapterName = (worksheet: Worksheet): string => {
    return worksheet.content?.chapter?.trim() || worksheet.name || 'Sans chapitre';
};

export const buildWorksheetTree = (
    worksheets: Worksheet[],
    worksheetClasses: string[]
): WorksheetTreeClass[] => {
    const classes = new Map<string, Map<string, Worksheet[]>>();
    
    worksheetClasses.forEach((className) => {
        const normalizedName = className.trim();
        if (normalizedName) classes.set(normalizedName, new Map());
    });

    [...worksheets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .forEach((worksheet) => {
            const className = getWorksheetClassName(worksheet);
            const chapterName = getWorksheetChapterName(worksheet);
            const chapters = classes.get(className) || new Map<string, Worksheet[]>();
            const chapterWorksheets = chapters.get(chapterName) || [];
            chapterWorksheets.push(worksheet);
            chapters.set(chapterName, chapterWorksheets);
            classes.set(className, chapters);
        });

    return Array.from(classes, ([className, chapters]) => ({
        className,
        worksheetCount: Array.from(chapters.values()).reduce((sum, list) => sum + list.length, 0),
        chapters: Array.from(chapters, ([chapterName, chapterWorksheets]) => ({ chapterName, worksheets: chapterWorksheets })),
    })).sort((a, b) => {
        if (a.className === 'Non classé') return 1;
        if (b.className === 'Non classé') return -1;
        return a.className.localeCompare(b.className, 'fr');
    });
};

export const generateDynamicSubtitle = (
    searchQuery: string,
    treeFilter: TreeFilter,
    sortedWorksheetsCount: number,
    worksheets: Worksheet[]
): string => {
    if (searchQuery.trim()) {
        return `Recherche : « ${searchQuery.trim()} » · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
    }

    if (treeFilter) {
        if (treeFilter.type === 'class') {
            return `Classe : ${treeFilter.className} · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
        }
        if (treeFilter.type === 'chapter') {
            return `${treeFilter.className} › ${treeFilter.chapterName} · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
        }
        if (treeFilter.type === 'worksheet') {
            const ws = worksheets.find((item) => item.id === treeFilter.worksheetId);
            return ws ? `Aperçu : ${ws.name}` : 'Fiche sélectionnée';
        }
    }
    
    const total = worksheets.length;
    const classes = Array.from(new Set(worksheets.map(getWorksheetClassName))).filter(c => c && c !== 'Non classé');
    const chapters = Array.from(new Set(worksheets.map(getWorksheetChapterName))).filter(c => c && c !== 'Général');

    if (classes.length > 0) {
        const classListStr = classes.slice(0, 3).join(', ') + (classes.length > 3 ? ` +${classes.length - 3}` : '');
        return `${total} fiches · ${classListStr}`;
    }
    
    if (chapters.length > 0) {
        const chapListStr = chapters.slice(0, 3).join(', ') + (chapters.length > 3 ? ` +${chapters.length - 3}` : '');
        return `${total} fiches · ${chapListStr}`;
    }

    return `${total} fiche${total > 1 ? 's' : ''} disponible${total > 1 ? 's' : ''}`;
};
