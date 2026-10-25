import { useRef, useState, useCallback } from 'react';
import { Stroke, Point } from '../types';
import { invalidateStrokeRenderCache } from '../renderUtils';
import { cloneStrokesList } from './useCanvasHistory';
import { getStrokeBounds, Bounds } from '../utils';

interface UseSelectionOptions {
  strokesRef: React.MutableRefObject<Stroke[]>;
  redrawAll: () => void;
  commitStrokes: () => void;
  recordSnapshot?: (before: Stroke[], after: Stroke[]) => void;
}

export function useSelection({
  strokesRef,
  redrawAll,
  commitStrokes,
  recordSnapshot,
}: UseSelectionOptions) {
  const [selectedStrokeIndexes, setSelectedStrokeIndexes] = useState<Set<number>>(new Set());
  const lassoPathRef = useRef<Point[]>([]);
  const selectionBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const originalSelectedStrokesRef = useRef<Stroke[]>([]);
  const beforeDragAllStrokesRef = useRef<Stroke[] | null>(null);
  const initialSelectionBoundsRef = useRef<Bounds | null>(null);
  const draggedIndexesRef = useRef<number[]>([]);
  const isDraggingSelectionRef = useRef<boolean>(false);
  const selectionDragChangedRef = useRef<boolean>(false);

  const getSelectionCombinedBounds = useCallback((selection: Set<number> = selectedStrokeIndexes): Bounds | null => {
    if (selection.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selection.forEach(idx => {
      const stroke = strokesRef.current[idx];
      if (!stroke) return;
      const b = getStrokeBounds(stroke);
      if (!b) return;
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
    });
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [selectedStrokeIndexes, strokesRef]);

  const beginSelectionDrag = useCallback((selection: Set<number>) => {
    const indexes = Array.from(selection);
    draggedIndexesRef.current = indexes;
    selectionDragChangedRef.current = false;
    beforeDragAllStrokesRef.current = cloneStrokesList(strokesRef.current);
    initialSelectionBoundsRef.current = getSelectionCombinedBounds(selection);
    originalSelectedStrokesRef.current = indexes.map(idx => {
      const stroke = strokesRef.current[idx];
      return { ...stroke, points: stroke.points.map(p => ({ ...p })) };
    });
  }, [getSelectionCombinedBounds, strokesRef]);

  const moveSelectionBy = useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
      selectionDragChangedRef.current = true;
    }
    draggedIndexesRef.current.forEach((strokeIndex, position) => {
      const stroke = strokesRef.current[strokeIndex];
      const original = originalSelectedStrokesRef.current[position];
      if (!stroke || !original) return;
      stroke.points = original.points.map(p => ({
        ...p,
        x: p.x + dx,
        y: p.y + dy,
      }));
      invalidateStrokeRenderCache(stroke);
    });
  }, [strokesRef]);

  /**
   * Redimensionnement proportionnel ou libre d'une sélection (manuscrite, formes ou images)
   * à partir d'une poignée de coin ('tl' | 'tr' | 'bl' | 'br'), façon Noteshelf.
   */
  const scaleSelectionByHandle = useCallback((handle: string, currentX: number, currentY: number) => {
    const bounds = initialSelectionBoundsRef.current;
    if (!bounds) return;
    const origW = Math.max(12, bounds.maxX - bounds.minX);
    const origH = Math.max(12, bounds.maxY - bounds.minY);

    let anchorX = bounds.minX;
    let anchorY = bounds.minY;
    let rawScaleX = 1;
    let rawScaleY = 1;

    if (handle === 'br') {
      anchorX = bounds.minX;
      anchorY = bounds.minY;
      rawScaleX = (currentX - anchorX) / origW;
      rawScaleY = (currentY - anchorY) / origH;
    } else if (handle === 'tl') {
      anchorX = bounds.maxX;
      anchorY = bounds.maxY;
      rawScaleX = (anchorX - currentX) / origW;
      rawScaleY = (anchorY - currentY) / origH;
    } else if (handle === 'tr') {
      anchorX = bounds.minX;
      anchorY = bounds.maxY;
      rawScaleX = (currentX - anchorX) / origW;
      rawScaleY = (anchorY - currentY) / origH;
    } else if (handle === 'bl') {
      anchorX = bounds.maxX;
      anchorY = bounds.minY;
      rawScaleX = (anchorX - currentX) / origW;
      rawScaleY = (currentY - anchorY) / origH;
    }

    // Mise à l'échelle uniforme douce pour préserver les proportions de l'écriture mathématique
    const uniformScale = Math.max(0.2, Math.min(4.5, (rawScaleX + rawScaleY) * 0.5));
    selectionDragChangedRef.current = true;

    draggedIndexesRef.current.forEach((strokeIndex, position) => {
      const stroke = strokesRef.current[strokeIndex];
      const original = originalSelectedStrokesRef.current[position];
      if (!stroke || !original) return;
      stroke.points = original.points.map(p => ({
        ...p,
        x: anchorX + (p.x - anchorX) * uniformScale,
        y: anchorY + (p.y - anchorY) * uniformScale,
      }));
      if (!stroke.isImage && original.width) {
        stroke.width = Math.max(1, Math.min(48, original.width * Math.pow(uniformScale, 0.65)));
      }
      if (stroke.isText && original.fontSize) {
        stroke.fontSize = Math.max(12, Math.min(96, Math.round(original.fontSize * uniformScale)));
      }
      invalidateStrokeRenderCache(stroke);
    });
  }, [strokesRef]);

  const finishSelectionDrag = useCallback(() => {
    if (selectionDragChangedRef.current && beforeDragAllStrokesRef.current) {
      recordSnapshot?.(beforeDragAllStrokesRef.current, strokesRef.current);
    }
    selectionDragChangedRef.current = false;
    beforeDragAllStrokesRef.current = null;
    initialSelectionBoundsRef.current = null;
  }, [recordSnapshot, strokesRef]);

  const clearSelection = useCallback(() => {
    setSelectedStrokeIndexes(new Set());
    lassoPathRef.current = [];
    selectionBoxRef.current = null;
  }, []);

  const deleteSelection = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    const before = cloneStrokesList(strokesRef.current);
    strokesRef.current = strokesRef.current.filter((_, idx) => !selectedStrokeIndexes.has(idx));
    recordSnapshot?.(before, strokesRef.current);
    setSelectedStrokeIndexes(new Set());
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, recordSnapshot, redrawAll, commitStrokes]);

  const duplicateSelection = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    const before = cloneStrokesList(strokesRef.current);
    const newStrokes = [...strokesRef.current];
    const newIndexes = new Set<number>();

    selectedStrokeIndexes.forEach(idx => {
      const orig = strokesRef.current[idx];
      if (!orig) return;
      const duplicated: Stroke = {
        ...orig,
        points: orig.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 })),
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
    recordSnapshot?.(before, strokesRef.current);
    setSelectedStrokeIndexes(newIndexes);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, recordSnapshot, redrawAll, commitStrokes]);

  const changeSelectionColor = useCallback((newColor: string) => {
    if (selectedStrokeIndexes.size === 0) return;
    const before = cloneStrokesList(strokesRef.current);
    selectedStrokeIndexes.forEach(idx => {
      const s = strokesRef.current[idx];
      if (s && !s.isImage) {
        s.color = newColor;
        invalidateStrokeRenderCache(s);
      }
    });
    recordSnapshot?.(before, strokesRef.current);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, recordSnapshot, redrawAll, commitStrokes]);

  const changeSelectionWidth = useCallback((delta: number) => {
    if (selectedStrokeIndexes.size === 0) return;
    const before = cloneStrokesList(strokesRef.current);
    selectedStrokeIndexes.forEach(idx => {
      const s = strokesRef.current[idx];
      if (s && !s.isImage) {
        s.width = Math.max(1, (s.width || 3) + delta);
        invalidateStrokeRenderCache(s);
      }
    });
    recordSnapshot?.(before, strokesRef.current);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, recordSnapshot, redrawAll, commitStrokes]);

  const bringSelectionToFront = useCallback(() => {
    if (selectedStrokeIndexes.size === 0) return;
    const before = cloneStrokesList(strokesRef.current);
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
    recordSnapshot?.(before, strokesRef.current);

    const newSelected = new Set<number>();
    const startIdx = nonSelectedStrokes.length;
    for (let i = 0; i < selectedStrokes.length; i++) {
      newSelected.add(startIdx + i);
    }
    setSelectedStrokeIndexes(newSelected);
    redrawAll();
    commitStrokes();
  }, [selectedStrokeIndexes, strokesRef, recordSnapshot, redrawAll, commitStrokes]);

  return {
    selectedStrokeIndexes,
    setSelectedStrokeIndexes,
    lassoPathRef,
    selectionBoxRef,
    dragStartRef,
    originalSelectedStrokesRef,
    draggedIndexesRef,
    isDraggingSelectionRef,
    getSelectionCombinedBounds,
    beginSelectionDrag,
    moveSelectionBy,
    scaleSelectionByHandle,
    finishSelectionDrag,
    clearSelection,
    deleteSelection,
    duplicateSelection,
    changeSelectionColor,
    changeSelectionWidth,
    bringSelectionToFront,
    hasSelection: selectedStrokeIndexes.size > 0,
  };
}
