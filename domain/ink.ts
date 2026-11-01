/** Persisted ink model shared by rendering, storage, synchronization and export. */
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
  isImage?: boolean;
  imgSrc?: string;
  isText?: boolean;
  text?: string;
  font?: string;
  fontSize?: number;
}
