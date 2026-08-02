import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stroke, DrawingCanvasProps, ShapeType, Point, ToolType, PenType, HighlighterType, EraserType } from './types';
import { Toolbar } from './Toolbar';
import { drawStroke } from './renderUtils';
import { pointInPolygon, strokeIntersectsPoint, isPointInImage, isPointOnImageResizeHandle } from './utils';

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  height, 
  onAddImage,
  styleName,
  colorName,
  onStyleChange,
  onColorChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<ToolType>('pointer');
  const [openMenu, setOpenMenu] = useState<'pen' | 'highlighter' | 'eraser' | 'shape' | 'more' | null>(null);
  
  const [penType, setPenType] = useState<PenType>('fountain');
  const [highlighterType, setHighlighterType] = useState<HighlighterType>('straight');
  const [eraserType, setEraserType] = useState<EraserType>('stroke');
  const [shapeType, setShapeType] = useState<ShapeType>('line');
  
  const [color, setColor] = useState<string>('#0f172a');
  const [highlighterColor, setHighlighterColor] = useState<string>('#fde047');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [highlighterWidth, setHighlighterWidth] = useState<number>(18);
  const [eraserWidth, setEraserWidth] = useState<number>(30);
  
  const [palmRejection, setPalmRejection] = useState(true);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const lassoPathRef = useRef<Point[]>([]);
  const [selectedStrokeIndexes, setSelectedStrokeIndexes] = useState<Set<number>>(new Set());
  
  const isDraggingSelectionRef = useRef(false);
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  const selectionBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const originalSelectedStrokesRef = useRef<Stroke[]>([]);

  // Image manipulation state
  const dragModeRef = useRef<'move' | 'resize' | null>(null);
  const activeImageIndexRef = useRef<number | null>(null);
  const activeResizeHandleRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    strokesRef.current.forEach((stroke, idx) => {
      drawStroke(ctx, stroke, selectedStrokeIndexes.has(idx));
    });

    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
    
    if (tool === 'pointer' && selectionBoxRef.current) {
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
  }, [selectedStrokeIndexes, tool]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const targetWidth = Math.round(rect.width);
      const targetHeight = Math.round(rect.height);

      if (targetWidth === 0 || targetHeight === 0) return;

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        dimensionsRef.current = { width: targetWidth, height: targetHeight };
        redrawAll();
      }
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [redrawAll, height]);

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
        setTool('pointer');
        redrawAll();
      };
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCoordinates = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: (e as any).pressure || 0.5
    };
  };

  const isStylusEraser = (e: React.PointerEvent | PointerEvent) => {
    if (!e) return false;
    if (e.pointerType === 'eraser') return true;
    if (e.pointerType === 'pen') {
      const ne = (e as any).nativeEvent || e;
      const buttons = e.buttons ?? ne.buttons ?? 0;
      const button = e.button ?? ne.button ?? -1;
      return (
        (buttons & 2) !== 0 ||
        (buttons & 4) !== 0 ||
        (buttons & 32) !== 0 ||
        button === 2 ||
        button === 5 ||
        Boolean((ne as any).barrelButton) ||
        Boolean((e as any).barrelButton) ||
        Boolean((ne as any).eraser) ||
        Boolean((e as any).eraser)
      );
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (palmRejection && e.pointerType === 'touch') return;
    setOpenMenu(null);

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const stylusEraser = isStylusEraser(e);
    const activeTool = stylusEraser ? 'eraser' : tool;
    
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
           originalSelectedStrokesRef.current = Array.from(newSelection).map(idx => {
             const s = strokesRef.current[idx];
             return {
               ...s,
               points: s.points.map(p => ({...p}))
             };
           });
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
    
    if (activeTool === 'eraser' && eraserType === 'stroke') {
      let erasedAny = false;
      strokesRef.current = strokesRef.current.filter(s => {
        if (strokeIntersectsPoint(s, coords.x, coords.y, eraserWidth / 2)) {
          erasedAny = true;
          return false;
        }
        return true;
      });
      if (erasedAny) {
        setSelectedStrokeIndexes(new Set());
        redrawAll();
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
          originalSelectedStrokesRef.current = Array.from(selectedStrokeIndexes).map(idx => {
            const s = strokesRef.current[idx];
            return {
              ...s,
              points: s.points.map(p => ({...p}))
            };
          });
          return;
        }
      }
      
      setSelectedStrokeIndexes(new Set());
      lassoPathRef.current = [coords];
      redrawAll();
    } else {
      currentStrokeRef.current = {
        points: [coords],
        color: activeTool === 'highlighter' ? highlighterColor : color,
        width: activeTool === 'highlighter' ? highlighterWidth : activeTool === 'eraser' ? eraserWidth : lineWidth,
        isEraser: activeTool === 'eraser',
        isHighlighter: activeTool === 'highlighter',
        shapeType: activeTool === 'shape' ? shapeType : undefined,
        penType: activeTool === 'pen' ? penType : undefined,
        highlighterType: activeTool === 'highlighter' ? highlighterType : undefined
      };
      redrawAll();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    if (palmRejection && e.pointerType === 'touch') return;
    
    const nativeE = e.nativeEvent as any;
    const events = nativeE.getCoalescedEvents ? nativeE.getCoalescedEvents() : [nativeE];
    
    events.forEach((event: PointerEvent) => {
        const coords = getCoordinates(event);
        if (coords) {
            const stylusEraser = isStylusEraser(event);
            const activeTool = stylusEraser ? 'eraser' : tool;

            if (activeTool === 'pointer' && activeImageIndexRef.current !== null && dragStartRef.current) {
                const idx = activeImageIndexRef.current;
                const stroke = strokesRef.current[idx];
                const dx = coords.x - dragStartRef.current.x;
                const dy = coords.y - dragStartRef.current.y;
                
                if (dragModeRef.current === 'move') {
                   selectedStrokeIndexes.forEach((selectedIndex, i) => {
                       const s = strokesRef.current[selectedIndex];
                       const originalStroke = originalSelectedStrokesRef.current[i];
                       if (s && originalStroke) {
                           for (let j = 0; j < s.points.length; j++) {
                               s.points[j].x = originalStroke.points[j].x + (coords.x - dragStartRef.current!.x);
                               s.points[j].y = originalStroke.points[j].y + (coords.y - dragStartRef.current!.y);
                           }
                       }
                   });
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
              if (eraserType === 'stroke') {
                let erasedAny = false;
                strokesRef.current = strokesRef.current.filter(s => {
                  if (strokeIntersectsPoint(s, coords.x, coords.y, eraserWidth / 2)) {
                    erasedAny = true;
                    return false;
                  }
                  return true;
                });
                if (erasedAny) {
                  setSelectedStrokeIndexes(new Set());
                  redrawAll();
                }
              } else {
                // Pixel eraser via stylus button or tool
                if (currentStrokeRef.current) {
                  currentStrokeRef.current.isEraser = true;
                  currentStrokeRef.current.width = eraserWidth;
                  currentStrokeRef.current.points.push(coords);
                } else {
                  currentStrokeRef.current = {
                    points: [coords],
                    color: '',
                    width: eraserWidth,
                    isEraser: true
                  };
                }
                redrawAll();
              }
            } else if (activeTool === 'lasso') {
              if (isDraggingSelectionRef.current && dragStartRef.current) {
                const dx = coords.x - dragStartRef.current.x;
                const dy = coords.y - dragStartRef.current.y;
                
                selectedStrokeIndexes.forEach((idx, i) => {
                  const stroke = strokesRef.current[idx];
                  const originalStroke = originalSelectedStrokesRef.current[i];
                  if (stroke && originalStroke) {
                    for (let j = 0; j < stroke.points.length; j++) {
                      stroke.points[j].x = originalStroke.points[j].x + dx;
                      stroke.points[j].y = originalStroke.points[j].y + dy;
                    }
                  }
                });
              } else {
                lassoPathRef.current.push(coords);
              }
            } else if (currentStrokeRef.current) {
              if (activeTool === 'shape') {
                currentStrokeRef.current.points = [currentStrokeRef.current.points[0], coords];
              } else {
                // Add point with smoothing for stylus/touch writing quality
                const pts = currentStrokeRef.current.points;
                const last = pts[pts.length - 1];
                const dist = Math.hypot(coords.x - last.x, coords.y - last.y);
                if (dist > 0.3) {
                  const smoothed = {
                    x: last.x * 0.15 + coords.x * 0.85,
                    y: last.y * 0.15 + coords.y * 0.85,
                    pressure: coords.pressure
                  };
                  pts.push(smoothed);
                }
              }
            }
        }
    });
    
    redrawAll();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDrawing.current = false;
    
    if (tool === 'pointer') {
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
       redrawAll();
       return;
    }

    if (tool === 'lasso') {
      if (isDraggingSelectionRef.current) {
        isDraggingSelectionRef.current = false;
        dragStartRef.current = null;
      } else if (lassoPathRef.current.length > 2) {
        const newSelection = new Set<number>();
        const lassoPoly = lassoPathRef.current;
        
        strokesRef.current.forEach((stroke, idx) => {
          let isSelected = stroke.points.some(p => pointInPolygon(p, lassoPoly));
          
          if (!isSelected) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            stroke.points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
            const corners = [
                {x: minX, y: minY}, {x: maxX, y: minY},
                {x: minX, y: maxY}, {x: maxX, y: maxY},
                {x: (minX + maxX)/2, y: (minY + maxY)/2}
            ];
            isSelected = corners.some(p => pointInPolygon(p, lassoPoly));
          }
          
          if (!isSelected) {
             for (let i = 0; i < lassoPoly.length; i += 4) {
                 if (strokeIntersectsPoint(stroke, lassoPoly[i].x, lassoPoly[i].y, 10)) {
                     isSelected = true;
                     break;
                 }
             }
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
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      setRedoStack([]); 
    }
    
    redrawAll();
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    const lastStroke = strokesRef.current.pop();
    if (lastStroke) {
      setRedoStack(prev => [...prev, lastStroke]);
    }
    setSelectedStrokeIndexes(new Set());
    redrawAll();
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const newRedoStack = [...redoStack];
    const strokeToRestore = newRedoStack.pop();
    if (strokeToRestore) {
      strokesRef.current.push(strokeToRestore);
      setRedoStack(newRedoStack);
    }
    redrawAll();
  };

  const clear = () => {
    strokesRef.current = [];
    setRedoStack([]);
    setSelectedStrokeIndexes(new Set());
    redrawAll();
  };
  
  const deleteSelection = () => {
    if (selectedStrokeIndexes.size === 0) return;
    strokesRef.current = strokesRef.current.filter((_, idx) => !selectedStrokeIndexes.has(idx));
    setSelectedStrokeIndexes(new Set());
    redrawAll();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStrokeIndexes.size > 0) {
        deleteSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStrokeIndexes, tool]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [floatingState, setFloatingState] = useState<{ isFloating: boolean; left: number; width: number }>({
    isFloating: false,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const handleScrollAndResize = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const headerOffset = 52;
      const minCanvasVisible = 120;

      const topPassedHeader = rect.top < headerOffset;
      const bottomStillVisible = rect.bottom > (headerOffset + minCanvasVisible);

      if (topPassedHeader && bottomStillVisible) {
        setFloatingState({
          isFloating: true,
          left: rect.left,
          width: rect.width,
        });
      } else {
        setFloatingState(prev => prev.isFloating ? { isFloating: false, left: 0, width: 0 } : prev);
      }
    };

    window.addEventListener('scroll', handleScrollAndResize, { passive: true });
    window.addEventListener('resize', handleScrollAndResize, { passive: true });
    handleScrollAndResize();

    return () => {
      window.removeEventListener('scroll', handleScrollAndResize);
      window.removeEventListener('resize', handleScrollAndResize);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0 z-10 flex flex-col pointer-events-none group/canvas">
      {floatingState.isFloating && <div className="w-full h-[40px] shrink-0 pointer-events-none" />}
      <Toolbar 
        tool={tool} setTool={setTool} openMenu={openMenu} setOpenMenu={setOpenMenu}
        penType={penType} setPenType={setPenType}
        highlighterType={highlighterType} setHighlighterType={setHighlighterType}
        eraserType={eraserType} setEraserType={setEraserType}
        shapeType={shapeType} setShapeType={setShapeType}
        color={color} setColor={setColor}
        highlighterColor={highlighterColor} setHighlighterColor={setHighlighterColor}
        lineWidth={lineWidth} setLineWidth={setLineWidth}
        highlighterWidth={highlighterWidth} setHighlighterWidth={setHighlighterWidth}
        eraserWidth={eraserWidth} setEraserWidth={setEraserWidth}
        palmRejection={palmRejection} setPalmRejection={setPalmRejection}
        onUndo={undo} onRedo={redo} onClear={clear} onDeleteSelection={deleteSelection}
        canUndo={strokesRef.current.length > 0} canRedo={redoStack.length > 0} hasSelection={selectedStrokeIndexes.size > 0}
        onAddImage={onAddImage} fileInputRef={fileInputRef} handleImageUpload={handleImageUpload}
        styleName={styleName} colorName={colorName}
        onStyleChange={onStyleChange} onColorChange={onColorChange}
        isFloating={floatingState.isFloating}
        floatingLeft={floatingState.left}
        floatingWidth={floatingState.width}
      />
      <div 
        ref={containerRef}
        className="flex-1 w-full relative pointer-events-auto"
        style={{ touchAction: palmRejection ? 'none' : 'auto' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerOut={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute top-0 left-0 w-full h-full ${
            tool === 'pointer' ? 'cursor-default' : 
            tool === 'eraser' ? 'cursor-cell' : 
            tool === 'lasso' ? 'cursor-crosshair' : 
            'cursor-crosshair'
          }`}
          style={{ touchAction: palmRejection ? 'none' : 'auto' }}
        />
      </div>
    </div>
  );
};
