import React from 'react';
import { MathJax } from 'better-react-mathjax';
import { matchesOverlaySpec, useBeamerPresentation } from './BeamerPresentation';

interface MathTextProps {
  text: string;
  className?: string;
  /** Affiche la valeur des commandes \fillblank en mode auteur. */
  revealFillBlanks?: boolean;
}

/**
 * Auto-detects loose mathematical expressions/variables in plain text
 * and wraps them in inline math delimiters ($...$) so MathJax compiles them.
 */
function autoWrapMathInSegment(segment: string): string {
  if (!segment) return '';
  if (segment.includes('$') || segment.includes('\\[')) return segment;

  // Key TeX math indicators
  const hasMathKeywords = /(\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|frac|sqrt|vec|hat|overline|mathbb|mathcal|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+)/.test(segment);

  if (!hasMathKeywords) return segment;

  // Match expressions containing math commands or variables with operators/numbers
  const mathPhraseRegex = /((?:\\(?:mathbb|mathcal)\{[^{}]+\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]+\])?\{[^{}]*\}|\\(?:vec|hat|overline)\{[^{}]*\}|\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+|[0-9]+|<|>|=|\+|-|\/|\*|\(|\)|\s)+)/g;

  return segment.replace(mathPhraseRegex, (match) => {
    const trimmed = match.trim();
    if (!trimmed) return match;
    const isExplicitMath = /(\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|frac|sqrt|vec|hat|overline|mathbb|mathcal|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+|[<>=+\-*/])/;
    if (isExplicitMath.test(trimmed)) {
      return ` $${trimmed}$ `;
    }
    return match;
  });
}

/** Repère le premier bloc mathématique inline sans confondre \$ et $$. */
function findInlineMathRange(value: string): { start: number; end: number } | null {
  let start = -1;

  for (let index = 0; index < value.length; index++) {
    if (value[index] !== '$' || value[index - 1] === '\\') continue;
    if (value[index - 1] === '$' || value[index + 1] === '$') continue;

    if (start === -1) start = index;
    else return { start, end: index };
  }

  return null;
}

/**
 * Render inline formatting commands like \textbf{...}, \textit{...}, \underline{...}, \textcolor{color}{...}, \quad, \qquad
 */
