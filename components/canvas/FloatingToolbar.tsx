/**
 * Barre d'outils UNIQUE de la fiche : horizontale, flottante en haut et
 * repliable.
 *
 * Elle remplace les N barres horizontales qui étaient montées une par zone de
 * réponse. Les réglages d'outil vivent dans `toolStore` (partagés par toutes les
 * zones), les actions (annuler, effacer, importer…) sont adressées au canvas
 * actif via `canvasRegistry`.
 *
 * Ergonomie tablette : cibles tactiles confortables, défilement horizontal sur
 * petit écran et panneaux compacts qui s'ouvrent sous la barre.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, Circle, Crosshair, Diamond,
  Hexagon, Image as ImageIcon, Lasso, Minus, MousePointer2,
  MoveDiagonal2, MoveHorizontal, Palette, Pen, Pentagon, Plus, Ruler,
  Settings2, Square, Trash2, Triangle, Type, X, ArrowRight, Pencil, Printer, MoreVertical,
} from 'lucide-react';
import type {
  HighlighterType, PenType, PressureCurve, ShapeType, ToolType,
} from './types';
import { closeToolMenu, setToolState, useToolState, type ToolMenu } from './toolStore';
import {
  useActiveCanvasSnapshot, withActiveCanvas, withEveryCanvas,
} from './canvasRegistry';

const COLORS = ['#0f172a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
const HIGHLIGHTER_COLORS = ['#ef4444', '#fde047', '#86efac', '#22d3ee', '#3b82f6', '#a855f7', '#0f172a'];

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
  highlighterToolbar: {
    chisel: {
      base: `${CANVAS_REFERENCE_2D_ROOT}/highlight-chisel-toolbar-base-premium.png`,
      mask: `${CANVAS_REFERENCE_2D_ROOT}/highlight-chisel-toolbar-mask-premium.png`,
    },
    round: {
      base: `${CANVAS_REFERENCE_2D_ROOT}/highlight-round-toolbar-base-premium.png`,
      mask: `${CANVAS_REFERENCE_2D_ROOT}/highlight-round-toolbar-mask-premium.png`,
    },
  },
  eraser: `${CANVAS_REFERENCE_2D_ROOT}/toolbar-eraser-retina.png`,
  lasso: `${CANVAS_REFERENCE_2D_ROOT}/toolbar-lasso-retina.png`,
  undo: `${CANVAS_ICON_ROOT}/undo.png`,
  redo: `${CANVAS_ICON_ROOT}/redo.png`,
} as const;

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
  { value: 'hexagon', label: 'Hexagone' },
  { value: 'axes', label: 'Repère' },
];

const BACKGROUND_STYLES: Array<{ id: 'slate' | 'seyes' | 'grid' | 'dotted' | 'blank'; name: string }> = [
  { id: 'slate', name: 'Ardoise' },
  { id: 'seyes', name: 'Seyes' },
  { id: 'grid', name: 'Carreaux' },
  { id: 'dotted', name: 'Points' },
  { id: 'blank', name: 'Vierge' },
];

const BACKGROUND_COLORS: Array<{ id: 'white' | 'black' | 'green' | 'blue' | 'cream'; name: string; color: string }> = [
  { id: 'white', name: 'Blanc', color: '#ffffff' },
  { id: 'black', name: 'Noir', color: '#0f172a' },
  { id: 'green', name: 'Vert', color: '#14532d' },
  { id: 'blue', name: 'Bleu', color: '#1e3a8a' },
  { id: 'cream', name: 'Crème', color: '#fef3c7' },
];

// ── Fragments visuels ───────────────────────────────────────────────────────

const PngIcon: React.FC<{ src: string; size?: number }> = ({ src, size = 26 }) => (
  <img src={src} alt="" aria-hidden="true" style={{ width: size, height: size }} className="object-contain" />
);

const PenIcon: React.FC<{ src: string; size?: number }> = ({ src, size = 34 }) => (
  <img src={src} alt="" aria-hidden="true" style={{ width: size, height: size }} className="rounded-full object-cover" />
);

const HighlighterIcon: React.FC<{ base: string; mask: string; color: string; size?: number }> = ({ base, mask, color, size = 32 }) => (
  <span aria-hidden="true" className="relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size, isolation: 'isolate' }}>
    <img src={base} alt="" className="absolute inset-0 h-full w-full object-contain" />
    <span
      className="absolute inset-0"
      style={{
        backgroundColor: color,
        mixBlendMode: 'color',
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

const ShapeGlyph: React.FC<{ type: ShapeType; size?: number; strokeWidth?: number }> = ({ type, size = 26, strokeWidth = 1.9 }) => {
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

interface RailButtonProps {
  label: string;
  active?: boolean;
  activeSurface?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * Bouton visuel de 40 px ; la feuille de style élargit discrètement la cible à
 * 42 px sur écran tactile. La barre reste ainsi compacte sans devenir imprécise.
 */
