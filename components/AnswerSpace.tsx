import React, { useRef, useCallback, useId, useState, useEffect } from 'react';
import type { PedagogicalGuidance } from '../types';
import { DrawingCanvas } from './canvas/DrawingCanvas';
import type { Stroke } from './canvas/types';
import SolutionViewer from './SolutionViewer';
import { AnswerSpacePaper, resolveAnswerSpaceTheme } from './AnswerSpacePaper';
import { useQuestionProgress } from './QuestionBeamerScope';
import { setActiveCanvas, useCanvasIsActive } from './canvas/canvasRegistry';
import { MAX_ANSWER_HEIGHT as MAX_HEIGHT, resolveAnswerSpaceHeight, resolveAnswerSpaceMinimum } from '../domain/answerSpaceHeight';

const GRID_SIZE_PX = 5 * 3.7795275591;
const EMPTY_STROKES: Stroke[] = [];

interface AnswerSpaceProps {
  height?: number;
  minHeight?: number;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  onHeightChange: (newHeight: number) => void;
  onStyleChange?: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  onColorChange?: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
  strokes?: Stroke[];
  onStrokesChange?: (strokes: Stroke[]) => void;
  solution?: string;
  answer?: string;
  guidance?: PedagogicalGuidance;
  isEditMode?: boolean;
  onSolutionUpdate?: (newSol: string) => void;
  revealSolution?: boolean;
  showSolutions?: boolean;
}

