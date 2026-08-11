import type { Stroke } from './components/canvas/types';

export interface ImageConfig {
  id: string;
  src: string; // Base64 or URL
  width?: number; // in pixels or percentage
  height?: number; // in pixels or percentage
  placement?: 'left' | 'center' | 'right';
  caption?: string;
}

/** Parcours d'aide progressive affiché directement dans la zone de réponse. */
export interface PedagogicalGuidance {
  instruction?: string;
  recall?: string;
  hints?: string[];
  answer?: string;
}

export interface QuestionPart {
  text: string;
  answer?: string;
  solution?: string;
  guidance?: PedagogicalGuidance;
  subquestions?: QuestionPart[];
  answerHeight?: number;
  answerStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  image?: ImageConfig;
  strokes?: Stroke[];
}

export interface Exercise {
  id: string;
  title: string;
  statement: string;
  answer?: string;
  solution?: string;
  guidance?: PedagogicalGuidance;
  questions: QuestionPart[];
  statementAnswerHeight?: number;
  statementAnswerStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  statementAnswerColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  image?: ImageConfig;
  statementStrokes?: Stroke[];
  hideBadge?: boolean;
}

export type PaperTheme = 'classic' | 'white' | 'dark' | 'amber' | 'rose' | 'slate';

export interface WorksheetContent {
  chapter: string;
  exercises: Exercise[];
  version?: string;
  settings?: {
    showCanvas?: boolean;
    showSolutions?: boolean;
    answerSpaceMinHeight?: number;
    answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
    answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
    presentationMode?: boolean;
    oneQuestionPerPage?: boolean;
    className?: string;
    schoolYear?: string;
    logoDataUrl?: string;
    /** Informations propres à cette fiche. Si absentes, la configuration générale est utilisée. */
    userName?: string;
    textFont?: string;
    mathFont?: string;
    handwritingFont?: string;
    textScale?: number;
    mathScale?: number;
    paperTheme?: PaperTheme;
  };
}

/** Préférences partagées par toutes les fiches qui ne possèdent pas de surcharge locale. */
export interface AppConfiguration {
  userName: string;
  schoolYear: string;
  textFont: string;
  mathFont: string;
  handwritingFont: string;
  textScale: number;
  mathScale: number;
  paperTheme?: PaperTheme;
}

export interface Worksheet {
  id: string;
  name: string;
  createdAt: string;
  content: WorksheetContent;
}