const RailButton: React.FC<RailButtonProps> = ({ label, active, activeSurface = true, disabled, tone = 'neutral', onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`canvas-rail-button relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-25 ${
      active
        ? tone === 'danger'
          ? 'bg-rose-100 text-rose-600'
          : activeSurface
            ? 'bg-[#dceceb] text-[#19788c]'
            : 'bg-transparent text-[#435054]'
        : tone === 'danger'
          ? 'text-rose-500 hover:bg-rose-50'
          : 'text-[#5b676a] hover:bg-[#fffefa] hover:text-[#172126]'
    }`}
  >
    {children}
  </button>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl bg-[#f4f1eb] px-3 text-left text-[12px] font-semibold text-[#263337]"
  >
    <span className="min-w-0 flex-1">{label}</span>
    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#19788c]' : 'bg-[#cfd4d1]'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </span>
  </button>
);

const Section: React.FC<{
  title: string;
  summary: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, summary, icon, open, onToggle, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-[46px] w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 active:bg-slate-100"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight text-slate-800">{title}</span>
        <span className="block truncate text-[11px] font-medium leading-tight text-slate-400">{summary}</span>
      </span>
      <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="border-t border-slate-100 px-3 pb-3 pt-2.5">{children}</div>}
  </section>
);

const PanelHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="mb-2 flex items-center justify-between">
    <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
    <button
      type="button"
      onClick={onClose}
      aria-label="Fermer le panneau"
      className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      <X size={17} />
    </button>
  </div>
);

// ── Barre ───────────────────────────────────────────────────────────────────

interface CanvasFloatingToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  onPrint: () => void;
}

