import type { Stroke as DocumentStroke } from '../../domain/ink';
export type { Point, ShapeType, SelectionMode, ToolType, PenType, HighlighterType, EraserType, LineStyle, PressureCurve } from '../../domain/ink';

/** Browser-only rendering cache; never part of the persisted document model. */
export interface Stroke extends DocumentStroke {
  imgElement?: HTMLImageElement;
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
