import React, { useState } from 'react';
import type { Exercise, QuestionPart, ImageConfig } from '../types';
import EditableMathText from './EditableMathText';
import AnswerSpace from './AnswerSpace';
import ImageModal from './ImageModal';
import { Image as ImageIcon } from 'lucide-react';
import QuestionBeamerScope from './QuestionBeamerScope';
import { computeQuestionLayout, joinAroundFigure } from '../utils/questionLayout';
import { formatPartieTitle } from '../utils/worksheetUtils';

interface ExerciseCardProps {
  exercise: Exercise;
  exerciseNumber: number;
  totalExercisesCount?: number;
  hideExerciseBadge?: boolean;
  showCanvas?: boolean;
  answerSpaceMinHeight?: number;
  answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  presentationMode?: boolean;
  oneQuestionPerPage?: boolean;
  isEditMode?: boolean;
  onQuestionUpdate: (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => void;
  onExerciseUpdate: (exerciseId: string, newProps: Partial<Exercise>) => void;
  onExerciseMergeUp?: (exerciseId: string) => void;
  onQuestionMergeUp?: (exerciseId: string, questionPath: (string | number)[]) => void;
}

/**
 * Numéro en pastille. La hauteur de la pastille vaut exactement celle de la
 * première ligne d'énoncé : combinée à `align-items: start`, elle se centre
 * sur cette ligne sans jamais dériver vers le bas du bloc.
 *
 * Hiérarchie visuelle : pastille pleine au niveau 0, pastille douce au niveau
 * 1, simple étiquette au-delà — une seule famille de gris ardoise.
 */
const badgeStyle = (level: number): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    fontFamily: "var(--worksheet-text-font, 'Plus Jakarta Sans', sans-serif)",
    lineHeight: '1.625',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    padding: '0 0.15rem 0 0',
    margin: 0,
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact' as any,
  };

  if (level <= 0) {
    return {
      ...base,
      fontSize: '1.05em',
      fontWeight: 700,
      color: '#0f172a',
    };
  }

  if (level === 1) {
    return {
      ...base,
      fontSize: '1.05em',
      fontWeight: 700,
      color: '#0369a1',
    };
  }

  return {
    ...base,
    fontSize: '1.05em',
    fontWeight: 700,
    color: '#334155',
  };
};

const slideBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'Fredoka, Quicksand, sans-serif',
  lineHeight: 1,
  fontSize: '2em',
  color: '#19788c',
  fontWeight: 700,
  marginBottom: '1.5rem',
  backgroundColor: '#dceceb',
  borderRadius: '9999px',
  width: '4rem',
  height: '4rem',
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact' as any,
};

/** Figure d'une question, ancrée dans le texte ou placée sous l'énoncé. */
const QuestionFigure: React.FC<{ image: ImageConfig; isSlide?: boolean; inline?: boolean }> = ({ image, isSlide, inline }) => (
  <div
    className={`question-figure ${inline ? 'my-4' : 'mt-3 mb-2'} flex ${
      isSlide ? 'justify-center my-8' :
      image.placement === 'center' ? 'justify-center' :
      image.placement === 'right' ? 'justify-end' : 'justify-start'
    }`}
  >
    <div className="flex flex-col items-center gap-1">
      <img
        src={image.src}
        alt={image.caption || "Image de la question"}
        style={{
          width: image.width ? `${image.width}px` : 'auto',
          height: image.height ? `${image.height}px` : 'auto',
          maxWidth: '100%',
          objectFit: 'contain'
        }}
        className={`print:max-w-full ${isSlide ? 'max-h-[40vh]' : ''}`}
      />
      {image.caption && (
        <span className={`text-slate-600 font-medium italic print:text-black mt-1 ${isSlide ? 'text-lg mt-4' : 'text-xs'}`}>
          {image.caption}
        </span>
      )}
    </div>
  </div>
);

