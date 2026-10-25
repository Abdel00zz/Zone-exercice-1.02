import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Stroke, DrawingCanvasProps, Point, ToolType } from './types';
import { drawStroke } from './renderUtils';
import {
  boundsIntersect, getPointsBounds, getStrokeBounds, pointInPolygon,
  strokeIntersectsPoint, isPointInImage, isPointOnImageResizeHandle,
} from './utils';
import {
  setActiveCanvas, isActiveCanvas, clearActiveCanvas, isTypingTarget, useCanvasIsActive,
  registerCanvas, notifyCanvasChanged, type CanvasHandle,
} from './canvasRegistry';
import { closeToolMenu, getToolState, setToolState, useToolValue, type CanvasToolState } from './toolStore';
import {
  calibratePressure, constrainShapePoint, optimizeStrokePoints,
  recognizeStrokeShape, simplifyPoints, StrokeSmoother,
} from './inkEngine';
import CanvasTextLayer from './CanvasTextLayer';
import CanvasTextEditor, { CanvasTextDraft } from './CanvasTextEditor';
import CorrectionProgressControl from './CorrectionProgressControl';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { useSelection } from './hooks/useSelection';

/**
 * Résolution du canvas. Le bitmap est dimensionné en pixels physiques pour que
 * le tracé reste net sur écran haute densité (tablette + stylet) et à
 * l'impression ; le contexte est ensuite mis à l'échelle pour que tout le code
 * de dessin continue de raisonner en pixels CSS.
 * Plafonné à 2 pour ne pas exploser la mémoire : une fiche affiche facilement
 * une dizaine de canvas simultanément.
 */
const getRenderScale = (isPrinting = false) => {
  if (isPrinting) return 4.5; // ~432 DPI pour une impression PDF ultra-haute résolution livre d'art
  return Math.min(2.5, Math.max(2, window.devicePixelRatio || 2));
};

