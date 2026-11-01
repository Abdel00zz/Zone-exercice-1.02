import React, { useId } from 'react';

// Configuration
const MM_TO_PX = 3.7795275591;
const GRID_SIZE_MM = 5;
const GRID_SIZE_PX = GRID_SIZE_MM * MM_TO_PX;
const SEYES_LINE_MM = 2; // Seyes has horizontal lines every 2mm
const SEYES_LINE_PX = SEYES_LINE_MM * MM_TO_PX;

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

// Palette d'impression universelle sur papier blanc A4 : réglures nettes,
// contraste maîtrisé et respect strict des teintes scolaires (Seyes / grille).
const PRINT_PAPER_PALETTE: ColorPalette = {
  bg: '#ffffff',
  line: '#94a3b8',
  border: '#64748b',
  dot: '#64748b',
  seyesMajor: '#64748b',
  seyesMinor: '#cbd5e1',
  seyesVertical: '#f87171',
};

type ThemeMap = Record<'seyes' | 'slate' | 'grid' | 'dotted' | 'blank', { screen: ColorPalette, print: ColorPalette }>;

const THEMES: ThemeMap = {
  slate: {
    screen: COLOR_PALETTES.black,
    print: PRINT_PAPER_PALETTE,
  },
  seyes: {
    screen: COLOR_PALETTES.white,
    print: PRINT_PAPER_PALETTE,
  },
  grid: {
    screen: COLOR_PALETTES.white,
    print: PRINT_PAPER_PALETTE,
  },
  dotted: {
    screen: COLOR_PALETTES.white,
    print: PRINT_PAPER_PALETTE,
  },
  blank: {
    screen: COLOR_PALETTES.white,
    print: PRINT_PAPER_PALETTE,
  }
};


export type AnswerSpaceStyle = keyof typeof THEMES;
export type AnswerSpaceColor = keyof typeof COLOR_PALETTES;

export const resolveAnswerSpaceTheme = (styleName: AnswerSpaceStyle, colorName?: AnswerSpaceColor | '') => ({
  screen: (colorName && COLOR_PALETTES[colorName]) || (THEMES[styleName] || THEMES.slate).screen,
  print: PRINT_PAPER_PALETTE,
});

/** Même papier dans l'aperçu, les zones réelles et l'impression. */
export const AnswerSpacePaper: React.FC<{ styleName: AnswerSpaceStyle; colorName?: AnswerSpaceColor | ''; height?: number }> = ({ styleName, colorName, height = 1600 }) => {
  const theme = resolveAnswerSpaceTheme(styleName, colorName);
  const gridPatternId = `paper-${useId().replace(/:/g, '')}`;
  return <>
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

              {styleName === 'slate' && (
                <line x1="0" y1="0" x2={GRID_SIZE_PX} y2="0" stroke={theme.screen.line} strokeWidth="1" shapeRendering="crispEdges" />
              )}

              {styleName === 'grid' && (
                <>
                  <line x1="0" y1="0" x2={GRID_SIZE_PX} y2="0" stroke={theme.screen.line} strokeWidth="1" shapeRendering="crispEdges" />
                  <line x1="0" y1="0" x2="0" y2={GRID_SIZE_PX} stroke={theme.screen.line} strokeWidth="1" shapeRendering="crispEdges" />
                </>
              )}

              {styleName === 'dotted' && (
                <circle cx={GRID_SIZE_PX / 2} cy={GRID_SIZE_PX / 2} r="1" fill={theme.screen.dot} />
              )}

              {styleName === 'seyes' && (
                <>
                  {/* Ligne horizontale mineure (toutes les 2mm) */}
                  <line x1="0" y1={SEYES_LINE_PX} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX} stroke={theme.screen.seyesMinor} strokeWidth="1" shapeRendering="crispEdges" />
                  <line x1="0" y1={SEYES_LINE_PX * 2} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 2} stroke={theme.screen.seyesMinor} strokeWidth="1" shapeRendering="crispEdges" />
                  <line x1="0" y1={SEYES_LINE_PX * 3} x2={SEYES_LINE_PX * 4} y2={SEYES_LINE_PX * 3} stroke={theme.screen.seyesMinor} strokeWidth="1" shapeRendering="crispEdges" />
                  {/* Ligne horizontale majeure (toutes les 8mm) */}
                  <line x1="0" y1="0" x2={SEYES_LINE_PX * 4} y2="0" stroke={theme.screen.seyesMajor} strokeWidth="1.2" shapeRendering="crispEdges" />
                  {/* Ligne verticale majeure (toutes les 8mm) */}
                  <line x1="0" y1="0" x2="0" y2={SEYES_LINE_PX * 4} stroke={theme.screen.seyesMajor} strokeWidth="1.2" shapeRendering="crispEdges" />
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

          <PrintRuling styleName={styleName} height={height} palette={theme.print} />
        </svg>

  </>;
};

/** Chromium rasterise les SVG pattern lors de l'export PDF. Des primitives
 * explicites conservent le papier vectoriel, même à très fort grossissement. */
const PrintRuling: React.FC<{ styleName: AnswerSpaceStyle; height: number; palette: ColorPalette }> = ({ styleName, height, palette }) => {
  const seyes = styleName === 'seyes';
  const step = seyes ? SEYES_LINE_PX : GRID_SIZE_PX;
  const rows = Math.ceil(Math.min(1600, height) / step);
  // A4, marges de 14 mm : au maximum 182 mm de papier utile.
  const columns = Math.ceil(182 * MM_TO_PX / (seyes ? SEYES_LINE_PX * 4 : GRID_SIZE_PX));
  if (styleName === 'blank') return null;
  if (styleName === 'dotted') {
    const dots = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
      const x = (column + 0.5) * GRID_SIZE_PX, y = (row + 0.5) * GRID_SIZE_PX;
      return `M${x - 0.75} ${y}a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0 -1.5 0`;
    }).join(' ')).join(' ');
    return <path d={dots} fill={palette.dot} data-print-ruling="dotted" />;
  }
  return <g data-print-ruling={styleName}>
    {Array.from({ length: rows + 1 }, (_, row) => <line key={`h-${row}`} x1="0" x2="100%" y1={row * step} y2={row * step}
      stroke={seyes ? row % 4 === 0 ? palette.seyesMajor : palette.seyesMinor : palette.line}
      strokeWidth={seyes ? row % 4 === 0 ? 0.85 : 0.5 : 0.6} />)}
    {(styleName === 'grid' || seyes) && Array.from({ length: columns + 1 }, (_, column) => <line key={`v-${column}`} y1="0" y2="100%"
      x1={column * (seyes ? SEYES_LINE_PX * 4 : GRID_SIZE_PX)} x2={column * (seyes ? SEYES_LINE_PX * 4 : GRID_SIZE_PX)}
      stroke={seyes ? palette.seyesMajor : palette.line} strokeWidth={seyes ? 0.85 : 0.6} />)}
  </g>;
};
