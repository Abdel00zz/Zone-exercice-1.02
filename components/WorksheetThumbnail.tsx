import React from 'react';
import type { ImageConfig, QuestionPart, Worksheet } from '../types';
import MathText from './MathText';
import { formatNumbering } from '../utils/questionLayout';

interface WorksheetThumbnailProps {
  worksheet: Worksheet;
}

/**
 * Transforme les commandes d'animation Beamer en contenu statique. Une
 * miniature doit donner une vue d'ensemble de la fiche, pas seulement de la
 * première étape de sa présentation.
 */
function makePresentationTextStatic(value: string): string {
  let result = value.replace(/\\pause\b\s*/g, '');
  const command = /\\(?:onslide|only|uncover|visible|invisible|alert)\b/g;
  let match: RegExpExecArray | null;

  while ((match = command.exec(result)) !== null) {
    let cursor = match.index + match[0].length;
    while (/\s/.test(result[cursor] ?? '')) cursor++;

    if (result[cursor] === '<') {
      const overlayEnd = result.indexOf('>', cursor + 1);
      if (overlayEnd !== -1) cursor = overlayEnd + 1;
    }
    while (/\s/.test(result[cursor] ?? '')) cursor++;

    if (result[cursor] !== '{') {
      result = result.slice(0, match.index) + result.slice(cursor);
      command.lastIndex = match.index;
      continue;
    }

    let depth = 1;
    let closingBrace = cursor + 1;
    while (closingBrace < result.length && depth > 0) {
      if (result[closingBrace] === '{') depth++;
      if (result[closingBrace] === '}') depth--;
      closingBrace++;
    }

    if (depth !== 0) {
      result = result.slice(0, match.index) + result.slice(cursor);
      command.lastIndex = match.index;
      continue;
    }

    const inner = result.slice(cursor + 1, closingBrace - 1);
    result = result.slice(0, match.index) + inner + result.slice(closingBrace);
    command.lastIndex = match.index;
  }

  return result
    .replace(/\\item\s*<[^>]+>/g, '\\item')
    .replace(/(\\begin\{(?:itemize|enumerate)\})\s*\[\s*<[^>]+>\s*\]/g, '$1')
    .replace(/\\(?:figure|image|includegraphics)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, '')
    .replace(/\\begin\{block\}\{[^{}]*\}|\\end\{block\}/g, '');
}

const ThumbnailMath: React.FC<{ text?: string; className?: string }> = ({ text, className }) => (
  text ? <MathText text={makePresentationTextStatic(text)} className={className} /> : null
);

const ThumbnailImage: React.FC<{ image?: ImageConfig }> = ({ image }) => {
  if (!image?.src) return null;

  return (
    <figure
      className={`my-1 flex flex-col gap-0.5 ${
        image.placement === 'right' ? 'items-end' : image.placement === 'center' ? 'items-center' : 'items-start'
      }`}
    >
      <img
        src={image.src}
        alt=""
        aria-hidden="true"
        className="max-h-16 max-w-full object-contain"
        style={{
          width: image.width ? `${Math.min(image.width, 420)}px` : 'auto',
          height: image.height ? `${Math.min(image.height, 150)}px` : 'auto',
        }}
      />
      {image.caption && <figcaption className="text-[5px] italic text-[#555]">{image.caption}</figcaption>}
    </figure>
  );
};

