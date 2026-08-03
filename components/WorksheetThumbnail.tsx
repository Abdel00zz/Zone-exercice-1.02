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
  const label = level === 0 ? `${number}.` : `(${number})`;

  return (
    <li className={`relative grid grid-cols-[15px_minmax(0,1fr)] gap-0.5 ${level > 0 ? 'mt-0.5' : 'mt-1'}`}>
      <span className="pt-px text-right text-[6.5px] font-normal leading-[1.3] text-black">
        {label}
      </span>
      <div className="min-w-0 pl-0.5 text-[6.5px] leading-[1.3] text-black">
        <ThumbnailMath text={question.text} />
        <ThumbnailImage image={question.image} />
        {!!question.subquestions?.length && (
          <ol className="mt-0.5 pl-1">
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
  const title = worksheet.content.chapter?.trim() || worksheet.name;
  const className = settings.className?.trim();

  return (
    <div
      className="worksheet-thumbnail relative h-full w-full overflow-hidden bg-white text-black"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
      aria-hidden="true"
    >
      <div className="h-full px-[5.5%] pb-[5%] pt-[4.5%]">
        <header className="mb-2">
          <div className="mb-1 flex items-center justify-between gap-2 font-sans text-[4.5px] font-extrabold uppercase tracking-[0.18em] text-[#19788c]">
            <span>Fiche d'exercices</span>
            {className && <span className="max-w-[42%] truncate text-[#607074]">{className}</span>}
          </div>
          <div className="flex items-stretch gap-1.5">
            <span className="w-[2px] shrink-0 rounded-full bg-[#19788c]" />
            <h4 className="min-w-0 flex-1 text-[9.5px] font-bold leading-[1.08] tracking-[-0.015em] text-[#111719]">
              <ThumbnailMath text={title} />
            </h4>
          </div>
          <div className="mt-1.5 h-px bg-gradient-to-r from-[#19788c]/55 via-[#9fb8b8]/35 to-transparent" />
        </header>

        <div>
          {worksheet.content.exercises?.length ? worksheet.content.exercises.map((exercise, exerciseIndex) => (
            <section key={exercise.id || exerciseIndex} className={exerciseIndex > 0 ? 'mt-2.5' : ''}>
              <div className="flex items-baseline gap-1.5 border-l-2 border-[#19788c]/75 pl-1.5 text-[8px] leading-none text-black">
                <span className="shrink-0 font-bold tracking-[-0.01em]">Exercice {exerciseIndex + 1}</span>
                {exercise.title && (
                  <span className="min-w-0 truncate text-[6px] italic text-[#465357]">
                    —{' '}
                    <ThumbnailMath text={exercise.title} />
                  </span>
                )}
              </div>
              {exercise.statement && (
                <div className="mt-0.5 text-[6.5px] font-normal leading-[1.3] text-black">
                  <ThumbnailMath text={exercise.statement} />
                </div>
              )}
              <ThumbnailImage image={exercise.image} />
              <ol className="mt-0.5 pl-2">
                {(exercise.questions ?? []).map((question, questionIndex) => (
                  <ThumbnailQuestion
                    key={`${exercise.id}-${questionIndex}-${question.text.slice(0, 12)}`}
                    question={question}
                    index={questionIndex}
                  />
                ))}
              </ol>
            </section>
          )) : (
            <div className="grid min-h-32 place-items-center text-center text-[6.5px] text-[#777]">
              Cette fiche ne contient aucun exercice.
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white via-white/75 to-transparent" />
    </div>
  );
};

export default React.memo(WorksheetThumbnail);
