import React, { useState, useRef } from 'react';
import { 
  Eraser, Undo2, Redo2, Trash2, Hand, PenTool, MousePointer2, 
  Image as ImageIcon, Lasso, CircleDashed, Highlighter, Square, 
  Circle, Minus, Plus, Brush, Sparkles, Scissors, ArrowRight, MoveHorizontal,
  Triangle, ChevronDown, Check, Palette, Type, Pen, Pencil, Heart, MoreVertical, X,
  Ruler, Crosshair, Diamond, Pentagon, Hexagon, MoveDiagonal2
} from 'lucide-react';
import { ToolType, PenType, HighlighterType, EraserType, ShapeType, LineStyle, SelectionMode, PressureCurve, CorrectionProgress, CorrectionToggle } from './types';
import CorrectionProgressControl from './CorrectionProgressControl';

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  openMenu: 'pen' | 'highlighter' | 'eraser' | 'shape' | 'lasso' | 'more' | 'palette' | null;
  setOpenMenu: (menu: 'pen' | 'highlighter' | 'eraser' | 'shape' | 'lasso' | 'more' | 'palette' | null) => void;
  
  penType: PenType;
  setPenType: (type: PenType) => void;
  highlighterType: HighlighterType;
  setHighlighterType: (type: HighlighterType) => void;
  highlighterStraightLines?: boolean;
  setHighlighterStraightLines?: (value: boolean) => void;
  eraserType: EraserType;
  setEraserType: (type: EraserType) => void;
  shapeType: ShapeType;
  setShapeType: (type: ShapeType) => void;
  lineStyle?: LineStyle;
  setLineStyle?: (style: LineStyle) => void;
  straightenLines?: boolean;
  setStraightenLines?: (val: boolean) => void;
  
  selectionMode?: SelectionMode;
  setSelectionMode?: (mode: SelectionMode) => void;
  includePartialSelection?: boolean;
  setIncludePartialSelection?: (val: boolean) => void;
  alignWithShapes?: boolean;
  setAlignWithShapes?: (val: boolean) => void;
  highlighterOpacity?: number;
  setHighlighterOpacity?: (val: number) => void;
  
  color: string;
  setColor: (color: string) => void;
  highlighterColor: string;
  setHighlighterColor: (color: string) => void;
  
  lineWidth: number;
  setLineWidth: (width: number) => void;
  highlighterWidth: number;
  setHighlighterWidth: (width: number) => void;
  eraserWidth: number;
  setEraserWidth: (width: number) => void;
  
  palmRejection: boolean;
  setPalmRejection: (val: boolean) => void;
  pressureCurve?: PressureCurve;
  setPressureCurve?: (curve: PressureCurve) => void;
  penStabilization?: number;
  setPenStabilization?: (value: number) => void;
  shapeRecognition?: boolean;
  setShapeRecognition?: (value: boolean) => void;
  snapGrid?: boolean;
  setSnapGrid?: (value: boolean) => void;
  angleSnap?: boolean;
  setAngleSnap?: (value: boolean) => void;
  angleStep?: 15 | 30 | 45;
  setAngleStep?: (value: 15 | 30 | 45) => void;
  regularShapes?: boolean;
  setRegularShapes?: (value: boolean) => void;
  showMeasurements?: boolean;
  setShowMeasurements?: (value: boolean) => void;
  eraserHighlighterOnly?: boolean;
  setEraserHighlighterOnly?: (value: boolean) => void;
  eraserAutoSize?: boolean;
  setEraserAutoSize?: (value: boolean) => void;
  
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDeleteSelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  
  onAddImage?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  styleName?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  colorName?: 'black' | 'green' | 'blue' | 'white' | 'cream' | '';
  onStyleChange?: (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => void;
  onColorChange?: (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => void;
  isFloating?: boolean;
  floatingLeft?: number;
  floatingWidth?: number;
  correctionProgress?: CorrectionProgress;
  correctionToggle?: CorrectionToggle;
}

const COLORS = [
  '#0f172a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'
];

const HIGHLIGHTER_COLORS = [
  '#ef4444', '#fde047', '#86efac', '#22d3ee', '#3b82f6', '#a855f7', '#0f172a'
];

const CANVAS_ICON_ROOT = '/assets/canvas-icons';
const CANVAS_TOOL_2D_ROOT = '/assets/canvas-tools-2d';
const CANVAS_REFERENCE_2D_ROOT = '/assets/canvas-reference-2d';

const PEN_STYLES: Array<{ value: PenType; label: string; title: string; image: string }> = [
  { value: 'ballpoint', label: 'Bille', title: 'Stylo à bille', image: `${CANVAS_TOOL_2D_ROOT}/pen-ballpoint-complete.png` },
  { value: 'fountain', label: 'Plume', title: 'Stylo plume', image: `${CANVAS_TOOL_2D_ROOT}/pen-fountain.png` },
  { value: 'marker', label: 'Feutre', title: 'Feutre', image: `${CANVAS_TOOL_2D_ROOT}/pen-marker-soft-modern.png` },
  { value: 'pencil', label: 'Crayon', title: 'Crayon', image: `${CANVAS_TOOL_2D_ROOT}/pen-pencil-coherent.png` },
];

const CANVAS_ICONS = {
  highlighter: {
    chisel: `${CANVAS_REFERENCE_2D_ROOT}/highlight-chisel.png`,
    round: `${CANVAS_REFERENCE_2D_ROOT}/highlight-round.png`,
  },
  highlighterToolbar: {
    chisel: {
      base: `${CANVAS_REFERENCE_2D_ROOT}/highlight-chisel-toolbar-base-neutral.png`,
      mask: `${CANVAS_REFERENCE_2D_ROOT}/highlight-chisel-toolbar-mask.png`,
    },
    round: {
      base: `${CANVAS_REFERENCE_2D_ROOT}/highlight-round-toolbar-base-neutral.png`,
      mask: `${CANVAS_REFERENCE_2D_ROOT}/highlight-round-toolbar-mask.png`,
    },
  },
  eraser: `${CANVAS_REFERENCE_2D_ROOT}/toolbar-eraser-retina.png`,
  lasso: `${CANVAS_REFERENCE_2D_ROOT}/toolbar-lasso-retina.png`,
  undo: `${CANVAS_ICON_ROOT}/undo.png`,
  redo: `${CANVAS_ICON_ROOT}/redo.png`,
} as const;

const ToolbarPngIcon: React.FC<{ src: string; size?: number }> = ({ src, size = 22 }) => (
  <img src={src} alt="" aria-hidden="true" style={{ width: size, height: size }} className="object-contain" />
);

const PenReferenceIcon: React.FC<{ src: string; size?: number }> = ({ src, size = 34 }) => (
  <img src={src} alt="" aria-hidden="true" style={{ width: size, height: size }} className="rounded-full object-cover" />
);

const HighlighterReferenceIcon: React.FC<{ base: string; mask: string; color: string; size?: number }> = ({ base, mask, color, size = 28 }) => (
  <span aria-hidden="true" className="relative inline-block shrink-0 overflow-hidden rounded-full bg-[#f6f6f1]" style={{ width: size, height: size }}>
    <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" />
    <span
      className="absolute inset-0"
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url("${mask}")`,
        maskImage: `url("${mask}")`,
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  </span>
);

const ShapeGlyph: React.FC<{ type: ShapeType; size?: number; strokeWidth?: number }> = ({ type, size = 24, strokeWidth = 1.9 }) => {
  if (type === 'line') return <Minus size={size} strokeWidth={strokeWidth} className="-rotate-45" />;
  if (type === 'arrow') return <ArrowRight size={size} strokeWidth={strokeWidth} className="-rotate-45" />;
  if (type === 'double-arrow') return <MoveHorizontal size={size} strokeWidth={strokeWidth} className="-rotate-45" />;
  if (type === 'angle') return <Ruler size={size} strokeWidth={strokeWidth} />;
  if (type === 'axes') return <Crosshair size={size} strokeWidth={strokeWidth} />;
  if (type === 'rectangle') return <Square size={size} strokeWidth={strokeWidth} />;
  if (type === 'circle') return <Circle size={size} strokeWidth={strokeWidth} />;
  if (type === 'triangle') return <Triangle size={size} strokeWidth={strokeWidth} />;
  if (type === 'right-triangle') return <Triangle size={size} strokeWidth={strokeWidth} className="rotate-[30deg]" />;
  if (type === 'diamond') return <Diamond size={size} strokeWidth={strokeWidth} />;
  if (type === 'parallelogram') return <MoveDiagonal2 size={size} strokeWidth={strokeWidth} />;
  if (type === 'pentagon') return <Pentagon size={size} strokeWidth={strokeWidth} />;
  if (type === 'hexagon') return <Hexagon size={size} strokeWidth={strokeWidth} />;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"><path d="M4 16c2-4 4-8 8-8s4 8 8 8" /></svg>;
};

const ESSENTIAL_SHAPES: Array<{ value: ShapeType; label: string }> = [
  { value: 'freeform', label: 'Forme libre' },
  { value: 'line', label: 'Ligne' },
  { value: 'arrow', label: 'Flèche' },
  { value: 'double-arrow', label: 'Double flèche' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Cercle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Losange' },
  { value: 'parallelogram', label: 'Parallélogramme' },
  { value: 'pentagon', label: 'Pentagone' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool, setTool, openMenu, setOpenMenu,
  penType, setPenType, highlighterType, setHighlighterType,
  highlighterStraightLines = false, setHighlighterStraightLines,
  eraserType, setEraserType, shapeType, setShapeType,
  lineStyle = 'solid', setLineStyle, straightenLines = false, setStraightenLines,
  selectionMode = 'lasso', setSelectionMode,
  includePartialSelection = true, setIncludePartialSelection,
  alignWithShapes = true, setAlignWithShapes,
  highlighterOpacity = 0.45, setHighlighterOpacity,
  color, setColor, highlighterColor, setHighlighterColor,
  lineWidth, setLineWidth, highlighterWidth, setHighlighterWidth,
  eraserWidth, setEraserWidth,
  palmRejection, setPalmRejection,
  pressureCurve = 'balanced', setPressureCurve,
  penStabilization = 0.35, setPenStabilization,
  shapeRecognition = true, setShapeRecognition,
  snapGrid = false, setSnapGrid,
  angleSnap = false, setAngleSnap,
  angleStep = 15, setAngleStep,
  regularShapes = false, setRegularShapes,
  showMeasurements = true, setShowMeasurements,
  eraserHighlighterOnly = false, setEraserHighlighterOnly,
  eraserAutoSize = false, setEraserAutoSize,
  onUndo, onRedo, onClear, onDeleteSelection,
  canUndo, canRedo, hasSelection,
  onAddImage, fileInputRef, handleImageUpload,
  styleName, colorName, onStyleChange, onColorChange,
  isFloating = false,
  floatingLeft = 0,
  floatingWidth = 0,
  correctionProgress,
  correctionToggle,
}) => {
  const normalizedPenType: PenType = PEN_STYLES.some((style) => style.value === penType) ? penType : 'ballpoint';
  const activePenStyle = PEN_STYLES.find((style) => style.value === normalizedPenType) || PEN_STYLES[0];

  const handleToolClick = (targetTool: ToolType) => {
    if (tool !== targetTool) {
      setTool(targetTool);
      setOpenMenu(null);
    } else {
      setOpenMenu(openMenu === targetTool ? null : targetTool as any);
    }
  };

  const containerClasses = isFloating
    ? `fixed top-11 sm:top-14 bg-slate-100/95 backdrop-blur-xl border border-slate-300/80 shadow-[0_8px_28px_rgba(15,23,42,0.16)] px-3 py-1.5 flex items-center justify-center gap-2 sm:gap-4 pointer-events-auto transition-all duration-200 print:hidden rounded-none ${openMenu ? 'z-[100]' : 'z-40'}`
    : `relative w-full bg-slate-100/95 backdrop-blur-xl border-b border-slate-300/80 px-3 py-1.5 flex items-center justify-center gap-2 sm:gap-4 pointer-events-auto transition-all duration-200 print:hidden shadow-[0_3px_12px_rgba(15,23,42,0.10)] rounded-none ${openMenu ? 'z-[100]' : 'z-30'}`;

  const containerStyle: React.CSSProperties = isFloating
    ? { left: `${floatingLeft}px`, width: `${floatingWidth}px` }
    : {};

  return (
    <div className={`canvas-toolbar ${containerClasses}`} style={containerStyle}>
      <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-visible w-full relative">
        {/* Pen Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => handleToolClick('pen')}
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'pen' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Stylo (Cliquez à nouveau pour ouvrir les options)"
          >
            <PenReferenceIcon src={activePenStyle.image} size={30} />
          </button>
          {tool === 'pen' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}
          
          {openMenu === 'pen' && (
            <div className="canvas-toolbar-menu absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[344px] max-w-[calc(100vw-16px)] bg-white rounded-[24px] shadow-[0_18px_48px_rgba(15,23,42,0.18)] border border-slate-200/80 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <div className="text-sm font-semibold text-slate-600 px-1">{activePenStyle.title}</div>

                <div className="h-12 rounded-xl bg-slate-100/90 px-4 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <input
                    aria-label="Épaisseur du trait"
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={Math.min(10, lineWidth)}
                    onChange={(event) => setLineWidth(parseFloat(event.target.value))}
                    className="flex-1 h-1 bg-slate-300 rounded-full appearance-none cursor-pointer accent-slate-700"
                  />
                  <span className="w-7 text-right text-[11px] font-medium text-slate-500">{lineWidth.toFixed(1)}</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {PEN_STYLES.map((style) => {
                    const selected = normalizedPenType === style.value;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        title={style.title}
                        onClick={() => setPenType(style.value)}
                        className="flex min-w-0 flex-col items-center gap-1.5"
                      >
                        <span className={`h-14 w-14 rounded-full bg-[#f1f1ee] flex items-center justify-center transition ${selected ? 'ring-2 ring-[#e56861] ring-offset-2 shadow-md' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}>
                          <PenReferenceIcon src={style.image} size={54} />
                        </span>
                        <span className={`text-[11px] font-medium ${selected ? 'text-[#a43b36]' : 'text-slate-500'}`}>{style.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="text-[11px] font-semibold text-slate-500 mb-2">Couleur du trait</div>
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {COLORS.map((candidate) => (
                      <button
                        key={candidate}
                        type="button"
                        aria-label={`Couleur ${candidate}`}
                        onClick={() => setColor(candidate)}
                        className={`h-8 w-8 rounded-full transition-transform ${color === candidate ? 'ring-2 ring-[#e56861] ring-offset-2 scale-105' : 'hover:scale-110'}`}
                        style={{ backgroundColor: candidate }}
                      />
                    ))}
                    <label className="relative h-8 w-8 rounded-full cursor-pointer flex items-center justify-center bg-[conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]" title="Couleur personnalisée">
                      <span className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-base text-slate-700">+</span>
                      <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShapeRecognition?.(!shapeRecognition)}
                  className="mt-1 rounded-xl bg-slate-100/90 px-2 py-2 flex items-center justify-between gap-3 text-left"
                >
                  <span className="text-[13px] font-semibold text-slate-800">Maintenir pour convertir en forme</span>
                  <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${shapeRecognition ? 'bg-teal-700' : 'bg-slate-300'}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${shapeRecognition ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Highlighter Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => handleToolClick('highlighter')}
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'highlighter' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Surligneur (Cliquez à nouveau pour ouvrir les options)"
          >
            <HighlighterReferenceIcon
              base={CANVAS_ICONS.highlighterToolbar[highlighterType].base}
              mask={CANVAS_ICONS.highlighterToolbar[highlighterType].mask}
              color={highlighterColor}
            />
          </button>
          {tool === 'highlighter' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'highlighter' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[344px] max-h-[min(590px,calc(100vh-90px))] overflow-y-auto bg-white rounded-[24px] shadow-[0_18px_48px_rgba(15,23,42,0.18)] border border-slate-200/80 z-50 animate-in fade-in duration-150">
              <div className="p-4 flex flex-col gap-4">
                <div className="text-sm font-semibold text-slate-600 px-1">Surligneur</div>
                
                {/* Pointes 2D originales MathPlus */}
                <div className="grid grid-cols-2 gap-5 px-6">
                  {([
                    { value: 'chisel' as HighlighterType, label: 'Biseau', image: CANVAS_ICONS.highlighter.chisel },
                    { value: 'round' as HighlighterType, label: 'Rond', image: CANVAS_ICONS.highlighter.round },
                  ]).map((style) => {
                    const selected = highlighterType === style.value;
                    return (
                      <button key={style.value} type="button" onClick={() => setHighlighterType(style.value)} className="flex flex-col items-center gap-1.5" title={`Pointe ${style.label}`}>
                        <span className={`h-[74px] w-[74px] overflow-hidden rounded-full bg-[#f1f1ee] transition ${selected ? 'ring-2 ring-[#e56861] ring-offset-2 shadow-md' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}>
                          <img src={style.image} alt="" className="h-full w-full object-contain" />
                        </span>
                        <span className={`text-xs font-semibold ${selected ? 'text-[#a43b36]' : 'text-slate-500'}`}>{style.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Size Slider */}
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: highlighterColor }} />
                  <div className="flex-1 relative flex items-center justify-center h-8">
                    <div className="w-full h-2 bg-slate-200 rounded-full relative flex items-center px-2">
                      <div className="w-full flex justify-between">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400/40" />
                        ))}
                      </div>
                      <input 
                        type="range" 
                        min="8" 
                        max="34" 
                        step="1" 
                        value={highlighterWidth} 
                        onChange={(e) => setHighlighterWidth(parseFloat(e.target.value))} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" 
                      />
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-3 py-0.5 rounded-full shadow-xs pointer-events-none">
                      {Math.round(highlighterWidth)}
                    </div>
                  </div>
                  <span className="w-7 text-right text-[11px] font-medium text-slate-500">px</span>
                </div>

                {/* Transparency Slider with Checkered Pattern Track */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setHighlighterOpacity && setHighlighterOpacity(Math.max(0.1, highlighterOpacity - 0.05))} className="p-1 text-slate-600 hover:text-slate-900"><Minus size={20} /></button>
                  <div className="flex-1 relative flex items-center justify-center h-8">
                    <div 
                      className="w-full h-3 rounded-full overflow-hidden relative shadow-inner border border-slate-300"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #ccc 25%, transparent 25%), 
                          linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                          linear-gradient(45deg, transparent 75%, #ccc 75%), 
                          linear-gradient(-45deg, transparent 75%, #ccc 75%)
                        `,
                        backgroundSize: `8px 8px`,
                        backgroundPosition: `0 0, 0 4px, 4px -4px, -4px 0`
                      }}
                    >
                      <div 
                        className="h-full w-full rounded-full transition-all" 
                        style={{ backgroundColor: highlighterColor, opacity: highlighterOpacity }} 
                      />
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1" 
                        step="0.05" 
                        value={highlighterOpacity} 
                        onChange={(e) => setHighlighterOpacity && setHighlighterOpacity(parseFloat(e.target.value))} 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" 
                      />
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-amber-100/90 border border-amber-300 text-slate-800 text-xs font-bold px-3 py-0.5 rounded-full shadow-xs pointer-events-none">
                      {Math.round(highlighterOpacity * 100)}
                    </div>
                  </div>
                  <button onClick={() => setHighlighterOpacity && setHighlighterOpacity(Math.min(1, highlighterOpacity + 0.05))} className="p-1 text-slate-600 hover:text-slate-900"><Plus size={20} /></button>
                </div>

                {/* Toggle: lignes droites indépendant du type de pointe */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-800 text-sm font-medium">Tracer des lignes droites</span>
                  <button 
                    onClick={() => setHighlighterStraightLines?.(!highlighterStraightLines)} 
                    className={`w-11 h-6 rounded-full transition-colors relative ${highlighterStraightLines ? 'bg-teal-700' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${highlighterStraightLines ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-800 text-sm font-medium">Maintenir pour convertir en forme</span>
                  <button onClick={() => setShapeRecognition?.(!shapeRecognition)} className={`w-11 h-6 rounded-full transition-colors relative ${shapeRecognition ? 'bg-teal-700' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${shapeRecognition ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Colors palette with checkmark & color wheel */}
                <div className="flex justify-between items-center gap-2 pt-2">
                  {HIGHLIGHTER_COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setHighlighterColor(c)} 
                      className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${highlighterColor === c ? 'scale-110 shadow-md ring-2 ring-blue-500 ring-offset-2 ring-offset-[#F8F9FB]' : 'hover:scale-110 shadow-xs'}`} 
                      style={{ backgroundColor: c }}
                    >
                      {highlighterColor === c && <Check size={16} className="text-slate-800 drop-shadow-sm" />}
                    </button>
                  ))}
                  <label className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-500 shadow-xs hover:scale-110 transition-transform cursor-pointer flex items-center justify-center" title="Couleur personnalisée">
                    <input 
                      type="color" 
                      value={highlighterColor} 
                      onChange={(e) => setHighlighterColor(e.target.value)} 
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" 
                    />
                  </label>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Eraser Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => handleToolClick('eraser')}
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'eraser' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Gomme (Cliquez à nouveau pour ouvrir les options)"
          >
            <ToolbarPngIcon src={CANVAS_ICONS.eraser} size={26} />
          </button>
          {tool === 'eraser' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'eraser' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-6 flex flex-col gap-6">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white" />
                  <input type="range" min="10" max="80" step="1" value={eraserWidth} onChange={(e) => setEraserWidth(parseFloat(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600" />
                  <div className="w-8 h-8 rounded-full border-2 border-slate-500 bg-white" />
                </div>
                <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg">
                  <button onClick={() => setEraserType('stroke')} className={`flex-1 py-2 px-3 rounded-md transition ${eraserType === 'stroke' ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    Trait Entier
                  </button>
                  <button onClick={() => setEraserType('pixel')} className={`flex-1 py-2 px-3 rounded-md transition ${eraserType === 'pixel' ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    Précise
                  </button>
                </div>
                <button type="button" onClick={() => setEraserAutoSize?.(!eraserAutoSize)} className="flex items-center justify-between text-sm font-medium text-slate-800">
                  <span>Taille selon la pression</span>
                  <span className={`relative h-5 w-9 rounded-full ${eraserAutoSize ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${eraserAutoSize ? 'translate-x-[18px]' : 'translate-x-0.5'}`} /></span>
                </button>
                <button type="button" onClick={() => setEraserHighlighterOnly?.(!eraserHighlighterOnly)} className="flex items-center justify-between text-sm font-medium text-slate-800">
                  <span>Seulement le surligneur</span>
                  <span className={`relative h-5 w-9 rounded-full ${eraserHighlighterOnly ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${eraserHighlighterOnly ? 'translate-x-[18px]' : 'translate-x-0.5'}`} /></span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shape Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => handleToolClick('shape')}
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'shape' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Formes (Cliquez à nouveau pour ouvrir les options)"
          >
            <ShapeGlyph type={shapeType} size={22} strokeWidth={tool === 'shape' ? 2.35 : 1.8} />
          </button>
          {tool === 'shape' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'shape' && (
            <div className="canvas-toolbar-menu absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[344px] max-w-[calc(100vw-16px)] bg-[#fafafa] rounded-[26px] shadow-[0_20px_55px_rgba(15,23,42,0.18)] border border-slate-200/70 z-50 animate-in fade-in duration-150 p-5 sm:p-6">
              <h3 className="mb-5 font-serif text-[26px] font-semibold leading-none text-slate-950">Formes</h3>

              <div className="grid grid-cols-4 justify-items-center gap-x-3 gap-y-5">
                {ESSENTIAL_SHAPES.map((shape) => {
                  const selected = shapeType === shape.value;
                  return (
                    <button
                      key={shape.value}
                      type="button"
                      onClick={() => { setShapeType(shape.value); setOpenMenu(null); }}
                      className={`grid h-14 w-14 place-items-center rounded-full text-slate-950 transition-all active:scale-95 ${selected ? 'scale-105 bg-white shadow-[0_7px_20px_rgba(15,23,42,0.2)]' : 'hover:bg-white hover:shadow-sm'}`}
                      title={shape.label}
                      aria-label={shape.label}
                      aria-pressed={selected}
                    >
                      <ShapeGlyph type={shape.value} size={31} strokeWidth={2.25} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200/70 pt-5">
                <span className="font-sans text-[15px] font-medium leading-tight text-slate-900">
                  Alignement avec d'autres formes
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={alignWithShapes}
                  aria-label="Alignement avec d'autres formes"
                  onClick={() => setAlignWithShapes?.(!alignWithShapes)}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${alignWithShapes ? 'bg-teal-700' : 'bg-slate-300'}`}
                >
                  <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${alignWithShapes ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

        {/* Lasso / Selection Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => handleToolClick('lasso')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'lasso' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Sélection (Cliquez pour configurer le mode)"
          >
            {selectionMode === 'rectangle' ? (
              <div className="w-5 h-5 border-2 border-dashed border-slate-700 rounded-xs" />
            ) : (
              <ToolbarPngIcon src={CANVAS_ICONS.lasso} size={26} />
            )}
          </button>
          {tool === 'lasso' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'lasso' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[320px] bg-[#F8F9FB] rounded-3xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 p-5">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                <span className="text-lg font-bold text-slate-900">Mode de sélection</span>
                <button onClick={() => setOpenMenu(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Radio Options: Lasso vs Rectangle */}
              <div className="flex flex-col gap-3 my-2">
                <button 
                  onClick={() => setSelectionMode && setSelectionMode('lasso')}
                  className="flex items-center gap-4 text-left py-2 px-2 rounded-xl hover:bg-slate-200/40 transition"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectionMode === 'lasso' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'}`}>
                    {selectionMode === 'lasso' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex items-center gap-3 text-slate-900 font-medium text-base">
                    <Lasso size={22} className="text-slate-800" />
                    <span>Lasso</span>
                  </div>
                </button>

                <button 
                  onClick={() => setSelectionMode && setSelectionMode('rectangle')}
                  className="flex items-center gap-4 text-left py-2 px-2 rounded-xl hover:bg-slate-200/40 transition"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectionMode === 'rectangle' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'}`}>
                    {selectionMode === 'rectangle' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex items-center gap-3 text-slate-900 font-medium text-base">
                    <div className="w-5 h-5 border-2 border-dashed border-slate-800 rounded-xs" />
                    <span>Rectangle</span>
                  </div>
                </button>
              </div>

              {/* Toggle: Inclure les objets sélectionnés partiellement */}
              <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between gap-3 mt-2">
                <span className="text-slate-900 font-medium text-sm leading-tight max-w-[200px]">
                  Inclure les objets sélectionnés partiellement
                </span>
                <button 
                  onClick={() => setIncludePartialSelection && setIncludePartialSelection(!includePartialSelection)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${includePartialSelection ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${includePartialSelection ? 'left-6.5' : 'left-0.5'}`} />
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Pointer / Scroll */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => { setTool('pointer'); setOpenMenu(null); }} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'pointer' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Pointeur / Défilement"
          >
            <MousePointer2 size={20} strokeWidth={tool === 'pointer' ? 2.5 : 1.5} />
          </button>
          {tool === 'pointer' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}
        </div>

        {/* Text Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => { setTool('text'); setOpenMenu(null); }} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'text' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Texte"
          >
            <Type size={20} strokeWidth={tool === 'text' ? 2.5 : 1.5} />
          </button>
          {tool === 'text' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}
        </div>
        
        {/* Actions: Undo/Redo/Trash */}
        <div className="flex items-center gap-0.5">
            <button onClick={onUndo} disabled={!canUndo} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-md disabled:opacity-30 transition">
              <ToolbarPngIcon src={CANVAS_ICONS.undo} size={19} />
            </button>
            <button onClick={onRedo} disabled={!canRedo} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-md disabled:opacity-30 transition">
              <ToolbarPngIcon src={CANVAS_ICONS.redo} size={19} />
            </button>
            
            <button onClick={hasSelection ? onDeleteSelection : onClear} className={`p-1.5 transition rounded-md ${hasSelection ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`} title={hasSelection ? "Supprimer la sélection" : "Tout effacer"}>
              <Trash2 size={18} />
            </button>
        </div>

        {/* Background Style & Color Selector */}
        {(onStyleChange || onColorChange) && (
          <div className="relative flex flex-col items-center justify-center">
            <button
              onClick={() => { setOpenMenu(openMenu === 'palette' ? null : 'palette'); }}
              className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${openMenu === 'palette' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
              title="Style & Couleur du fond"
            >
              <Palette size={20} strokeWidth={1.5} />
            </button>

            {openMenu === 'palette' && (
              <div className="absolute top-full mt-2 right-0 w-[280px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 p-4 flex flex-col gap-3">
                {onStyleChange && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Style de fond</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'slate', name: 'Ardoise' },
                        { id: 'seyes', name: 'Seyes' },
                        { id: 'grid', name: 'Carreaux' },
                        { id: 'dotted', name: 'Pointillés' },
                        { id: 'blank', name: 'Vierge' }
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { onStyleChange(s.id as any); setOpenMenu(null); }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition text-left ${styleName === s.id ? 'bg-blue-500 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onColorChange && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Couleur du fond</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'white', name: 'Blanc', class: 'bg-white text-slate-800' },
                        { id: 'black', name: 'Noir', class: 'bg-slate-900 text-white' },
                        { id: 'green', name: 'Vert', class: 'bg-emerald-900 text-white' },
                        { id: 'blue', name: 'Bleu', class: 'bg-sky-900 text-white' },
                        { id: 'cream', name: 'Crème', class: 'bg-amber-50 text-amber-900' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { onColorChange(c.id as any); setOpenMenu(null); }}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition text-center ${c.class} ${colorName === c.id ? 'ring-2 ring-blue-500 ring-offset-1 border-transparent' : 'border-slate-300'}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Menu "...": Palm Rejection & Image Import */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50`} 
            title="Plus d'options"
          >
            <MoreVertical size={20} />
          </button>

          {openMenu === 'more' && (
            <div className="absolute top-full mt-2 right-0 w-[310px] max-h-[70vh] overflow-y-auto bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 p-4 flex flex-col gap-3">
              <button 
                onClick={() => setPalmRejection(!palmRejection)}
                className="flex items-center justify-between text-slate-800 text-sm font-medium py-1 px-1 hover:bg-slate-200/50 rounded-lg"
              >
                <span>Rejet de paume</span>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${palmRejection ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${palmRejection ? 'left-4.5' : 'left-0.5'}`} />
                </div>
              </button>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Encre MathPlus</label>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>Courbe de pression</span>
                  <select value={pressureCurve} onChange={(event) => setPressureCurve?.(event.target.value as PressureCurve)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                    <option value="soft">Souple</option>
                    <option value="balanced">Équilibrée</option>
                    <option value="firm">Ferme</option>
                  </select>
                </div>
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 flex justify-between"><span>Stabilisation</span><span>{Math.round(penStabilization * 100)}%</span></span>
                  <input type="range" min="0" max="1" step="0.05" value={penStabilization} onChange={(event) => setPenStabilization?.(Number(event.target.value))} className="w-full accent-blue-600" />
                </label>
                <button type="button" onClick={() => setShapeRecognition?.(!shapeRecognition)} className="flex w-full items-center justify-between text-sm text-slate-700">
                  <span>Dessiner + maintenir → forme</span><span className={`h-2.5 w-2.5 rounded-full ${shapeRecognition ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </button>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Aides géométriques</label>
                <button type="button" onClick={() => setSnapGrid?.(!snapGrid)} className="flex w-full items-center justify-between text-sm text-slate-700"><span>Aimantation grille</span><Check size={15} className={snapGrid ? 'opacity-100 text-blue-600' : 'opacity-20'} /></button>
                <button type="button" onClick={() => setAngleSnap?.(!angleSnap)} className="flex w-full items-center justify-between text-sm text-slate-700"><span>Angles contraints</span><Check size={15} className={angleSnap ? 'opacity-100 text-blue-600' : 'opacity-20'} /></button>
                {angleSnap && (
                  <div className="grid grid-cols-3 gap-1">
                    {([15, 30, 45] as const).map(value => <button key={value} type="button" onClick={() => setAngleStep?.(value)} className={`rounded-md px-2 py-1 text-xs ${angleStep === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{value}°</button>)}
                  </div>
                )}
                <button type="button" onClick={() => setRegularShapes?.(!regularShapes)} className="flex w-full items-center justify-between text-sm text-slate-700"><span>Formes régulières</span><Check size={15} className={regularShapes ? 'opacity-100 text-blue-600' : 'opacity-20'} /></button>
                <button type="button" onClick={() => setShowMeasurements?.(!showMeasurements)} className="flex w-full items-center justify-between text-sm text-slate-700"><span>Afficher les mesures</span><Check size={15} className={showMeasurements ? 'opacity-100 text-blue-600' : 'opacity-20'} /></button>
              </div>

              <hr className="border-slate-200" />

              <button 
                onClick={() => { onAddImage ? onAddImage() : fileInputRef.current?.click(); setOpenMenu(null); }}
                className="flex items-center gap-2 text-slate-800 text-sm font-medium py-1.5 px-2 hover:bg-slate-200/50 rounded-lg text-left"
              >
                <ImageIcon size={18} className="text-blue-600" />
                <span>Insérer une image</span>
              </button>
            </div>
          )}
        </div>

        {correctionToggle?.available && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {correctionProgress && <CorrectionProgressControl progress={correctionProgress} />}
            <button
              type="button"
              aria-pressed={correctionToggle.visible}
              onClick={correctionToggle.toggle}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold transition active:scale-95 ${
                correctionToggle.visible
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700'
              }`}
              title={correctionToggle.visible ? 'Masquer le rappel de cours' : 'Afficher le rappel de cours'}
            >
              Aide
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />

      </div>
    </div>
  );
};
