import React, { useState, useRef, useEffect } from 'react';
import MathText from './MathText';

interface EditableMathTextProps {
  text: string;
  isEditMode: boolean;
  onChange: (newText: string) => void;
  className?: string;
}

const EditableMathTextImpl: React.FC<EditableMathTextProps> = ({ text, isEditMode, onChange, className = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentText, setCurrentText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (isEditMode) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (currentText !== text) {
      onChange(currentText);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const makeSelectionFillBlank = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentText.slice(start, end);
    if (!selected) return;
    const wrapped = `\\fillblank{${selected}}`;
    const next = currentText.slice(0, start) + wrapped + currentText.slice(end);
    setCurrentText(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + wrapped.length);
    });
  };

  if (isEditing) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={makeSelectionFillBlank}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          title="Sélectionnez un mot, un texte ou une formule dans l'éditeur"
        >
          Transformer la sélection en blanc
        </button>
        <textarea
          ref={textareaRef}
          value={currentText}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full bg-yellow-50 border border-yellow-400 p-2 rounded-md font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 ${className}`}
          style={{ minHeight: '60px', overflow: 'hidden' }}
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`${isEditMode ? 'hover:bg-yellow-50/50 hover:outline-dashed hover:outline-2 hover:outline-yellow-400 cursor-text transition-colors' : ''} ${className}`}
      title={isEditMode ? "Double-cliquez pour modifier" : undefined}
    >
      <MathText text={text} revealFillBlanks={isEditMode} />
    </div>
  );
};

// Évite de re-parser le LaTeX via MathJax à chaque rendu parent quand rien n'a changé.
const EditableMathText = React.memo(EditableMathTextImpl);

export default EditableMathText;
