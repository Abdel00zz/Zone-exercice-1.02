import type { PedagogicalGuidance, QuestionPart, Worksheet } from '../types';
import { getWorksheetChapterName, getWorksheetClassName } from './worksheetUtils';

type SearchField = 'title' | 'class' | 'chapter' | 'statement' | 'question' | 'answer' | 'solution' | 'content';

interface SearchSection {
  field: SearchField;
  label: string;
  original: string;
  normalized: string;
  tokens: string[];
  weight: number;
  target: Omit<WorksheetSearchNavigation, 'query'>;
}

export interface WorksheetSearchDocument {
  worksheet: Worksheet;
  sections: SearchSection[];
}

export interface WorksheetSearchMatch {
  score: number;
  fieldLabel: string;
  excerpt: string;
  mathText?: string;
  target: WorksheetSearchNavigation;
}

export interface WorksheetSearchNavigation {
  anchorId: string;
  revealSolution: boolean;
  query: string;
}

export const WORKSHEET_TITLE_SEARCH_ANCHOR = 'worksheet-search-title';
const safeAnchorSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');
export const getExerciseSearchAnchor = (exerciseId: string) => `worksheet-search-exercise-${safeAnchorSegment(exerciseId)}`;
export const getQuestionSearchAnchor = (exerciseId: string, path: (string | number)[]) =>
  `${getExerciseSearchAnchor(exerciseId)}-${path.map(part => safeAnchorSegment(String(part))).join('-')}`;

interface QueryTerm {
  field?: SearchField;
  value: string;
  phrase: boolean;
}

const FIELD_ALIASES: Record<string, SearchField> = {
  titre: 'title', title: 'title', nom: 'title',
  classe: 'class', class: 'class',
  chapitre: 'chapter', chapter: 'chapter',
  enonce: 'statement', statement: 'statement', exercice: 'statement',
  question: 'question', questions: 'question',
  reponse: 'answer', answer: 'answer',
  solution: 'solution', corrige: 'solution', correction: 'solution',
  contenu: 'content', content: 'content',
};

/** Normalisation commune : insensible aux accents, à la casse et au bruit LaTeX. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Conserver le nom des commandes : « \\sqrt », « sqrt » et « √ » restent recherchables.
    .replace(/\\([a-zA-Z]+)\*?/g, ' $1 ')
    .replace(/[{}$^_\\|()[\],;:!?=+*/<>-]+/g, ' ')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanExcerpt(value: string): string {
  return value
    .replace(/\\(?:begin|end)\{[^}]+\}/g, ' ')
    .replace(/\\[a-zA-Z]+\*?/g, ' ')
    .replace(/[{}$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function guidanceText(guidance?: PedagogicalGuidance): string {
  if (!guidance) return '';
  return [guidance.instruction, guidance.recall, ...(guidance.hints || []), guidance.answer]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function canvasText(strokes?: QuestionPart['strokes']): string {
  if (!strokes?.length) return '';
  return strokes
    .filter(stroke => stroke.isText && stroke.text)
    .map(stroke => stroke.text)
    .join(' ');
}

type AddSection = (field: SearchField, label: string, value: string | undefined, target: Omit<WorksheetSearchNavigation, 'query'>) => void;

function collectQuestion(question: QuestionPart, exerciseId: string, path: (string | number)[], add: AddSection): void {
  const anchorId = getQuestionSearchAnchor(exerciseId, path);
  const questionTarget = { anchorId, revealSolution: false };
  const correctionTarget = { anchorId, revealSolution: true };
  add('question', 'Question', question.text, questionTarget);
  add('answer', 'Réponse', question.answer, correctionTarget);
  add('solution', 'Solution', question.solution, correctionTarget);
  add('content', 'Aide pédagogique', guidanceText(question.guidance), correctionTarget);
  add('solution', 'Annotation manuscrite', canvasText(question.strokes), correctionTarget);
  add('content', 'Légende', question.image?.caption, questionTarget);
  question.subquestions?.forEach((subquestion, index) =>
    collectQuestion(subquestion, exerciseId, [...path, 'subquestions', index], add));
}

export function buildWorksheetSearchDocument(worksheet: Worksheet): WorksheetSearchDocument {
  const sections: SearchSection[] = [];
  const weights: Record<SearchField, number> = {
    title: 14,
    class: 11,
    chapter: 12,
    statement: 7,
    question: 6,
    answer: 4,
    solution: 5,
    content: 3,
  };
  const titleTarget = { anchorId: WORKSHEET_TITLE_SEARCH_ANCHOR, revealSolution: false };
  const add: AddSection = (field, label, value, target) => {
    if (!value?.trim()) return;
    const normalized = normalizeSearchText(value);
    if (!normalized) return;
    sections.push({
      field,
      label,
      original: value,
      normalized,
      tokens: normalized.split(' '),
      weight: weights[field],
      target,
    });
  };

  add('title', 'Titre', worksheet.name, titleTarget);
  add('chapter', 'Chapitre', worksheet.content.chapter || getWorksheetChapterName(worksheet), titleTarget);
  add('class', 'Classe', getWorksheetClassName(worksheet), titleTarget);
  add('content', 'Année scolaire', worksheet.content.settings?.schoolYear, titleTarget);
  add('content', 'Auteur', worksheet.content.settings?.userName, titleTarget);

  worksheet.content.exercises?.forEach(exercise => {
    const anchorId = getExerciseSearchAnchor(exercise.id);
    const exerciseTarget = { anchorId, revealSolution: false };
    const correctionTarget = { anchorId, revealSolution: true };
    add('statement', 'Titre d’exercice', exercise.title, exerciseTarget);
    add('statement', 'Énoncé', exercise.statement, exerciseTarget);
    add('answer', 'Réponse', exercise.answer, correctionTarget);
    add('solution', 'Solution', exercise.solution, correctionTarget);
    add('content', 'Aide pédagogique', guidanceText(exercise.guidance), correctionTarget);
    add('solution', 'Annotation manuscrite', canvasText(exercise.statementStrokes), correctionTarget);
    add('content', 'Légende', exercise.image?.caption, exerciseTarget);
    exercise.questions?.forEach((question, index) => collectQuestion(question, exercise.id, ['questions', index], add));
  });

  return { worksheet, sections };
}

function parseQuery(query: string): QueryTerm[] {
  const terms: QueryTerm[] = [];
  const expression = /(?:(\p{L}+):)?(?:"([^"]+)"|([^\s"]+))/gu;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(query)) !== null) {
    const rawField = match[1] ? normalizeSearchText(match[1]) : '';
    const rawValue = match[2] || match[3] || '';
    const value = normalizeSearchText(rawValue);
    if (!value) continue;
    terms.push({
      field: rawField ? FIELD_ALIASES[rawField] : undefined,
      value,
      phrase: Boolean(match[2]),
    });
  }
  return terms;
}

