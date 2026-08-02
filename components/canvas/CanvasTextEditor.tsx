import React from 'react';

export interface CanvasTextDraft {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  editingIndex?: number;
}

interface CanvasTextEditorProps {
  draft: CanvasTextDraft;
  color: string;
  isEditMode: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const CanvasTextEditor: React.FC<CanvasTextEditorProps> = ({
  draft,
  color,
  isEditMode,
  textAreaRef,
  onChange,
  onCommit,
  onCancel,
}) => {
  const makeSelectionFillBlank = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.text.slice(start, end);
    if (!selected) return;
    const wrapped = `\\fillblank{${selected}}`;
    onChange(draft.text.slice(0, start) + wrapped + draft.text.slice(end));
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + wrapped.length);
    });
  };

  return (
    <>
      {isEditMode && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={makeSelectionFillBlank}
          className="absolute z-[61] min-h-9 rounded-full bg-slate-800 px-3 text-xs font-semibold text-white shadow-lg active:scale-95"
          style={{ left: draft.x, top: Math.max(2, draft.y - 40) }}
          title="Sélectionnez un mot, un texte ou une formule"
        >
          Blanc stratégique
        </button>
      )}
      <textarea
        ref={textAreaRef}
        autoFocus
        aria-label="Zone de texte du canvas"
        placeholder="Saisir du texte…"
        className="absolute z-[60] pointer-events-auto bg-white/95 border-dashed border-2 border-blue-500 rounded-md px-2 py-1 outline-none resize-none overflow-hidden shadow-lg placeholder:text-slate-400"
        style={{
          left: draft.x,
          top: draft.y,
          width: '220px',
          minWidth: '120px',
          minHeight: '52px',
          color,
          fontFamily: 'Caveat',
          fontSize: '24px',
          lineHeight: '1.2',
        }}
        value={draft.text}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.target.style.height = 'auto';
          event.target.style.height = `${event.target.scrollHeight}px`;
          event.target.style.width = 'auto';
          event.target.style.width = `${Math.max(50, event.target.scrollWidth)}px`;
          onChange(event.target.value);
        }}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </>
  );
};

export default React.memo(CanvasTextEditor);
