import React, { useRef, useCallback, useId, useState, useEffect } from 'react';
import type { PedagogicalGuidance } from '../types';
import { DrawingCanvas } from './DrawingCanvas';
import SolutionViewer from './SolutionViewer';
import { useQuestionProgress } from './QuestionBeamerScope';

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
    bg: '#ffffff',
    line: '#e2e8f0',
    border: '#cbd5e1',
    dot: '#94a3b8',
    seyesMajor: '#94a3b8',
    seyesMinor: '#e2e8f0',
    seyesVertical: '#fca5a5'
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
  const heightLabelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const pendingHeight = useRef(height);
  const rafId = useRef<number>(0);
  const questionProgress = useQuestionProgress();

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

  // Calcul de la nouvelle hauteur avec snapping (redimensionnement manuel)
  const calculateHeight = useCallback((clientY: number): number => {
    const delta = clientY - startY.current;
    const rawHeight = startHeight.current + delta;
    return clampHeight(Math.round(rawHeight / GRID_SIZE_PX) * GRID_SIZE_PX);
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
    return true;
  }, [height]);

  // Remonte la hauteur finale une seule fois, puis nettoie l'état de glissement.
  const endResize = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    cancelAnimationFrame(rafId.current);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (pendingHeight.current !== height) {
      onHeightChange(pendingHeight.current);
    }
  }, [height, onHeightChange]);

  // Mouse events
  const handleMouseMove = useCallback((e: MouseEvent) => handleMove(e.clientY), [handleMove]);
  const handleMouseUp = useCallback(() => {
    endResize();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [endResize, handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!beginResize(e.clientY)) return;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [beginResize, handleMouseMove, handleMouseUp]);

  // Touch events
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    endResize();
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
  }, [endResize, handleTouchMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (!beginResize(e.touches[0].clientY)) return;

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }, [beginResize, handleTouchMove, handleTouchEnd]);

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
    const snapped = clampHeight(Math.round(next / GRID_SIZE_PX) * GRID_SIZE_PX);
    if (snapped !== height) onHeightChange(snapped);
  }, [height, onHeightChange]);

  // Filet de sécurité : si le composant disparaît en plein glissement, on retire
  // les styles globaux posés sur <body>.
  useEffect(() => () => {
    cancelAnimationFrame(rafId.current);
    if (isResizing.current) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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
    <div className="my-3 answer-space group relative">
      <div
        ref={containerRef}
        className="w-full relative rounded-none transition-shadow duration-200 hover:shadow-md print:rounded-none print:shadow-none box-border"
        style={{
          height: `${height}px`,
          backgroundColor: theme.screen.bg,
          border: `1px solid ${theme.screen.border}`,
          boxSizing: 'border-box',
          // overflow: 'hidden', // Permet au menu déroulant de dépasser
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none print:hidden"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ overflow: 'hidden' }}
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
                  <line x1={SEYES_LINE_PX * 4} y1="0" x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.screen.seyesVertical} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 2} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 2} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 3} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 3} stroke={theme.screen.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 4} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.screen.seyesMajor} strokeWidth="1" />
                </>
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridPatternId})`} />
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
                  <line x1={SEYES_LINE_PX * 4} y1="0" x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.print.seyesVertical} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 2} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 2} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 3} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 3} stroke={theme.print.seyesMinor} strokeWidth="1" />
                  <line x1="0" y1={SEYES_LINE_PX * 4} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 4} stroke={theme.print.seyesMajor} strokeWidth="1" />
                </>
              )}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridPatternId}-print)`} />
        </svg>

        {/*
          Poignée de redimensionnement.
          Elle occupait auparavant toute la largeur sur 20 px de haut, à
          l'intérieur du cadre : ces 20 px du bas de chaque zone de réponse
          étaient donc impossibles à écrire, la poignée captant le pointeur
          avant le canvas. Elle est désormais réduite à une pastille centrée,
          à cheval sur le bord inférieur.
        */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-28 h-4 cursor-row-resize z-[40] flex items-center justify-center opacity-40 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 no-print group/handle rounded-full bg-white/80 backdrop-blur-[2px] border border-slate-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onKeyDown={handleHandleKeyDown}
          role="slider"
          aria-label="Ajuster la hauteur de la zone de réponse"
          aria-orientation="vertical"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          aria-valuetext={`${height} pixels`}
          tabIndex={0}
        >
          <div className="w-10 h-[3px] bg-slate-300 rounded-full group-hover/handle:bg-slate-500 transition-colors duration-200" />
        </div>

        {/* Indicateur discret ; le bouton Corrigé vit désormais dans la barre du canvas. */}
        <div className="absolute top-1.5 right-1.5 z-20 no-print">
          <div className="px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded select-none opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {height}px
          </div>
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