const ThumbnailQuestion: React.FC<{
  question: QuestionPart;
  index: number;
  level?: number;
}> = ({ question, index, level = 0 }) => {
  const number = formatNumbering(index, level);
  const label = `${number}.`;

  return (
    <li className={`relative grid grid-cols-[auto_1fr] gap-1 items-baseline ${level > 0 ? 'mt-0.5' : 'mt-1'}`}>
      <span className={`text-right font-bold text-[#1e293b] shrink-0 select-none ${level === 0 ? 'text-[5.5px] min-w-[7px]' : 'text-[5px] min-w-[6px]'}`}>
        {label}
      </span>
      <div className="min-w-0 text-[5.8px] font-normal leading-[1.3] text-[#334155]">
        <ThumbnailMath text={question.text} />
        <ThumbnailImage image={question.image} />
        {!!question.subquestions?.length && (
          <ol className="mt-0.5 pl-0.5 space-y-0.5">
            {question.subquestions.map((subquestion, subIndex) => (
              <ThumbnailQuestion
                key={`${level}-${subIndex}-${subquestion.text.slice(0, 12)}`}
                question={subquestion}
                index={subIndex}
                level={level + 1}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
};

/** Miniature de document A4, volontairement dépourvue de toute zone de réponse. */
const WorksheetThumbnail: React.FC<WorksheetThumbnailProps> = ({ worksheet }) => {
  const settings = worksheet.content.settings ?? {};
  const title = worksheet.name;
  const className = settings.className?.trim();

  return (
    <div
      className="worksheet-thumbnail relative h-full w-full overflow-hidden bg-[#f4f1ea] shadow-inner text-[#334155] font-latex font-normal"
      style={{ 
        fontWeight: 400,
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0) 20%), url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noise)" opacity="0.04"/></svg>')` 
      }}
      aria-hidden="true"
    >
      <div className="h-full px-[8%] pb-[8%] pt-[8%]">
        <header className="mb-3.5 text-center flex flex-col items-center">
          <h4 className="text-[10px] font-semibold leading-[1.3] text-[#19788c] w-4/5">
            <ThumbnailMath text={title} />
          </h4>
          <div className="mt-1 flex items-center justify-center w-full gap-1">
            <div className="h-[0.5px] w-8 bg-gradient-to-r from-transparent to-[#19788c]/40" />
            <div className="h-0.5 w-0.5 rotate-45 bg-[#19788c]/60" />
            <div className="h-[0.5px] w-8 bg-gradient-to-l from-transparent to-[#19788c]/40" />
          </div>
        </header>

        <div className="text-[6.5px] font-normal leading-[1.4] text-justify text-[#334155]">
          {worksheet.content.exercises?.length ? worksheet.content.exercises.map((exercise, exerciseIndex) => {
            const isPartie = exercise.title && exercise.title.toLowerCase().includes('partie');
            return (
              <section key={exercise.id || exerciseIndex} className={exerciseIndex > 0 ? 'mt-3' : ''}>
                {isPartie ? (
                   <div className="mb-1.5 mt-2.5 text-center">
                      <span className="text-[7px] font-semibold text-[#1e293b] uppercase tracking-wider">
                        <ThumbnailMath text={exercise.title || `Partie ${exerciseIndex + 1}`} />
                      </span>
                   </div>
                ) : (
                  <div className="mb-0.5 text-[7px] font-semibold text-[#1e293b] flex items-baseline gap-1">
                    <span className="shrink-0">Exercice {exerciseIndex + 1}.</span>
                    {exercise.title && (
                      <span className="font-normal text-[#334155]">
                         <ThumbnailMath text={exercise.title} />
                      </span>
                    )}
                  </div>
                )}
                
                {exercise.statement && (
                  <div className="mt-0.5 mb-1 font-normal">
                    <ThumbnailMath text={exercise.statement} />
                  </div>
                )}
                
                <ThumbnailImage image={exercise.image} />
                
                {(!isPartie || (exercise.questions && exercise.questions.length > 0)) && (
                  <ol className="mt-0.5 pl-0.5">
                    {(exercise.questions ?? []).map((question, questionIndex) => (
                      <ThumbnailQuestion
                        key={`${exercise.id}-${questionIndex}-${question.text.slice(0, 12)}`}
                        question={question}
                        index={questionIndex}
                      />
                    ))}
                  </ol>
                )}
              </section>
            );
          }) : (
            <div className="grid min-h-32 place-items-center text-center text-[6.5px] text-[#777]">
              Cette fiche ne contient aucun exercice.
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/80 to-transparent" />
    </div>
  );
};

export default React.memo(WorksheetThumbnail);