const AnswerSpace: React.FC<AnswerSpaceProps> = ({
  height: requestedHeight,
  minHeight,
  styleName = 'slate',
  colorName,
  onHeightChange,
  onStyleChange,
  onColorChange,
  strokes = EMPTY_STROKES,
  onStrokesChange,
  solution,
  answer,
  guidance,
  isEditMode,
  onSolutionUpdate,
  revealSolution = false,
  showSolutions = false,
}) => {
  const minimumHeight = resolveAnswerSpaceMinimum(minHeight);
  const height = resolveAnswerSpaceHeight(requestedHeight, minimumHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasInstanceId = useId();
  const isCanvasActive = useCanvasIsActive(canvasInstanceId);
  const heightLabelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const resizePreviewRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const pendingHeight = useRef(height);
  const rafId = useRef<number>(0);
  const previousBodyStyles = useRef({ cursor: '', userSelect: '' });
  const questionProgress = useQuestionProgress();
  const [isResizeActive, setIsResizeActive] = useState(false);

  const guidanceContent = [guidance?.instruction, guidance?.recall, ...(guidance?.hints || []), guidance?.answer].filter(Boolean).join(' ');
  const hasSolutionContent = !!(solution || answer || guidanceContent);
  const solutionContent = solution || answer || guidanceContent;
  const estimatedSolutionLines = Math.max(1, Math.ceil(solutionContent.length / 72));
  const solutionMinHeight = Math.min(560, Math.max(190, 104 + estimatedSolutionLines * 30));
  // La fiche définit l'état initial, puis le bouton reste propre à cette zone.
  const [isSolutionVisible, setIsSolutionVisible] = useState(showSolutions);

  useEffect(() => setIsSolutionVisible(showSolutions), [showSolutions]);

  useEffect(() => {
    if (revealSolution && hasSolutionContent) setIsSolutionVisible(true);
  }, [hasSolutionContent, revealSolution]);

  useEffect(() => {
    if (isSolutionVisible && hasSolutionContent && height < solutionMinHeight) {
      onHeightChange(solutionMinHeight);
    }
  }, [height, hasSolutionContent, isSolutionVisible, onHeightChange, solutionMinHeight]);

  const theme = resolveAnswerSpaceTheme(styleName, colorName);
  const isDarkCanvas = ['black', 'green', 'blue'].includes(colorName || (styleName === 'slate' ? 'black' : ''));

  const clampHeight = useCallback((value: number) => resolveAnswerSpaceHeight(value, minimumHeight), [minimumHeight]);

  // Le glissement reste continu au pixel près. L'ancien pas de 5 mm donnait
  // l'impression d'un pointeur lent car la poignée avançait par bonds de 19 px.
  const calculateHeight = useCallback((clientY: number): number => {
    const delta = clientY - startY.current;
    const rawHeight = startHeight.current + delta;
    return clampHeight(Math.round(rawHeight));
  }, [clampHeight]);

  /**
   * Déplace uniquement un cadre fantôme et la poignée pendant le glissement.
   *
   * Modifier la hauteur réelle de la zone à chaque frame forçait encore le
   * navigateur à remettre en page toute la fiche et à notifier les canvas.
   * L'aperçu absolu n'influence pas le document : la hauteur réelle n'est
   * appliquée qu'une fois, au relâchement.
   */
  const updateResizePreview = useCallback((next: number) => {
    pendingHeight.current = next;
    const offset = next - startHeight.current;
    if (resizePreviewRef.current) {
      resizePreviewRef.current.style.height = `${next}px`;
      resizePreviewRef.current.style.opacity = '1';
    }
    if (heightLabelRef.current) heightLabelRef.current.textContent = `${next}px`;
    if (resizeHandleRef.current) {
      resizeHandleRef.current.style.transform = `translate(-50%, ${offset + 5}px)`;
      resizeHandleRef.current.setAttribute('aria-valuenow', String(next));
      resizeHandleRef.current.setAttribute('aria-valuetext', `${next} pixels`);
    }
  }, []);

  const handleMove = useCallback((clientY: number) => {
    if (!isResizing.current) return;
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => updateResizePreview(calculateHeight(clientY)));
  }, [calculateHeight, updateResizePreview]);

  const beginResize = useCallback((clientY: number) => {
    if (!containerRef.current) return false;
    isResizing.current = true;
    startY.current = clientY;
    startHeight.current = containerRef.current.offsetHeight;
    pendingHeight.current = startHeight.current;
    if (resizePreviewRef.current) {
      resizePreviewRef.current.style.height = `${startHeight.current}px`;
      resizePreviewRef.current.style.opacity = '1';
    }
    previousBodyStyles.current = {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    setIsResizeActive(true);
    return true;
  }, [height]);

  // Remonte la hauteur finale une seule fois, puis nettoie l'état de glissement.
  const endResize = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    cancelAnimationFrame(rafId.current);
    const finalHeight = pendingHeight.current;
    if (containerRef.current) containerRef.current.style.height = `${finalHeight}px`;
    if (resizePreviewRef.current) {
      resizePreviewRef.current.style.height = `${finalHeight}px`;
      resizePreviewRef.current.style.opacity = '0';
    }
    resizeHandleRef.current?.style.removeProperty('transform');
    document.body.style.cursor = previousBodyStyles.current.cursor;
    document.body.style.userSelect = previousBodyStyles.current.userSelect;
    setIsResizeActive(false);
    if (finalHeight !== height) {
      onHeightChange(finalHeight);
    }
  }, [height, onHeightChange]);

  // Un seul flux Pointer Events couvre souris, doigt et stylet. La capture
  // maintient le redimensionnement actif même si le pointeur quitte la poignée.
  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (!beginResize(e.clientY)) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* non disponible */ }
  }, [beginResize]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || !isResizing.current) return;
    e.preventDefault();
    handleMove(e.clientY);
  }, [handleMove]);

  const handleResizePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    if (isResizing.current) updateResizePreview(calculateHeight(e.clientY));
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch { /* capture déjà libérée */ }
    endResize();
  }, [calculateHeight, endResize, updateResizePreview]);

  // Certains navigateurs Android peuvent perdre la capture lors d'un geste
  // interrompu par le système. Le relâchement global garantit la sortie de
  // l'état actif et conserve la dernière hauteur atteinte.
  useEffect(() => {
    if (!isResizeActive) return;
    const finishFromWindow = (event: PointerEvent) => {
      if (isResizing.current) updateResizePreview(calculateHeight(event.clientY));
      endResize();
    };
    const finishOnBlur = () => endResize();
    window.addEventListener('pointerup', finishFromWindow, true);
    window.addEventListener('pointercancel', finishFromWindow, true);
    window.addEventListener('blur', finishOnBlur);
    return () => {
      window.removeEventListener('pointerup', finishFromWindow, true);
      window.removeEventListener('pointercancel', finishFromWindow, true);
      window.removeEventListener('blur', finishOnBlur);
    };
  }, [calculateHeight, endResize, isResizeActive, updateResizePreview]);

  // La poignée porte role="slider" et tabIndex : elle doit donc être pilotable
  // au clavier, ce qui n'était pas le cas.
  const handleHandleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? GRID_SIZE_PX * 4 : GRID_SIZE_PX;
    let next: number | null = null;

    if (e.key === 'ArrowDown') next = height + step;
    else if (e.key === 'ArrowUp') next = height - step;
    else if (e.key === 'PageDown') next = height + GRID_SIZE_PX * 8;
    else if (e.key === 'PageUp') next = height - GRID_SIZE_PX * 8;
    else if (e.key === 'Home') next = minimumHeight;
    else if (e.key === 'End') next = MAX_HEIGHT;

    if (next === null) return;
    e.preventDefault();
    const normalized = clampHeight(Math.round(next));
    if (normalized !== height) onHeightChange(normalized);
  }, [height, onHeightChange, minimumHeight, clampHeight]);

  useEffect(() => {
    pendingHeight.current = height;
    if (!isResizing.current && resizePreviewRef.current) {
      resizePreviewRef.current.style.height = `${height}px`;
      resizePreviewRef.current.style.opacity = '0';
    }
    if (heightLabelRef.current) heightLabelRef.current.textContent = `${height}px`;
    if (resizeHandleRef.current) {
      resizeHandleRef.current.setAttribute('aria-valuenow', String(height));
      resizeHandleRef.current.setAttribute('aria-valuetext', `${height} pixels`);
    }
  }, [height]);

  // Filet de sécurité : si le composant disparaît en plein glissement, on retire
  // les styles globaux posés sur <body>.
  useEffect(() => () => {
    cancelAnimationFrame(rafId.current);
    if (isResizing.current) {
      document.body.style.cursor = previousBodyStyles.current.cursor;
      document.body.style.userSelect = previousBodyStyles.current.userSelect;
    }
  }, []);

  // Ne monte le <canvas> (contexte 2D, Toolbar, listeners) que lorsque la zone approche du viewport,
  // pour éviter de payer le coût de rendu de dizaines de canvases hors écran dès l'ouverture d'une fiche.
  const [isNearViewport, setIsNearViewport] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '1200px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filet de sécurité pour l'impression : force le montage même hors-écran, sinon les zones
  // jamais scrollées apparaîtraient vides sur le papier.
  useEffect(() => {
    const handleBeforePrint = () => setIsNearViewport(true);
    window.addEventListener('worksheet-mount-print', handleBeforePrint);
    return () => {
      window.removeEventListener('worksheet-mount-print', handleBeforePrint);
    };
  }, []);

  return (
    <div
      className="mt-3 mb-8 answer-space group relative"
      onPointerDownCapture={() => setActiveCanvas(canvasInstanceId)}
      data-active={isCanvasActive || undefined}
    >
      <div
        ref={containerRef}
        data-answer-space-surface=""
        className={`w-full relative rounded-md transition-shadow duration-200 print:rounded-none print:shadow-none print:border-none box-border ${
          isResizeActive
            ? 'shadow-sm'
            : isCanvasActive
              ? 'shadow-xs ring-2 ring-sky-500/40 border-sky-600'
              : 'hover:shadow-xs'
        }`}
        style={{
          height: `${height}px`,
          backgroundColor: theme.screen.bg,
          border: `1px solid ${isCanvasActive ? '#0284c7' : theme.screen.border}`,
          boxSizing: 'border-box',
        }}
      >
        <AnswerSpacePaper styleName={styleName} colorName={colorName} height={height} />

        <div
          ref={resizePreviewRef}
          data-resize-preview=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[35] rounded-md border-2 border-slate-500 bg-slate-500/[0.035] shadow-[0_5px_18px_rgba(15,23,42,0.14)] print:hidden"
          style={{
            height: `${height}px`,
            opacity: isResizeActive ? 1 : 0,
            contain: 'layout paint style',
            willChange: 'height',
          }}
        />

        {/*
          Poignée de redimensionnement.
          La cible tactile est volontairement plus grande que la pastille
          visible. Elle dépasse surtout sous le canvas afin de préserver la
          surface d'écriture, et l'espace inférieur du composant lui est réservé.
        */}
        <div
          ref={resizeHandleRef}
          className="absolute bottom-0 left-1/2 z-[40] flex h-8 w-40 -translate-x-1/2 translate-y-[5px] touch-none cursor-row-resize select-none items-center justify-center no-print outline-none group/handle"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerEnd}
          onPointerCancel={handleResizePointerEnd}
          onLostPointerCapture={endResize}
          onKeyDown={handleHandleKeyDown}
          role="slider"
          aria-label="Ajuster la hauteur de la zone de réponse"
          aria-orientation="vertical"
          aria-valuemin={minimumHeight}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          aria-valuetext={`${height} pixels`}
          tabIndex={0}
          title="Glisser pour ajuster la hauteur"
        >
          <span
            className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
              isResizeActive
                ? 'h-[3px] w-12 bg-[#64748b] shadow-[0_0_8px_rgba(100,116,139,0.5)]'
                : isCanvasActive
                  ? 'h-[2px] w-8 bg-[#94a3b8]'
                  : 'h-[2px] w-6 bg-[#cbd5e1] group-hover:w-10 group-hover:bg-[#94a3b8]'
            }`}
          >
            <span
              ref={heightLabelRef}
              className={`pointer-events-none absolute left-[calc(100%+12px)] whitespace-nowrap rounded-full bg-[#172126] px-2 py-1 font-mono text-[10px] font-semibold text-white shadow-lg transition-all ${
                isResizeActive ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
              }`}
              aria-hidden="true"
            >
              {height}px
            </span>
          </span>
        </div>

        {/*
          Corrigé placé dans le papier, sous les annotations. La barre d'outils
          n'occupe plus le haut de la zone : le corrigé récupère cette place, et
          seule une réserve à droite reste nécessaire pour le bouton « Aide ».
        */}
        {isSolutionVisible && (hasSolutionContent || isEditMode) && (
          <div className="absolute inset-0 z-[5] pl-3 sm:pl-4 pr-20 sm:pr-24 pb-3 pt-3 overflow-hidden bg-transparent border-none pointer-events-none select-none transition-all print:pr-4">
            <SolutionViewer
              solution={solution}
              answer={answer}
              guidance={guidance}
              isDarkCanvas={isDarkCanvas}
              isEditMode={isEditMode}
              onUpdate={onSolutionUpdate}
              progressStep={questionProgress?.step}
            />
          </div>
        )}

        {isNearViewport ? (
          <DrawingCanvas
            instanceId={canvasInstanceId}
            height={height}
            isResizing={isResizeActive}
            styleName={styleName}
            colorName={colorName}
            onStyleChange={onStyleChange}
            onColorChange={onColorChange}
            initialStrokes={strokes}
            onStrokesChange={onStrokesChange}
            isEditMode={isEditMode}
            correctionProgress={isSolutionVisible && questionProgress && questionProgress.maxStep > 1 ? questionProgress : undefined}
            correctionToggle={{
              available: hasSolutionContent || !!isEditMode,
              visible: isSolutionVisible,
              toggle: () => setIsSolutionVisible(value => !value),
            }}
          />
        ) : (
          <div className="absolute inset-0 no-print" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default AnswerSpace;