export const CanvasFloatingToolbar: React.FC<CanvasFloatingToolbarProps> = ({
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  onPrint,
}) => {
  const tools = useToolState();
  const canvas = useActiveCanvasSnapshot();
  const railRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<'background' | 'ink' | 'geometry' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { openMenu, railCollapsed } = tools;

  const activePen = PEN_STYLES.find(style => style.value === tools.penType) || PEN_STYLES[0];

  // Le stylet est souvent posé sur la zone d'écriture au moment d'un tap ailleurs :
  // fermer au clic extérieur évite qu'un panneau reste ouvert par-dessus la fiche.
  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (railRef.current?.contains(event.target as Node)) return;
      closeToolMenu();
    };
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeToolMenu(); };
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3500);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const selectTool = (tool: ToolType, menu?: ToolMenu) => {
    if (tools.tool !== tool) {
      setToolState({ tool, openMenu: null });
    } else if (menu) {
      setToolState({ openMenu: openMenu === menu ? null : menu });
    }
  };

  const toggleMenu = (menu: Exclude<ToolMenu, null>) =>
    setToolState({ openMenu: openMenu === menu ? null : menu });

  const handleClear = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    withActiveCanvas(handle => handle.clear());
  };

  const applyBackgroundStyle = (style: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank') => {
    const apply = (handle: { setBackgroundStyle: (s: typeof style) => void }) => handle.setBackgroundStyle(style);
    if (tools.applyBackgroundToAll) withEveryCanvas(apply); else withActiveCanvas(apply);
  };

  const applyBackgroundColor = (color: 'black' | 'green' | 'blue' | 'white' | 'cream' | '') => {
    const apply = (handle: { setBackgroundColor: (c: typeof color) => void }) => handle.setBackgroundColor(color);
    if (tools.applyBackgroundToAll) withEveryCanvas(apply); else withActiveCanvas(apply);
  };

  if (railCollapsed) {
    return (
      <div
        ref={railRef}
        className="canvas-toolbar canvas-rail fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 print:hidden"
      >
        <button
          type="button"
          onClick={() => setToolState({ railCollapsed: false })}
          title="Afficher la barre d'outils"
          aria-label="Afficher la barre d'outils"
          className="group relative grid h-12 w-12 place-items-center rounded-2xl bg-[#fffefa]/95 text-[#435054] border border-[#dedbd2] shadow-[0_8px_28px_rgba(23,33,38,0.18)] backdrop-blur-xl transition hover:scale-105 active:scale-95"
        >
          {tools.tool === 'pen' ? <PenIcon src={activePen.image} size={29} />
            : tools.tool === 'highlighter' ? (
              <HighlighterIcon
                base={CANVAS_ICONS.highlighterToolbar[tools.highlighterType].base}
                mask={CANVAS_ICONS.highlighterToolbar[tools.highlighterType].mask}
                color={tools.highlighterColor}
                size={28}
              />
            )
            : tools.tool === 'eraser' ? <PngIcon src={CANVAS_ICONS.eraser} size={26} />
            : tools.tool === 'lasso' ? <PngIcon src={CANVAS_ICONS.lasso} size={26} />
            : tools.tool === 'shape' ? <ShapeGlyph type={tools.shapeType} size={24} strokeWidth={2} />
            : tools.tool === 'text' ? <Type size={24} />
            : <MousePointer2 size={24} />}
        </button>
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    right: 'calc(100% + 14px)',
    top: '50%',
    transform: 'translateY(-50%)',
    maxHeight: 'min(85vh, 620px)',
  };

  const panel = (title: string, body: React.ReactNode, width = 320) => (
    <div
      className="canvas-rail-panel absolute z-50 flex flex-col overflow-y-auto overscroll-contain rounded-2xl border border-[#dedbd2] bg-[#fffefa]/98 p-3.5 shadow-[0_20px_50px_rgba(23,33,38,0.22)] backdrop-blur-xl animate-in fade-in slide-in-from-right-3 duration-200"
      style={{ ...panelStyle, width: `min(${width}px, calc(100vw - 80px))` }}
    >
      <PanelHeader title={title} onClose={closeToolMenu} />
      {body}
    </div>
  );

  // z-40 : au-dessus de la fiche, ancré verticalement à droite pour ne pas masquer le texte.
  return (
    <div
      ref={railRef}
      className="canvas-toolbar canvas-rail fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 print:hidden"
    >
      <div
        className="flex flex-col items-center gap-1 rounded-2xl sm:rounded-3xl bg-[#fffefa]/95 py-2 px-1.5 border border-[#dedbd2] shadow-[0_12px_36px_rgba(23,33,38,0.18)] backdrop-blur-xl transition-all duration-300"
      >
        <RailButton label="Stylo" active={tools.tool === 'pen'} onClick={() => selectTool('pen', 'pen')}>
          <PenIcon src={activePen.image} size={30} />
        </RailButton>

        <RailButton label="Surligneur" active={tools.tool === 'highlighter'} activeSurface={false} onClick={() => selectTool('highlighter', 'highlighter')}>
          <HighlighterIcon
            base={CANVAS_ICONS.highlighterToolbar[tools.highlighterType].base}
            mask={CANVAS_ICONS.highlighterToolbar[tools.highlighterType].mask}
            color={tools.highlighterColor}
            size={28}
          />
        </RailButton>

        <RailButton label="Gomme" active={tools.tool === 'eraser'} onClick={() => selectTool('eraser', 'eraser')}>
          <PngIcon src={CANVAS_ICONS.eraser} size={26} />
        </RailButton>

        <RailButton label="Formes" active={tools.tool === 'shape'} onClick={() => selectTool('shape', 'shape')}>
          <ShapeGlyph type={tools.shapeType} size={24} strokeWidth={tools.tool === 'shape' ? 2.2 : 1.8} />
        </RailButton>

        <RailButton label="Sélection" active={tools.tool === 'lasso'} onClick={() => selectTool('lasso', 'lasso')}>
          {tools.selectionMode === 'rectangle'
            ? <span className="block h-6 w-6 rounded-[3px] border-2 border-dashed border-current" />
            : <PngIcon src={CANVAS_ICONS.lasso} size={26} />}
        </RailButton>

        <RailButton label="Texte" active={tools.tool === 'text'} onClick={() => selectTool('text')}>
          <Type size={23} strokeWidth={tools.tool === 'text' ? 2.3 : 1.7} />
        </RailButton>

        <RailButton label="Pointeur / déplacement" active={tools.tool === 'pointer'} onClick={() => selectTool('pointer')}>
          <MousePointer2 size={22} strokeWidth={tools.tool === 'pointer' ? 2.3 : 1.7} />
        </RailButton>

        <div className="my-1 h-px w-7 shrink-0 bg-[#dedbd2]" />

        <RailButton label="Annuler" disabled={!canvas.canUndo} onClick={() => withActiveCanvas(handle => handle.undo())}>
          <PngIcon src={CANVAS_ICONS.undo} size={21} />
        </RailButton>

        <RailButton label="Rétablir" disabled={!canvas.canRedo} onClick={() => withActiveCanvas(handle => handle.redo())}>
          <PngIcon src={CANVAS_ICONS.redo} size={21} />
        </RailButton>

        <RailButton
          label={canvas.hasSelection ? 'Supprimer la sélection' : confirmClear ? 'Confirmer : tout effacer' : 'Tout effacer cette zone'}
          tone="danger"
          active={confirmClear && !canvas.hasSelection}
          onClick={() => {
            if (canvas.hasSelection) withActiveCanvas(handle => handle.deleteSelection());
            else handleClear();
          }}
        >
          <Trash2 size={21} />
        </RailButton>

        <RailButton label="Option" active={openMenu === 'more'} onClick={() => toggleMenu('more')}>
          <MoreVertical size={21} />
        </RailButton>

        <button
          type="button"
          onClick={() => setToolState({ railCollapsed: true, openMenu: null })}
          title="Replier la barre"
          aria-label="Replier la barre d'outils"
          className="grid h-7 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700"
        >
          <ChevronDown size={17} className="-rotate-90" />
        </button>
      </div>

      {/* ── Panneaux ─────────────────────────────────────────────────────── */}

      {openMenu === 'pen' && panel(activePen.title, (
        <div className="flex flex-col gap-4">
          <div className="flex h-12 items-center gap-3 rounded-xl bg-slate-100/90 px-4">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tools.color }} />
            <input
              aria-label="Épaisseur du trait"
              type="range" min="1" max="10" step="0.5"
              value={Math.min(10, tools.lineWidth)}
              onChange={event => setToolState({ lineWidth: parseFloat(event.target.value) })}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-300 accent-slate-700"
            />
            <span className="w-7 text-right text-[11px] font-medium text-slate-500">{tools.lineWidth.toFixed(1)}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PEN_STYLES.map(style => {
              const selected = tools.penType === style.value;
              return (
                <button
                  key={style.value}
                  type="button"
                  title={style.title}
                  onClick={() => setToolState({ penType: style.value, tool: 'pen' })}
                  className="flex min-w-0 flex-col items-center gap-1.5"
                >
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f1ee] transition ${selected ? 'shadow-md ring-2 ring-[#e56861] ring-offset-2' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}>
                    <PenIcon src={style.image} size={58} />
                  </span>
                  <span className={`text-[11px] font-medium ${selected ? 'text-[#a43b36]' : 'text-slate-500'}`}>{style.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <div className="mb-2 text-[11px] font-semibold text-slate-500">Couleur du trait</div>
            <div className="flex flex-wrap items-center gap-2.5">
              {COLORS.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  aria-label={`Couleur ${candidate}`}
                  onClick={() => setToolState({ color: candidate })}
                  className={`h-10 w-10 rounded-full transition-transform ${tools.color === candidate ? 'scale-105 ring-2 ring-[#e56861] ring-offset-2' : 'hover:scale-110'}`}
                  style={{ backgroundColor: candidate }}
                />
              ))}
              <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]" title="Couleur personnalisée">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base text-slate-700">+</span>
                <input type="color" value={tools.color} onChange={event => setToolState({ color: event.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
            </div>
          </div>

          <Toggle label="Maintenir pour convertir en forme" checked={tools.shapeRecognition} onChange={() => setToolState({ shapeRecognition: !tools.shapeRecognition })} />
          <Toggle label="Redresser les traits longs" checked={tools.straightenLines} onChange={() => setToolState({ straightenLines: !tools.straightenLines })} />
        </div>
      ))}

      {openMenu === 'highlighter' && panel('Surligneur', (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-5 px-6">
            {([ 
              { value: 'chisel' as HighlighterType, label: 'Biseau' },
              { value: 'round' as HighlighterType, label: 'Rond' },
            ]).map(style => {
              const selected = tools.highlighterType === style.value;
              const icon = CANVAS_ICONS.highlighterToolbar[style.value];
              return (
                <button
                  key={style.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setToolState({ highlighterType: style.value })}
                  className={`relative flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 transition-[transform,background-color,border-color,box-shadow] duration-200 active:scale-[0.97] ${
                    selected
                      ? 'scale-[1.02] border-slate-300 bg-white/75 shadow-[0_8px_20px_rgba(15,23,42,0.10)]'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm'
                  }`}
                  title={`Pointe ${style.label}`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white shadow-sm"
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <HighlighterIcon base={icon.base} mask={icon.mask} color={tools.highlighterColor} size={76} />
                  <span className={`text-xs font-semibold ${selected ? 'text-slate-800' : 'text-slate-500'}`}>{style.label}</span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tools.highlighterColor }} />
            <input
              aria-label="Largeur du surligneur"
              type="range" min="8" max="34" step="1"
              value={tools.highlighterWidth}
              onChange={event => setToolState({ highlighterWidth: parseFloat(event.target.value) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-700"
            />
            <span className="w-10 text-right text-[11px] font-semibold text-slate-600">{Math.round(tools.highlighterWidth)} px</span>
          </label>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Moins opaque" onClick={() => setToolState({ highlighterOpacity: Math.max(0.1, tools.highlighterOpacity - 0.05) })} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Minus size={20} /></button>
            <div className="relative flex h-8 flex-1 items-center">
              <div
                className="relative h-3 w-full overflow-hidden rounded-full border border-slate-300 shadow-inner"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                }}
              >
                <div className="h-full w-full rounded-full transition-all" style={{ backgroundColor: tools.highlighterColor, opacity: tools.highlighterOpacity }} />
                <input
                  aria-label="Opacité du surligneur"
                  type="range" min="0.1" max="1" step="0.05"
                  value={tools.highlighterOpacity}
                  onChange={event => setToolState({ highlighterOpacity: parseFloat(event.target.value) })}
                  className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
                />
              </div>
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-0.5 text-xs font-bold text-slate-800">
                {Math.round(tools.highlighterOpacity * 100)}
              </span>
            </div>
            <button type="button" aria-label="Plus opaque" onClick={() => setToolState({ highlighterOpacity: Math.min(1, tools.highlighterOpacity + 0.05) })} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Plus size={20} /></button>
          </div>

          <Toggle label="Tracer des lignes droites" checked={tools.highlighterStraightLines} onChange={() => setToolState({ highlighterStraightLines: !tools.highlighterStraightLines })} />

          <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 pt-3">
            {HIGHLIGHTER_COLORS.map(candidate => (
              <button
                key={candidate}
                type="button"
                aria-label={`Couleur ${candidate}`}
                onClick={() => setToolState({ highlighterColor: candidate })}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform ${tools.highlighterColor === candidate ? 'scale-110 shadow-md ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-110'}`}
                style={{ backgroundColor: candidate }}
              >
                {tools.highlighterColor === candidate && <Check size={17} className="text-slate-800 drop-shadow-sm" />}
              </button>
            ))}
            <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-500" title="Couleur personnalisée">
              <input type="color" value={tools.highlighterColor} onChange={event => setToolState({ highlighterColor: event.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
          </div>
        </div>
      ))}

      {openMenu === 'eraser' && panel('Gomme', (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 px-1">
            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-slate-400 bg-white" />
            <input
              aria-label="Taille de la gomme"
              type="range" min="10" max="80" step="1"
              value={tools.eraserWidth}
              onChange={event => setToolState({ eraserWidth: parseFloat(event.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-600"
            />
            <span className="h-8 w-8 shrink-0 rounded-full border-2 border-slate-500 bg-white" />
          </div>

          <div className="flex gap-2 rounded-xl bg-slate-200/60 p-1">
            {([
              { value: 'stroke' as const, label: 'Trait entier' },
              { value: 'pixel' as const, label: 'Précise' },
            ]).map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setToolState({ eraserType: option.value })}
                className={`min-h-11 flex-1 rounded-lg px-3 text-[13px] font-semibold transition ${tools.eraserType === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Toggle label="Taille selon la pression" checked={tools.eraserAutoSize} onChange={() => setToolState({ eraserAutoSize: !tools.eraserAutoSize })} />
          <Toggle label="Seulement le surligneur" checked={tools.eraserHighlighterOnly} onChange={() => setToolState({ eraserHighlighterOnly: !tools.eraserHighlighterOnly })} />
        </div>
      ))}

      {openMenu === 'shape' && panel('Formes', (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-4">
            {ESSENTIAL_SHAPES.map(shape => {
              const selected = tools.shapeType === shape.value;
              return (
                <button
                  key={shape.value}
                  type="button"
                  onClick={() => setToolState({ shapeType: shape.value, tool: 'shape' })}
                  className={`grid h-14 w-14 place-items-center rounded-full text-slate-900 transition-all active:scale-95 ${selected ? 'scale-105 bg-[#19788c] text-white shadow-[0_7px_20px_rgba(25,120,140,0.3)]' : 'bg-slate-50 hover:bg-white hover:shadow-sm'}`}
                  title={shape.label}
                  aria-label={shape.label}
                  aria-pressed={selected}
                >
                  <ShapeGlyph type={shape.value} size={30} strokeWidth={2.2} />
                </button>
              );
            })}
          </div>
          <Toggle label="Alignement avec d'autres formes" checked={tools.alignWithShapes} onChange={() => setToolState({ alignWithShapes: !tools.alignWithShapes })} />
          <Toggle label="Formes régulières (carré, cercle)" checked={tools.regularShapes} onChange={() => setToolState({ regularShapes: !tools.regularShapes })} />
          <Toggle label="Afficher les mesures" checked={tools.showMeasurements} onChange={() => setToolState({ showMeasurements: !tools.showMeasurements })} />
        </div>
      ))}

      {openMenu === 'lasso' && panel('Mode de sélection', (
        <div className="flex flex-col gap-3">
          {([
            { value: 'lasso' as const, label: 'Lasso', icon: <Lasso size={22} /> },
            { value: 'rectangle' as const, label: 'Rectangle', icon: <span className="block h-5 w-5 rounded-[3px] border-2 border-dashed border-slate-800" /> },
          ]).map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setToolState({ selectionMode: option.value, tool: 'lasso' })}
              className="flex min-h-[52px] items-center gap-4 rounded-xl px-3 text-left transition hover:bg-slate-100"
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${tools.selectionMode === option.value ? 'border-blue-600 bg-blue-600' : 'border-slate-400'}`}>
                {tools.selectionMode === option.value && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">{option.icon}{option.label}</span>
            </button>
          ))}
          <Toggle
            label="Inclure les objets partiellement sélectionnés"
            checked={tools.includePartialSelection}
            onChange={() => setToolState({ includePartialSelection: !tools.includePartialSelection })}
          />
          <button
            type="button"
            disabled={!canvas.hasSelection}
            onClick={() => withActiveCanvas(handle => handle.duplicateSelection())}
            className="min-h-12 rounded-xl bg-[#19788c] px-3 text-[13px] font-bold text-white transition active:scale-[0.99] disabled:opacity-30 hover:bg-[#11677a] shadow-[0_5px_15px_rgba(25,120,140,0.25)]"
          >
            Dupliquer la sélection
          </button>
        </div>
      ))}

      {openMenu === 'more' && panel('Option', (
        <div className="flex flex-col gap-2.5">
          <section aria-label="Actions de la fiche" className="rounded-xl border border-slate-200/90 bg-white p-2">
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Fiche</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  closeToolMenu();
                  onToggleEditMode();
                }}
                aria-pressed={isEditMode}
                className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 text-[11px] font-bold transition active:scale-[0.97] ${
                  isEditMode
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <Pencil size={18} strokeWidth={1.9} />
                <span>Édition</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  closeToolMenu();
                  onOpenSettings();
                }}
                className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 active:scale-[0.97]"
              >
                <Settings2 size={18} strokeWidth={1.9} />
                <span>Configuration</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  closeToolMenu();
                  onPrint();
                }}
                className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-900 px-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800 active:scale-[0.97]"
              >
                <Printer size={18} strokeWidth={1.9} />
                <span>Imprimer</span>
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              closeToolMenu();
              withActiveCanvas(handle => handle.importImage());
            }}
            className="flex min-h-[50px] w-full items-center justify-between rounded-xl border border-slate-200/90 bg-white px-4 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <ImageIcon size={20} className="text-emerald-600" />
              <span>Insérer une image</span>
            </div>
            <Plus size={18} className="text-slate-400" />
          </button>

          <Toggle label="Rejet de paume (anti-affleurement)" checked={tools.palmRejection} onChange={() => setToolState({ palmRejection: !tools.palmRejection })} />

          <Section
            title="Fond du canvas"
            summary={canvas.canChangeBackground
              ? `${canvas.styleName || 'style'} · ${canvas.colorName || 'couleur auto'}`
              : 'zone active non modifiable'}
            icon={<Palette size={17} />}
            open={expandedSection === 'background'}
            onToggle={() => setExpandedSection(value => value === 'background' ? null : 'background')}
          >
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUND_STYLES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyBackgroundStyle(item.id)}
                  className={`min-h-11 rounded-lg border px-2 text-xs font-semibold transition ${canvas.styleName === item.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-2">
              {BACKGROUND_COLORS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Fond ${item.name}`}
                  title={item.name}
                  onClick={() => applyBackgroundColor(item.id)}
                  className={`h-11 rounded-lg border transition ${canvas.colorName === item.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                  style={{ backgroundColor: item.color, borderColor: item.id === 'white' ? '#cbd5e1' : item.color }}
                />
              ))}
            </div>
            <div className="mt-2.5">
              <Toggle
                label="Appliquer à toutes les zones"
                checked={tools.applyBackgroundToAll}
                onChange={() => setToolState({ applyBackgroundToAll: !tools.applyBackgroundToAll })}
              />
            </div>
          </Section>

          <Section
            title="Encre Interactive Maths"
            summary={`${tools.pressureCurve === 'balanced' ? 'Équilibrée' : tools.pressureCurve === 'soft' ? 'Souple' : 'Ferme'} · stabilisation ${Math.round(tools.penStabilization * 100)}%`}
            icon={<Pen size={17} />}
            open={expandedSection === 'ink'}
            onToggle={() => setExpandedSection(value => value === 'ink' ? null : 'ink')}
          >
            <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <span>Pression</span>
              <select
                value={tools.pressureCurve}
                onChange={event => setToolState({ pressureCurve: event.target.value as PressureCurve })}
                className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
              >
                <option value="soft">Souple</option>
                <option value="balanced">Équilibrée</option>
                <option value="firm">Ferme</option>
              </select>
            </label>
            <label className="mt-2.5 block text-xs font-semibold text-slate-600">
              <span className="mb-1 flex justify-between"><span>Stabilisation</span><span>{Math.round(tools.penStabilization * 100)}%</span></span>
              <input
                type="range" min="0" max="1" step="0.05"
                value={tools.penStabilization}
                onChange={event => setToolState({ penStabilization: Number(event.target.value) })}
                className="w-full accent-blue-600"
              />
            </label>
          </Section>

          <Section
            title="Aides géométriques"
            summary={`${tools.snapGrid ? 'grille · ' : ''}${tools.angleSnap ? `angles ${tools.angleStep}° · ` : ''}${tools.regularShapes ? 'formes régulières' : 'options de tracé'}`}
            icon={<Ruler size={17} />}
            open={expandedSection === 'geometry'}
            onToggle={() => setExpandedSection(value => value === 'geometry' ? null : 'geometry')}
          >
            <div className="space-y-1">
              {[
                { label: 'Aimantation grille', checked: tools.snapGrid, action: () => setToolState({ snapGrid: !tools.snapGrid }) },
                { label: 'Angles contraints', checked: tools.angleSnap, action: () => setToolState({ angleSnap: !tools.angleSnap }) },
                { label: 'Formes régulières', checked: tools.regularShapes, action: () => setToolState({ regularShapes: !tools.regularShapes }) },
                { label: 'Afficher les mesures', checked: tools.showMeasurements, action: () => setToolState({ showMeasurements: !tools.showMeasurements }) },
              ].map(item => (
                <button key={item.label} type="button" onClick={item.action} className="flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <span>{item.label}</span>
                  <Check size={16} className={item.checked ? 'text-blue-600' : 'opacity-20'} />
                </button>
              ))}
            </div>
            {tools.angleSnap && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([15, 30, 45] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setToolState({ angleStep: value })}
                    className={`min-h-11 rounded-lg px-2 text-xs font-bold ${tools.angleStep === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {value}°
                  </button>
                ))}
              </div>
            )}
          </Section>

        </div>
      ))}
    </div>
  );
};

export default CanvasFloatingToolbar;
