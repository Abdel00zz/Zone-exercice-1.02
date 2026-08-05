import { useRef, useState, useCallback } from 'react';
import { Stroke } from '../types';

export type HistoryAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; items: { index: number; stroke: Stroke }[] };

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
    historyRef.current.push({ type: 'add', stroke });
    setRedoStack([]);
  }, []);

  const recordEraseGesture = useCallback(() => {
    if (eraseGestureRef.current.length > 0) {
      historyRef.current.push({ type: 'erase', items: eraseGestureRef.current });
      eraseGestureRef.current = [];
      setRedoStack([]);
    }
  }, []);

  const undo = useCallback(() => {
    const lastAction = historyRef.current.pop();
    if (!lastAction) return;
    if (lastAction.type === 'add') {
      strokesRef.current.pop();
    } else {
      for (let i = lastAction.items.length - 1; i >= 0; i--) {
        const { index, stroke } = lastAction.items[i];
        strokesRef.current.splice(index, 0, stroke);
      }
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
        strokesRef.current.push(actionToRedo.stroke);
      } else {
        const erasedSet = new Set(actionToRedo.items.map(item => item.stroke));
        strokesRef.current = strokesRef.current.filter(s => !erasedSet.has(s));
      }
      historyRef.current.push(actionToRedo);
      setRedoStack(newRedoStack);
    }
    redrawAll();
    commitStrokes();
  }, [redoStack, strokesRef, redrawAll, commitStrokes]);

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
    undo,
    redo,
    clearHistory,
  };
}
