import React, { useRef, useCallback, useId, useState, useEffect } from 'react';
import type { PedagogicalGuidance } from '../types';
import { DrawingCanvas } from './DrawingCanvas';
import SolutionViewer from './SolutionViewer';
import { useQuestionProgress } from './QuestionBeamerScope';
import { setActiveCanvas, useCanvasIsActive } from './canvas/canvasRegistry';

// Configuration
const MM_TO_PX = 3.7795275591;
const GRID_SIZE_MM = 5;
const GRID_SIZE_PX = GRID_SIZE_MM * MM_TO_PX;
const SEYES_LINE_MM = 2; // Seyes has horizontal lines every 2mm
const SEYES_LINE_PX = SEYES_LINE_MM * MM_TO_PX;
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 1600; 
const A4_HEIGHT_PX = 1123;
const PRINT_MARGIN_BOTTOM_PX = 50;

type ColorPalette = {
  bg: string;
  line: string;
  border: string;
  dot?: string;
  seyesMajor?: string;
  seyesMinor?: string;
  seyesVertical?: string;
};

// Define explicit color palettes
const COLOR_PALETTES: Record<'black' | 'green' | 'blue' | 'white' | 'cream', ColorPalette> = {
  black: {
    bg: '#0f172a',
    line: '#334155',
    border: '#1e293b',
    dot: '#475569',
    seyesMajor: '#475569',
    seyesMinor: '#334155',
    seyesVertical: '#ef4444'
  },
  green: {
    bg: '#14532d',
    line: '#166534',
    border: '#14532d',
    dot: '#22c55e',
    seyesMajor: '#22c55e',
    seyesMinor: '#166534',
    seyesVertical: '#ef4444'
  },
  blue: {
    bg: '#1e3a8a',
    line: '#1e40af',
    border: '#1e3a8a',
    dot: '#60a5fa',
    seyesMajor: '#60a5fa',
    seyesMinor: '#1e40af',
    seyesVertical: '#ef4444'
  },
  white: {
    bg: 'transparent',
    line: '#a4b4c4',
    border: '#a4b4c4',
    dot: '#a4b4c4',
    seyesMajor: '#a4b4c4',
    seyesMinor: '#cfc6b6',
    seyesVertical: '#d9c2c2'
  },
  cream: {
    bg: '#fef3c7',
    line: '#fde68a',
    border: '#fcd34d',
    dot: '#fbbf24',
    seyesMajor: '#fbbf24',
    seyesMinor: '#fde68a',
    seyesVertical: '#fca5a5'
  }
};

type StyleConfig = {
  bg: string;
  line: string;
  border: string;
  dot?: string;
  seyesMajor?: string;
  seyesMinor?: string;
  seyesVertical?: string;
};

type ThemeMap = Record<'seyes' | 'slate' | 'grid' | 'dotted' | 'blank', { screen: StyleConfig, print: StyleConfig }>;

const THEMES: ThemeMap = {
  slate: {
    screen: COLOR_PALETTES.black,
    print: COLOR_PALETTES.black,
  },
  seyes: {
    screen: COLOR_PALETTES.white,
    print: { ...COLOR_PALETTES.white, border: '#ffffff' },
  },
  grid: {
    screen: COLOR_PALETTES.white,
    print: { ...COLOR_PALETTES.white, border: '#ffffff' },
  },
  dotted: {
    screen: COLOR_PALETTES.white,
    print: { ...COLOR_PALETTES.white, border: '#ffffff' },
  },
  blank: {
    screen: COLOR_PALETTES.white,
    print: { ...COLOR_PALETTES.white, border: '#ffffff' },
  }
};

interface AnswerSpaceProps {
  height?: number;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  onHeightChange: (newHeight: number) => void;
  onStyleChange?: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  onColorChange?: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
  strokes?: any[];
  onStrokesChange?: (strokes: any[]) => void;
  solution?: string;
  answer?: string;
  guidance?: PedagogicalGuidance;
  isEditMode?: boolean;
  onSolutionUpdate?: (newSol: string) => void;
}

