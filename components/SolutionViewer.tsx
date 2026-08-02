import React, { useState } from 'react';
import MathText from './MathText';
import type { PedagogicalGuidance } from '../types';
import { Edit2 } from 'lucide-react';

interface SolutionViewerProps {
  solution?: string;
  answer?: string;
  guidance?: PedagogicalGuidance;
  isDarkCanvas?: boolean;
  isEditMode?: boolean;
  onUpdate?: (newText: string) => void;
  progressStep?: number;
}

interface ParsedBlock {
  type: 'block' | 'alert' | 'example' | 'raw';
  title?: string;
  content: string;
}

/**
 * Parses LaTeX Beamer code like \begin{block}{Title}... \end{block}
 * and cleans overlay commands like \pause, \onslide<...>, etc.
 */
function parseBeamerContent(input: string): ParsedBlock[] {
  if (!input) return [];

  // Les commandes d'overlay ne sont plus supprimées ici : les fragments sont
  // transmis à MathText, qui les affiche selon l'étape Beamer courante.
  const clean = input;

  const blockRegex = /\\begin{(block|alertblock|exampleblock)}{(.*?)}([\s\S]*?)\\end{\1}/g;
  const blocks: ParsedBlock[] = [];
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      const rawPart = clean.substring(lastIndex, match.index).trim();
      if (rawPart) {
        blocks.push({ type: 'raw', content: rawPart });
      }
    }

    const envType = match[1]; // block | alertblock | exampleblock
    const title = match[2];
    const content = match[3].trim();

    let blockType: 'block' | 'alert' | 'example' = 'block';
    if (envType === 'alertblock') blockType = 'alert';
    if (envType === 'exampleblock') blockType = 'example';

    blocks.push({
      type: blockType,
      title,
      content,
    });

    lastIndex = blockRegex.lastIndex;
  }

  if (lastIndex < clean.length) {
    const remaining = clean.substring(lastIndex).trim();
    if (remaining) {
      blocks.push({ type: 'raw', content: remaining });
    }
  }

  return blocks;
}

/** Confie le contenu complet à MathText afin de préserver les overlays Beamer. */
function renderLatexContent(raw: string, textColorClass: string) {
  return (
    <div className={`canvas-help-text text-base sm:text-lg ${textColorClass}`}>
      <MathText text={raw} />
    </div>
  );
}

/** Liaison vectorielle souple entre les fragments successifs de l'aide. */
const GuidanceConnector: React.FC = () => (
  <span className="inline-flex h-5 w-11 shrink-0 self-baseline align-baseline text-indigo-400" aria-hidden="true">
    <svg viewBox="0 0 44 20" className="h-full w-full overflow-visible" fill="none">
      <path
        d="M2 12 C9 3 17 3 23 10 C28 16 34 14 40 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35.5 6.2 L40.5 6.8 L39.2 11.7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const SolutionViewer: React.FC<SolutionViewerProps> = ({
  solution,
  answer,
  guidance,
  isDarkCanvas = false,
  isEditMode = false,
  onUpdate,
  progressStep = 1,
}) => {
  const content = solution || answer || '';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const guidanceStages = React.useMemo(() => {
    const stages: Array<{ kind: 'instruction' | 'recall' | 'hint' | 'answer'; content: string }> = [];
    if (guidance?.instruction) stages.push({ kind: 'instruction', content: guidance.instruction });
    if (guidance?.recall) stages.push({ kind: 'recall', content: guidance.recall });
    (guidance?.hints || []).forEach((hint) => stages.push({ kind: 'hint', content: hint }));
    if (guidance?.answer) stages.push({ kind: 'answer', content: guidance.answer });
    return stages;
  }, [guidance]);

  React.useEffect(() => {
    if (!isEditing) setEditText(content);
  }, [content, isEditing]);

  if (!content && guidanceStages.length === 0 && !isEditMode) {
    return null;
  }

  const handleSave = () => {
    setIsEditing(false);
    if (onUpdate && editText !== content) {
      onUpdate(editText);
    }
  };

  // Natural handwritten ink color matching the canvas theme:
  // Light canvas (Seyes, Grid, White, Cream): Royal fountain pen blue / indigo ink
  // Dark canvas (Slate, Blackboard, Green): White/light-blue chalk with soft glow
  const textColorClass = isDarkCanvas
    ? 'text-sky-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
    : 'text-blue-900';

  if (guidanceStages.length > 0 && !isEditing) {
    const visibleStages = guidanceStages.slice(0, Math.max(1, progressStep));
    return (
      <div className="relative h-full w-full overflow-y-auto pr-1 pointer-events-auto canvas-guidance-scroll">
        <div className={`canvas-help-text flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-3 pt-1 text-base sm:text-lg ${textColorClass}`}>
          {visibleStages.map((stage, index) => {
            return (
              <span key={`${stage.kind}-${index}`} className="inline-flex max-w-full items-baseline gap-2 align-baseline animate-in fade-in duration-200">
                {index > 0 && <GuidanceConnector />}
                <span className="min-w-0">
                  <MathText text={stage.content} />
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="p-3 bg-yellow-50/95 border border-yellow-300 rounded-xl space-y-2 text-slate-800 pointer-events-auto shadow-md">
        <label className="text-xs font-bold text-yellow-800 uppercase tracking-wider flex items-center gap-1.5">
          <Edit2 className="w-3.5 h-3.5" /> Éditer la solution / corrigé (Code Beamer LaTeX)
        </label>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="w-full p-2.5 bg-white border border-yellow-400 rounded-lg font-mono text-xs text-slate-900 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-yellow-500"
          placeholder="\begin{block}{Corrigé}... \end{block}"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1 text-xs text-slate-600 bg-slate-200 rounded-md hover:bg-slate-300"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 font-medium"
          >
            Enregistrer
          </button>
        </div>
      </div>
    );
  }

  const parsedBlocks = parseBeamerContent(content);

  return (
    <div className="relative group/sol w-full h-full overflow-hidden bg-transparent border-none shadow-none">
      {/* Edit Trigger - Interactive */}
      {isEditMode && onUpdate && (
        <button
          onClick={() => {
            setEditText(content);
            setIsEditing(true);
          }}
          className="pointer-events-auto absolute top-1 right-1 p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg border border-slate-200 shadow-xs opacity-0 group-hover/sol:opacity-100 transition-opacity z-20"
          title="Modifier le corrigé"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Render parsed blocks or raw content completely boxless/frameless */}
      <div className="space-y-2">
        {parsedBlocks.length > 0 ? (
          parsedBlocks.map((blk, idx) => {
            if (blk.type === 'raw') {
              return <div key={idx}>{renderLatexContent(blk.content, textColorClass)}</div>;
            }

            return (
              <div key={idx}>
                {renderLatexContent(blk.content, textColorClass)}
              </div>
            );
          })
        ) : (
          <div className="text-slate-400 text-xs italic">Aucune solution rédigée.</div>
        )}
      </div>
    </div>
  );
};

export default SolutionViewer;
