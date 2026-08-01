import React, { useState } from 'react';
import { 
  Eraser, Undo2, Redo2, Trash2, Hand, PenTool, MousePointer2, 
  Image as ImageIcon, Lasso, CircleDashed, Highlighter, Square, 
  Circle, Minus, Sparkles, Scissors, ArrowRight, MoveHorizontal,
  Triangle, ChevronDown, Check, Palette, Type, Pen, Pencil, Heart, MoreVertical
} from 'lucide-react';
import { ToolType, PenType, HighlighterType, EraserType, ShapeType } from './types';

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  openMenu: 'pen' | 'highlighter' | 'eraser' | 'shape' | 'more' | null;
  setOpenMenu: (menu: 'pen' | 'highlighter' | 'eraser' | 'shape' | 'more' | null) => void;
  
  penType: PenType;
  setPenType: (type: PenType) => void;
  highlighterType: HighlighterType;
  setHighlighterType: (type: HighlighterType) => void;
  eraserType: EraserType;
  setEraserType: (type: EraserType) => void;
  shapeType: ShapeType;
  setShapeType: (type: ShapeType) => void;
  
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
}

const COLORS = [
  '#0f172a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'
];

const HIGHLIGHTER_COLORS = [
  '#fde047', '#86efac', '#93c5fd', '#fca5a5', '#d8b4fe', '#fdba74'
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool, setTool, openMenu, setOpenMenu,
  penType, setPenType, highlighterType, setHighlighterType,
  eraserType, setEraserType, shapeType, setShapeType,
  color, setColor, highlighterColor, setHighlighterColor,
  lineWidth, setLineWidth, highlighterWidth, setHighlighterWidth,
  eraserWidth, setEraserWidth,
  palmRejection, setPalmRejection,
  onUndo, onRedo, onClear, onDeleteSelection,
  canUndo, canRedo, hasSelection,
  onAddImage, fileInputRef, handleImageUpload,
  styleName, colorName, onStyleChange, onColorChange
}) => {
  const toggleMenu = (menu: 'pen' | 'highlighter' | 'eraser' | 'shape' | 'more') => {
    if (menu !== 'more') setTool(menu as ToolType);
    setOpenMenu(openMenu === menu ? null : menu);
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-[#FDFDFD] border-b border-slate-200 px-3 py-1.5 flex items-center justify-center gap-2 sm:gap-4 pointer-events-auto z-30 transition-all duration-200 print:hidden">
      <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-visible w-full relative">
        
        {/* Pen Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => toggleMenu('pen')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'pen' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Stylo"
          >
            <PenTool size={20} strokeWidth={tool === 'pen' ? 2.5 : 1.5} />
          </button>
          {tool === 'pen' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}
          
          {openMenu === 'pen' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-6 flex flex-col gap-8">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <input type="range" min="1" max="12" step="0.5" value={lineWidth} onChange={(e) => setLineWidth(parseFloat(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <div className="w-5 h-5 rounded-full bg-slate-800" />
                </div>
                <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg">
                  <button onClick={() => setPenType('fountain')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition ${penType === 'fountain' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    <Pen size={18} /> Plume
                  </button>
                  <button onClick={() => setPenType('fine')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition ${penType === 'fine' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    <Pencil size={18} /> Bille
                  </button>
                  <button onClick={() => setPenType('marker')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition ${penType === 'marker' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    <Highlighter size={18} /> Feutre
                  </button>
                </div>
                <div className="flex flex-wrap justify-between gap-3">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-110 shadow-md ring-2 ring-blue-500 ring-offset-2 ring-offset-[#F4F5F8]' : 'hover:scale-110 shadow-sm'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highlighter Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => toggleMenu('highlighter')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'highlighter' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Surligneur"
          >
            <Highlighter size={20} strokeWidth={tool === 'highlighter' ? 2.5 : 1.5} />
          </button>
          {tool === 'highlighter' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'highlighter' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-6 flex flex-col gap-8">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-300 opacity-50" />
                  <input type="range" min="8" max="40" step="1" value={highlighterWidth} onChange={(e) => setHighlighterWidth(parseFloat(e.target.value))} className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                  <div className="w-8 h-8 rounded-full bg-yellow-400 opacity-50" />
                </div>
                <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg">
                  <button onClick={() => setHighlighterType('straight')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition ${highlighterType === 'straight' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    <Minus size={18} strokeWidth={3} /> Droit
                  </button>
                  <button onClick={() => setHighlighterType('round')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition ${highlighterType === 'round' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-slate-600 hover:bg-white/50'}`}>
                    <Circle size={18} fill="currentColor" className="text-slate-400" /> Rond
                  </button>
                </div>
                <div className="flex justify-between gap-2">
                  {HIGHLIGHTER_COLORS.map(c => (
                    <button key={c} onClick={() => setHighlighterColor(c)} className={`w-10 h-10 rounded-full transition-transform ${highlighterColor === c ? 'scale-110 shadow-md ring-2 ring-blue-500 ring-offset-2 ring-offset-[#F4F5F8]' : 'hover:scale-110 shadow-sm'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Eraser Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => toggleMenu('eraser')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'eraser' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Gomme"
          >
            <Eraser size={20} strokeWidth={tool === 'eraser' ? 2.5 : 1.5} />
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
              </div>
            </div>
          )}
        </div>

        {/* Shape Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => toggleMenu('shape')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'shape' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Formes"
          >
            {shapeType === 'line' && <Minus size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} className="rotate-45" />}
            {shapeType === 'arrow' && <ArrowRight size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} className="-rotate-45" />}
            {shapeType === 'double-arrow' && <MoveHorizontal size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} className="-rotate-45" />}
            {shapeType === 'rectangle' && <Square size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} />}
            {shapeType === 'circle' && <Circle size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} />}
            {shapeType === 'triangle' && <Triangle size={20} strokeWidth={tool === 'shape' ? 2.5 : 1.5} />}
          </button>
          {tool === 'shape' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}

          {openMenu === 'shape' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[280px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-4 grid grid-cols-3 gap-2">
                <button onClick={() => { setShapeType('line'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'line' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <Minus size={24} className="rotate-45" /> <span className="text-xs font-medium">Ligne</span>
                </button>
                <button onClick={() => { setShapeType('arrow'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'arrow' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <ArrowRight size={24} className="-rotate-45" /> <span className="text-xs font-medium">Flèche</span>
                </button>
                <button onClick={() => { setShapeType('double-arrow'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'double-arrow' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <MoveHorizontal size={24} className="-rotate-45" /> <span className="text-xs font-medium">Double</span>
                </button>
                <button onClick={() => { setShapeType('rectangle'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'rectangle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <Square size={24} /> <span className="text-xs font-medium">Rect</span>
                </button>
                <button onClick={() => { setShapeType('circle'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'circle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <Circle size={24} /> <span className="text-xs font-medium">Cercle</span>
                </button>
                <button onClick={() => { setShapeType('triangle'); setOpenMenu(null); }} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${shapeType === 'triangle' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}>
                  <Triangle size={24} /> <span className="text-xs font-medium">Triangle</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

        {/* Lasso Tool */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => { setTool('lasso'); setOpenMenu(null); }} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md ${tool === 'lasso' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} 
            title="Sélection"
          >
            <Lasso size={20} strokeWidth={tool === 'lasso' ? 2.5 : 1.5} />
          </button>
          {tool === 'lasso' && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-slate-900" />}
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
        
        {/* Actions: Undo/Redo/Trash */}
        <div className="flex items-center gap-0.5">
            <button onClick={onUndo} disabled={!canUndo} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-md disabled:opacity-30 transition">
              <Undo2 size={18} />
            </button>
            <button onClick={onRedo} disabled={!canRedo} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-md disabled:opacity-30 transition">
              <Redo2 size={18} />
            </button>
            
            <button onClick={hasSelection ? onDeleteSelection : onClear} className={`p-1.5 transition rounded-md ${hasSelection ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`} title={hasSelection ? "Supprimer la sélection" : "Tout effacer"}>
              <Trash2 size={18} />
            </button>
        </div>

        {/* Menu "...": Palm Rejection & Image Import */}
        <div className="relative flex flex-col items-center justify-center">
          <button 
            onClick={() => toggleMenu('more')} 
            className={`p-1.5 transition flex flex-col items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-50`} 
            title="Plus d'options"
          >
            <MoreVertical size={20} strokeWidth={1.5} />
          </button>
          
          {openMenu === 'more' && (
            <div className="absolute top-full mt-2 right-0 w-[220px] bg-[#F4F5F8] rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="flex flex-col p-2">
                <button 
                  onClick={() => { setPalmRejection(!palmRejection); setOpenMenu(null); }} 
                  className={`px-3 py-2.5 rounded-lg flex items-center justify-between transition ${palmRejection ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-700'}`}
                >
                  <span className="text-sm font-medium">Rejet Paume / Main</span>
                  {palmRejection && <Check size={16} />}
                </button>

                <div className="my-1 border-t border-slate-200" />
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                     handleImageUpload(e);
                     setOpenMenu(null);
                  }} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {onAddImage ? (
                  <button 
                    onClick={() => { onAddImage(); setOpenMenu(null); }} 
                    className="px-3 py-2.5 rounded-lg flex items-center gap-2 transition hover:bg-slate-200 text-slate-700"
                  >
                    <ImageIcon size={18} />
                    <span className="text-sm font-medium">Image de l'énoncé</span>
                  </button>
                ) : null}

                <button 
                  onClick={() => { fileInputRef.current?.click(); }} 
                  className="px-3 py-2.5 rounded-lg flex items-center gap-2 transition hover:bg-slate-200 text-slate-700"
                >
                  <ImageIcon size={18} />
                  <span className="text-sm font-medium">Importer Image Libre</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
