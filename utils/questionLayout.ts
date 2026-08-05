import type { QuestionPart } from '../types';

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
  getSubquestions(question).length > 0 && !hasVisibleText(question.text);

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
  const isSlide = Boolean(presentationMode) && level === 0 && hasSubquestions;
  const collapsed = hasSubquestions && !isSlide && !hasVisibleText(question.text);
  const figure = question.image?.src ? splitAtFigureAnchor(question.text) : null;

  return {
    label: formatNumbering(index, level),
    subquestions,
    hasSubquestions,
    collapsed,
    isSlide,
    figure,
    showsAnswerSpace: Boolean(showCanvas) && !hasSubquestions,
  };
};
