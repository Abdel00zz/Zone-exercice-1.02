import React, { useRef, useCallback, useId, useMemo } from 'react';
import type { ImageConfig } from '../types';
import { DrawingCanvas } from './DrawingCanvas';

interface AnswerSpaceProps {
  height?: number;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  onHeightChange: (newHeight: number) => void;
  image?: ImageConfig;
}

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
  onAddImage?: () => void;
  image?: ImageConfig;
}

const AnswerSpace: React.FC<AnswerSpaceProps> = ({ height = 120, styleName = 'slate', colorName, onHeightChange, onStyleChange, onColorChange, onAddImage, image }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const rafId = useRef<number>(0);

  // Determine active theme colors
  const baseTheme = THEMES[styleName] || THEMES.slate;
  const customPalette = colorName ? COLOR_PALETTES[colorName] : undefined;
  
  const theme = customPalette ? {
    screen: customPalette,
    // Hide border on print unless it's a dark color and not a light theme by default
    print: { ...customPalette, border: (colorName === 'white' || colorName === 'cream') ? customPalette.bg : customPalette.border }
  } : baseTheme;

  // ID unique pour les patterns SVG
  const uid = useId().replace(/:/g, '');
  const gridPatternId = `grid-${uid}`;

  // Calcul de la nouvelle hauteur avec snapping (redimensionnement manuel)
  const calculateHeight = useCallback((clientY: number): number => {
    const delta = clientY - startY.current;
    const rawHeight = startHeight.current + delta;
    const snapped = Math.round(rawHeight / GRID_SIZE_PX) * GRID_SIZE_PX;
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, snapped));
  }, []);

  // Mise à jour fluide avec RAF
  const handleMove = useCallback((clientY: number) => {
    if (!isResizing.current) return;

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      onHeightChange(calculateHeight(clientY));
    });
  }, [calculateHeight, onHeightChange]);

  // Nettoyage des listeners
  const cleanup = useCallback(() => {
    isResizing.current = false;
    cancelAnimationFrame(rafId.current);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Mouse events
  const handleMouseMove = useCallback((e: MouseEvent) => handleMove(e.clientY), [handleMove]);
  const handleMouseUp = useCallback(() => {
    cleanup();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [cleanup, handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = containerRef.current.offsetHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Touch events
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    }
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    cleanup();
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
  }, [cleanup, handleTouchMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || e.touches.length !== 1) return;

    isResizing.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = containerRef.current.offsetHeight;

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove, handleTouchEnd]);

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

        {/* Poignée de redimensionnement */}
        <div
          className="absolute bottom-0 left-0 w-full h-5 cursor-row-resize z-[40] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 no-print group/handle hover:bg-slate-50/80 backdrop-blur-[2px]"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          aria-label="Ajuster la hauteur"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          tabIndex={0}
        >
          <div className="w-10 h-[3px] bg-slate-300 rounded-full group-hover/handle:bg-slate-400 group-hover/handle:w-16 transition-all duration-300 shadow-sm" />
        </div>

        {/* Indicateur de hauteur */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print z-20 pointer-events-none">
          <div className="px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white rounded-none select-none">
            {height}px
          </div>
        </div>

        <DrawingCanvas 
          height={height} 
          onAddImage={onAddImage} 
          styleName={styleName} 
          colorName={colorName} 
          onStyleChange={onStyleChange} 
          onColorChange={onColorChange} 
        />
      </div>
    </div>
  );
};

export default AnswerSpace;