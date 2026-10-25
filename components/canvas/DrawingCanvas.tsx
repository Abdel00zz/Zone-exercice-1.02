import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Stroke, DrawingCanvasProps, Point, ToolType } from './types';
import { drawStroke, invalidateStrokeRenderCache } from './renderUtils';
import {
  boundsIntersect, getPointsBounds, getStrokeBounds, pointInPolygon,
  strokeIntersectsPoint, isPointInImage,
} from './utils';
import {
  setActiveCanvas, isActiveCanvas, clearActiveCanvas, isTypingTarget, useCanvasIsActive,
  registerCanvas, notifyCanvasChanged, type CanvasHandle,
} from './canvasRegistry';
import { closeToolMenu, getToolState, setToolState, useToolValue, type CanvasToolState } from './toolStore';
import {
  appendInterpolatedPoint, buildPredictedTail, calibratePressure, constrainShapePoint,
  optimizeStrokePoints, recognizeStrokeShape, simplifyPoints, straightenStrokeIfEligible,
  StrokeSmoother,
} from './inkEngine';
import CanvasTextLayer from './CanvasTextLayer';
import CanvasTextEditor, { CanvasTextDraft } from './CanvasTextEditor';
import CorrectionProgressControl from './CorrectionProgressControl';
import { cloneStrokesList, useCanvasHistory } from './hooks/useCanvasHistory';
import { useSelection } from './hooks/useSelection';

/**
 * Résolution du canvas. Le bitmap est dimensionné en pixels physiques pour que
 * le tracé reste net sur écran haute densité (tablette + stylet) et à
 * l'impression ; le contexte est ensuite mis à l'échelle pour que tout le code
 * de dessin continue de raisonner en pixels CSS.
 */
const getRenderScale = (isPrinting = false) => {
  if (isPrinting) return 4.5; // ~432 DPI pour une impression PDF ultra-haute résolution livre d'art
  return Math.min(2.5, Math.max(2, window.devicePixelRatio || 2));
};

const LIGHT_CHALK_COLORS = new Set([
  '#ffffff', '#fff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
]);