interface QuestionListProps {
  questions: QuestionPart[];
  level: number;
  showCanvas?: boolean;
  answerSpaceMinHeight?: number;
  answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  presentationMode?: boolean;
  oneQuestionPerPage?: boolean;
  isEditMode?: boolean;
  onQuestionUpdate: (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => void;
  onQuestionMergeUp?: (exerciseId: string, questionPath: (string | number)[]) => void;
  exerciseId: string;
  path: (string | number)[];
  /**
   * Numéro chapeau du parent : il est inséré dans la première ligne de cette
   * liste, à l'intérieur du même bloc que la sous-question, comme dans un sujet
   * imprimé (« 1.  a. Calculer … »).
   */
  leadLabel?: string;
  leadLevel?: number;
}

const QuestionList: React.FC<QuestionListProps> = ({ questions, level = 0, showCanvas = true, answerSpaceMinHeight, answerSpaceStyle, answerSpaceColor, presentationMode, oneQuestionPerPage, isEditMode, onQuestionUpdate, onQuestionMergeUp, exerciseId, path, leadLabel, leadLevel = 0 }) => {
  const [activeImageModal, setActiveImageModal] = useState<number | null>(null);

  if (!questions || questions.length === 0) {
    return null;
  }

  const hasLead = Boolean(leadLabel);

  return (
    <div
      className={`question-list ${level > 0 ? 'question-list-sub' : 'question-list-main'} ${hasLead ? 'question-list-lead' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: level > 0 ? '0.75rem' : '1.5rem',
        paddingLeft: level > 0 && !hasLead ? '0.75rem' : '0',
      }}
    >
      {questions.map((q, index) => {
        const currentPath = [...path, index];
        const layout = computeQuestionLayout(q, { level, index, presentationMode, showCanvas });
        const { subquestions, hasSubquestions, collapsed, isSlide: isPresentationSlide, figure } = layout;
        const shouldBreakBefore = (oneQuestionPerPage && level === 0 && index > 0) || (isPresentationSlide && index > 0);

        const subquestionList = (
          <QuestionList
            questions={subquestions}
            level={level + 1}
            showCanvas={showCanvas}
            answerSpaceMinHeight={answerSpaceMinHeight}
            answerSpaceStyle={answerSpaceStyle}
            answerSpaceColor={answerSpaceColor}
            presentationMode={presentationMode}
            oneQuestionPerPage={oneQuestionPerPage}
            onQuestionUpdate={onQuestionUpdate}
            onQuestionMergeUp={onQuestionMergeUp}
            exerciseId={exerciseId}
            path={[...currentPath, 'subquestions']}
            isEditMode={isEditMode}
            leadLabel={collapsed ? layout.label : undefined}
            leadLevel={level}
          />
        );

        /*
            NUMÉRO CHAPEAU
            Une question sans énoncé propre ne consomme aucune ligne : son
            numéro descend dans la première sous-question, à l'intérieur du même
            bloc (« 1.  a. Calculer ... »).
        */
        if (collapsed) {
          return (
            <QuestionBeamerScope key={index} content={{ text: q.text, answer: q.answer, solution: q.solution, guidance: q.guidance }}>
              <div className={`question-block question-block-collapsed relative ${shouldBreakBefore ? 'print:break-before-page print:mt-10' : ''}`}>
                {subquestionList}
              </div>
            </QuestionBeamerScope>
          );
        }

        return (
          <QuestionBeamerScope key={index} content={{ text: q.text, answer: q.answer, solution: q.solution, guidance: q.guidance }}>
          <div
            className={`question-block group/question relative ${shouldBreakBefore ? 'print:break-before-page print:mt-10' : ''}`}
          >
            {/*
                MÉCANISME D'ALIGNEMENT INTELLIGENT & PRÉSENTATION
            */}
            <div
              className={`
                ${isPresentationSlide ? '' : `question-row question-row-level-${level}`}
                py-1
                print:p-0
                ${isPresentationSlide ? 'print:flex print:flex-col print:justify-center print:items-center print:min-h-[70vh] print:text-center' : ''}
              `}
              style={isPresentationSlide ? {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '40vh',
                textAlign: 'center',
                padding: '2rem'
              } : {
                display: 'grid',
                gridTemplateColumns: hasLead ? 'min-content min-content 1fr' : 'min-content 1fr',
                gap: '0.45rem',
                alignItems: 'first baseline',
              }}
            >
              {/* Numéro chapeau du parent. Les lignes suivantes conservent la
                  pastille, masquée : la colonne garde ainsi exactement la même
                  largeur et les sous-questions restent alignées. */}
              {hasLead && !isPresentationSlide && (
                <span
                  className={`question-lead-badge question-badge-level-${leadLevel}`}
                  style={index === 0 ? badgeStyle(leadLevel) : { ...badgeStyle(leadLevel), visibility: 'hidden' }}
                  aria-hidden={index > 0}
                >
                  {leadLabel && (leadLabel.endsWith('.') ? leadLabel : `${leadLabel}.`)}
                </span>
              )}

              {/* Badge */}
              <span
                className={`question-number-badge ${isPresentationSlide ? '' : `question-badge-level-${level}`} ${isPresentationSlide ? 'print:!mx-auto print:!mb-6 print:!text-[2rem] print:!bg-gray-100 print:!rounded-full print:!p-4 print:!w-[4rem] print:!h-[4rem] print:!flex print:!items-center print:!justify-center' : ''}`}
                style={isPresentationSlide ? slideBadgeStyle : badgeStyle(level)}
              >
                {layout.label && (layout.label.endsWith('.') ? layout.label : `${layout.label}.`)}
              </span>

              {/* Contenu de la question */}
              <div
                className={`question-content relative ${isPresentationSlide ? 'w-full max-w-3xl' : ''}`}
                style={{
                  minWidth: 0,
                  margin: 0,
                  padding: 0,
                }}
              >
                <div
                  className={`question-text-wrapper text-[#263337] print:text-black leading-relaxed font-beamer ${isPresentationSlide ? 'text-[1.5em] print:!text-[1.5em] text-center print:!leading-relaxed' : 'text-[1.05em] print:!text-[1.05em] pr-8'}`}
                  style={{ margin: 0, padding: 0 }}
                >
                  {figure && q.image ? (
                    /* Figure ancrée : l'énoncé se poursuit sous l'illustration. */
                    <>
                      <EditableMathText
                        text={figure.before}
                        isEditMode={!!isEditMode}
                        onChange={(newText) => onQuestionUpdate(exerciseId, currentPath, { text: joinAroundFigure(figure, newText, figure.after) })}
                      />
                      <QuestionFigure image={q.image} isSlide={isPresentationSlide} inline />
                      <EditableMathText
                        text={figure.after}
                        isEditMode={!!isEditMode}
                        onChange={(newText) => onQuestionUpdate(exerciseId, currentPath, { text: joinAroundFigure(figure, figure.before, newText) })}
                      />
                    </>
                  ) : (
                    <EditableMathText
                      text={q.text || ""}
                      isEditMode={!!isEditMode}
                      onChange={(newText) => onQuestionUpdate(exerciseId, currentPath, { text: newText })}
                      onDeleteEmpty={() => onQuestionMergeUp && onQuestionMergeUp(exerciseId, currentPath)}
                    />
                  )}
                </div>

                {/* Bouton d'ajout d'image (visible au survol) */}
                {isEditMode && (
                  <button
                    onClick={() => setActiveImageModal(index)}
                    className="absolute top-0 right-0 rounded-lg p-1.5 text-[#8a9293] opacity-0 transition-opacity hover:bg-[#e7f0ef] hover:text-[#19788c] group-hover/question:opacity-100 no-print"
                    title="Image de la question — affichée au-dessus de la zone de réponse"
                    aria-label="Ajouter ou modifier l'image de la question hors canvas"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Figure non ancrée : rendue sous la question */}
            {q.image && q.image.src && !figure && (
              <QuestionFigure image={q.image} isSlide={isPresentationSlide} />
            )}

            {/* Page break after presentation slide */}
            {isPresentationSlide && (
              <div className="print:break-after-page print:mb-10 w-full border-b border-dashed border-slate-300 my-8 no-print text-center text-slate-400 text-sm py-2">
                --- Saut de page (Mode Diaporama) ---
              </div>
            )}

            {hasSubquestions ? (
              <div className={`subquestions-container ${isPresentationSlide ? 'print:!mt-10' : ''} mt-3`}>
                {subquestionList}
              </div>
            ) : showCanvas ? (
               <AnswerSpace
                 height={q.answerHeight || answerSpaceMinHeight}
                 styleName={q.answerStyle || answerSpaceStyle}
                 colorName={q.answerColor || answerSpaceColor}
                 onHeightChange={(newHeight) => onQuestionUpdate(exerciseId, currentPath, { answerHeight: newHeight })}
                 onStyleChange={(newStyle) => onQuestionUpdate(exerciseId, currentPath, { answerStyle: newStyle })}
                 onColorChange={(newColor) => onQuestionUpdate(exerciseId, currentPath, { answerColor: newColor || undefined })}
                 strokes={q.strokes}
                 onStrokesChange={(newStrokes) => onQuestionUpdate(exerciseId, currentPath, { strokes: newStrokes })}
                 solution={q.solution}
                 answer={q.answer}
                 guidance={q.guidance}
                 isEditMode={isEditMode}
                 onSolutionUpdate={(newSol) => onQuestionUpdate(exerciseId, currentPath, { solution: newSol })}
               />
            ) : null}

            <ImageModal
              isOpen={activeImageModal === index}
              onClose={() => setActiveImageModal(null)}
              initialImage={q.image}
              onSave={(imageConfig) => {
                onQuestionUpdate(exerciseId, currentPath, { image: imageConfig });
                setActiveImageModal(null);
              }}
            />
          </div>
          </QuestionBeamerScope>
        )
      })}
    </div>
  );
};


