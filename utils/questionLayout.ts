import type { Exercise, QuestionPart } from '../types';

/**
 * Moteur de mise en page des questions.
 *
 * Il traduit une hiérarchie JSON arbitraire vers la présentation attendue d'un
 * sujet d'examen :
 *
 *   1.  a. Calculer ...
 *       b. Résoudre ...
 *   2.  Les courbes ... [figure] ... Justifier ...
 *
 * Trois règles gouvernent le rendu :
 *   - la numérotation dépend du niveau et reste définie à toute profondeur ;
 *   - une question sans énoncé propre ne consomme pas de ligne : son numéro est
 *     reporté sur la première sous-question (« numéro chapeau ») ;
 *   - une figure peut être ancrée à l'intérieur du texte plutôt qu'à la fin.
 */

export type NumberingStyle = 'decimal' | 'alpha' | 'roman' | 'greek' | 'bullet';

/** Styles successifs : 1. → a. → i. → α. → •. */
const LEVEL_STYLES: NumberingStyle[] = ['decimal', 'alpha', 'roman', 'greek'];

const GREEK_LETTERS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ'];

const ROMAN_TABLE: Array<[number, string]> = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
  [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
  [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

export const numberingStyleForLevel = (level: number): NumberingStyle =>
  LEVEL_STYLES[level] ?? 'bullet';

/** Séquence alphabétique illimitée : a … z, aa, ab … */
const toAlpha = (index: number): string => {
  let rest = index;
  let label = '';
  do {
    label = String.fromCharCode(97 + (rest % 26)) + label;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return label;
};

const toRoman = (value: number): string => {
  let rest = value;
  let label = '';
  for (const [weight, symbol] of ROMAN_TABLE) {
    while (rest >= weight) {
      label += symbol;
      rest -= weight;
    }
  }
  return label || '•';
};

/** Étiquette affichée devant une question, quelle que soit la profondeur. */
export const formatNumbering = (index: number, level: number): string => {
  let raw = '';
  switch (numberingStyleForLevel(level)) {
    case 'decimal':
      raw = `${index + 1}`;
      break;
    case 'alpha':
      raw = `${toAlpha(index)}`;
      break;
    case 'roman':
      raw = `${toRoman(index + 1)}`;
      break;
    case 'greek':
      raw = `${GREEK_LETTERS[index % GREEK_LETTERS.length]}`;
      break;
    default:
      return '•';
  }
  return raw.endsWith('.') ? raw : `${raw}.`;
};

/**
 * Un texte n'est « visible » que s'il reste quelque chose après suppression des
 * commandes purement typographiques. `""`, `"   "` et `"\\quad"` sont vides.
 */
export const hasVisibleText = (text?: string): boolean => {
  if (!text) return false;
  const stripped = text
    .replace(/\\(?:quad|qquad|hfill|vfill|noindent|smallskip|medskip|bigskip|par|newline|pause)\b/g, '')
    .replace(/\\\\(?:\[[^\]]*\])?/g, '')
    .replace(/[\s~]/g, '');
  return stripped.length > 0;
};

export const getSubquestions = (question: QuestionPart): QuestionPart[] =>
  Array.isArray(question.subquestions) ? question.subquestions.filter(Boolean) : [];

/**
 * Question « chapeau » : elle regroupe des sous-questions sans énoncé propre.
 * Son numéro doit être affiché à gauche de la première sous-question, comme
 * dans « 1.  a. Calculer $g(1)$ et $h(1)$. ».
 */
export const isSilentContainer = (question: QuestionPart): boolean =>
  getSubquestions(question).length > 0 && !hasVisibleText(question.text)
  && !question.image?.src && !hasOwnAnswerSpace(question);

/** Un parent peut lui aussi posséder une réponse ou des annotations. */
export const hasOwnAnswerSpace = (question: QuestionPart): boolean =>
  Boolean(question.answer || question.solution || question.strokes?.length
    || question.guidance?.instruction || question.guidance?.recall
    || question.guidance?.hints?.some(Boolean) || question.guidance?.answer)
  || question.answerHeight !== undefined;

/** Les annotations/corrigés d'énoncé ne dépendent pas d'une hauteur explicite. */
export const hasExerciseAnswerSpace = (exercise: Exercise): boolean =>
  !exercise.questions?.length || hasOwnAnswerSpace({
    text: exercise.statement, answer: exercise.answer, solution: exercise.solution,
    guidance: exercise.guidance, strokes: exercise.statementStrokes,
    answerHeight: exercise.statementAnswerHeight,
  });

export interface QuestionPageContext {
  question: QuestionPart;
  path: (string | number)[];
  index: number;
  level: number;
  label: string;
}

export interface QuestionPage extends QuestionPageContext {
  kind: 'question' | 'exercise';
  id: string;
  exerciseId: string;
  /** Les ancêtres sont du contexte, jamais des copies de leurs réponses. */
  ancestors: QuestionPageContext[];
}

/**
 * Plan logique commun à la projection et à l'impression, indépendant du DOM.
 * Chaque nœud significatif est une page en préordre, à toute profondeur.
 * Un parent avec énoncé seul est une introduction; un conteneur entièrement
 * silencieux ne produit pas de page vide mais conserve son numéro en contexte.
 */
export const buildQuestionPagePlan = (questions: QuestionPart[], exerciseId: string): QuestionPage[] => {
  const pages: QuestionPage[] = [];
  const authorId = (question: QuestionPart): string | null => {
    if (typeof question.id === 'string' && question.id.trim()) return question.id;
    if (typeof question.id === 'number' && Number.isFinite(question.id)) return String(question.id);
    return null;
  };
  const idCounts = new Map<string, number>();
  const countIds = (items: QuestionPart[]) => items.forEach(question => {
    if (!question) return;
    const id = authorId(question);
    if (id !== null) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    countIds(getSubquestions(question));
  });
  countIds(questions);
  const visit = (items: QuestionPart[], path: (string | number)[], ancestors: QuestionPageContext[]) => {
    items.forEach((question, index) => {
      if (!question) return;
      const current: QuestionPageContext = {
        question, index, path: [...path, index], level: ancestors.length,
        label: formatNumbering(index, ancestors.length),
      };
      if (!isSilentContainer(question)) {
        const id = authorId(question);
        const identity = id !== null && idCounts.get(id) === 1
          ? `id-${encodeURIComponent(id)}` : current.path.join('-');
        pages.push({ ...current, exerciseId, kind: 'question',
          id: `question-page-${encodeURIComponent(exerciseId)}-${identity}`,
          ancestors: [...ancestors],
        });
      }
      visit(getSubquestions(question), [...current.path, 'subquestions'], [...ancestors, current]);
    });
  };
  visit(questions, ['questions'], []);
  return pages;
};

export const buildWorksheetPagePlan = (exercises: Exercise[]): QuestionPage[] =>
  exercises.flatMap(exercise => {
    const pages = buildQuestionPagePlan(exercise.questions || [], exercise.id);
    if (pages.length) return pages;
    return [{ kind: 'exercise' as const, exerciseId: exercise.id,
      id: `exercise-page-${encodeURIComponent(exercise.id)}`, question: { text: exercise.statement || '' },
      path: [], index: 0, level: 0, label: '', ancestors: [],
    }];
  });

/**
 * Ancre de figure dans le texte : `\figure`, `\image` ou `\includegraphics{...}`.
 * Elle permet d'insérer l'illustration entre deux paragraphes de la question au
 * lieu de la rejeter systématiquement après tout l'énoncé.
 */
const FIGURE_ANCHOR = /\\(?:figure|image|includegraphics)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/;

export interface FigureSplit {
  before: string;
  anchor: string;
  after: string;
}

export const splitAtFigureAnchor = (text?: string): FigureSplit | null => {
  if (!text) return null;
  const match = text.match(FIGURE_ANCHOR);
  if (!match || match.index === undefined) return null;
  return {
    before: text.slice(0, match.index).replace(/\s+$/, ''),
    anchor: match[0],
    after: text.slice(match.index + match[0].length).replace(/^\s+/, ''),
  };
};

/** Recompose le texte complet après édition d'un seul des deux fragments. */
export const joinAroundFigure = (split: FigureSplit, before: string, after: string): string =>
  `${before}${before && !before.endsWith('\n') ? ' ' : ''}${split.anchor} ${after}`.trim();

export interface QuestionLayout {
  /** Étiquette de numérotation. */
  label: string;
  subquestions: QuestionPart[];
  hasSubquestions: boolean;
  /** Le numéro est reporté sur la première sous-question. */
  collapsed: boolean;
  /** Diapositive plein écran (mode présentation). */
  isSlide: boolean;
  /** Figure ancrée dans le texte, sinon `null` (figure rendue après l'énoncé). */
  figure: FigureSplit | null;
  /** Une zone de réponse doit être rendue sous la question. */
  showsAnswerSpace: boolean;
}

export interface LayoutOptions {
  level: number;
  index: number;
  presentationMode?: boolean;
  showCanvas?: boolean;
}

/**
 * Décide en un seul endroit de toute la géométrie d'une question : numéro,
 * repli du conteneur, diapositive, position de la figure, zone de réponse.
 */
export const computeQuestionLayout = (
  question: QuestionPart,
  { level, index, presentationMode, showCanvas }: LayoutOptions,
): QuestionLayout => {
  const subquestions = getSubquestions(question);
  const hasSubquestions = subquestions.length > 0;
  const isSlide = Boolean(presentationMode) && !isSilentContainer(question);
  const collapsed = !isSlide && isSilentContainer(question);
  const figure = question.image?.src ? splitAtFigureAnchor(question.text) : null;

  return {
    label: formatNumbering(index, level),
    subquestions,
    hasSubquestions,
    collapsed,
    isSlide,
    figure,
    showsAnswerSpace: Boolean(showCanvas) && (!hasSubquestions || hasOwnAnswerSpace(question)),
  };
};
