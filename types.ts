export interface ImageConfig {
  id: string;
  src: string; // Base64 or URL
  width?: number; // in pixels or percentage
  height?: number; // in pixels or percentage
  placement?: 'left' | 'center' | 'right';
  caption?: string;
}

export interface QuestionPart {
  text: string;
  subquestions?: QuestionPart[];
  answerHeight?: number;
  answerStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  image?: ImageConfig;
}

export interface Exercise {
  id: string;
  title: string;
  statement: string;
  questions: QuestionPart[];
  statementAnswerHeight?: number;
  statementAnswerStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  statementAnswerColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  image?: ImageConfig;
}

export interface WorksheetContent {
  chapter: string;
  exercises: Exercise[];
  version?: string;
  settings?: {
    showCanvas?: boolean;
    answerSpaceMinHeight?: number;
    answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
    answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
    presentationMode?: boolean;
    oneQuestionPerPage?: boolean;
    className?: string;
    schoolYear?: string;
    logoDataUrl?: string;
  };
}

export interface Worksheet {
  id: string;
  name: string;
  createdAt: string;
  content: WorksheetContent;
}