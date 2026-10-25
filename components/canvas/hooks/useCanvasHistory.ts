import { useRef, useState, useCallback } from 'react';
import { Stroke } from '../types';
import { invalidateStrokeRenderCache } from '../renderUtils';

export type HistoryAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; items: { index: number; stroke: Stroke }[] }
  | { type: 'snapshot'; before: Stroke[]; after: Stroke[] };

function cloneStroke(s: Stroke): Stroke {
  return {
    ...s,
    points: s.points.map(p => ({ ...p })),
  };
}

export function cloneStrokesList(strokes: Stroke[]): Stroke[] {
  return strokes.map(cloneStroke);
}

interface UseCanvasHistoryOptions {
  strokesRef: React.MutableRefObject<Stroke[]>;
  setStrokeCount: React.Dispatch<React.SetStateAction<number>>;
  setRenderRevision: React.Dispatch<React.SetStateAction<number>>;
  onStrokesChangeRef: React.MutableRefObject<((strokes: Stroke[]) => void) | undefined>;
  redrawAll: () => void;
  setSelectedStrokeIndexes: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export function useCanvasHistory({
  strokesRef,
  setStrokeCount,
  setRenderRevision,
  onStrokesChangeRef,
  redrawAll,
  setSelectedStrokeIndexes,
}: UseCanvasHistoryOptions) {
  const historyRef = useRef<HistoryAction[]>([]);
  const eraseGestureRef = useRef<{ index: number; stroke: Stroke }[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  const commitStrokes = useCallback(() => {
    setStrokeCount(strokesRef.current.length);
    setRenderRevision(revision => revision + 1);
    onStrokesChangeRef.current?.([...strokesRef.current]);
  }, [setStrokeCount, setRenderRevision, strokesRef, onStrokesChangeRef]);

  const recordAdd = useCallback((stroke: Stroke) => {
    historyRef.current.push({ type: 'add', stroke: cloneStroke(stroke) });
    setRedoStack([]);
  }, []);

  const recordEraseGesture = useCallback(() => {
    if (eraseGestureRef.current.length > 0) {
      historyRef.current.push({ type: 'erase', items: eraseGestureRef.current });
      eraseGestureRef.current = [];
      setRedoStack([]);
    }
  }, []);

  /**
   * Enregistre une transaction arbitraire (déplacement, redimensionnement, duplication,
   * changement de couleur/épaisseur, effacement complet) pour un Undo/Redo infaillible.
   */
  const recordSnapshot = useCallback((before: Stroke[], after: Stroke[]) => {
    historyRef.current.push({
      type: 'snapshot',
      before: cloneStrokesList(before),
      after: cloneStrokesList(after),
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    const lastAction = historyRef.current.pop();
    if (!lastAction) return;
    if (lastAction.type === 'add') {
      strokesRef.current.pop();
    } else if (lastAction.type === 'erase') {
      for (let i = lastAction.items.length - 1; i >= 0; i--) {
        const { index, stroke } = lastAction.items[i];
        strokesRef.current.splice(index, 0, stroke);
      }
    } else if (lastAction.type === 'snapshot') {
      strokesRef.current = cloneStrokesList(lastAction.before);
      invalidateStrokeRenderCache();
    }
    setRedoStack(prev => [...prev, lastAction]);
    setSelectedStrokeIndexes(new Set());
    redrawAll();
    commitStrokes();
  }, [strokesRef, setSelectedStrokeIndexes, redrawAll, commitStrokes]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const actionToRedo = newRedoStack.pop();
    if (actionToRedo) {
      if (actionToRedo.type === 'add') {
        strokesRef.current.push(cloneStroke(actionToRedo.stroke));
      } else if (actionToRedo.type === 'erase') {
        const erasedSet = new Set(actionToRedo.items.map(item => item.stroke));
        strokesRef.current = strokesRef.current.filter(s => !erasedSet.has(s));
      } else if (actionToRedo.type === 'snapshot') {
        strokesRef.current = cloneStrokesList(actionToRedo.after);
        invalidateStrokeRenderCache();
      }
      historyRef.current.push(actionToRedo);
      setRedoStack(newRedoStack);
    }
    setSelectedStrokeIndexes(new Set());
    redrawAll();
    commitStrokes();
  }, [redoStack, strokesRef, setSelectedStrokeIndexes, redrawAll, commitStrokes]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    eraseGestureRef.current = [];
    setRedoStack([]);
  }, []);

  return {
    historyRef,
    eraseGestureRef,
    redoStack,
    setRedoStack,
    canUndo: historyRef.current.length > 0,
    canRedo: redoStack.length > 0,
    commitStrokes,
    recordAdd,
    recordEraseGesture,
    recordSnapshot,
    undo,
    redo,
    clearHistory,
  };
}
