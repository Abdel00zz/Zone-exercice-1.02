import type { Worksheet, WorksheetContent, Exercise, QuestionPart } from '../types';
import { validateWorksheetWithZod } from './worksheetValidation';
import { parseCloudWorksheets } from '../domain/worksheetSchema';

/**
 * Traite et normalise intelligemment tout JSON de fiche ou d'exercice.
 * - Supporte le paramètre unique "exercise" ou le tableau/objet "exercises".
 * - Si le JSON ne contient qu'un seul exercice, masque le badge "Exercice 1".
 */
function normalizeNumber(value: unknown, field: string): number | undefined {
    if (value === undefined || value === '') return undefined;
    const number = typeof value === 'string' ? Number(value.trim().replace(/px$/i, '')) : value;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) throw new Error(`${field} doit être un nombre positif ou nul.`);
    return number;
}

function normalizeImage(value: any, id: string): any {
    if (value === undefined) return undefined;
    const image = typeof value === 'string' ? { src: value } : value;
    return { ...image, id: image.id || id, src: image.src ?? '', width: normalizeNumber(image.width, 'Largeur image'), height: normalizeNumber(image.height, 'Hauteur image') };
}

function normalizeGuidance(value: any): any {
    return typeof value === 'string' ? { instruction: value } : value;
}

function normalizeStyle(value: any): any {
    if (typeof value !== 'string') return value;
    const aliases: Record<string, string> = { ardoise: 'slate', 'seyès': 'seyes', quadrillage: 'grid', points: 'dotted', vierge: 'blank' };
    return aliases[value.toLocaleLowerCase('fr')] ?? value;
}

function normalizeQuestion(question: any, path: string): QuestionPart {
    return {
        ...question,
        text: question.text ?? question.statement ?? question.title ?? '',
        guidance: normalizeGuidance(question.guidance),
        image: normalizeImage(question.image, `img_${path}`),
        answerHeight: normalizeNumber(question.answerHeight ?? question.answerSpaceHeight, 'Hauteur de réponse'),
        answerStyle: normalizeStyle(question.answerStyle ?? question.answerSpaceStyle),
        answerColor: question.answerColor ?? question.answerSpaceColor,
        subquestions: question.subquestions?.map((child: unknown, index: number) => normalizeQuestion(child, `${path}_${index + 1}`)),
    };
}

export const normalizeWorksheetJson = (input: unknown, options: { allowEmptyExercises?: boolean } = {}): WorksheetContent => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Le JSON fourni est invalide ou vide.');
    }
    const validated = validateWorksheetWithZod(input);
    if (!validated.success) throw new Error(validated.error);
    const jsonData = validated.data;

    let rawExercises: any[] = [];
    let chapter = jsonData.chapter || jsonData.title || '';

    // Canonical exercises wins over an obsolete legacy alias left by older exports.
    if (jsonData.exercises !== undefined) {
        rawExercises = Array.isArray(jsonData.exercises) ? jsonData.exercises : [jsonData.exercises];
    }
    // Si le JSON contient la clé "exercise" (un seul exercice sous forme d'objet)
    else if (jsonData.exercise && typeof jsonData.exercise === 'object') {
        rawExercises = [jsonData.exercise];
        if (!chapter) {
            chapter = jsonData.exercise.title || 'Exercice';
        }
    }
    // Si le JSON contient la clé "exercises" (tableau ou objet unique)
    // Si le JSON est directement un objet exercice (possède 'questions', 'statement' ou 'title')
    else if (Array.isArray(jsonData.questions) || jsonData.statement || jsonData.title) {
        rawExercises = [jsonData];
        if (!chapter) {
            chapter = jsonData.title || 'Exercice';
        }
    }

    const allowedEmpty = options.allowEmptyExercises && Array.isArray(jsonData.exercises);
    if (!Array.isArray(rawExercises) || (rawExercises.length === 0 && !allowedEmpty)) {
        throw new Error('Le JSON doit contenir au moins un exercice ("exercises" ou "exercise").');
    }

    const isSingleExercise = rawExercises.length === 1;

    const normalizedExercises: Exercise[] = rawExercises.map((ex, index) => {
        return {
            ...ex,
            id: ex.id !== undefined && ex.id !== '' ? String(ex.id) : `ex_${index + 1}`,
            title: ex.title || '',
            statement: ex.statement ?? ex.text ?? '',
            answer: ex.answer,
            solution: ex.solution,
            guidance: normalizeGuidance(ex.guidance),
            questions: (ex.questions ?? []).map((question: unknown, questionIndex: number) => normalizeQuestion(question, `${index + 1}_${questionIndex + 1}`)),
            statementAnswerHeight: normalizeNumber(ex.statementAnswerHeight, 'Hauteur de réponse de l’énoncé'),
            statementAnswerStyle: normalizeStyle(ex.statementAnswerStyle),
            statementAnswerColor: ex.statementAnswerColor,
            image: normalizeImage(ex.image, `img_ex_${index + 1}`),
            statementStrokes: ex.statementStrokes,
            // Si le JSON ne contient qu'un seul exercice, masquer automatiquement le badge "Exercice 1"
            hideBadge: ex.hideBadge !== undefined ? ex.hideBadge : isSingleExercise,
        };
    });

    if (!chapter || typeof chapter !== 'string') {
        chapter = normalizedExercises[0]?.title || 'Fiche d\'Exercices';
    }

    const settings = {
        ...jsonData.settings,
        presentationMode: jsonData.settings?.presentationMode ?? false,
        answerSpaceMinHeight: normalizeNumber(jsonData.settings?.answerSpaceMinHeight, 'Hauteur de réponse par défaut'),
        answerSpaceStyle: normalizeStyle(jsonData.settings?.answerSpaceStyle),
        textScale: normalizeNumber(jsonData.settings?.textScale, 'Échelle du texte'),
        mathScale: normalizeNumber(jsonData.settings?.mathScale, 'Échelle des mathématiques'),
    };

    const content = {
        ...jsonData,
        settings,
        chapter,
        exercises: normalizedExercises,
    };
    // Do not export a second, stale exercise tree alongside the canonical tree.
    delete content.exercise;
    delete content.questions;
    return parseCloudWorksheets([{ id: 'import-validation', name: '', createdAt: '', content }])[0].content;
};

/** Validate the complete backup before the caller changes any local state. */
export function normalizeWorksheetBackup(input: unknown): Worksheet[] {
    if (!Array.isArray(input)) throw new Error('La sauvegarde doit être une liste de fiches.');
    const normalized = input.map((entry: unknown, index: number) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Fiche ${index + 1} invalide.`);
        const worksheet = entry as Record<string, unknown>;
        return { ...worksheet, content: normalizeWorksheetJson(worksheet.content, { allowEmptyExercises: true }) };
    });
    return parseCloudWorksheets(normalized);
}