function renderFormattedSegment(text: string, keyPrefix: string = 'fmt', revealFillBlanks = false): React.ReactNode[] {
  if (!text) return [];

  // Dans $...$, \underline et \text sont des commandes mathématiques :
  // le bloc complet doit parvenir intact à MathJax.
  const inlineMath = findInlineMathRange(text);
  if (inlineMath) {
    const before = text.slice(0, inlineMath.start);
    const math = text.slice(inlineMath.start, inlineMath.end + 1);
    const after = text.slice(inlineMath.end + 1);

    return [
      ...renderFormattedSegment(before, `${keyPrefix}-before`, revealFillBlanks),
      <MathJax key={`${keyPrefix}-math`} inline dynamic><span>{math}</span></MathJax>,
      ...renderFormattedSegment(after, `${keyPrefix}-after`, revealFillBlanks),
    ];
  }

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let idxCounter = 0;

  while (remaining.length > 0) {
    // Find next LaTeX text command
    const match = remaining.match(/\\(textbf|textit|emph|underline|textsf|texttt|quad|qquad|textcolor|Large|large|small)\b/);

    if (!match || match.index === undefined) {
      // No formatting command found in remaining string
      const processedText = autoWrapMathInSegment(remaining);
      nodes.push(
        <MathJax key={`${keyPrefix}-${idxCounter++}`} inline dynamic>
          <span>{processedText}</span>
        </MathJax>
      );
      break;
    }

    const matchPos = match.index;
    const cmd = match[1];

    // Push text before the command
    if (matchPos > 0) {
      const prior = remaining.substring(0, matchPos);
      const processedText = autoWrapMathInSegment(prior);
      nodes.push(
        <MathJax key={`${keyPrefix}-${idxCounter++}`} inline dynamic>
          <span>{processedText}</span>
        </MathJax>
      );
    }

    // Handle standalone commands
    if (cmd === 'quad') {
      nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="inline-block w-4" />);
      remaining = remaining.substring(matchPos + match[0].length);
      continue;
    }
    if (cmd === 'qquad') {
      nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="inline-block w-8" />);
      remaining = remaining.substring(matchPos + match[0].length);
      continue;
    }

    // LaTeX autorise des espaces ou un retour à la ligne entre la commande et
    // son argument : `\textbf {mot}` doit être équivalent à `\textbf{mot}`.
    let afterCmd = remaining.substring(matchPos + match[0].length).replace(/^\s+/, '');

    // Color extraction for \textcolor{color}{content}
    let textColor = '';
    if (cmd === 'textcolor') {
      if (afterCmd.startsWith('{')) {
        const colorEnd = afterCmd.indexOf('}');
        if (colorEnd !== -1) {
          textColor = afterCmd.substring(1, colorEnd);
          afterCmd = afterCmd.substring(colorEnd + 1).replace(/^\s+/, '');
        }
      }
    }

    // Parse brace parameter {...}
    if (afterCmd.startsWith('{')) {
      let braceDepth = 1;
      let closingIndex = -1;
      for (let i = 1; i < afterCmd.length; i++) {
        if (afterCmd[i] === '{') braceDepth++;
        else if (afterCmd[i] === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            closingIndex = i;
            break;
          }
        }
      }

      if (closingIndex !== -1) {
        const innerContent = afterCmd.substring(1, closingIndex);
        const children = renderFormattedSegment(innerContent, `${keyPrefix}-${idxCounter}`, revealFillBlanks);

        if (cmd === 'textbf') {
          nodes.push(<strong key={`${keyPrefix}-${idxCounter++}`} className="font-bold">{children}</strong>);
        } else if (cmd === 'textit' || cmd === 'emph') {
          nodes.push(<em key={`${keyPrefix}-${idxCounter++}`} className="italic">{children}</em>);
        } else if (cmd === 'underline') {
          nodes.push(<u key={`${keyPrefix}-${idxCounter++}`} className="underline">{children}</u>);
        } else if (cmd === 'textsf') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="font-sans">{children}</span>);
        } else if (cmd === 'texttt') {
          nodes.push(<code key={`${keyPrefix}-${idxCounter++}`} className="font-mono text-sm bg-black/5 dark:bg-white/10 px-1 rounded">{children}</code>);
        } else if (cmd === 'textcolor') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} style={{ color: textColor }}>{children}</span>);
        } else {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`}>{children}</span>);
        }

        remaining = afterCmd.substring(closingIndex + 1);
        continue;
      }
    }

    // Fallback if formatting structure doesn't match
    nodes.push(
      <MathJax key={`${keyPrefix}-${idxCounter++}`} inline dynamic>
        <span>{remaining}</span>
      </MathJax>
    );
    break;
  }

  return nodes;
}

/**
 * Main MathText Component
 * Preprocesses LaTeX commands (linebreaks, display math blocks, formatting, loose math)
 */
const StaticMathTextImpl: React.FC<MathTextProps> = ({ text, className = '', revealFillBlanks = false }) => {
  if (!text) return null;

  const expandedText = expandFillBlanks(text, revealFillBlanks);

  // 1. Tokenize display math blocks \[ ... \], $$ ... $$, \begin{align*} ... \end{align*},
  //    \begin{cases} ... \end{cases}, ainsi que le bloc de texte centré \begin{center} ... \end{center}
  const displayMathRegex = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\begin{center}[\s\S]*?\\end{center}|\\begin{(?:align|align\*|equation|equation\*|cases|matrix|pmatrix|bmatrix)}[\s\S]*?\\end{(?:align|align\*|equation|equation\*|cases|matrix|pmatrix|bmatrix)})/g;

  const displayTokens = expandedText.split(displayMathRegex);

  return (
    <span className={className}>
      {displayTokens.map((token, tokenIdx) => {
        if (!token) return null;

        // Bloc de texte centré : \begin{center} ... \end{center}
        if (token.startsWith('\\begin{center}')) {
          const inner = token.slice('\\begin{center}'.length, -'\\end{center}'.length);
          return (
            <div key={`center-${tokenIdx}`} className="math-center">
              <StaticMathText text={inner} revealFillBlanks={revealFillBlanks} />
            </div>
          );
        }

        // Is this token a Display Math block?
        const isDisplayMath =
          token.startsWith('\\[') ||
          token.startsWith('$$') ||
          token.startsWith('\\begin{align') ||
          token.startsWith('\\begin{equation') ||
          token.startsWith('\\begin{cases') ||
          token.startsWith('\\begin{matrix');

        if (isDisplayMath) {
          /* `math-display` porte seule l'interligne de la formule centrée :
             MathJax et Tailwind ajoutaient chacun leur marge, ce qui créait un
             saut visible entre la phrase et la formule. */
          return (
            <div key={`display-${tokenIdx}`} className="math-display">
              <MathJax dynamic>{token}</MathJax>
            </div>
          );
        }

        // Token is regular text with linebreaks and vertical spacing commands
        const lineBreakRegex = /(\\\\\[[0-9.]+(?:em|cm|pt|px)?\]|\\\\|\\newline|\\par|\\smallskip|\\medskip|\\bigskip)/g;
        const lineParts = token.split(lineBreakRegex);

        return (
          <React.Fragment key={`text-block-${tokenIdx}`}>
            {lineParts.map((linePart, lineIdx) => {
              if (!linePart) return null;

              // Check if linePart is a line break directive
              if (linePart.startsWith('\\\\[') && linePart.endsWith(']')) {
                // Extract spacing like 0.5em, 1em
                const heightVal = linePart.substring(3, linePart.length - 1);
                return <div key={`lb-${lineIdx}`} style={{ height: heightVal || '0.5em' }} />;
              }
              if (linePart === '\\\\' || linePart === '\\newline') {
                return <br key={`br-${lineIdx}`} />;
              }
              if (linePart === '\\par') {
                return <div key={`par-${lineIdx}`} className="h-3" />;
              }
              if (linePart === '\\smallskip') {
                return <div key={`skip-${lineIdx}`} style={{ height: '0.3em' }} />;
              }
              if (linePart === '\\medskip') {
                return <div key={`skip-${lineIdx}`} style={{ height: '0.6em' }} />;
              }
              if (linePart === '\\bigskip') {
                return <div key={`skip-${lineIdx}`} style={{ height: '1.1em' }} />;
              }

              // Render formatted segments
              return (
                <span key={`line-${lineIdx}`}>
                  {renderFormattedSegment(linePart, `node-${tokenIdx}-${lineIdx}`, revealFillBlanks)}
                </span>
              );
            })}
          </React.Fragment>
        );
      })}
    </span>
  );
};

// Évite de re-parser le LaTeX via MathJax à chaque rendu parent quand le texte n'a pas changé.
const StaticMathText = React.memo(StaticMathTextImpl);

interface ProgressivePiece {
  kind: 'text' | 'command';
  text: string;
  command?: 'only' | 'uncover' | 'visible' | 'invisible' | 'alert' | 'onslide';
  spec?: string;
  minStep: number;
}

function findClosingBrace(value: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < value.length; index++) {
    if (value[index] === '{') depth++;
    if (value[index] === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Convertit \fillblank{...} en soulignement TeX, visible seulement en mode auteur. */
function expandFillBlanks(value: string, reveal: boolean): string {
  let result = '';
  let cursor = 0;
  const token = '\\fillblank{';

  const isInsideMathAt = (position: number) => {
    let inMath = false;
    for (let index = 0; index < position; index++) {
      if (value[index] === '\\') { index++; continue; }
      if (value[index] !== '$') continue;
      if (value[index + 1] === '$') index++;
      inMath = !inMath;
    }
    return inMath;
  };

  while (cursor < value.length) {
    const start = value.indexOf(token, cursor);
    if (start === -1) {
      result += value.slice(cursor);
      break;
    }
    result += value.slice(cursor, start);
    const openingBrace = start + token.length - 1;
    const closingBrace = findClosingBrace(value, openingBrace);
    if (closingBrace === -1) {
      result += value.slice(start);
      break;
    }

    const rawInner = value.slice(openingBrace + 1, closingBrace);
    const hasMathDelimiters = rawInner.startsWith('$') && rawInner.endsWith('$');
    const inner = hasMathDelimiters ? rawInner.slice(1, -1) : rawInner;
    const texValue = hasMathDelimiters || isInsideMathAt(start) ? inner : `\\text{${inner}}`;
    const replacement = `\\underline{${reveal ? texValue : `\\phantom{${texValue}}`}}`;
    result += isInsideMathAt(start) ? replacement : `$${replacement}$`;
    cursor = closingBrace + 1;
  }
  return result;
}

/** Découpe les commandes d'overlay tout en conservant les accolades LaTeX internes. */
function parseProgressivePieces(text: string): ProgressivePiece[] {
  const pieces: ProgressivePiece[] = [];
  const commandRegex = /\\(pause|onslide|only|uncover|visible|invisible|alert)\b/g;
  let cursor = 0;
  let minStep = 1;
  let match: RegExpExecArray | null;

  const pushText = (value: string) => {
    if (value) pieces.push({ kind: 'text', text: value, minStep });
  };

  while ((match = commandRegex.exec(text)) !== null) {
    pushText(text.slice(cursor, match.index));
    const command = match[1] as ProgressivePiece['command'] | 'pause';

    if (command === 'pause') {
      minStep++;
      cursor = commandRegex.lastIndex;
      continue;
    }

    let position = commandRegex.lastIndex;
    while (/\s/.test(text[position] ?? '')) position++;
    if (text[position] !== '<') {
      pushText(match[0]);
      cursor = commandRegex.lastIndex;
      continue;
    }

    const specEnd = text.indexOf('>', position + 1);
    if (specEnd === -1) {
      pushText(match[0]);
      cursor = commandRegex.lastIndex;
      continue;
    }

    const spec = text.slice(position + 1, specEnd);
    let contentStart = specEnd + 1;
    while (/\s/.test(text[contentStart] ?? '')) contentStart++;

    if (text[contentStart] === '{') {
      const closingBrace = findClosingBrace(text, contentStart);
      if (closingBrace !== -1) {
        pieces.push({
          kind: 'command',
          text: text.slice(contentStart + 1, closingBrace),
          command,
          spec,
          minStep,
        });
        cursor = closingBrace + 1;
        commandRegex.lastIndex = cursor;
        continue;
      }
    }

    // Forme Beamer sans accolades : \onslide<2-> contenu restant.
    if (command === 'onslide') {
      pieces.push({
        kind: 'command',
        text: text.slice(contentStart),
        command,
        spec,
        minStep,
      });
      cursor = text.length;
      break;
    }

    pushText(text.slice(match.index, contentStart));
    cursor = contentStart;
    commandRegex.lastIndex = cursor;
  }

  pushText(text.slice(cursor));
  return pieces;
}

const ProgressiveInline: React.FC<{ text: string; step: number; revealFillBlanks?: boolean }> = ({ text, step, revealFillBlanks = false }) => {
  const pieces = parseProgressivePieces(text);

  return (
    <>
      {pieces.map((piece, index) => {
        const afterPause = step >= piece.minStep;
        const overlayMatch = piece.spec ? matchesOverlaySpec(piece.spec, step) : true;
        const command = piece.command;
        const active = afterPause && overlayMatch;

        if (piece.kind === 'text') {
          return afterPause ? <StaticMathText key={index} text={piece.text} revealFillBlanks={revealFillBlanks} /> : null;
        }

        if (command === 'alert') {
          if (!afterPause) return null;
          return (
            <span key={index} className={overlayMatch ? 'text-rose-600 font-semibold' : undefined}>
              <ProgressiveInline text={piece.text} step={step} revealFillBlanks={revealFillBlanks} />
            </span>
          );
        }

        if (command === 'only' && !active) return null;

        const hidden = command === 'invisible' ? !afterPause || overlayMatch : !active;
        const preserveSpace = command === 'uncover' || command === 'visible' || command === 'invisible';
        if (hidden && !preserveSpace) return null;

        return (
          <span
            key={index}
            style={hidden ? { visibility: 'hidden' } : undefined}
          >
            <ProgressiveInline text={piece.text} step={step} revealFillBlanks={revealFillBlanks} />
          </span>
        );
      })}
    </>
  );
};

interface ItemizeBlock {
  kind: 'itemize' | 'enumerate';
  before: string;
  body: string;
  spec?: string;
  after: string;
}

/** Repère la première liste, à puces (`itemize`) ou numérotée (`enumerate`). */
function splitFirstItemize(text: string): ItemizeBlock | null {
  const start = text.match(/\\begin\{(itemize|enumerate)\}(?:\s*\[\s*<([^>]+)>\s*\])?/);
  if (!start || start.index === undefined) return null;
  const kind = start[1] as ItemizeBlock['kind'];
  const bodyStart = start.index + start[0].length;
  const endToken = `\\end{${kind}}`;
  const bodyEnd = text.indexOf(endToken, bodyStart);
  if (bodyEnd === -1) return null;

  return {
    kind,
    before: text.slice(0, start.index),
    body: text.slice(bodyStart, bodyEnd),
    spec: start[2],
    after: text.slice(bodyEnd + endToken.length),
  };
}

function parseItems(body: string): Array<{ text: string; spec?: string }> {
  const matches = [...body.matchAll(/\\item(?:\s*<([^>]+)>)?/g)];
  return matches.map((match, index) => ({
    spec: match[1],
    text: body.slice(
      (match.index ?? 0) + match[0].length,
      matches[index + 1]?.index ?? body.length,
    ).trim(),
  }));
}

const ProgressiveContent: React.FC<{ text: string; step: number; revealFillBlanks?: boolean }> = ({ text, step, revealFillBlanks = false }) => {
  const itemize = splitFirstItemize(text);
  if (!itemize) return <ProgressiveInline text={text} step={step} revealFillBlanks={revealFillBlanks} />;

  const items = parseItems(itemize.body);
  const ListTag = itemize.kind === 'enumerate' ? 'ol' : 'ul';
  return (
    <>
      <ProgressiveContent text={itemize.before} step={step} revealFillBlanks={revealFillBlanks} />
      <ListTag className={`${itemize.kind === 'enumerate' ? 'list-decimal' : 'list-disc'} list-outside ml-6 my-2 space-y-1`}>
        {items.map((item, index) => {
          const spec = item.spec ?? itemize.spec;
          const plusValue = index + 1;
          const visible = !spec || matchesOverlaySpec(spec, step, plusValue);
          return (
            <li key={index} style={!visible ? { visibility: 'hidden' } : undefined}>
              <ProgressiveContent text={item.text} step={step} revealFillBlanks={revealFillBlanks} />
            </li>
          );
        })}
      </ListTag>
      <ProgressiveContent text={itemize.after} step={step} revealFillBlanks={revealFillBlanks} />
    </>
  );
};

const MathTextImpl: React.FC<MathTextProps> = ({ text, className = '', revealFillBlanks = false }) => {
  const { step } = useBeamerPresentation();
  if (!text) return null;

  return (
    <span className={`inline-block w-full ${className}`}>
      <ProgressiveContent text={text} step={step} revealFillBlanks={revealFillBlanks} />
    </span>
  );
};

// Évite de re-parser le LaTeX via MathJax à chaque rendu parent quand le texte n'a pas changé.
const MathText = React.memo(MathTextImpl);

export default MathText;
