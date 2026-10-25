export interface Point {
  x: number;
  y: number;
  pressure: number;
  /** Inclinaison horizontale du stylet (-90 à 90 degrés) pour l'ombrage crayon et la plume. */
  tiltX?: number;
  /** Inclinaison verticale du stylet (-90 à 90 degrés). */
  tiltY?: number;
  /** Horodatage haute précision (ms) pour la dynamique de vélocité de l'encre. */
  t?: number;
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
  /** Source d'entrée conservée pour ne pas deviner la présence d'un vrai stylet à partir de la pression. */
  pointerType?: string;
  /** `true` quand les valeurs de pression proviennent d'un stylet matériel. */
  usesRealPressure?: boolean;
  opacity?: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
  shapeType?: ShapeType;
  penType?: PenType;
  lineStyle?: LineStyle;
  highlighterType?: HighlighterType;
  /** Courbe de pression active lors du tracé ('soft' | 'balanced' | 'firm'). */
  pressureCurve?: PressureCurve;
  /** Niveau de stabilisation (0 à 1) réglé dans Encre Interactive Maths. */
  stabilization?: number;
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
  /** Identifiant stable fourni par la zone de réponse pour la coordination avec la barre d'outils. */
  instanceId?: string;
  height: number;
  /** Suspend la réallocation du bitmap haute résolution pendant le glissement de la poignée. */
  isResizing?: boolean;
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
