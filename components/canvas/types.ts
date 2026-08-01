export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type ShapeType = 'line' | 'arrow' | 'double-arrow' | 'rectangle' | 'circle' | 'triangle';

export type ToolType = 'pointer' | 'pen' | 'highlighter' | 'marker' | 'eraser' | 'shape' | 'lasso' | 'text';
export type PenType = 'fountain' | 'marker' | 'fine';
export type HighlighterType = 'straight' | 'round';
export type EraserType = 'stroke' | 'pixel';

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
  shapeType?: ShapeType;
  penType?: PenType;
  highlighterType?: HighlighterType;
  isImage?: boolean;
  imgSrc?: string;
  imgElement?: HTMLImageElement;
}

export interface DrawingCanvasProps {
  height: number;
  onAddImage?: () => void;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  onStyleChange?: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  onColorChange?: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
}
