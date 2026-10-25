import { useRef, useState, useCallback } from 'react';
import { Stroke, Point } from '../types';

interface UseSelectionOptions {
  strokesRef: React.MutableRefObject<Stroke[]>;
  redrawAll: () => void;
  commitStrokes: () => void;
}

export function useSelection({
  strokesRef,
  redrawAll,
  commitStrokes,
}: UseSelectionOptions) {
  const [selectedStrokeIndexes, setSelectedStrokeIndexes] = useState<Set<number>>(new Set());
  const lassoPathRef = useRef<Point[]>([]);
  const selectionBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalSelectedStrokesRef = useRef<Stroke[]>([]);
  const draggedIndexesRef = useRef<number[]>([]);
  const isDraggingSelectionRef = useRef<boolean>(false);

  const beginSelectionDrag = useCallback((selection: Set<number>) => {
    const indexes = Array.from(selection);
    draggedIndexesRef.current = indexes;
    originalSelectedStrokesRef.current = indexes.map(idx => {
      const stroke = strokesRef.current[idx];
      return { ...stroke, points: stroke.points.map(p => ({ ...p })) };
    });
  }, [strokesRef]);

  const moveSelectionBy = useCallback((dx: number, dy: number) => {
    draggedIndexesRef.current.forEach((strokeIndex, position) => {
      const stroke = strokesRef.current[strokeIndex];
      const original = originalSelectedStrokesRef.current[position];
      if (!stroke || !original) return;
      for (let j = 0; j < stroke.points.length && j < original.points.length; j++) {
        stroke.points[j].x = original.points[j].x + dx;
        stroke.points[j].y = original.points[j].y + dy;
      }
    });
  }, [strokesRef]);

  const clearSelection = useCallback(() => {
    setSelectedStrokeIndexes(new Set());
    lassoPathRef.current = [];
    selectionBoxRef.current = null;
  }, []);

  const deleteSelection = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    strokesRef.current = strokesRef.current.filter((_, idx) => !selectedStrokeIndexes.has(idx));
    setSelectedStrokeIndexes(new Set());
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, redrawAll, commitStrokes]);

  const duplicateSelection = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    const newStrokes = [...strokesRef.current];
    const newIndexes = new Set<number>();

    selectedStrokeIndexes.forEach(idx => {
      const orig = strokesRef.current[idx];
      if (!orig) return;
      const duplicated: Stroke = {
        ...orig,
        points: orig.points.map(p => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure })),
      };
      if (orig.isImage && orig.imgSrc) {
        const img = new window.Image();
        img.src = orig.imgSrc;
        duplicated.imgElement = img;
      }
      newStrokes.push(duplicated);
      newIndexes.add(newStrokes.length - 1);
    });

    strokesRef.current = newStrokes;
    setSelectedStrokeIndexes(newIndexes);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, redrawAll, commitStrokes]);

  const changeSelectionColor = useCallback((newColor: string) => {
    if (selectedStrokeIndexes.size === 0) return;
    selectedStrokeIndexes.forEach(idx => {
      const s = strokesRef.current[idx];
      if (s && !s.isImage) {
        s.color = newColor;
      }
    });
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, redrawAll, commitStrokes]);

  const changeSelectionWidth = useCallback((delta: number) => {
    if (selectedStrokeIndexes.size === 0) return;
    selectedStrokeIndexes.forEach(idx => {
      const s = strokesRef.current[idx];
      if (s && !s.isImage) {
        s.width = Math.max(1, (s.width || 3) + delta);
      }
    });
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, redrawAll, commitStrokes]);

  const bringSelectionToFront = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    const selectedStrokes: Stroke[] = [];
    const nonSelectedStrokes: Stroke[] = [];

    strokesRef.current.forEach((s, idx) => {
      if (selectedStrokeIndexes.has(idx)) {
        selectedStrokes.push(s);
      } else {
        nonSelectedStrokes.push(s);
      }
    });

    strokesRef.current = [...nonSelectedStrokes, ...selectedStrokes];

    const newSelected = new Set<number>();
    const startIdx = nonSelectedStrokes.length;
    for (let i = 0; i < selectedStrokes.length; i++) {
      newSelected.add(startIdx + i);
    }
    setSelectedStrokeIndexes(newSelected);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, redrawAll, commitStrokes]);

  return {
    selectedStrokeIndexes,
    setSelectedStrokeIndexes,
    lassoPathRef,
    selectionBoxRef,
    dragStartRef,
    originalSelectedStrokesRef,
    draggedIndexesRef,
    isDraggingSelectionRef,
    beginSelectionDrag,
    moveSelectionBy,
    clearSelection,
    deleteSelection,
    duplicateSelection,
    changeSelectionColor,
    changeSelectionWidth,
    bringSelectionToFront,
    hasSelection: selectedStrokeIndexes.size > 0,
  };
}
