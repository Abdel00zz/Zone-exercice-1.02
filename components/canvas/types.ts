export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type ShapeType = 'freeform' | 'line' | 'arrow' | 'double-arrow' | 'angle' | 'axes' | 'rectangle' | 'circle' | 'triangle' | 'right-triangle' | 'diamond' | 'parallelogram' | 'pentagon' | 'hexagon';

export type SelectionMode = 'lasso' | 'rectangle';

export type ToolType = 'pointer' | 'pen' | 'highlighter' | 'marker' | 'eraser' | 'shape' | 'lasso' | 'text';
export type PenType = 'ballpoint' | 'fountain' | 'calligraphy' | 'marker' | 'pencil' | 'brush';
export type HighlighterType = 'chisel' | 'round';
export type EraserType = 'stroke' | 'pixel';
export type LineStyle = 'solid' | 'tapered' | 'dashed' | 'dotted';
export type PressureCurve = 'soft' | 'balanced' | 'firm';

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  opacity?: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
  shapeType?: ShapeType;
  penType?: PenType;
  lineStyle?: LineStyle;
  highlighterType?: HighlighterType;
  isImage?: boolean;
  imgSrc?: string;
  imgElement?: HTMLImageElement;
  isText?: boolean;
  text?: string;
  font?: string;
  fontSize?: number;
}

export interface CorrectionProgress {
  step: number;
  maxStep: number;
  reset: () => void;
  previous: () => void;
  next: () => void;
}

export interface CorrectionToggle {
  available: boolean;
  visible: boolean;
  toggle: () => void;
}

export interface DrawingCanvasProps {
  height: number;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  onStyleChange?: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  onColorChange?: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
  initialStrokes?: Stroke[];
  onStrokesChange?: (strokes: Stroke[]) => void;
  /** Autorise la réédition d'un texte existant par double-clic/double-tap. */
  isEditMode?: boolean;
  correctionProgress?: CorrectionProgress;
  correctionToggle?: CorrectionToggle;
}