const AnswerSpace: React.FC<AnswerSpaceProps> = ({
  height = 120,
  styleName = 'slate',
  colorName,
  onHeightChange,
  onStyleChange,
  onColorChange,
  strokes = [],
  onStrokesChange,
  solution,
  answer,
  guidance,
  isEditMode,
  onSolutionUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasInstanceId = useId();
  const isCanvasActive = useCanvasIsActive(canvasInstanceId);
  const heightLabelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
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
  // L'aide appartient à cette zone uniquement : chaque canvas démarre fermé
  // et son bouton local ne modifie aucune autre question.
  const [isSolutionVisible, setIsSolutionVisible] = useState(false);

  useEffect(() => {
    if (isSolutionVisible && hasSolutionContent && height < solutionMinHeight) {
      onHeightChange(solutionMinHeight);
    }
  }, [height, hasSolutionContent, isSolutionVisible, onHeightChange, solutionMinHeight]);

  // Determine active theme colors
  const baseTheme = THEMES[styleName] || THEMES.slate;
  const customPalette = colorName ? COLOR_PALETTES[colorName] : undefined;
  
  const theme = customPalette ? {
    screen: customPalette,
    // Hide border on print unless it's a dark color and not a light theme by default
    print: { ...customPalette, border: (colorName === 'white' || colorName === 'cream') ? customPalette.bg : customPalette.border }
  } : baseTheme;

  const isDarkCanvas = ['black', 'green', 'blue'].includes(colorName || (styleName === 'slate' ? 'black' : ''));

  // ID unique pour les patterns SVG
  const uid = useId().replace(/:/g, '');
  const gridPatternId = `grid-${uid}`;

  const clampHeight = (value: number) => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, value));
  const snapHeight = (value: number) => Math.round(clampHeight(Math.round(value / GRID_SIZE_PX) * GRID_SIZE_PX));

  // Calcul de la nouvelle hauteur avec snapping (redimensionnement manuel)
  const calculateHeight = useCallback((clientY: number): number => {
    const delta = clientY - startY.current;
    const rawHeight = startHeight.current + delta;
    return snapHeight(rawHeight);
  }, []);

  /**
   * Applique la hauteur directement au DOM pendant le glissement.
   *
   * Auparavant chaque frame appelait `onHeightChange`, ce qui déclenchait une
   * mise à jour de la fiche complète, un re-rendu de tous les exercices, une
   * recomposition MathJax et une écriture localStorage — 60 fois par seconde.
   * La valeur n'est remontée qu'au relâchement.
   */
  const applyHeight = useCallback((next: number) => {
    pendingHeight.current = next;
    if (containerRef.current) containerRef.current.style.height = `${next}px`;
    if (heightLabelRef.current) heightLabelRef.current.textContent = `${next}px`;
    if (resizeHandleRef.current) {
      resizeHandleRef.current.setAttribute('aria-valuenow', String(next));
      resizeHandleRef.current.setAttribute('aria-valuetext', `${next} pixels`);
    }
  }, []);

  const handleMove = useCallback((clientY: number) => {
    if (!isResizing.current) return;
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => applyHeight(calculateHeight(clientY)));
  }, [applyHeight, calculateHeight]);

  const beginResize = useCallback((clientY: number) => {
    if (!containerRef.current) return false;
    isResizing.current = true;
    startY.current = clientY;
    startHeight.current = containerRef.current.offsetHeight;
    pendingHeight.current = height;
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
    document.body.style.cursor = previousBodyStyles.current.cursor;
    document.body.style.userSelect = previousBodyStyles.current.userSelect;
    setIsResizeActive(false);
    if (pendingHeight.current !== height) {
      onHeightChange(pendingHeight.current);
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
    if (isResizing.current) applyHeight(calculateHeight(e.clientY));
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch { /* capture déjà libérée */ }
    endResize();
  }, [applyHeight, calculateHeight, endResize]);

  // Certains navigateurs Android peuvent perdre la capture lors d'un geste
  // interrompu par le système. Le relâchement global garantit la sortie de
  // l'état actif et conserve la dernière hauteur atteinte.
  useEffect(() => {
    if (!isResizeActive) return;
    const finishFromWindow = (event: PointerEvent) => {
      if (isResizing.current) applyHeight(calculateHeight(event.clientY));
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
  }, [applyHeight, calculateHeight, endResize, isResizeActive]);

  // La poignée porte role="slider" et tabIndex : elle doit donc être pilotable
  // au clavier, ce qui n'était pas le cas.
  const handleHandleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? GRID_SIZE_PX * 4 : GRID_SIZE_PX;
    let next: number | null = null;

    if (e.key === 'ArrowDown') next = height + step;
    else if (e.key === 'ArrowUp') next = height - step;
    else if (e.key === 'PageDown') next = height + GRID_SIZE_PX * 8;
    else if (e.key === 'PageUp') next = height - GRID_SIZE_PX * 8;
    else if (e.key === 'Home') next = MIN_HEIGHT;
    else if (e.key === 'End') next = MAX_HEIGHT;

    if (next === null) return;
    e.preventDefault();
    const snapped = snapHeight(next);
    if (snapped !== height) onHeightChange(snapped);
  }, [height, onHeightChange]);

  useEffect(() => {
    pendingHeight.current = height;
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
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, []);

  return (
    <div
      className="mt-3 mb-8 answer-space group relative"
      onPointerDownCapture={() => setActiveCanvas(canvasInstanceId)}
      data-active={isCanvasActive || undefined}
    >
      <div
        ref={containerRef}
        className={`w-full relative rounded-md transition-all duration-200 print:rounded-none print:shadow-none print:border-none box-border ${
          isResizeActive
            ? 'shadow-md ring-2 ring-slate-400'
            : isCanvasActive
              ? 'shadow-xs ring-2 ring-sky-500/40 border-sky-600'
              : 'hover:shadow-xs'
        }`}
        style={{
          height: `${height}px`,
          backgroundColor: theme.screen.bg,
          border: isResizeActive ? '2px solid #64748b' : isCanvasActive ? '2px solid #0284c7' : `1px solid ${theme.screen.border}`,
          boxSizing: 'border-box',
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none print:hidden overflow-hidden"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={gridPatternId}
              width={styleName === 'seyes' ? SEYES_LINE_PX * 4 : GRID_SIZE_PX}
              height={styleName === 'seyes' ? SEYES_LINE_PX * 4 : GRID_SIZE_PX}
              patternUnits="userSpaceOnUse"
            >
              <rect width="100%" height="100%" fill={theme.screen.bg} />
              
              {styleName === 'slate' && (
                <line x1="0" y1={GRID_SIZE_PX} x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.screen.line} strokeWidth="1" />
              )}
              
              {styleName === 'grid' && (
                <>
                  <line x1="0" y1={GRID_SIZE_PX} x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.screen.line} strokeWidth="1" />
                  <line x1={GRID_SIZE_PX} y1="0" x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.screen.line} strokeWidth="1" />
                </>
              )}

              {styleName === 'dotted' && (
                <circle cx={GRID_SIZE_PX / 2} cy={GRID_SIZE_PX / 2} r="1" fill={theme.screen.dot} />
              )}

              {styleName === 'seyes' && (
                <>
                  {/* Ligne horizontale mineure (toutes les 2mm) */}
                  <line x1="0" y1={SEYES_LINE_PX} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 2} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 2} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 3} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 3} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  {/* Ligne horizontale majeure (toutes les 8mm) */}
                  <line x1="0" y1={SEYES_LINE_PX * 4} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.screen.seyesMajor} strokeWidth="1" />
                </>
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridPatternId})`} />
          {/* Marge verticale Séyes : une seule ligne rouge à ~2,5 cm du bord gauche */}
          {styleName === 'seyes' && (
            <line
              x1={Math.round(25 * MM_TO_PX)} y1="0"
              x2={Math.round(25 * MM_TO_PX)} y2="100%"
              stroke={theme.screen.seyesVertical}
              strokeWidth="1"
            />
          )}
        </svg>

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none hidden print:block"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          preserveAspectRatio="none"
          style={{ overflow: 'hidden', shapeRendering: 'geometricPrecision', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}
        >
          <rect width="100%" height="100%" fill={theme.print.bg} />
          
          <defs>
            <pattern
              id={`${gridPatternId}-print`}
              width={styleName === 'seyes' ? SEYES_LINE_PX * 4 : GRID_SIZE_PX}
              height={styleName === 'seyes' ? SEYES_LINE_PX * 4 : GRID_SIZE_PX}
              patternUnits="userSpaceOnUse"
            >
              {styleName === 'slate' && (
                <line x1="0" y1={GRID_SIZE_PX} x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.print.line} strokeWidth="1" />
              )}
              
              {styleName === 'grid' && (
                <>
                  <line x1="0" y1={GRID_SIZE_PX} x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.print.line} strokeWidth="1" />
                  <line x1={GRID_SIZE_PX} y1="0" x2={GRID_SIZE_PX} y2={GRID_SIZE_PX} stroke={theme.print.line} strokeWidth="1" />
                </>
              )}

              {styleName === 'dotted' && (
                <circle cx={GRID_SIZE_PX / 2} cy={GRID_SIZE_PX / 2} r="1" fill={theme.print.dot} />
              )}

              {styleName === 'seyes' && (
                <>
                  {/* Lignes horizontales mineures */}
                  <line x1="0" y1={SEYES_LINE_PX} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 2} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 2} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 3} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 3} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  {/* Ligne horizontale majeure */}
                  <line x1="0" y1={SEYES_LINE_PX * 4} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.print.seyesMajor} strokeWidth="1" />
                </>
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridPatternId}-print)`} />
          {/* Marge verticale Séyes impression : une seule ligne rouge à ~2,5 cm du bord gauche */}
          {styleName === 'seyes' && (
            <line
              x1={Math.round(25 * MM_TO_PX)} y1="0"
              x2={Math.round(25 * MM_TO_PX)} y2="100%"
              stroke={theme.print.seyesVertical}
              strokeWidth="1"
            />
          )}
        </svg>

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
          aria-valuemin={MIN_HEIGHT}
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