const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, exerciseNumber, totalExercisesCount, hideExerciseBadge, showCanvas = true, answerSpaceMinHeight, answerSpaceStyle, answerSpaceColor, presentationMode, oneQuestionPerPage, isEditMode, onQuestionUpdate, onExerciseUpdate, onQuestionMergeUp }) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Mécanisme intelligent : si la fiche ne contient qu'un seul exercice ou si le titre indique "Partie X", masquer le badge "Exercice 1"
  const isPartieTitle = Boolean(exercise.title && exercise.title.toLowerCase().includes('partie'));
  const shouldHideBadge = hideExerciseBadge || totalExercisesCount === 1 || exercise.hideBadge === true || isPartieTitle;

  return (
    <div className={`exercise-card bg-transparent text-black py-4 mb-8 print:shadow-none print:rounded-none print:bg-transparent print:text-black print:p-0 print:mb-6 border-none relative group/exercise ${(oneQuestionPerPage && exerciseNumber > 1) ? 'print:break-before-page' : ''}`}>
      {/* En-tête : Badge "Exercice X" affiché uniquement lorsqu'il y a plusieurs exercices et pas de "Partie X" */}
      {!shouldHideBadge && (
        <h2 className="exercise-title flex items-center mb-6 print:mb-4">
          <div className="relative inline-flex items-center justify-center bg-[linear-gradient(135deg,#e6e6e6_0%,#a0a0a0_100%)] px-5 py-2 rounded-[4px_8px_8px_4px] font-sans font-bold text-[0.85em] text-[#333] uppercase tracking-[1px] shadow-[4px_6px_10px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(0,0,0,0.2)] border border-[#999] [text-shadow:1px_1px_0px_rgba(255,255,255,0.6)] -ml-[calc(1.5rem+8px)] sm:-ml-[calc(3rem+8px)] md:-ml-[calc(4rem+8px)] print:-ml-0 print:border-none print:shadow-none print:bg-none print:text-black">
            Exercice {exerciseNumber}
            <div className="absolute top-[100%] left-0 w-2 h-3 bg-[linear-gradient(to_bottom,#777,transparent)] [clip-path:polygon(0_0,100%_0,100%_100%)] print:hidden" />
          </div>
        </h2>
      )}

      {(exercise.title || isEditMode) && (
        <div className={`exercise-part-title flex w-full items-center justify-center text-center ${isPartieTitle ? 'my-3 mb-5' : 'mb-6 print:mb-4'}`}>
          <div className={`flex-1 h-[1px] mr-2.5 ${isPartieTitle ? 'bg-gradient-to-r from-transparent via-[#bfae9c] to-[#bfae9c] max-w-[60px] sm:max-w-[130px]' : 'border-b border-[#cbd5e1] max-w-[80px] sm:max-w-[160px]'}`} />
          <div className={`print:text-black ${isPartieTitle ? "font-itim text-[1.15em] sm:text-[1.25em] font-medium text-[#423a31] px-3 tracking-wide" : "text-[1.15em] italic text-[#5c5953] tracking-[0.5px]"}`}>
            <EditableMathText
              text={exercise.title ? formatPartieTitle(exercise.title) : ""}
              isEditMode={!!isEditMode}
              onChange={(newTitle) => onExerciseUpdate && onExerciseUpdate(exercise.id, { title: newTitle })}
              className={!exercise.title && isEditMode ? "min-w-[150px] text-[#aaa29b]" : ""}
            />
          </div>
          <div className={`flex-1 h-[1px] ml-2.5 ${isPartieTitle ? 'bg-gradient-to-l from-transparent via-[#bfae9c] to-[#bfae9c] max-w-[60px] sm:max-w-[130px]' : 'border-b border-[#cbd5e1] max-w-[80px] sm:max-w-[160px]'}`} />
        </div>
      )}

      {/* Bouton d'ajout d'image pour l'énoncé (visible au survol) */}
      {isEditMode && (
        <button
          onClick={() => setIsImageModalOpen(true)}
          className="absolute top-6 right-6 rounded-lg p-2 text-[#8a9293] opacity-0 transition-opacity hover:bg-[#e7f0ef] hover:text-[#19788c] group-hover/exercise:opacity-100 no-print"
          title="Image de l'énoncé — affichée au-dessus de la zone de réponse"
          aria-label="Ajouter ou modifier l'image de l'énoncé hors canvas"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
      )}

      {exercise.statement && (
        <div className="exercise-statement text-[1.15em] sm:text-[1.2em] text-[#2b2b2b] mb-6 leading-[1.7] font-serif print:text-black print:text-[1.1em] text-left">
          <EditableMathText
            text={exercise.statement}
            isEditMode={!!isEditMode}
            onChange={(newStatement) => onExerciseUpdate(exercise.id, { statement: newStatement })}
          />
        </div>
      )}

      {/* Rendu de l'image de l'exercice (sous l'énoncé, hors du canva) */}
      {exercise.image && exercise.image.src && (
        <div className={`mt-3 mb-6 flex ${
          exercise.image.placement === 'center' ? 'justify-center' :
          exercise.image.placement === 'right' ? 'justify-end' : 'justify-start'
        }`}>
          <div className="flex flex-col items-center gap-1">
            <img
              src={exercise.image.src}
              alt={exercise.image.caption || "Image de l'exercice"}
              style={{
                width: exercise.image.width ? `${exercise.image.width}px` : 'auto',
                height: exercise.image.height ? `${exercise.image.height}px` : 'auto',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              className="print:max-w-full"
            />
            {exercise.image.caption && (
              <span className="text-xs text-slate-600 font-medium italic print:text-black mt-1">
                {exercise.image.caption}
              </span>
            )}
          </div>
        </div>
      )}

      {showCanvas && (exercise.statementAnswerHeight !== undefined || (exercise.questions && exercise.questions.length === 0)) && (
         <AnswerSpace
            height={exercise.statementAnswerHeight || answerSpaceMinHeight}
            styleName={exercise.statementAnswerStyle || answerSpaceStyle}
            colorName={exercise.statementAnswerColor || answerSpaceColor}
            onHeightChange={(newHeight) => onExerciseUpdate(exercise.id, { statementAnswerHeight: newHeight })}
            onStyleChange={(newStyle) => onExerciseUpdate(exercise.id, { statementAnswerStyle: newStyle })}
            onColorChange={(newColor) => onExerciseUpdate(exercise.id, { statementAnswerColor: newColor || undefined })}
            strokes={exercise.statementStrokes}
            onStrokesChange={(newStrokes) => onExerciseUpdate(exercise.id, { statementStrokes: newStrokes })}
            solution={exercise.solution}
            answer={exercise.answer}
            guidance={exercise.guidance}
            isEditMode={isEditMode}
            onSolutionUpdate={(newSol) => onExerciseUpdate(exercise.id, { solution: newSol })}
          />
      )}

      {exercise.questions && exercise.questions.length > 0 && (
        <div className="mt-8 exercise-questions-wrapper print:mt-6">
          <QuestionList
            questions={exercise.questions}
            level={0}
            showCanvas={showCanvas}
            answerSpaceMinHeight={answerSpaceMinHeight}
            answerSpaceStyle={answerSpaceStyle}
            answerSpaceColor={answerSpaceColor}
            presentationMode={presentationMode}
            oneQuestionPerPage={oneQuestionPerPage}
            onQuestionUpdate={onQuestionUpdate}
            onQuestionMergeUp={onQuestionMergeUp}
            exerciseId={exercise.id}
            path={['questions']}
            isEditMode={isEditMode}
          />
        </div>
      )}

      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        initialImage={exercise.image}
        onSave={(imageConfig) => {
          onExerciseUpdate(exercise.id, { image: imageConfig });
          setIsImageModalOpen(false);
        }}
      />
    </div>
  );
};

export default ExerciseCard;
