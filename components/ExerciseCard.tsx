import React, { useState } from 'react';
import type { Exercise, QuestionPart, ImageConfig } from '../types';
import MathText from './MathText';
import EditableMathText from './EditableMathText';
import AnswerSpace from './AnswerSpace';
import ImageModal from './ImageModal';
import { Image as ImageIcon } from 'lucide-react';
import QuestionBeamerScope from './QuestionBeamerScope';

interface ExerciseCardProps {
  exercise: Exercise;
  exerciseNumber: number;
  showCanvas?: boolean;
  showSolutions?: boolean;
  answerSpaceMinHeight?: number;
  answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  presentationMode?: boolean;
  oneQuestionPerPage?: boolean;
  isEditMode?: boolean;
  onQuestionUpdate: (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => void;
  onExerciseUpdate: (exerciseId: string, newProps: Partial<Exercise>) => void;
}

const getNumbering = (index: number, level: number): string => {
  switch (level) {
    case 0:
      return `${index + 1}.`;
    case 1:
      return `${String.fromCharCode(97 + index)}.`;
    default:
      return '-';
  }
};

interface QuestionListProps {
  questions: QuestionPart[];
  level: number;
  showCanvas?: boolean;
  showSolutions?: boolean;
  answerSpaceMinHeight?: number;
  answerSpaceStyle?: 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
  answerSpaceColor?: 'black' | 'green' | 'blue' | 'white' | 'cream';
  presentationMode?: boolean;
  oneQuestionPerPage?: boolean;
  isEditMode?: boolean;
  onQuestionUpdate: (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => void;
  exerciseId: string;
  path: (string | number)[];
}

const QuestionList: React.FC<QuestionListProps> = ({ questions, level = 0, showCanvas = true, showSolutions, answerSpaceMinHeight, answerSpaceStyle, answerSpaceColor, presentationMode, oneQuestionPerPage, isEditMode, onQuestionUpdate, exerciseId, path }) => {
  const [activeImageModal, setActiveImageModal] = useState<number | null>(null);

  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div 
      className={`question-list ${level > 0 ? 'question-list-sub' : 'question-list-main'}`}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: level > 0 ? '0.75rem' : '1.5rem',
        paddingLeft: level > 0 ? '0.75rem' : '0',
      }}
    >
      {questions.map((q, index) => {
        const currentPath = [...path, index];
        const hasSubquestions = q.subquestions && q.subquestions.length > 0;
        const isPresentationSlide = presentationMode && level === 0 && hasSubquestions;
        const shouldBreakBefore = (oneQuestionPerPage && level === 0 && index > 0) || (isPresentationSlide && index > 0);

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
                bg-blue-50/40 rounded-xl p-3 sm:p-4 border border-blue-100/50 
                print:bg-transparent print:border-transparent print:p-0
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
                gridTemplateColumns: 'min-content 1fr',
                gap: '0.75rem',
                alignItems: 'baseline',
              }}
            >
              {/* Badge */}
              <span 
                className={`question-number-badge ${isPresentationSlide ? '' : `question-badge-level-${level}`} ${isPresentationSlide ? 'print:!mx-auto print:!mb-6 print:!text-[2rem] print:!bg-gray-100 print:!rounded-full print:!p-4 print:!w-[4rem] print:!h-[4rem] print:!flex print:!items-center print:!justify-center' : ''}`}
                style={isPresentationSlide ? {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"Space Grotesk", sans-serif',
                  lineHeight: 1,
                  fontSize: '2rem',
                  color: '#1e293b',
                  fontWeight: 700,
                  marginBottom: '1.5rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '9999px',
                  width: '4rem',
                  height: '4rem',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact' as any,
                } : {
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  justifyContent: 'flex-end',
                  fontFamily: '"Space Grotesk", sans-serif',
                  lineHeight: 1.2,
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact' as any,
                  ...(level === 0
                    ? {
                        fontSize: '1.1rem',
                        color: '#1e293b',
                        fontWeight: 600,
                        minWidth: '1.5rem',
                        marginTop: 0
                      }
                    : {
                        fontSize: '1rem',
                        color: '#475569',
                        fontWeight: 500,
                        minWidth: '1.5rem',
                        marginTop: 0
                      }
                  ),
                }}
              >
                {getNumbering(index, level)}
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
                  className={`question-text-wrapper text-slate-800 print:text-black leading-relaxed font-beamer ${isPresentationSlide ? 'text-[1.5rem] print:!text-[24pt] text-center print:!leading-relaxed' : 'text-[1.05rem] print:!text-[11pt] pr-8'}`} 
                  style={{ margin: 0, padding: 0 }}
                >
                  <EditableMathText 
                    text={q.text} 
                    isEditMode={!!isEditMode}
                    onChange={(newText) => onQuestionUpdate(exerciseId, currentPath, { text: newText })}
                  />
                </div>
                
                {/* Bouton d'ajout d'image (visible au survol) */}
                <button
                  onClick={() => setActiveImageModal(index)}
                  className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover/question:opacity-100 transition-opacity no-print"
                  title="Ajouter/Modifier une image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Rendu de l'image de la question (positionnée au-dessous de la question) */}
            {q.image && q.image.src && (
              <div className={`mt-3 mb-2 flex ${
                isPresentationSlide ? 'justify-center my-8' :
                q.image.placement === 'center' ? 'justify-center' : 
                q.image.placement === 'right' ? 'justify-end' : 'justify-start'
              }`}>
                <div className="flex flex-col items-center gap-1">
                  <img 
                    src={q.image.src} 
                    alt={q.image.caption || "Image de la question"} 
                    style={{ 
                      width: q.image.width ? `${q.image.width}px` : 'auto',
                      height: q.image.height ? `${q.image.height}px` : 'auto',
                      maxWidth: '100%',
                      objectFit: 'contain'
                    }}
                    className={`print:max-w-full ${isPresentationSlide ? 'max-h-[40vh]' : ''}`}
                  />
                  {q.image.caption && (
                    <span className={`text-slate-600 font-medium italic print:text-black mt-1 ${isPresentationSlide ? 'text-lg mt-4' : 'text-xs'}`}>
                      {q.image.caption}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Page break after presentation slide */}
            {isPresentationSlide && (
              <div className="print:break-after-page print:mb-10 w-full border-b border-dashed border-slate-300 my-8 no-print text-center text-slate-400 text-sm py-2">
                --- Saut de page (Mode Diaporama) ---
              </div>
            )}

            {hasSubquestions ? (
              <div className={`subquestions-container ${isPresentationSlide ? 'print:!mt-10' : ''}`} style={{ marginTop: '0.75rem' }}>
                <QuestionList 
                  questions={q.subquestions} 
                  level={level + 1} 
                  showCanvas={showCanvas}
                  showSolutions={showSolutions}
                  answerSpaceMinHeight={answerSpaceMinHeight}
                  answerSpaceStyle={answerSpaceStyle}
                  answerSpaceColor={answerSpaceColor}
                  presentationMode={presentationMode}
                  oneQuestionPerPage={oneQuestionPerPage}
                  onQuestionUpdate={onQuestionUpdate}
                  exerciseId={exerciseId}
                  path={[...currentPath, 'subquestions']}
                  isEditMode={isEditMode}
                />
              </div>
            ) : showCanvas ? (
               <AnswerSpace 
                 height={q.answerHeight || answerSpaceMinHeight}
                 styleName={q.answerStyle || answerSpaceStyle}
                 colorName={q.answerColor || answerSpaceColor}
                 onHeightChange={(newHeight) => onQuestionUpdate(exerciseId, currentPath, { answerHeight: newHeight })}
                 onStyleChange={(newStyle) => onQuestionUpdate(exerciseId, currentPath, { answerStyle: newStyle })}
                 onColorChange={(newColor) => onQuestionUpdate(exerciseId, currentPath, { answerColor: newColor || undefined })}
                 onAddImage={() => setActiveImageModal(index)}
                 strokes={q.strokes}
                 onStrokesChange={(newStrokes) => onQuestionUpdate(exerciseId, currentPath, { strokes: newStrokes })}
                 solution={q.solution}
                 answer={q.answer}
                 guidance={q.guidance}
                 showSolution={showSolutions}
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


const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, exerciseNumber, showCanvas = true, showSolutions, answerSpaceMinHeight, answerSpaceStyle, answerSpaceColor, presentationMode, oneQuestionPerPage, isEditMode, onQuestionUpdate, onExerciseUpdate }) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <div className={`exercise-card bg-white text-black p-4 sm:p-6 lg:p-10 landscape:px-4 landscape:py-5 sm:landscape:px-6 rounded-2xl shadow-sm mb-10 print:shadow-none print:rounded-none print:bg-transparent print:text-black print:p-0 print:mb-6 border border-slate-200 print:border-none relative group/exercise ${(oneQuestionPerPage && exerciseNumber > 1) ? 'print:break-before-page' : ''}`}>
      <h2 className="exercise-title text-xl font-bold font-display text-slate-900 print:text-black flex flex-col md:flex-row print:block items-start md:items-center gap-3 mb-8 print:mb-5 pt-2">
        <span 
          className="exercise-badge font-bold uppercase tracking-widest shadow-none print:mb-3 print:inline-block shrink-0"
          style={{
            backgroundColor: '#7dd3fc',
            color: '#000000',
            fontSize: '0.85rem',
            padding: '0.4rem 1rem',
            borderRadius: '0.4rem',
            border: '1px solid #0284c7',
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 600,
            letterSpacing: '0.1em',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact' as any,
            lineHeight: 1,
          }}
        >
          Exercice {exerciseNumber}
        </span>
        {(exercise.title || isEditMode) && (
          <div className="font-beamer font-normal text-[1.1rem]">
            <EditableMathText 
              text={exercise.title || ""}
              isEditMode={!!isEditMode}
              onChange={(newTitle) => onExerciseUpdate(exercise.id, { title: newTitle })}
              className={!exercise.title && isEditMode ? "min-w-[150px] text-slate-400 italic" : ""}
            />
          </div>
        )}
      </h2>
      
      {/* Bouton d'ajout d'image pour l'énoncé (visible au survol) */}
      <button
        onClick={() => setIsImageModalOpen(true)}
        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover/exercise:opacity-100 transition-opacity no-print"
        title="Ajouter/Modifier une image pour l'énoncé"
      >
        <ImageIcon className="w-5 h-5" />
      </button>

      {exercise.statement && (
        <div className="exercise-statement prose prose-lg max-w-none text-slate-800 print:text-black mb-8 pl-1 font-beamer text-[1.1rem] print:!text-[11.5pt]">
            <div className="text-slate-800 print:text-black leading-relaxed">
              <EditableMathText 
                text={exercise.statement} 
                isEditMode={!!isEditMode}
                onChange={(newStatement) => onExerciseUpdate(exercise.id, { statement: newStatement })}
              />
            </div>
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
            onAddImage={() => setIsImageModalOpen(true)}
            strokes={exercise.statementStrokes}
            onStrokesChange={(newStrokes) => onExerciseUpdate(exercise.id, { statementStrokes: newStrokes })}
            solution={exercise.solution}
            answer={exercise.answer}
            guidance={exercise.guidance}
            showSolution={showSolutions}
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
            showSolutions={showSolutions}
            answerSpaceMinHeight={answerSpaceMinHeight}
            answerSpaceStyle={answerSpaceStyle}
            answerSpaceColor={answerSpaceColor}
            presentationMode={presentationMode}
            oneQuestionPerPage={oneQuestionPerPage}
            onQuestionUpdate={onQuestionUpdate}
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