const LIGHT_CHALK_COLORS = new Set([
  '#ffffff', '#fff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
]);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const strokesRef = useRef<Stroke[]>(initialStrokes);
  const currentStrokeRef = useRef<Stroke | null>(null);
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

  const {
    eraseGestureRef,
    redoStack,
    setRedoStack,
    commitStrokes,
    recordAdd,
    recordEraseGesture,
    undo,
    redo,
    clearHistory,
  } = useCanvasHistory({
    strokesRef,
    setStrokeCount,
    setRenderRevision,
    onStrokesChangeRef,
    redrawAll: () => redrawAllRef.current(),
    setSelectedStrokeIndexes: (val) => setSelectedStrokeIndexes(val),
  });

  const {
    selectedStrokeIndexes,
    setSelectedStrokeIndexes,
    lassoPathRef,
    selectionBoxRef,
    dragStartRef,
    isDraggingSelectionRef,
    beginSelectionDrag,
    moveSelectionBy,
    clearSelection,
    deleteSelection,
    duplicateSelection,
    changeSelectionColor,
    changeSelectionWidth,
    bringSelectionToFront,
  } = useSelection({
    strokesRef,
    redrawAll: () => redrawAllRef.current(),
    commitStrokes,
  });

  /**
   * Les réglages d'outil sont partagés par toute la fiche (`toolStore`) et pilotés
   * par la barre flottante unique. Seules les valeurs qui changent le RENDU de ce
   * canvas sont souscrites ; les autres sont lues au moment de l'événement pointeur
   * via `getToolState()`, pour ne pas re-rendre les dizaines de canvas montés à
   * chaque déplacement d'un curseur d'épaisseur.
   */
  const tool = useToolValue(snapshot => snapshot.tool);
  const selectionMode = useToolValue(snapshot => snapshot.selectionMode);
  const showMeasurements = useToolValue(snapshot => snapshot.showMeasurements);
  const palmRejection = useToolValue(snapshot => snapshot.palmRejection);
  // Couleur de repli de la couche texte DOM (le canvas 2D ne rend pas le LaTeX).
  const color = useToolValue(snapshot => snapshot.color);

  const [textInput, setTextInput] = useState<CanvasTextDraft | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lastPenInputAtRef = useRef(0);

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
  // width/height en pixels CSS, scale = facteur de densité du bitmap.
  const dimensionsRef = useRef({ width: 0, height: 0, scale: 1 });



  // Image manipulation state
  const dragModeRef = useRef<'move' | 'resize' | 'select' | null>(null);
  const activeImageIndexRef = useRef<number | null>(null);
  const activeResizeHandleRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Le bitmap est en pixels physiques : on ramène le repère en pixels CSS
    // pour que tout le code de dessin (coordonnées, épaisseurs) reste inchangé.
    const scale = dimensionsRef.current.scale || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

    const isDarkTheme = ['black', 'green', 'blue'].includes(colorName || (styleName === 'slate' ? 'black' : ''));
    const adaptPrintColor = isPrintingRef.current && isDarkTheme;

    strokesRef.current.forEach((stroke, idx) => {
      // Le texte est rendu dans une couche DOM : MathText peut ainsi compiler
      // LaTeX/Beamer, contrairement à CanvasRenderingContext2D.fillText().
      if (stroke.isText) return;
      if (adaptPrintColor && stroke.color && LIGHT_CHALK_COLORS.has(stroke.color.toLowerCase())) {
        drawStroke(ctx, { ...stroke, color: '#0f172a' }, false, true);
      } else {
        drawStroke(ctx, stroke, isPrintingRef.current ? false : selectedStrokeIndexes.has(idx), true);
      }
    });

    const previewStroke = recognizedStrokeRef.current || currentStrokeRef.current;
    if (previewStroke) {
      drawStroke(ctx, previewStroke, false, false);
      if (showMeasurements && previewStroke.shapeType && previewStroke.points.length >= 2) {
        const start = previewStroke.points[0];
        const end = previewStroke.points[previewStroke.points.length - 1];
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        const label = ['line', 'arrow', 'double-arrow'].includes(previewStroke.shapeType)
          ? `${Math.round(Math.hypot(width, height))} px`
          : `${Math.round(width)} × ${Math.round(height)} px`;
        ctx.save();
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText(label, (start.x + end.x) / 2 + 8, (start.y + end.y) / 2 - 8);
        ctx.restore();
      }
    }
    
    if ((tool === 'pointer' || (tool === 'lasso' && selectionMode === 'rectangle')) && selectionBoxRef.current) {
      const box = selectionBoxRef.current;
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
    }
    
    if (tool === 'lasso' && lassoPathRef.current.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      
      ctx.moveTo(lassoPathRef.current[0].x, lassoPathRef.current[0].y);
      for (let i = 1; i < lassoPathRef.current.length; i++) {
        ctx.lineTo(lassoPathRef.current[i].x, lassoPathRef.current[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
    
    if (selectedStrokeIndexes.size > 0 && lassoPathRef.current.length === 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      selectedStrokeIndexes.forEach(idx => {
        const stroke = strokesRef.current[idx];
        if (!stroke) return;
        stroke.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });
      
      if (minX !== Infinity) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
        ctx.setLineDash([]);
        
        if (tool === 'pointer' && selectedStrokeIndexes.size === 1) {
           const stroke = strokesRef.current[Array.from(selectedStrokeIndexes)[0]];
           if (stroke.isImage) {
               ctx.fillStyle = '#2563eb';
               // Draw 4 resize handles
               const p1 = stroke.points[0];
               const p2 = stroke.points[1];
               const sMinX = Math.min(p1.x, p2.x);
               const sMaxX = Math.max(p1.x, p2.x);
               const sMinY = Math.min(p1.y, p2.y);
               const sMaxY = Math.max(p1.y, p2.y);
               
               const handles = [
                 {x: sMinX, y: sMinY},
                 {x: sMaxX, y: sMinY},
                 {x: sMinX, y: sMaxY},
                 {x: sMaxX, y: sMaxY}
               ];
               handles.forEach(h => {
                  ctx.beginPath();
                  ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = 'white';
                  ctx.lineWidth = 2;
                  ctx.stroke();
               });
           }
        }
      }
    }
  }, [selectedStrokeIndexes, tool, selectionMode, showMeasurements]);

  // `redrawAll` change d'identité à chaque changement de sélection/outil ; passer
  // par une ref évite de recréer le ResizeObserver et les abonnements à chaque fois.
  redrawAllRef.current = redrawAll;

  // Les Pointer Events peuvent arriver plus vite que l'écran (stylets 120/240 Hz).
  // Une seule peinture est donc planifiée par image, en utilisant les derniers
  // points coalescés disponibles au moment où le navigateur dessine réellement.
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
        strokesRef.current[textInput.editingIndex] = {
          ...strokesRef.current[textInput.editingIndex],
          text: textInput.text,
        };
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
      redrawAllRef.current();
      commitStrokes();
    }
    setTextInput(null);
  }, [commitStrokes, recordAdd, textInput]);

  useEffect(() => {
    // rAF en cours pour le rendu intermédiaire (throttle visuel)
    let rafId = 0;
    // Timer pour diffèrer le commitStrokes (évite N écritures localStorage/seconde)
    let commitTimer = 0;
    // Largeur avant le dernier redimensionnement nécessitant un rescale
    let pendingRescale = false;

    const resizeCanvas = () => {
      // Le cadre CSS suit la poignée, mais le bitmap reste inchangé pendant le
      // geste. Réassigner canvas.width/height réinitialiserait le contexte et
      // obligerait à recalculer tous les traits à chaque taille intermédiaire.
      if (isResizingRef.current) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const cssWidth = Math.round(rect.width);
      const cssHeight = Math.round(rect.height);
      if (cssWidth === 0 || cssHeight === 0) return;

      const isPrintMedia = isPrintingRef.current || (typeof window !== 'undefined' && window.matchMedia?.('print').matches);
      // Sur papier A4 portrait (210mm - 28mm marges = 182mm), la largeur standard vaut ~688px à 96 DPI.
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

      // Les traits sont stockés en pixels absolus. Sans cette remise à l'échelle,
      // une rotation de tablette ou un redimensionnement de fenêtre décalait le
      // tracé par rapport aux lignes de la zone de réponse. On ne réagit qu'à la
      // largeur, et JAMAIS pendant l'aperçu d'impression pour ne pas déformer les
      // figures géométriques (cercles -> ellipses) ni altérer la sauvegarde.
      const needsRescale = !isPrintMedia && previousWidth > 0 && cssWidth !== previousWidth && strokesRef.current.length > 0;
      if (needsRescale) {
        const ratio = cssWidth / previousWidth;
        strokesRef.current.forEach(stroke => {
          stroke.points.forEach(point => {
            point.x *= ratio;
          });
        });
        pendingRescale = true;
      }

      redrawAllRef.current();
    };
    resizeCanvasRef.current = resizeCanvas;

    const handlePreparePrint = () => {
      isPrintingRef.current = true;
      resizeCanvas();
      redrawAllRef.current();
    };

    const handleAfterPrint = () => {
      isPrintingRef.current = false;
      resizeCanvas();
      redrawAllRef.current();
    };

    // Throttle visuel via rAF : au plus un redimensionnement par frame.
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        resizeCanvas();
        // Différer le commitStrokes pour ne l'appeler qu'une seule fois
        // une fois le redimensionnement stabilisé (120 ms sans nouveau resize).
        if (pendingRescale) {
          clearTimeout(commitTimer);
          commitTimer = window.setTimeout(() => {
            pendingRescale = false;
            commitStrokes();
          }, 120);
        }
      });
    };

    // Premier appel synchrone pour initialiser les dimensions sans délai.
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

  // Le ResizeObserver peut ne pas recevoir un nouvel événement au relâchement :
  // le DOM possède déjà la hauteur finale appliquée directement pendant le drag.
  // On force donc exactement une allocation finale après le commit React.
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
            { x: 50 + w, y: 50 + h, pressure: 0.5 }
          ],
          color: '',
          width: 0,
          isImage: true,
          imgSrc: src,
          imgElement: img
        };
        strokesRef.current.push(newStroke);
        setRedoStack([]);
        setToolState({ tool: 'pointer', openMenu: null });
        redrawAll(); commitStrokes();
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Coordonnées en pixels CSS : le contexte 2D est déjà mis à l'échelle par la
  // densité d'écran dans `redrawAll`, il ne faut pas l'appliquer deux fois.
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
    };
  };

  const clearShapeRecognition = () => {
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = null;
    recognizedStrokeRef.current = null;
  };

  const scheduleShapeRecognition = (activeTool: ToolType) => {
    const { shapeRecognition, highlighterStraightLines } = getToolState();
    if (!shapeRecognition || !['pen', 'highlighter'].includes(activeTool) || (activeTool === 'highlighter' && highlighterStraightLines)) return;
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = setTimeout(() => {
      recognitionTimerRef.current = null;
      const stroke = currentStrokeRef.current;
      if (!stroke) return;
      recognizedStrokeRef.current = recognizeStrokeShape(stroke);
      if (recognizedStrokeRef.current) redrawAllRef.current();
    }, 550);
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

  // Bits 2 (clic droit / bouton latéral secondaire), 32 (bouton gomme standard) et button 2/5
  // permettent d'activer la gomme instantanément lors de la pression du bouton latéral du stylet.
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

  // La capture du pointeur peut échouer (pointeur déjà relâché, événement synthétique).
  // Une exception ici interromprait le handler et ferait perdre le trait en cours.
  const capturePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture non disponible : le dessin reste fonctionnel dans les limites du canvas */
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
  }, [instanceId, isEditMode]);

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
    // Si le rejet de paume est activé, ignorer le toucher au doigt (seuls le stylet et la souris dessinent)
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
    clearShapeRecognition();
    smootherRef.current = null;

    if (activeTool === 'text') {
      e.preventDefault();
      if (!textInput?.visible) {
        setTextInput({ visible: true, x: coords.x, y: coords.y, text: '' });
      }
      return;
    }

    capturePointer(e);
    
    if (activeTool === 'pointer') {
       if (selectedStrokeIndexes.size === 1) {
         const idx = Array.from(selectedStrokeIndexes)[0];
         const stroke = strokesRef.current[idx];
         const handleType = isPointOnImageResizeHandle(coords.x, coords.y, stroke);
         if (stroke.isImage && handleType) {
            isDrawing.current = true;
            dragModeRef.current = 'resize';
            activeImageIndexRef.current = idx;
            activeResizeHandleRef.current = handleType as string;
            dragStartRef.current = { x: coords.x, y: coords.y };
            return;
         }
       }
       
       for (let i = strokesRef.current.length - 1; i >= 0; i--) {
         const stroke = strokesRef.current[i];
         let clicked = false;
         if (stroke.isImage) {
            clicked = isPointInImage(coords.x, coords.y, stroke);
         } else {
            clicked = strokeIntersectsPoint(stroke, coords.x, coords.y, 10);
         }
         
         if (clicked) {
           let newSelection = selectedStrokeIndexes;
           if (!selectedStrokeIndexes.has(i)) {
               newSelection = new Set([i]);
               setSelectedStrokeIndexes(newSelection);
           }
           isDrawing.current = true;
           dragModeRef.current = 'move';
           activeImageIndexRef.current = i;
           dragStartRef.current = { x: coords.x, y: coords.y };
           beginSelectionDrag(newSelection);
           redrawAll();
           return;
         }
       }
       
       setSelectedStrokeIndexes(new Set());
       isDrawing.current = true;
       dragModeRef.current = 'select';
       dragStartRef.current = { x: coords.x, y: coords.y };
       selectionBoxRef.current = { x: coords.x, y: coords.y, w: 0, h: 0 };
       redrawAll();
       return;
    }

    isDrawing.current = true;
    
    if (activeTool === 'eraser' && (settings.eraserType === 'stroke' || settings.eraserHighlighterOnly)) {
      eraseGestureRef.current = [];
      let erasedAny = false;
      const activeEraserWidth = settings.eraserAutoSize ? settings.eraserWidth * (0.55 + coords.pressure * 0.9) : settings.eraserWidth;
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
        redrawAll(); // la persistance a lieu au relâchement du pointeur
      }
    } else if (activeTool === 'lasso') {
      if (selectedStrokeIndexes.size > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedStrokeIndexes.forEach(idx => {
          const s = strokesRef.current[idx];
          if (!s) return;
          s.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
        });
        
        if (coords.x >= minX - 6 && coords.x <= maxX + 6 && coords.y >= minY - 6 && coords.y <= maxY + 6) {
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
      redrawAll();
    } else {
      const startPoint = activeTool === 'shape' && settings.snapGrid
        ? { ...coords, x: Math.round(coords.x / 24) * 24, y: Math.round(coords.y / 24) * 24 }
        : coords;
      currentStrokeRef.current = {
        points: [startPoint],
        color: activeTool === 'highlighter' ? settings.highlighterColor : settings.color,
        width: activeTool === 'highlighter' ? settings.highlighterWidth : activeTool === 'eraser' ? settings.eraserWidth : settings.lineWidth,
        pointerType: e.pointerType,
        usesRealPressure: e.pointerType === 'pen',
        opacity: activeTool === 'highlighter' ? settings.highlighterOpacity : undefined,
        isEraser: activeTool === 'eraser',
        isHighlighter: activeTool === 'highlighter',
        shapeType: activeTool === 'shape' ? settings.shapeType : undefined,
        penType: activeTool === 'pen' ? settings.penType : undefined,
        lineStyle: activeTool === 'pen' ? settings.lineStyle : undefined,
        highlighterType: activeTool === 'highlighter' ? settings.highlighterType : undefined
      };
      if (activeTool === 'pen' || (activeTool === 'highlighter' && !settings.highlighterStraightLines)) {
        smootherRef.current = new StrokeSmoother(settings.penStabilization);
        smootherRef.current.seed(startPoint, e.timeStamp);
      }
      scheduleShapeRecognition(activeTool);
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
    // Une seule mesure de layout par paquet coalescé. Auparavant cette lecture
    // était répétée pour chaque échantillon d'un stylet 120/240 Hz.
    const canvasRect = canvas.getBoundingClientRect();

    const nativeE = e.nativeEvent as PointerEvent;
    const coalescedEvents: PointerEvent[] | undefined = nativeE.getCoalescedEvents?.();
    // Certains navigateurs exposent l'API mais renvoient ponctuellement une
    // liste vide. Le pointermove principal doit alors rester utilisable.
    const events = coalescedEvents?.length ? coalescedEvents : [nativeE];
    
    let recognitionTool: ToolType | null = null;
    if (currentStrokeRef.current) clearShapeRecognition();

    events.forEach((event: PointerEvent) => {
        const rawCoords = getCoordinates(event, canvasRect, settings);
        if (rawCoords) {
            const stylusEraser = isStylusEraser(event);
            const activeTool: ToolType = stylusEraser ? 'eraser' : settings.tool;
            let coords = rawCoords;
            if (smootherRef.current && (activeTool === 'pen' || activeTool === 'highlighter')) {
              coords = smootherRef.current.next(rawCoords, event.timeStamp);
            }

            if (activeTool === 'pointer' && activeImageIndexRef.current !== null && dragStartRef.current) {
                const idx = activeImageIndexRef.current;
                const stroke = strokesRef.current[idx];
                const dx = coords.x - dragStartRef.current.x;
                const dy = coords.y - dragStartRef.current.y;
                
                if (dragModeRef.current === 'move') {
                   moveSelectionBy(dx, dy);
                } else if (dragModeRef.current === 'resize') {
                   // Proportional resize
                   const p1 = stroke.points[0]; // top-left (usually)
                   const p2 = stroke.points[1]; // bottom-right (usually)
                   
                   const handle = activeResizeHandleRef.current;
                   const aspect = (p2.y - p1.y) / (p2.x - p1.x); // Should be maintained
                   
                   if (handle === 'br') {
                      const newW = (coords.x - p1.x);
                      stroke.points[1] = { x: p1.x + newW, y: p1.y + newW * aspect, pressure: 0.5 };
                   } else if (handle === 'tl') {
                      const newW = (p2.x - coords.x);
                      stroke.points[0] = { x: p2.x - newW, y: p2.y - newW * aspect, pressure: 0.5 };
                   } else if (handle === 'tr') {
                      const newW = (coords.x - p1.x);
                      stroke.points[0].y = p2.y - newW * aspect;
                      stroke.points[1].x = p1.x + newW;
                   } else if (handle === 'bl') {
                      const newW = (p2.x - coords.x);
                      stroke.points[0].x = p2.x - newW;
                      stroke.points[1].y = p1.y + newW * aspect;
                   }
                }
            } else if (activeTool === 'pointer') {
                if (dragModeRef.current === 'select' && selectionBoxRef.current && dragStartRef.current) {
                    selectionBoxRef.current.w = coords.x - dragStartRef.current.x;
                    selectionBoxRef.current.h = coords.y - dragStartRef.current.y;
                }
                return;
            } else if (activeTool === 'eraser') {
              if (settings.eraserType === 'stroke' || settings.eraserHighlighterOnly) {
                let erasedAny = false;
                const activeEraserWidth = settings.eraserAutoSize ? settings.eraserWidth * (0.55 + coords.pressure * 0.9) : settings.eraserWidth;
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
                }
              } else {
                // Pixel eraser via stylus button or tool
                const pixelEraserWidth = settings.eraserAutoSize
                  ? settings.eraserWidth * (0.55 + coords.pressure * 0.9)
                  : settings.eraserWidth;
                if (currentStrokeRef.current) {
                  currentStrokeRef.current.isEraser = true;
                  currentStrokeRef.current.width = pixelEraserWidth;
                  const points = currentStrokeRef.current.points;
                  const last = points[points.length - 1];
                  if (Math.hypot(coords.x - last.x, coords.y - last.y) >= Math.max(0.8, pixelEraserWidth * 0.04)) {
                    points.push(coords);
                  }
                } else {
                  currentStrokeRef.current = {
                    points: [coords],
                    color: '',
                    width: pixelEraserWidth,
                    isEraser: true
                  };
                }
              }
            } else if (activeTool === 'lasso') {
              if (isDraggingSelectionRef.current && dragStartRef.current) {
                moveSelectionBy(coords.x - dragStartRef.current.x, coords.y - dragStartRef.current.y);
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
                const dx = Math.abs(coords.x - start.x);
                const dy = Math.abs(coords.y - start.y);
                if (dx >= dy) {
                  currentStrokeRef.current.points = [start, { x: coords.x, y: start.y, pressure: coords.pressure }];
                } else {
                  currentStrokeRef.current.points = [start, { x: start.x, y: coords.y, pressure: coords.pressure }];
                }
              } else {
                // Le StrokeSmoother (OneEuroFilter) gère déjà la stabilisation ;
                // un lissage supplémentaire ici rendrait les traits trop mous.
                const pts = currentStrokeRef.current.points;
                const last = pts[pts.length - 1];
                const dist = Math.hypot(coords.x - last.x, coords.y - last.y);
                const minDistance = activeTool === 'highlighter'
                  ? Math.max(0.7, Math.min(2, currentStrokeRef.current.width * 0.07))
                  : Math.max(0.4, Math.min(1.25, currentStrokeRef.current.width * 0.12));
                const pressureChanged = currentStrokeRef.current.usesRealPressure
                  && Math.abs(coords.pressure - last.pressure) >= 0.025;
                if (dist >= minDistance || pressureChanged) {
                  pts.push(coords);
                }
              }
              recognitionTool = activeTool;
            }
        }
    });

    // Un seul timer de reconnaissance par paquet, pas un par point coalescé.
    if (recognitionTool) scheduleShapeRecognition(recognitionTool);

    // Rendu seul pendant le geste. La persistance (clone de la fiche +
    // écriture localStorage) est reportée au relâchement du pointeur.
    scheduleRedraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cancelScheduledRedraw();
    releasePointer(e);
    const settings = getToolState();
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = null;
    smootherRef.current = null;
    if (!isDrawing.current && !currentStrokeRef.current) return;
    isDrawing.current = false;

    if (settings.tool === 'pointer') {
       if (dragModeRef.current === 'select' && selectionBoxRef.current) {
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
       activeImageIndexRef.current = null;
       dragModeRef.current = null;
       dragStartRef.current = null;
       activeResizeHandleRef.current = null;
       selectionBoxRef.current = null;
       redrawAll(); commitStrokes();
       return;
    }

    if (settings.tool === 'lasso') {
      if (isDraggingSelectionRef.current) {
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
        const newSelection = new Set<number>();
        const lassoPoly = simplifyPoints(lassoPathRef.current, 1.25);
        const lassoBounds = getPointsBounds(lassoPoly);
        
        strokesRef.current.forEach((stroke, idx) => {
          const strokeBounds = getStrokeBounds(stroke);
          if (!lassoBounds || !strokeBounds || !boundsIntersect(lassoBounds, strokeBounds)) return;
          let isSelected = false;
          if (settings.includePartialSelection) {
            isSelected = stroke.points.some(p => pointInPolygon(p, lassoPoly));
            if (!isSelected) {
              for (let i = 0; i < lassoPoly.length; i += 4) {
                if (strokeIntersectsPoint(stroke, lassoPoly[i].x, lassoPoly[i].y, 10)) {
                  isSelected = true;
                  break;
                }
              }
            }
          } else {
            isSelected = stroke.points.every(p => pointInPolygon(p, lassoPoly));
          }
          
          if (isSelected) {
            newSelection.add(idx);
          }
        });
        setSelectedStrokeIndexes(newSelection);
        lassoPathRef.current = [];
      } else {
        lassoPathRef.current = [];
      }
    } else if (currentStrokeRef.current) {
      const stylusEraser = isStylusEraser(e);
      const activeTool: ToolType = stylusEraser ? 'eraser' : settings.tool;
      if (recognizedStrokeRef.current && (activeTool === 'pen' || activeTool === 'highlighter')) {
        currentStrokeRef.current = recognizedStrokeRef.current;
      }
      if (settings.straightenLines && activeTool === 'pen' && currentStrokeRef.current.points.length > 4) {
        const pts = currentStrokeRef.current.points;
        const p1 = pts[0];
        const p2 = pts[pts.length - 1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let maxDeviation = 0;
        for(let i = 1; i < pts.length - 1; i++) {
           const p = pts[i];
           const num = Math.abs((p2.y - p1.y)*p.x - (p2.x - p1.x)*p.y + p2.x*p1.y - p2.y*p1.x);
           const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
           const d = den === 0 ? 0 : num / den;
           if (d > maxDeviation) maxDeviation = d;
        }
        if (dist > 25 && (maxDeviation < dist * 0.15 || maxDeviation < 18)) {
           currentStrokeRef.current.shapeType = 'line';
           currentStrokeRef.current.points = [p1, p2];
         }
      }
      currentStrokeRef.current.points = optimizeStrokePoints(currentStrokeRef.current);
      const committedStroke = currentStrokeRef.current;
      strokesRef.current.push(committedStroke);
      recordAdd(committedStroke);
      currentStrokeRef.current = null;
      recognizedStrokeRef.current = null;
    }

    recordEraseGesture();

    redrawAll(); commitStrokes();
  };

  const clear = () => {
    strokesRef.current = [];
    clearHistory();
    clearSelection();
    redrawAll(); commitStrokes();
  };

  /**
   * Raccourcis clavier limités au canvas actif.
   *
   * Chaque question de la fiche instancie son propre canvas : sur une fiche de
   * deux exercices il y en a déjà dix, chacun écoutant `keydown` sur window et
   * annulant sans condition. Un simple Ctrl+Z supprimait donc un trait dans
   * TOUS les canvas à la fois. On ne réagit désormais que si l'utilisateur a
   * touché ce canvas en dernier, et jamais pendant une saisie de texte.
   */
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
  }, [selectedStrokeIndexes, tool, instanceId]);

  useEffect(() => () => {
    clearActiveCanvas(instanceId);
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
  }, [instanceId]);

  /**
   * Passerelle vers la barre d'outils unique de la fiche.
   *
   * La ref est réassignée à chaque rendu pour que le registre appelle toujours
   * les fermetures courantes, sans réinscription ; l'inscription elle-même n'a
   * lieu qu'au montage.
   */
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
      canUndo: strokeCount > 0,
      canRedo: redoStack.length > 0,
      hasSelection: selectedStrokeIndexes.size > 0,
      styleName,
      colorName,
      canChangeBackground: !!(onStyleChange || onColorChange),
    },
  };

  useEffect(() => registerCanvas(instanceId, () => handleRef.current!), [instanceId]);

  // Sans notification, la barre garderait « Annuler » grisé après le premier trait.
  useEffect(() => { notifyCanvasChanged(instanceId); });

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none group/canvas z-10">
      {/*
        Bouton de rappel de cours / aide : badge d'aide parfaitement fusionné sur la bordure supérieure du cadre.
      */}
      {correctionToggle?.available && (
        <div 
          className="absolute right-6 z-30 flex items-end pointer-events-auto no-print"
          style={{ 
            top: isResizing || isCanvasActive ? '-26px' : '-25px', // height of the tab (24px) + border (1px or 2px)
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

      {/* Import d'image : déclenché depuis la barre flottante, mais la cible reste cette zone. */}
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
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          selectedStrokeIndexes.forEach(idx => {
            const s = strokesRef.current[idx];
            if (!s) return;
            s.points.forEach(p => {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            });
          });
          if (minX === Infinity) return null;
          const topPos = Math.max(8, minY - 44);
          const leftPos = Math.max(8, (minX + maxX) / 2 - 120);

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
