import React from 'react';
import MathText from '../MathText';
import type { Stroke } from './types';
import { isLightInk, screenInkColor } from './inkColors';

interface CanvasTextLayerProps {
  strokes: Stroke[];
  revision: number;
  selectedIndexes: Set<number>;
  editingIndex?: number;
  isEditMode: boolean;
  fallbackColor: string;
  darkPaper: boolean;
  onEditText: (index: number) => void;
}

/**
 * Couche DOM strictement bornée au canvas courant.
 * Elle compile LaTeX/Beamer sans alourdir le moteur de tracé 2D.
 */
const CanvasTextLayer: React.FC<CanvasTextLayerProps> = ({
  strokes,
  revision,
  selectedIndexes,
  editingIndex,
  isEditMode,
  fallbackColor,
  darkPaper,
  onEditText,
}) => (
  <div className="canvas-text-layer absolute inset-0 z-20 overflow-hidden pointer-events-none" aria-live="polite">
    {strokes.map((stroke, index) => {
      if (!stroke.isText || !stroke.text || editingIndex === index) return null;
      const anchor = stroke.points[0];
      if (!anchor) return null;
      const selected = selectedIndexes.has(index);
      const rawColor = (stroke.color || fallbackColor || '').toLowerCase();
      const isLightChalk = isLightInk(rawColor);
      return (
        <div
          key={`canvas-text-${index}`}
          data-canvas-text-index={index}
          data-render-revision={revision}
          data-light-chalk={isLightChalk || undefined}
          className={`canvas-compiled-text absolute whitespace-pre-wrap rounded-md px-1.5 py-0.5 leading-relaxed ${isEditMode ? 'pointer-events-auto cursor-text' : ''} ${selected && isEditMode ? 'ring-2 ring-blue-400/70 bg-blue-50/35' : ''}`}
          style={{
            left: anchor.x,
            top: anchor.y,
            maxWidth: `calc(100% - ${Math.max(8, anchor.x)}px)`,
            color: screenInkColor(stroke.color || fallbackColor, darkPaper),
            fontFamily: 'Caveat, cursive',
            fontSize: `${stroke.fontSize || 24}px`,
          }}
          title={isEditMode ? 'Double-cliquez pour modifier ce texte' : undefined}
          onDoubleClick={(event) => {
            if (!isEditMode) return;
            event.preventDefault();
            event.stopPropagation();
            onEditText(index);
          }}
          onClick={(event) => {
            if (isEditMode && event.detail >= 2) onEditText(index);
          }}
        >
          <MathText text={stroke.text} revealFillBlanks={isEditMode} disableHighlight={isEditMode} />
        </div>
      );
    })}
  </div>
);

export default React.memo(CanvasTextLayer);