interface InkTrailPresenter {
  updateInkTrailStartPoint?: (event: PointerEvent, style: { color: string; diameter: number }) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  instanceId: providedInstanceId,
  isResizing = false,
  styleName,
  colorName,
  onStyleChange,
  onColorChange,
  initialStrokes = [],
  onStrokesChange,
  isEditMode = false,
  correctionProgress,
  correctionToggle,
}) => {
  const generatedInstanceId = useId();
  const instanceId = providedInstanceId ?? generatedInstanceId;
  const isCanvasActive = useCanvasIsActive(instanceId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * Buffer hors-écran ("Dry Ink Layer" façon Noteshelf) :
   * Tous les traits validés sont pré-rendus sur ce canvas statique.
   * Pendant l'écriture au stylet à 120/240 Hz, `redrawAll` copie ce buffer en O(1)
   * via `ctx.drawImage` et ne calcule que le trait actif ("Wet Ink").
   */
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticDirtyRef = useRef<boolean>(true);
  const inkPresenterRef = useRef<InkTrailPresenter | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const strokesRef = useRef<Stroke[]>(initialStrokes);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const predictedTailRef = useRef<Point[]>([]);
  const eraserCursorRef = useRef<{ x: number; y: number; radius: number } | null>(null);
  // Force le re-rendu de la Toolbar quand le nombre de traits change
  const [strokeCount, setStrokeCount] = useState(initialStrokes.length);
  const [renderRevision, setRenderRevision] = useState(0);

  const onStrokesChangeRef = useRef(onStrokesChange);
  onStrokesChangeRef.current = onStrokesChange;

  const redrawAllRef = useRef<() => void>(() => {});
  const resizeCanvasRef = useRef<() => void>(() => {});
  const isResizingRef = useRef(isResizing);
  const wasResizingRef = useRef(isResizing);
  const isPrintingRef = useRef(false);
  const redrawFrameRef = useRef(0);

  const invalidateAndRedraw = useCallback(() => {
    staticDirtyRef.current = true;
    redrawAllRef.current();
  }, []);

  const {
    eraseGestureRef,
    redoStack,
    canUndo,
    commitStrokes,
    recordAdd,
    recordEraseGesture,
    recordSnapshot,
    undo,
    redo,
  } = useCanvasHistory({
    strokesRef,
    setStrokeCount,
    setRenderRevision,
    onStrokesChangeRef,
    redrawAll: invalidateAndRedraw,
    setSelectedStrokeIndexes: (val) => setSelectedStrokeIndexes(val),
  });

  // Synchronise les traits si la fiche est rechargée (restauration JSON / synchronisation Cloud)
  const lastCommittedStrokesRef = useRef<Stroke[]>(initialStrokes);
  useEffect(() => {
    if (isDrawing.current) return;
    if (initialStrokes !== lastCommittedStrokesRef.current && initialStrokes !== strokesRef.current) {
      lastCommittedStrokesRef.current = initialStrokes;
      strokesRef.current = initialStrokes;
      setStrokeCount(initialStrokes.length);
      staticDirtyRef.current = true;
      redrawAllRef.current();
    }
  }, [initialStrokes]);

  const {
    selectedStrokeIndexes,
    setSelectedStrokeIndexes,
    lassoPathRef,
    selectionBoxRef,
    dragStartRef,
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
  } = useSelection({
    strokesRef,
    redrawAll: invalidateAndRedraw,
    commitStrokes,
    recordSnapshot,
  });

  const tool = useToolValue(snapshot => snapshot.tool);
  const selectionMode = useToolValue(snapshot => snapshot.selectionMode);
  const showMeasurements = useToolValue(snapshot => snapshot.showMeasurements);
  const palmRejection = useToolValue(snapshot => snapshot.palmRejection);
  const color = useToolValue(snapshot => snapshot.color);

  const [textInput, setTextInput] = useState<CanvasTextDraft | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lastPenInputAtRef = useRef(0);
  const activeGestureToolRef = useRef<ToolType>('pen');

  // Initialisation optionnelle du délégué matériel Web Ink API (tablettes compatibles)
  useEffect(() => {
    const canvas = canvasRef.current;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!canvas || !nav?.ink?.requestPresenter) return;
    let cancelled = false;
    nav.ink.requestPresenter({ presentationArea: canvas })
      .then((presenter: InkTrailPresenter) => {
        if (!cancelled) inkPresenterRef.current = presenter;
      })
      .catch(() => {
        /* Web Ink API non supportée sur ce périphérique : le moteur prédictif prend le relais */
      });
    return () => {
      cancelled = true;
      inkPresenterRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!textInput?.visible) return;
    const frame = window.requestAnimationFrame(() => {
      textAreaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [textInput?.visible]);

  const smootherRef = useRef<StrokeSmoother | null>(null);
  const recognitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognizedStrokeRef = useRef<Stroke | null>(null);
  const holdAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const recognizedOriginRef = useRef<{ pointerX: number; pointerY: number; p0: Point; p1: Point } | null>(null);
  // width/height en pixels CSS, scale = facteur de densité du bitmap.
  const dimensionsRef = useRef({ width: 0, height: 0, scale: 1 });

  // Manipulation d'image et poignées de redimensionnement de sélection
  const dragModeRef = useRef<'move' | 'resize' | 'select' | null>(null);
  const activeResizeHandleRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toute modification de la sélection ou du thème invalide le cache statique
  useEffect(() => {
    staticDirtyRef.current = true;
    redrawAllRef.current();
  }, [selectedStrokeIndexes, colorName, styleName]);

  const rebuildStaticLayer = useCallback(() => {
    const { width, height, scale } = dimensionsRef.current;
    if (width <= 0 || height <= 0) return;

    const bitmapW = Math.round(width * scale);
    const bitmapH = Math.round(height * scale);
    let staticCanvas = staticCanvasRef.current;
    if (!staticCanvas && typeof document !== 'undefined') {
      staticCanvas = document.createElement('canvas');
      staticCanvasRef.current = staticCanvas;
    }
    if (!staticCanvas) return;

    if (staticCanvas.width !== bitmapW || staticCanvas.height !== bitmapH) {
      staticCanvas.width = bitmapW;
      staticCanvas.height = bitmapH;
    }

    const sCtx = staticCanvas.getContext('2d');
    if (!sCtx) return;

    sCtx.setTransform(scale, 0, 0, scale, 0, 0);
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.clearRect(0, 0, width, height);

    const isDarkTheme = ['black', 'green', 'blue'].includes(colorName || (styleName === 'slate' ? 'black' : ''));
    const adaptPrintColor = isPrintingRef.current && isDarkTheme;

    /**
     * Ordre de rendu Noteshelf :
     * 1. Les surligneurs sont dessinés en premier plan de fond pour ne JAMAIS
     *    ternir ni voiler l'encre noire/colorée des formules mathématiques.
     * 2. Les traits d'encre, formes, images et coups de gomme pixel suivent dans l'ordre chronologique.
     */
    strokesRef.current.forEach((stroke, idx) => {
      if (stroke.isText || !stroke.isHighlighter) return;
      const isSelected = isPrintingRef.current ? false : selectedStrokeIndexes.has(idx);
      drawStroke(sCtx, stroke, isSelected, true);
    });

    strokesRef.current.forEach((stroke, idx) => {
      if (stroke.isText || stroke.isHighlighter) return;
      const isSelected = isPrintingRef.current ? false : selectedStrokeIndexes.has(idx);
      if (adaptPrintColor && stroke.color && LIGHT_CHALK_COLORS.has(stroke.color.toLowerCase())) {
        drawStroke(sCtx, { ...stroke, color: '#0f172a' }, false, true);
      } else {
        drawStroke(sCtx, stroke, isSelected, true);
      }
    });

    staticDirtyRef.current = false;
  }, [colorName, selectedStrokeIndexes, styleName]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, scale = 1 } = dimensionsRef.current;
    if (width <= 0 || height <= 0) return;

    if (staticDirtyRef.current || !staticCanvasRef.current) {
      rebuildStaticLayer();
    }

    // Copie ultra-rapide O(1) du buffer statique en coordonnées bitmap physiques
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const previewStroke = recognizedStrokeRef.current || currentStrokeRef.current;

    // Si le trait actif en cours est un surligneur, on le dessine SOUS le buffer d'encre statique !
    if (previewStroke && previewStroke.isHighlighter) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const wetPoints = predictedTailRef.current.length > 0 && !previewStroke.shapeType
        ? [...previewStroke.points, ...predictedTailRef.current]
        : undefined;
      drawStroke(ctx, previewStroke, false, false, wetPoints);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    if (staticCanvasRef.current && staticCanvasRef.current.width > 0) {
      ctx.drawImage(staticCanvasRef.current, 0, 0);
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (previewStroke && !previewStroke.isHighlighter) {
      const wetPoints = predictedTailRef.current.length > 0 && !previewStroke.shapeType
        ? [...previewStroke.points, ...predictedTailRef.current]
        : undefined;
      drawStroke(ctx, previewStroke, false, false, wetPoints);
    }

    if (showMeasurements && previewStroke && previewStroke.shapeType && previewStroke.points.length >= 2) {
      const start = previewStroke.points[0];
      const end = previewStroke.points[previewStroke.points.length - 1];
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      let label = '';
      if (['line', 'arrow', 'double-arrow'].includes(previewStroke.shapeType)) {
        const deg = Math.round(Math.abs(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI));
        label = `${Math.round(Math.hypot(w, h))} px · ${deg}°`;
      } else if (previewStroke.shapeType === 'angle') {
        const deg = Math.round(Math.abs(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI));
        label = `${deg}°`;
      } else if (previewStroke.shapeType === 'circle' && Math.abs(w - h) <= 2) {
        label = `⌀ ${Math.round(w)} px`;
      } else {
        label = `${Math.round(w)} × ${Math.round(h)} px`;
      }
      ctx.save();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(label, (start.x + end.x) / 2 + 8, (start.y + end.y) / 2 - 8);
      ctx.restore();
    }

    // Anneau visuel de la gomme pendant l'effacement (style Noteshelf)
    if (eraserCursorRef.current && !isPrintingRef.current) {
      const { x, y, radius } = eraserCursorRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, radius), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.75)';
      ctx.fillStyle = 'rgba(241, 245, 249, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if ((tool === 'pointer' || (tool === 'lasso' && selectionMode === 'rectangle')) && selectionBoxRef.current) {
      const box = selectionBoxRef.current;
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 5]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
    }

    if (tool === 'lasso' && lassoPathRef.current.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';

      ctx.moveTo(lassoPathRef.current[0].x, lassoPathRef.current[0].y);
      for (let i = 1; i < lassoPathRef.current.length; i++) {
        ctx.lineTo(lassoPathRef.current[i].x, lassoPathRef.current[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    // Cadre de sélection et 4 poignées de redimensionnement proportionnel (Noteshelf)
    if (selectedStrokeIndexes.size > 0 && lassoPathRef.current.length === 0 && !isPrintingRef.current) {
      const bounds = getSelectionCombinedBounds(selectedStrokeIndexes);
      if (bounds) {
        const pad = 6;
        const bx = bounds.minX - pad;
        const by = bounds.minY - pad;
        const bw = bounds.maxX - bounds.minX + pad * 2;
        const bh = bounds.maxY - bounds.minY + pad * 2;

        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        const handles = [
          { x: bx, y: by },
          { x: bx + bw, y: by },
          { x: bx, y: by + bh },
          { x: bx + bw, y: by + bh },
        ];
        handles.forEach(h => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = '#2563eb';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        ctx.restore();
      }
    }
  }, [getSelectionCombinedBounds, rebuildStaticLayer, selectedStrokeIndexes, selectionMode, showMeasurements, tool]);

  redrawAllRef.current = redrawAll;

  const scheduleRedraw = useCallback(() => {
    if (redrawFrameRef.current) return;
    redrawFrameRef.current = window.requestAnimationFrame(() => {
      redrawFrameRef.current = 0;
      redrawAllRef.current();
    });
  }, []);

  const cancelScheduledRedraw = useCallback(() => {
    if (!redrawFrameRef.current) return;
    window.cancelAnimationFrame(redrawFrameRef.current);
    redrawFrameRef.current = 0;
  }, []);

  useEffect(() => () => cancelScheduledRedraw(), [cancelScheduledRedraw]);

  const commitTextInput = useCallback(() => {
    if (!textInput) return;
    const { color, lineWidth } = getToolState();
    if (textInput.text.trim()) {
      if (textInput.editingIndex !== undefined && strokesRef.current[textInput.editingIndex]?.isText) {
        const before = cloneStrokesList(strokesRef.current);
        strokesRef.current[textInput.editingIndex] = {
          ...strokesRef.current[textInput.editingIndex],
          text: textInput.text,
        };
        recordSnapshot(before, strokesRef.current);
      } else {
        const newTextStroke: Stroke = {
          points: [{ x: textInput.x, y: textInput.y, pressure: 0.5 }],
          color,
          width: lineWidth,
          isText: true,
          text: textInput.text,
          font: 'Caveat',
          fontSize: 24,
        };
        strokesRef.current.push(newTextStroke);
        recordAdd(newTextStroke);
      }
      staticDirtyRef.current = true;
      redrawAllRef.current();
      commitStrokes();
    }
    setTextInput(null);
  }, [commitStrokes, recordAdd, recordSnapshot, textInput]);

  useEffect(() => {
    let rafId = 0;
    let commitTimer = 0;
    let pendingRescale = false;

    const resizeCanvas = () => {
      if (isResizingRef.current) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const cssWidth = Math.round(rect.width);
      const cssHeight = Math.round(rect.height);
      if (cssWidth === 0 || cssHeight === 0) return;

      const isPrintMedia = isPrintingRef.current || (typeof window !== 'undefined' && window.matchMedia?.('print').matches);
      const printTargetWidth = 688;
      const targetCssWidth = isPrintMedia ? Math.max(cssWidth, printTargetWidth) : cssWidth;

      const scale = getRenderScale(isPrintMedia);
      const bitmapWidth = Math.round(targetCssWidth * scale);
      const bitmapHeight = Math.round(cssHeight * scale);
      if (canvas.width === bitmapWidth && canvas.height === bitmapHeight) return;

      const previousWidth = dimensionsRef.current.width;

      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
      if (!isPrintMedia) {
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
      }
      dimensionsRef.current = { width: targetCssWidth, height: cssHeight, scale };

      const needsRescale = !isPrintMedia && previousWidth > 0 && cssWidth !== previousWidth && strokesRef.current.length > 0;
      if (needsRescale) {
        const ratio = cssWidth / previousWidth;
        strokesRef.current.forEach(stroke => {
          stroke.points.forEach(point => {
            point.x *= ratio;
          });
          invalidateStrokeRenderCache(stroke);
        });
        pendingRescale = true;
      }

      staticDirtyRef.current = true;
      redrawAllRef.current();
    };
    resizeCanvasRef.current = resizeCanvas;

    const handlePreparePrint = () => {
      isPrintingRef.current = true;
      staticDirtyRef.current = true;
      resizeCanvas();
      redrawAllRef.current();
    };

    const handleAfterPrint = () => {
      isPrintingRef.current = false;
      staticDirtyRef.current = true;
      resizeCanvas();
      redrawAllRef.current();
    };

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        resizeCanvas();
        if (pendingRescale) {
          clearTimeout(commitTimer);
          commitTimer = window.setTimeout(() => {
            pendingRescale = false;
            commitStrokes();
          }, 120);
        }
      });
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('worksheet-prepare-print', handlePreparePrint);
    window.addEventListener('beforeprint', handlePreparePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('worksheet-prepare-print', handlePreparePrint);
      window.removeEventListener('beforeprint', handlePreparePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      cancelAnimationFrame(rafId);
      clearTimeout(commitTimer);
    };
  }, [commitStrokes, colorName, styleName]);

  isResizingRef.current = isResizing;
  useEffect(() => {
    const wasResizing = wasResizingRef.current;
    wasResizingRef.current = isResizing;
    if (!wasResizing || isResizing) return;
    const frame = window.requestAnimationFrame(() => resizeCanvasRef.current());
    return () => window.cancelAnimationFrame(frame);
  }, [isResizing]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        const maxWidth = dimensionsRef.current.width * 0.5 || 300;
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (maxWidth / w) * h;
          w = maxWidth;
        }
        const newStroke: Stroke = {
          points: [
            { x: 50, y: 50, pressure: 0.5 },
            { x: 50 + w, y: 50 + h, pressure: 0.5 },
          ],
          color: '',
          width: 0,
          isImage: true,
          imgSrc: src,
          imgElement: img,
        };
        strokesRef.current.push(newStroke);
        recordAdd(newStroke);
        setToolState({ tool: 'pointer', openMenu: null });
        staticDirtyRef.current = true;
        redrawAll();
        commitStrokes();
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCoordinates = (
    e: React.PointerEvent | PointerEvent,
    knownRect?: DOMRect,
    knownSettings?: CanvasToolState,
  ): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = knownRect || canvas.getBoundingClientRect();
    const { pressureCurve, penType } = knownSettings || getToolState();

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: calibratePressure({
        pressure: e.pressure,
        pointerType: e.pointerType,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
      }, pressureCurve, penType === 'pencil'),
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      t: e.timeStamp,
    };
  };

  const clearShapeRecognition = () => {
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = null;
    recognizedStrokeRef.current = null;
    recognizedOriginRef.current = null;
  };

  const scheduleShapeRecognition = (activeTool: ToolType) => {
    const { shapeRecognition, highlighterStraightLines } = getToolState();
    if (!shapeRecognition || !['pen', 'highlighter'].includes(activeTool) || (activeTool === 'highlighter' && highlighterStraightLines)) return;
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = setTimeout(() => {
      recognitionTimerRef.current = null;
      const stroke = currentStrokeRef.current;
      if (!stroke || recognizedStrokeRef.current || stroke.points.length < 6) return;
      const recognized = recognizeStrokeShape(stroke);
      if (recognized && recognized.points.length >= 2) {
        recognizedStrokeRef.current = recognized;
        const anchor = holdAnchorRef.current || stroke.points[stroke.points.length - 1];
        recognizedOriginRef.current = {
          pointerX: anchor.x,
          pointerY: anchor.y,
          p0: { ...recognized.points[0] },
          p1: { ...recognized.points[recognized.points.length - 1] },
        };
        predictedTailRef.current = [];
        redrawAllRef.current();
      }
    }, 380);
  };

  const alignPointToExistingShapes = (point: Point): Point => {
    if (!getToolState().alignWithShapes) return point;
    const threshold = 10;
    let bestX = point.x;
    let bestY = point.y;
    let bestDx = threshold + 1;
    let bestDy = threshold + 1;

    for (const stroke of strokesRef.current) {
      if (!stroke.shapeType || stroke.points.length < 2) continue;
      const first = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      const anchors = [first, last, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }];
      for (const anchor of anchors) {
        const dx = Math.abs(anchor.x - point.x);
        const dy = Math.abs(anchor.y - point.y);
        if (dx < bestDx) { bestDx = dx; bestX = anchor.x; }
        if (dy < bestDy) { bestDy = dy; bestY = anchor.y; }
      }
    }
    return { ...point, x: bestX, y: bestY };
  };

  const isStylusEraser = (e: React.PointerEvent | PointerEvent) => {
    if (!e) return false;
    if (e.pointerType === 'eraser') return true;
    if (e.pointerType === 'pen') {
      const ne = (e as any).nativeEvent || e;
      const buttons = e.buttons ?? ne.buttons ?? 0;
      const button = e.button ?? ne.button ?? -1;
      return (
        (buttons & 32) !== 0 ||
        (buttons & 2) !== 0 ||
        button === 5 ||
        button === 2 ||
        Boolean((ne as any).barrelButton) ||
        Boolean((e as any).barrelButton) ||
        Boolean((ne as any).eraser) ||
        Boolean((e as any).eraser)
      );
    }
    return false;
  };

  const capturePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture non disponible */
    }
  };

  const releasePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* rien à libérer */
    }
  };

  /**
   * Teste si le point (x, y) touche l'une des 4 poignées de coin du cadre de sélection actuel.
   */
  const getSelectionResizeHandleAt = (x: number, y: number): string | null => {
    if (selectedStrokeIndexes.size === 0) return null;
    const bounds = getSelectionCombinedBounds(selectedStrokeIndexes);
    if (!bounds) return null;
    const pad = 6;
    const handles = [
      { x: bounds.minX - pad, y: bounds.minY - pad, type: 'tl' },
      { x: bounds.maxX + pad, y: bounds.minY - pad, type: 'tr' },
      { x: bounds.minX - pad, y: bounds.maxY + pad, type: 'bl' },
      { x: bounds.maxX + pad, y: bounds.maxY + pad, type: 'br' },
    ];
    for (const h of handles) {
      if (Math.hypot(x - h.x, y - h.y) <= 14) {
        return h.type;
      }
    }
    return null;
  };

  const openTextEditorByIndex = useCallback((index: number) => {
    if (!isEditMode) return false;
    const stroke = strokesRef.current[index];
    if (!stroke?.isText || !stroke.text) return false;
    setActiveCanvas(instanceId);
    setToolState({ tool: 'text', openMenu: null });
    setSelectedStrokeIndexes(new Set([index]));
    setTextInput({
      visible: true,
      x: stroke.points[0]?.x ?? 20,
      y: stroke.points[0]?.y ?? 20,
      text: stroke.text,
      editingIndex: index,
    });
    return true;
  }, [instanceId, isEditMode, setSelectedStrokeIndexes]);

  const openTextEditorAt = useCallback((x: number, y: number) => {
    if (!isEditMode) return false;
    for (let index = strokesRef.current.length - 1; index >= 0; index--) {
      const stroke = strokesRef.current[index];
      if (!stroke.isText || !stroke.text || !strokeIntersectsPoint(stroke, x, y, 14)) continue;
      return openTextEditorByIndex(index);
    }
    return false;
  }, [isEditMode, openTextEditorByIndex]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && palmRejection) return;
    if (e.pointerType === 'pen') lastPenInputAtRef.current = Date.now();
    if (e.cancelable) e.preventDefault();

    const settings = getToolState();
    closeToolMenu();
    setActiveCanvas(instanceId);

    const coords = getCoordinates(e, undefined, settings);
    if (!coords) return;

    const stylusEraser = isStylusEraser(e);
    const activeTool: ToolType = stylusEraser ? 'eraser' : settings.tool;
    activeGestureToolRef.current = activeTool;
    clearShapeRecognition();
    smootherRef.current = null;
    predictedTailRef.current = [];
    eraserCursorRef.current = null;

    if (activeTool === 'text') {
      e.preventDefault();
      if (!textInput?.visible) {
        setTextInput({ visible: true, x: coords.x, y: coords.y, text: '' });
      }
      return;
    }

    capturePointer(e);

    if (activeTool === 'pointer') {
      const handleType = getSelectionResizeHandleAt(coords.x, coords.y);
      if (handleType) {
        isDrawing.current = true;
        dragModeRef.current = 'resize';
        activeResizeHandleRef.current = handleType;
        dragStartRef.current = { x: coords.x, y: coords.y };
        beginSelectionDrag(selectedStrokeIndexes);
        return;
      }

      for (let i = strokesRef.current.length - 1; i >= 0; i--) {
        const stroke = strokesRef.current[i];
        const clicked = stroke.isImage
          ? isPointInImage(coords.x, coords.y, stroke)
          : strokeIntersectsPoint(stroke, coords.x, coords.y, 10);

        if (clicked) {
          let newSelection = selectedStrokeIndexes;
          if (!selectedStrokeIndexes.has(i)) {
            newSelection = new Set([i]);
            setSelectedStrokeIndexes(newSelection);
          }
          isDrawing.current = true;
          dragModeRef.current = 'move';
          dragStartRef.current = { x: coords.x, y: coords.y };
          beginSelectionDrag(newSelection);
          staticDirtyRef.current = true;
          redrawAll();
          return;
        }
      }

      setSelectedStrokeIndexes(new Set());
      isDrawing.current = true;
      dragModeRef.current = 'select';
      dragStartRef.current = { x: coords.x, y: coords.y };
      selectionBoxRef.current = { x: coords.x, y: coords.y, w: 0, h: 0 };
      staticDirtyRef.current = true;
      redrawAll();
      return;
    }

    isDrawing.current = true;

    if (activeTool === 'eraser' && (settings.eraserType === 'stroke' || settings.eraserHighlighterOnly)) {
      eraseGestureRef.current = [];
      let erasedAny = false;
      const activeEraserWidth = settings.eraserAutoSize ? settings.eraserWidth * (0.55 + coords.pressure * 0.9) : settings.eraserWidth;
      eraserCursorRef.current = { x: coords.x, y: coords.y, radius: activeEraserWidth / 2 };
      const kept: Stroke[] = [];
      strokesRef.current.forEach((s, idx) => {
        if ((!settings.eraserHighlighterOnly || s.isHighlighter) && strokeIntersectsPoint(s, coords.x, coords.y, activeEraserWidth / 2)) {
          erasedAny = true;
          eraseGestureRef.current.push({ index: idx, stroke: s });
        } else {
          kept.push(s);
        }
      });
      strokesRef.current = kept;
      if (erasedAny) {
        setSelectedStrokeIndexes(new Set());
        staticDirtyRef.current = true;
      }
      redrawAll();
    } else if (activeTool === 'lasso') {
      const handleType = getSelectionResizeHandleAt(coords.x, coords.y);
      if (handleType) {
        dragModeRef.current = 'resize';
        activeResizeHandleRef.current = handleType;
        dragStartRef.current = { x: coords.x, y: coords.y };
        beginSelectionDrag(selectedStrokeIndexes);
        return;
      }

      if (selectedStrokeIndexes.size > 0) {
        const bounds = getSelectionCombinedBounds(selectedStrokeIndexes);
        if (bounds && coords.x >= bounds.minX - 8 && coords.x <= bounds.maxX + 8 && coords.y >= bounds.minY - 8 && coords.y <= bounds.maxY + 8) {
          isDraggingSelectionRef.current = true;
          dragStartRef.current = coords;
          beginSelectionDrag(selectedStrokeIndexes);
          return;
        }
      }

      setSelectedStrokeIndexes(new Set());
      if (settings.selectionMode === 'rectangle') {
        dragModeRef.current = 'select';
        dragStartRef.current = { x: coords.x, y: coords.y };
        selectionBoxRef.current = { x: coords.x, y: coords.y, w: 0, h: 0 };
      } else {
        lassoPathRef.current = [coords];
      }
      staticDirtyRef.current = true;
      redrawAll();
    } else {
      const startPoint = (activeTool === 'shape' || (activeTool === 'highlighter' && settings.highlighterStraightLines)) && settings.snapGrid
        ? { ...coords, x: Math.round(coords.x / 24) * 24, y: Math.round(coords.y / 24) * 24 }
        : coords;
      const strokeWidth = activeTool === 'highlighter'
        ? settings.highlighterWidth
        : activeTool === 'eraser'
          ? (settings.eraserAutoSize ? settings.eraserWidth * (0.55 + coords.pressure * 0.9) : settings.eraserWidth)
          : settings.lineWidth;

      if (activeTool === 'eraser') {
        eraserCursorRef.current = { x: coords.x, y: coords.y, radius: strokeWidth / 2 };
      }

      currentStrokeRef.current = {
        points: [startPoint],
        color: activeTool === 'highlighter' ? settings.highlighterColor : settings.color,
        width: strokeWidth,
        pointerType: e.pointerType,
        usesRealPressure: e.pointerType === 'pen',
        opacity: activeTool === 'highlighter' ? settings.highlighterOpacity : undefined,
        isEraser: activeTool === 'eraser',
        isHighlighter: activeTool === 'highlighter',
        shapeType: activeTool === 'shape' ? settings.shapeType : undefined,
        penType: activeTool === 'pen' ? settings.penType : undefined,
        lineStyle: activeTool === 'pen' ? settings.lineStyle : undefined,
        highlighterType: activeTool === 'highlighter' ? settings.highlighterType : undefined,
        pressureCurve: settings.pressureCurve,
        stabilization: settings.penStabilization,
      };
      if (activeTool === 'pen' || (activeTool === 'highlighter' && !settings.highlighterStraightLines)) {
        smootherRef.current = new StrokeSmoother(
          settings.penStabilization,
          activeTool === 'pen' ? settings.penType : undefined,
        );
        smootherRef.current.seed(startPoint, e.timeStamp);
      }
      holdAnchorRef.current = { x: startPoint.x, y: startPoint.y };
      redrawAll();
    }
  };

  const handleTextDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (openTextEditorAt(x, y)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [openTextEditorAt]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    if (e.pointerType === 'touch' && palmRejection) return;
    if (e.pointerType === 'pen') lastPenInputAtRef.current = Date.now();
    if (e.cancelable) e.preventDefault();
    const settings = getToolState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const nativeE = e.nativeEvent as PointerEvent;
    const coalescedEvents: PointerEvent[] | undefined = nativeE.getCoalescedEvents?.();
    const events = coalescedEvents?.length ? coalescedEvents : [nativeE];

    let recognitionTool: ToolType | null = null;
    const alreadyRecognizedShape = recognizedStrokeRef.current;

    events.forEach((event: PointerEvent) => {
      const rawCoords = getCoordinates(event, canvasRect, settings);
      if (!rawCoords) return;

      const stylusEraser = isStylusEraser(event);
      const activeTool: ToolType = stylusEraser ? 'eraser' : activeGestureToolRef.current;
      if (stylusEraser) activeGestureToolRef.current = 'eraser';

      // Si une forme a déjà été reconnue au maintien (Hold-to-Shape Noteshelf) :
      // - Tant que le stylet reste quasi immobile (< 8 px du point de maintien), la forme reconnue
      //   reste 100 % verrouillée (évite qu'un cercle fermé près de son point de départ ne s'écrase en un point).
      // - Si l'utilisateur glisse volontairement (> 8 px) après la reconnaissance :
      //   • Pour une ligne/flèche/angle : ajuste l'extrémité.
      //   • Pour une forme fermée (cercle, rectangle, triangle) : redimensionne proportionnellement autour du centre.
      if (alreadyRecognizedShape && alreadyRecognizedShape.shapeType && alreadyRecognizedShape.points.length >= 2) {
        const origin = recognizedOriginRef.current;
        if (!origin) return;
        const postSnapDrift = Math.hypot(rawCoords.x - origin.pointerX, rawCoords.y - origin.pointerY);
        if (postSnapDrift < 8) {
          return;
        }
        const isOpenShape = ['line', 'arrow', 'double-arrow', 'angle'].includes(alreadyRecognizedShape.shapeType);
        if (isOpenShape) {
          const start = origin.p0;
          const constrained = constrainShapePoint(start, rawCoords, alreadyRecognizedShape.shapeType, {
            snapGrid: settings.snapGrid,
            angleSnap: settings.angleSnap,
            angleStep: settings.angleStep,
            regularShapes: settings.regularShapes !== e.shiftKey,
          });
          alreadyRecognizedShape.points = [start, alignPointToExistingShapes(constrained)];
        } else {
          const cx = (origin.p0.x + origin.p1.x) / 2;
          const cy = (origin.p0.y + origin.p1.y) / 2;
          const baseDist = Math.max(18, Math.hypot(origin.pointerX - cx, origin.pointerY - cy));
          const currDist = Math.max(12, Math.hypot(rawCoords.x - cx, rawCoords.y - cy));
          const scaleFactor = Math.max(0.35, Math.min(3.5, currDist / baseDist));
          const halfW = Math.max(10, (Math.abs(origin.p1.x - origin.p0.x) / 2) * scaleFactor);
          const halfH = Math.max(10, (Math.abs(origin.p1.y - origin.p0.y) / 2) * scaleFactor);
          alreadyRecognizedShape.points = [
            { x: cx - halfW, y: cy - halfH, pressure: origin.p0.pressure },
            { x: cx + halfW, y: cy + halfH, pressure: origin.p1.pressure },
          ];
        }
        return;
      }

      let coords = rawCoords;
      if (smootherRef.current && (activeTool === 'pen' || activeTool === 'highlighter')) {
        coords = smootherRef.current.next(rawCoords, event.timeStamp);
      }

      if (activeTool === 'pointer') {
        if (dragModeRef.current === 'move' && dragStartRef.current) {
          const dx = coords.x - dragStartRef.current.x;
          const dy = coords.y - dragStartRef.current.y;
          moveSelectionBy(dx, dy);
          staticDirtyRef.current = true;
        } else if (dragModeRef.current === 'resize' && activeResizeHandleRef.current) {
          scaleSelectionByHandle(activeResizeHandleRef.current, coords.x, coords.y);
          staticDirtyRef.current = true;
        } else if (dragModeRef.current === 'select' && selectionBoxRef.current && dragStartRef.current) {
          selectionBoxRef.current.w = coords.x - dragStartRef.current.x;
          selectionBoxRef.current.h = coords.y - dragStartRef.current.y;
        }
        return;
      }

      if (activeTool === 'eraser') {
        const activeEraserWidth = settings.eraserAutoSize
          ? settings.eraserWidth * (0.55 + coords.pressure * 0.9)
          : settings.eraserWidth;
        eraserCursorRef.current = { x: coords.x, y: coords.y, radius: activeEraserWidth / 2 };

        if (settings.eraserType === 'stroke' || settings.eraserHighlighterOnly) {
          let erasedAny = false;
          const kept: Stroke[] = [];
          strokesRef.current.forEach((s, idx) => {
            if ((!settings.eraserHighlighterOnly || s.isHighlighter) && strokeIntersectsPoint(s, coords.x, coords.y, activeEraserWidth / 2)) {
              erasedAny = true;
              eraseGestureRef.current.push({ index: idx, stroke: s });
            } else {
              kept.push(s);
            }
          });
          strokesRef.current = kept;
          if (erasedAny) {
            setSelectedStrokeIndexes(new Set());
            staticDirtyRef.current = true;
          }
        } else {
          if (currentStrokeRef.current) {
            currentStrokeRef.current.isEraser = true;
            currentStrokeRef.current.width = activeEraserWidth;
            const points = currentStrokeRef.current.points;
            const last = points[points.length - 1];
            if (Math.hypot(coords.x - last.x, coords.y - last.y) >= Math.max(0.75, activeEraserWidth * 0.04)) {
              points.push(coords);
            }
          } else {
            currentStrokeRef.current = {
              points: [coords],
              color: '',
              width: activeEraserWidth,
              isEraser: true,
            };
          }
        }
      } else if (activeTool === 'lasso') {
        if (dragModeRef.current === 'resize' && activeResizeHandleRef.current) {
          scaleSelectionByHandle(activeResizeHandleRef.current, coords.x, coords.y);
          staticDirtyRef.current = true;
        } else if (isDraggingSelectionRef.current && dragStartRef.current) {
          moveSelectionBy(coords.x - dragStartRef.current.x, coords.y - dragStartRef.current.y);
          staticDirtyRef.current = true;
        } else if (settings.selectionMode === 'rectangle' && selectionBoxRef.current && dragStartRef.current) {
          selectionBoxRef.current.w = coords.x - dragStartRef.current.x;
          selectionBoxRef.current.h = coords.y - dragStartRef.current.y;
        } else {
          const last = lassoPathRef.current[lassoPathRef.current.length - 1];
          if (!last || Math.hypot(coords.x - last.x, coords.y - last.y) >= 0.8) {
            lassoPathRef.current.push(coords);
          }
        }
      } else if (currentStrokeRef.current) {
        if (activeTool === 'shape') {
          const start = currentStrokeRef.current.points[0];
          const constrained = constrainShapePoint(start, coords, settings.shapeType, {
            snapGrid: settings.snapGrid,
            angleSnap: settings.angleSnap,
            angleStep: settings.angleStep,
            regularShapes: settings.regularShapes !== e.shiftKey,
          });
          currentStrokeRef.current.points = [start, alignPointToExistingShapes(constrained)];
        } else if (activeTool === 'highlighter' && settings.highlighterStraightLines) {
          const start = currentStrokeRef.current.points[0];
          if (settings.angleSnap) {
            const constrained = constrainShapePoint(start, coords, 'line', {
              snapGrid: settings.snapGrid,
              angleSnap: true,
              angleStep: settings.angleStep,
              regularShapes: false,
            });
            currentStrokeRef.current.points = [start, constrained];
          } else {
            const dx = Math.abs(coords.x - start.x);
            const dy = Math.abs(coords.y - start.y);
            if (dx >= dy) {
              currentStrokeRef.current.points = [start, { x: coords.x, y: start.y, pressure: coords.pressure }];
            } else {
              currentStrokeRef.current.points = [start, { x: start.x, y: coords.y, pressure: coords.pressure }];
            }
          }
        } else {
          const pts = currentStrokeRef.current.points;
          const last = pts[pts.length - 1];
          const dist = Math.hypot(coords.x - last.x, coords.y - last.y);
          const minDistance = activeTool === 'highlighter'
            ? Math.max(0.65, Math.min(1.8, currentStrokeRef.current.width * 0.06))
            : Math.max(0.28, Math.min(0.95, currentStrokeRef.current.width * 0.09));

          // Détection de maintien réel (Dwell Anchor) indépendante de la fréquence 60/120/240 Hz :
          // tant que le stylet sort d'un rayon de 4.5 px autour de l'ancre, il est en mouvement
          // et le compte à rebours Hold-to-Shape (380 ms) est réarmé.
          const anchor = holdAnchorRef.current;
          const dwellDrift = anchor ? Math.hypot(rawCoords.x - anchor.x, rawCoords.y - anchor.y) : Infinity;
          if (dwellDrift > 4.5) {
            holdAnchorRef.current = { x: rawCoords.x, y: rawCoords.y };
            if (recognitionTimerRef.current) {
              clearTimeout(recognitionTimerRef.current);
              recognitionTimerRef.current = null;
            }
            recognitionTool = activeTool;
          }

          if (dist >= minDistance) {
            appendInterpolatedPoint(pts, coords, minDistance);
          } else if (
            currentStrokeRef.current.usesRealPressure &&
            dist >= 0.12 &&
            Math.abs(coords.pressure - last.pressure) >= 0.03
          ) {
            pts[pts.length - 1] = { ...last, pressure: coords.pressure };
          }
        }
      }
    });

    // Prédiction matérielle zéro-latence (`getPredictedEvents`) + Web Ink API
    if (
      currentStrokeRef.current &&
      !recognizedStrokeRef.current &&
      !currentStrokeRef.current.shapeType &&
      !currentStrokeRef.current.isEraser &&
      !(settings.tool === 'highlighter' && settings.highlighterStraightLines)
    ) {
      const predictedEvents: PointerEvent[] | undefined = (nativeE as any).getPredictedEvents?.();
      if (predictedEvents && predictedEvents.length > 0) {
        const rawPredicted: Point[] = [];
        for (let i = 0; i < Math.min(3, predictedEvents.length); i++) {
          const p = getCoordinates(predictedEvents[i], canvasRect, settings);
          if (p) rawPredicted.push(p);
        }
        predictedTailRef.current = buildPredictedTail(
          currentStrokeRef.current.points,
          rawPredicted,
          smootherRef.current,
          nativeE.timeStamp,
        );
      } else {
        predictedTailRef.current = [];
      }

      if (inkPresenterRef.current?.updateInkTrailStartPoint && currentStrokeRef.current.color) {
        try {
          inkPresenterRef.current.updateInkTrailStartPoint(nativeE, {
            color: currentStrokeRef.current.color,
            diameter: Math.max(1, currentStrokeRef.current.width),
          });
        } catch {
          /* ignore */
        }
      }
    } else {
      predictedTailRef.current = [];
    }

    if (recognitionTool && !alreadyRecognizedShape) {
      scheduleShapeRecognition(recognitionTool);
    }

    scheduleRedraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cancelScheduledRedraw();
    releasePointer(e);
    const settings = getToolState();
    const activeTool = activeGestureToolRef.current;
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = null;
    smootherRef.current = null;
    predictedTailRef.current = [];
    eraserCursorRef.current = null;

    if (!isDrawing.current && !currentStrokeRef.current) return;
    isDrawing.current = false;

    if (activeTool === 'pointer') {
      if (dragModeRef.current === 'move' || dragModeRef.current === 'resize') {
        finishSelectionDrag();
      } else if (dragModeRef.current === 'select' && selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const minX = Math.min(box.x, box.x + box.w);
        const maxX = Math.max(box.x, box.x + box.w);
        const minY = Math.min(box.y, box.y + box.h);
        const maxY = Math.max(box.y, box.y + box.h);

        if (maxX - minX > 5 && maxY - minY > 5) {
          const newSelection = new Set<number>();
          strokesRef.current.forEach((stroke, idx) => {
            let isSelected = false;
            if (stroke.isImage && stroke.points.length >= 2) {
              const p1 = stroke.points[0];
              const p2 = stroke.points[1];
              const sMinX = Math.min(p1.x, p2.x);
              const sMaxX = Math.max(p1.x, p2.x);
              const sMinY = Math.min(p1.y, p2.y);
              const sMaxY = Math.max(p1.y, p2.y);
              if (sMaxX >= minX && sMinX <= maxX && sMaxY >= minY && sMinY <= maxY) isSelected = true;
            } else {
              for (const p of stroke.points) {
                if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
                  isSelected = true;
                  break;
                }
              }
            }
            if (isSelected) newSelection.add(idx);
          });
          setSelectedStrokeIndexes(newSelection);
        }
      }
      dragModeRef.current = null;
      dragStartRef.current = null;
      activeResizeHandleRef.current = null;
      selectionBoxRef.current = null;
      staticDirtyRef.current = true;
      redrawAll();
      commitStrokes();
      return;
    }

    if (activeTool === 'lasso') {
      if (dragModeRef.current === 'resize') {
        finishSelectionDrag();
        dragModeRef.current = null;
        activeResizeHandleRef.current = null;
        dragStartRef.current = null;
      } else if (isDraggingSelectionRef.current) {
        finishSelectionDrag();
        isDraggingSelectionRef.current = false;
        dragStartRef.current = null;
      } else if (settings.selectionMode === 'rectangle' && selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const minX = Math.min(box.x, box.x + box.w);
        const maxX = Math.max(box.x, box.x + box.w);
        const minY = Math.min(box.y, box.y + box.h);
        const maxY = Math.max(box.y, box.y + box.h);

        if (maxX - minX > 3 && maxY - minY > 3) {
          const newSelection = new Set<number>();
          strokesRef.current.forEach((stroke, idx) => {
            let isSelected = false;
            if (settings.includePartialSelection) {
              isSelected = stroke.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
            } else {
              isSelected = stroke.points.every(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
            }
            if (isSelected) newSelection.add(idx);
          });
          setSelectedStrokeIndexes(newSelection);
        }
        selectionBoxRef.current = null;
        dragStartRef.current = null;
        dragModeRef.current = null;
      } else if (lassoPathRef.current.length > 2) {
        const lassoPolygon = simplifyPoints(lassoPathRef.current, 1.8);
        const lassoBounds = getPointsBounds(lassoPolygon);
        const newSelection = new Set<number>();
        strokesRef.current.forEach((stroke, idx) => {
          const strokeBounds = getStrokeBounds(stroke);
          if (!lassoBounds || !strokeBounds || !boundsIntersect(lassoBounds, strokeBounds)) return;
          let isSelected = false;
          if (settings.includePartialSelection) {
            for (const p of stroke.points) {
              if (pointInPolygon(p, lassoPolygon)) {
                isSelected = true;
                break;
              }
            }
          } else {
            isSelected = stroke.points.every(p => pointInPolygon(p, lassoPolygon));
          }
          if (isSelected) newSelection.add(idx);
        });
        setSelectedStrokeIndexes(newSelection);
        lassoPathRef.current = [];
      } else {
        lassoPathRef.current = [];
      }
      staticDirtyRef.current = true;
      redrawAll();
      commitStrokes();
      return;
    }

    if (currentStrokeRef.current) {
      let committedStroke: Stroke = recognizedStrokeRef.current
        ? recognizedStrokeRef.current
        : {
          ...currentStrokeRef.current,
          points: optimizeStrokePoints(currentStrokeRef.current),
        };

      // Redressement automatique des traits longs si activé
      if (!committedStroke.shapeType && settings.straightenLines) {
        committedStroke = straightenStrokeIfEligible(committedStroke, true);
      }

      strokesRef.current.push(committedStroke);
      recordAdd(committedStroke);
      currentStrokeRef.current = null;
      recognizedStrokeRef.current = null;
      staticDirtyRef.current = true;
    }

    recordEraseGesture();

    redrawAll();
    commitStrokes();
    lastCommittedStrokesRef.current = strokesRef.current;
  };

  const clear = () => {
    if (strokesRef.current.length === 0) return;
    const before = cloneStrokesList(strokesRef.current);
    strokesRef.current = [];
    recordSnapshot(before, []);
    clearSelection();
    staticDirtyRef.current = true;
    redrawAll();
    commitStrokes();
    lastCommittedStrokesRef.current = strokesRef.current;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveCanvas(instanceId)) return;
      if (isTypingTarget(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStrokeIndexes.size > 0) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === 'Escape' && selectedStrokeIndexes.size > 0) {
        setSelectedStrokeIndexes(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStrokeIndexes, tool, instanceId, redo, undo, deleteSelection, setSelectedStrokeIndexes]);

  useEffect(() => () => {
    clearActiveCanvas(instanceId);
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
  }, [instanceId]);

  const handleRef = useRef<CanvasHandle | null>(null);
  handleRef.current = {
    undo,
    redo,
    clear,
    deleteSelection,
    duplicateSelection,
    importImage: () => fileInputRef.current?.click(),
    setBackgroundStyle: (style) => onStyleChange?.(style),
    setBackgroundColor: (value) => onColorChange?.(value),
    snapshot: {
      canUndo: canUndo || strokeCount > 0,
      canRedo: redoStack.length > 0,
      hasSelection: selectedStrokeIndexes.size > 0,
      styleName,
      colorName,
      canChangeBackground: !!(onStyleChange || onColorChange),
    },
  };

  useEffect(() => registerCanvas(instanceId, () => handleRef.current!), [instanceId]);

  useEffect(() => {
    notifyCanvasChanged(instanceId);
  }, [
    instanceId,
    canUndo,
    strokeCount,
    redoStack.length,
    selectedStrokeIndexes.size,
    styleName,
    colorName,
    onStyleChange,
    onColorChange,
  ]);

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none group/canvas z-10">
      {correctionToggle?.available && (
        <div
          className="absolute right-6 z-30 flex items-end pointer-events-auto no-print"
          style={{
            top: isResizing || isCanvasActive ? '-26px' : '-25px',
          }}
        >
          {correctionProgress && correctionToggle.visible && (
            <div className="animate-in fade-in slide-in-from-right-2 duration-200 mr-2 mb-1">
              <CorrectionProgressControl progress={correctionProgress} />
            </div>
          )}

          {(() => {
            const borderWidth = isResizing || isCanvasActive ? 2 : 1;
            const borderColor = isResizing ? '#64748b' : isCanvasActive ? '#0284c7' : (colorName === 'black' || (styleName === 'slate' && !colorName)) ? '#1e293b' : colorName === 'green' ? '#14532d' : colorName === 'blue' ? '#1e3a8a' : colorName === 'cream' ? '#fcd34d' : '#a4b4c4';
            const bgColor = (colorName === 'black' || (styleName === 'slate' && !colorName)) ? '#0f172a' : colorName === 'green' ? '#14532d' : colorName === 'blue' ? '#1e3a8a' : colorName === 'cream' ? '#fef3c7' : '#f4f1ea';
            const textColor = correctionToggle.visible ? '#0d9488' : (colorName === 'black' || colorName === 'green' || colorName === 'blue' || (styleName === 'slate' && !colorName)) ? '#cbd5e1' : '#64748b';

            return (
              <button
                type="button"
                aria-label={correctionToggle.visible ? 'Masquer la correction et rappel de cours' : 'Afficher la correction et rappel de cours'}
                aria-pressed={correctionToggle.visible}
                onClick={correctionToggle.toggle}
                className="group/helpbtn relative flex items-center justify-center h-[26px] px-3.5 rounded-t-lg transition-colors duration-200 ease-out font-itim tracking-wide text-[0.88rem] font-bold"
                style={{
                  backgroundColor: bgColor,
                  borderTop: `${borderWidth}px solid ${borderColor}`,
                  borderLeft: `${borderWidth}px solid ${borderColor}`,
                  borderRight: `${borderWidth}px solid ${borderColor}`,
                  borderBottom: `${borderWidth}px solid ${bgColor}`,
                  color: textColor,
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05), 0 -2px 4px -1px rgba(0, 0, 0, 0.03)',
                  clipPath: 'inset(-10px -10px 0 -10px)',
                }}
                title={correctionToggle.visible ? 'Masquer le rappel de cours' : 'Afficher le rappel de cours'}
              >
                <span>Aide</span>
              </button>
            );
          })()}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        aria-label="Importer une image dans le canvas"
        className="hidden"
      />

      <div
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden pointer-events-auto"
        onPointerDownCapture={() => setActiveCanvas(instanceId)}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          data-has-strokes={strokesRef.current.some(s => !s.isText && s.points && s.points.length > 0) ? 'true' : 'false'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleTextDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute top-0 left-0 w-full h-full ${
            tool === 'pointer' ? 'cursor-default' :
            tool === 'eraser' ? 'cursor-cell' :
            tool === 'lasso' ? 'cursor-crosshair' :
            tool === 'text' ? 'cursor-text' :
            'cursor-crosshair'
          }`}
          style={{ touchAction: 'none' }}
        />
        <CanvasTextLayer
          strokes={strokesRef.current}
          revision={renderRevision}
          selectedIndexes={selectedStrokeIndexes}
          editingIndex={textInput?.editingIndex}
          isEditMode={isEditMode}
          fallbackColor={color}
          onEditText={openTextEditorByIndex}
        />
        {selectedStrokeIndexes.size > 0 && (() => {
          const bounds = getSelectionCombinedBounds(selectedStrokeIndexes);
          if (!bounds) return null;
          const topPos = Math.max(8, bounds.minY - 46);
          const maxLeft = Math.max(8, (dimensionsRef.current.width || 320) - 256);
          const leftPos = Math.min(maxLeft, Math.max(8, (bounds.minX + bounds.maxX) / 2 - 120));

          return (
            <div
              className="absolute z-30 bg-white/95 backdrop-blur-md border border-slate-300 rounded-full shadow-lg px-3 py-1 flex items-center gap-2 transition-all animate-in fade-in duration-100"
              style={{ left: `${leftPos}px`, top: `${topPos}px` }}
            >
              <button
                onClick={duplicateSelection}
                className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-full transition"
                title="Dupliquer la sélection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button
                onClick={bringSelectionToFront}
                className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-full transition"
                title="Mettre au premier plan"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <button
                onClick={() => changeSelectionWidth(-1)}
                className="p-1 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100"
                title="Réduire l'épaisseur"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => changeSelectionWidth(1)}
                className="p-1 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100"
                title="Augmenter l'épaisseur"
              >
                <Plus size={14} />
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-1">
                {['#0f172a', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'].map(c => (
                  <button
                    key={c}
                    onClick={() => changeSelectionColor(c)}
                    className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <button
                onClick={deleteSelection}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })()}
        {textInput?.visible && (
          <CanvasTextEditor
            draft={textInput}
            color={color}
            isEditMode={isEditMode}
            textAreaRef={textAreaRef}
            onChange={(text) => setTextInput(current => current ? { ...current, text } : current)}
            onCommit={commitTextInput}
            onCancel={() => setTextInput(null)}
          />
        )}
      </div>
    </div>
  );
};