/** Distance de Levenshtein bornée : abandon anticipé pour garder la saisie instantanée. */
function boundedEditDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = new Array<number>(right.length + 1);
    current[0] = row;
    let rowMinimum = current[0];
    for (let column = 1; column <= right.length; column++) {
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

function matchSection(section: SearchSection, term: QueryTerm): number {
  if (term.field && term.field !== 'content' && section.field !== term.field) return 0;
  if (term.phrase) return section.normalized.includes(term.value) ? section.weight * 18 + term.value.length : 0;
  if (section.normalized.includes(term.value)) return section.weight * 12 + term.value.length;

  let best = 0;
  const typoLimit = term.value.length >= 8 ? 2 : term.value.length >= 4 ? 1 : 0;
  for (const token of section.tokens) {
    if (token.startsWith(term.value) || (term.value.length >= 5 && term.value.startsWith(token))) {
      best = Math.max(best, section.weight * 8);
      continue;
    }
    if (typoLimit > 0 && token.length >= 3 && Math.abs(token.length - term.value.length) <= typoLimit) {
      const distance = boundedEditDistance(token, term.value, typoLimit);
      if (distance <= typoLimit) best = Math.max(best, section.weight * (6 - distance));
    }
  }
  return best;
}

export function searchWorksheet(document: WorksheetSearchDocument, query: string): WorksheetSearchMatch | null {
  const terms = parseQuery(query);
  if (terms.length === 0) return null;

  let totalScore = 0;
  let bestSection: SearchSection | null = null;
  let bestSectionRank = 0;
  for (const term of terms) {
    let termScore = 0;
    let termSection: SearchSection | null = null;
    for (const section of document.sections) {
      const score = matchSection(section, term);
      if (score > termScore) {
        termScore = score;
        termSection = section;
      }
    }
    // Tous les mots demandés doivent être présents, éventuellement dans des champs différents.
    if (termScore === 0) return null;
    totalScore += termScore;
    // L'extrait doit expliquer le mot distinctif, pas un mot-outil court comme « de ».
    const sectionRank = termScore * Math.min(12, term.value.length);
    if (termSection && sectionRank > bestSectionRank) {
      bestSection = termSection;
      bestSectionRank = sectionRank;
    }
  }

  const excerpt = cleanExcerpt(bestSection?.original || '').slice(0, 150);
  return {
    score: totalScore,
    fieldLabel: bestSection?.label || 'Contenu',
    excerpt: excerpt.length === 150 ? `${excerpt}…` : excerpt,
    mathText: bestSection && bestSection.original.length <= 800 && /\\[a-zA-Z]+|\$|[∀∃∈∉√≤≥≠≈]/.test(bestSection.original)
      ? bestSection.original
      : undefined,
    target: {
      ...(bestSection?.target || { anchorId: WORKSHEET_TITLE_SEARCH_ANCHOR, revealSolution: false }),
      query,
    },
  };
}
