import React, { createContext, useContext, useMemo, useState } from 'react';
import { BeamerPresentationProvider, getBeamerMaxStep } from './BeamerPresentation';

interface QuestionBeamerScopeProps {
  content: unknown;
  children: React.ReactNode;
}

export interface QuestionProgressValue {
  step: number;
  maxStep: number;
  reset: () => void;
  previous: () => void;
  next: () => void;
}

const QuestionProgressContext = createContext<QuestionProgressValue | null>(null);
export const useQuestionProgress = () => useContext(QuestionProgressContext);

/** Navigation Beamer locale : aucune étape ne fuit vers une autre question. */
const QuestionBeamerScope: React.FC<QuestionBeamerScopeProps> = ({ content, children }) => {
  const maxStep = useMemo(() => {
    const beamerSteps = getBeamerMaxStep(content);
    const guidance = (content as { guidance?: { instruction?: string; recall?: string; hints?: string[]; answer?: string } } | null)?.guidance;
    const guidanceSteps = guidance
      ? [guidance.instruction, guidance.recall, ...(guidance.hints || []), guidance.answer].filter(Boolean).length
      : 1;
    return Math.max(beamerSteps, guidanceSteps);
  }, [content]);
  const [step, setStep] = useState(1);
  const currentStep = Math.min(step, maxStep);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault();
      setStep(value => Math.min(maxStep, value + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setStep(value => Math.max(1, value - 1));
    }
  };

  return (
    <QuestionProgressContext.Provider value={{
      step: currentStep,
      maxStep,
      reset: () => setStep(1),
      previous: () => setStep(value => Math.max(1, value - 1)),
      next: () => setStep(value => Math.min(maxStep, value + 1)),
    }}>
      <BeamerPresentationProvider step={currentStep}>
      <div className="question-beamer-scope relative outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
        {children}
      </div>
      </BeamerPresentationProvider>
    </QuestionProgressContext.Provider>
  );
};

export default QuestionBeamerScope;
