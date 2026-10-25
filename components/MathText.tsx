import React from 'react';
import katex from 'katex';
import { MathJax } from 'better-react-mathjax';
import { matchesOverlaySpec, useBeamerPresentation } from './BeamerPresentation';
import { DEFAULT_MATHJAX_FONT, isKatexPrimaryFont } from '../utils/mathjaxFonts';

export interface MathEngineConfig {
  mathFont: string;
  mathScale: number;
}

export const MathEngineContext = React.createContext<MathEngineConfig>({
  mathFont: DEFAULT_MATHJAX_FONT,
  mathScale: 100,
});

interface MathTextProps {
  text: string;
  className?: string;
  /** Affiche la valeur des commandes \fillblank en mode auteur. */
  revealFillBlanks?: boolean;
  /** Désactive le surlignage par double-clic (ex: en mode édition). */
  disableHighlight?: boolean;
}

/**
 * Répare les commandes `\text...` écrites avec un seul antislash dans un JSON.
 * Le parseur JSON transforme alors silencieusement `\t` en tabulation, ce qui
 * produisait `extbf{...}` à l'écran au lieu d'un texte gras.
 */
function repairJsonTextCommandEscapes(value: string): string {
  return value
    .replace(/\u0009extbf(?=\s*\{)/g, '\\textbf')
    .replace(/\u0009extit(?=\s*\{)/g, '\\textit')
    .replace(/\u0009extsf(?=\s*\{)/g, '\\textsf')
    .replace(/\u0009exttt(?=\s*\{)/g, '\\texttt')
    .replace(/\u0009extcolor(?=\s*\{)/g, '\\textcolor');
}

/**
 * Extrait le code TeX brut d'un délimiteur inline ($...$, \(...\))
 * ou display ($$...$$, \[...\]).
 */
function stripMathDelimiters(raw: string): { tex: string; displayMode: boolean } {
  const trimmed = raw.trim();
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
    return { tex: trimmed.slice(2, -2).trim(), displayMode: true };
  }
  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length >= 4) {
    return { tex: trimmed.slice(2, -2).trim(), displayMode: true };
  }
  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)') && trimmed.length >= 4) {
    return { tex: trimmed.slice(2, -2).trim(), displayMode: false };
  }
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length >= 2) {
    return { tex: trimmed.slice(1, -1).trim(), displayMode: false };
  }
  if (/^\\begin\{(?:align|align\*|equation|equation\*|cases|matrix|pmatrix|bmatrix)\}/.test(trimmed)) {
    return { tex: trimmed, displayMode: true };
  }
  return { tex: trimmed, displayMode: false };
}

const KATEX_MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\llbracket': '[\\![',
  '\\rrbracket': ']\\!]',
  '\\parallel': '\\Vert',
};

/**
 * Rend une formule mathématique avec KaTeX (moteur vectoriel synchrone ultra-net
 * pour l'écran et le PDF imprimé), et bascule automatiquement sur MathJax 4
 * si une police spécialisée (ex: Neo Euler, Fira Math) est sélectionnée ou si
 * une macro exotique n'est pas reconnue par KaTeX.
 */
const MathFormula: React.FC<{ rawMath: string; display?: boolean }> = React.memo(({ rawMath, display = false }) => {
  const { mathFont } = React.useContext(MathEngineContext);
  const useKatex = isKatexPrimaryFont(mathFont);

  const katexHtml = React.useMemo(() => {
    if (!useKatex) return null;
    const { tex, displayMode } = stripMathDelimiters(rawMath);
    if (!tex) return '';
    try {
      return katex.renderToString(tex, {
        displayMode: display || displayMode,
        throwOnError: true,
        strict: false,
        trust: true,
        output: 'htmlAndMathml',
        macros: { ...KATEX_MACROS },
      });
    } catch {
      return null;
    }
  }, [rawMath, display, useKatex]);

  if (katexHtml !== null) {
    if (display) {
      return (
        <span
          className="katex-formula-block"
          dangerouslySetInnerHTML={{ __html: katexHtml }}
        />
      );
    }
    return (
      <span
        className="katex-formula-inline"
        dangerouslySetInnerHTML={{ __html: katexHtml }}
      />
    );
  }

  if (display) {
    return <MathJax dynamic>{rawMath}</MathJax>;
  }
  return (
    <MathJax inline dynamic>
      <span>{rawMath}</span>
    </MathJax>
  );
});

/**
 * Auto-detects loose mathematical expressions/variables in plain text
 * and wraps them in inline math delimiters ($...$) so KaTeX/MathJax compiles them.
 */
function autoWrapMathInSegment(segment: string): string {
  if (!segment) return '';
  if (segment.includes('$') || segment.includes('\\[') || segment.includes('\\(')) return segment;

  // Key TeX math indicators
  const hasMathKeywords = /(\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|frac|sqrt|vec|hat|overline|mathbb|mathcal|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+)/.test(segment);

  if (!hasMathKeywords) return segment;

  const mathPhraseRegex = /((?:\\(?:mathbb|mathcal)\{[^{}]+\}|\\frac\{[^{}]*\}\{[^{}]*\}|\\sqrt(?:\[[^\]]+\])?\{[^{}]*\}|\\(?:vec|hat|overline)\{[^{}]*\}|\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+|[0-9]+|<|>|=|\+|-|\/|\*|\(|\)|\s)+)/g;

  return segment.replace(mathPhraseRegex, (match) => {
    const trimmed = match.trim();
    if (!trimmed) return match;
    const isExplicitMath = /(\\(?:forall|exists|in|notin|subset|cap|cup|implies|iff|le|ge|neq|approx|times|div|frac|sqrt|vec|hat|overline|mathbb|mathcal|alpha|beta|gamma|delta|theta|pi|sigma|Delta|lim|sum|int|infty)|[a-zA-Z]_[a-zA-Z0-9{}']+|[a-zA-Z]\^[a-zA-Z0-9{}']+)/;
    if (isExplicitMath.test(trimmed)) {
      const leadingSpace = /^\s/.test(match) ? ' ' : '';
      const trailingSpace = /\s$/.test(match) ? ' ' : '';
      return `${leadingSpace}$${trimmed}$${trailingSpace}`;
    }
    return match;
  });
}

/**
 * Repère le premier bloc mathématique inline ($...$ ou \(...\)) sans confondre \$ et $$.
 */
function findInlineMathRange(value: string): { start: number; end: number } | null {
  let dollarStart = -1;

  for (let index = 0; index < value.length; index++) {
    // Support \( ... \)
    if (dollarStart === -1 && value[index] === '\\' && value[index + 1] === '(') {
      const closeIdx = value.indexOf('\\)', index + 2);
      if (closeIdx !== -1) {
        return { start: index, end: closeIdx + 1 };
      }
    }

    if (value[index] !== '$' || value[index - 1] === '\\') continue;
    if (value[index - 1] === '$' || value[index + 1] === '$') continue;

    if (dollarStart === -1) dollarStart = index;
    else return { start: dollarStart, end: index };
  }

  return null;
}

/**
 * Trouve l'accolade fermante équilibrée `{ ... }` en ignorant les accolades
 * échappées (`\{`, `\}`) et en traversant proprement les blocs `$ ... $`.
 */
function findClosingBraceRespectingMath(value: string, openingIndex: number): number {
  let depth = 0;
  let inMath = false;

  for (let index = openingIndex; index < value.length; index++) {
    const ch = value[index];
    if (ch === '\\') {
      index++;
      continue;
    }
    if (ch === '$' && value[index + 1] !== '$') {
      inMath = !inMath;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Render inline formatting commands like \textbf{...}, \textit{...}, \underline{...},
 * \textcolor{color}{...}, \quad, \qquad AND inline math ($...$, \(...\)) in strict
 * left-to-right order so that `\textbf{texte avec $x^2$ en gras}` works flawlessly.
 */
function renderFormattedSegment(text: string, keyPrefix: string = 'fmt', revealFillBlanks = false): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let idxCounter = 0;

  const cmdRegex = /\\(textbf|textit|emph|underline|textsf|texttt|quad|qquad|textcolor|highlight|hl|Large|large|small)\b/;

  while (remaining.length > 0) {
    const inlineMath = findInlineMathRange(remaining);
    const cmdMatch = remaining.match(cmdRegex);
    const cmdPos = cmdMatch?.index !== undefined ? cmdMatch.index : Infinity;
    const mathPos = inlineMath ? inlineMath.start : Infinity;

    // 1. Aucun bloc math ni commande de formatage restant
    if (mathPos === Infinity && cmdPos === Infinity) {
      const processed = autoWrapMathInSegment(remaining);
      if (processed !== remaining && findInlineMathRange(processed)) {
        nodes.push(...renderFormattedSegment(processed, `${keyPrefix}-auto-${idxCounter++}`, revealFillBlanks));
      } else {
        nodes.push(<span key={`${keyPrefix}-txt-${idxCounter++}`}>{remaining}</span>);
      }
      break;
    }

    // 2. Un bloc mathématique inline ($...$ ou \(...\)) commence avant toute commande \textbf etc.
    if (inlineMath && mathPos < cmdPos) {
      if (mathPos > 0) {
        const before = remaining.slice(0, mathPos);
        nodes.push(...renderFormattedSegment(before, `${keyPrefix}-pre-${idxCounter++}`, revealFillBlanks));
      }
      const mathToken = remaining.slice(inlineMath.start, inlineMath.end + 1);
      nodes.push(<MathFormula key={`${keyPrefix}-math-${idxCounter++}`} rawMath={mathToken} />);
      remaining = remaining.slice(inlineMath.end + 1);
      continue;
    }

    // 3. Une commande de mise en forme (\textbf, \textit, \underline, \quad...) commence en premier
    if (!cmdMatch || cmdMatch.index === undefined) break;
    const matchPos = cmdMatch.index;
    const cmd = cmdMatch[1];

    if (matchPos > 0) {
      const prior = remaining.substring(0, matchPos);
      nodes.push(...renderFormattedSegment(prior, `${keyPrefix}-prior-${idxCounter++}`, revealFillBlanks));
    }

    // Commandes d'espacement sans argument
    if (cmd === 'quad') {
      nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="inline-block w-4" />);
      remaining = remaining.substring(matchPos + cmdMatch[0].length);
      continue;
    }
    if (cmd === 'qquad') {
      nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="inline-block w-8" />);
      remaining = remaining.substring(matchPos + cmdMatch[0].length);
      continue;
    }

    let afterCmd = remaining.substring(matchPos + cmdMatch[0].length).replace(/^\s+/, '');

    // Extraction de la couleur pour \textcolor{color}{content}
    let textColor = '';
    if (cmd === 'textcolor' && afterCmd.startsWith('{')) {
      const colorEnd = findClosingBraceRespectingMath(afterCmd, 0);
      if (colorEnd !== -1) {
        textColor = afterCmd.substring(1, colorEnd).trim();
        afterCmd = afterCmd.substring(colorEnd + 1).replace(/^\s+/, '');
      }
    }

    if (afterCmd.startsWith('{')) {
      const closingIndex = findClosingBraceRespectingMath(afterCmd, 0);
      if (closingIndex !== -1) {
        const innerContent = afterCmd.substring(1, closingIndex);
        const children = renderFormattedSegment(innerContent, `${keyPrefix}-${idxCounter}`, revealFillBlanks);

        if (cmd === 'textbf') {
          nodes.push(<strong key={`${keyPrefix}-${idxCounter++}`} className="font-bold math-in-bold">{children}</strong>);
        } else if (cmd === 'textit' || cmd === 'emph') {
          nodes.push(<em key={`${keyPrefix}-${idxCounter++}`} className="italic">{children}</em>);
        } else if (cmd === 'underline') {
          nodes.push(<u key={`${keyPrefix}-${idxCounter++}`} className="underline decoration-1 underline-offset-2">{children}</u>);
        } else if (cmd === 'textsf') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="font-sans">{children}</span>);
        } else if (cmd === 'texttt') {
          nodes.push(<code key={`${keyPrefix}-${idxCounter++}`} className="font-mono text-[0.92em] bg-black/5 px-1 rounded">{children}</code>);
        } else if (cmd === 'textcolor') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} style={{ color: textColor }}>{children}</span>);
        } else if (cmd === 'highlight' || cmd === 'hl') {
          nodes.push(<mark key={`${keyPrefix}-${idxCounter++}`} className="math-highlight-rounded">{children}</mark>);
        } else if (cmd === 'Large') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="text-[1.2em]">{children}</span>);
        } else if (cmd === 'large') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="text-[1.1em]">{children}</span>);
        } else if (cmd === 'small') {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`} className="text-[0.9em]">{children}</span>);
        } else {
          nodes.push(<span key={`${keyPrefix}-${idxCounter++}`}>{children}</span>);
        }

        remaining = afterCmd.substring(closingIndex + 1);
        continue;
      }
    }

    // Repli si la commande n'a pas d'accolade fermante valide
    nodes.push(<span key={`${keyPrefix}-raw-${idxCounter++}`}>{remaining.slice(matchPos, matchPos + cmdMatch[0].length)}</span>);
    remaining = remaining.slice(matchPos + cmdMatch[0].length);
  }

  return nodes;
}

/**
 * Main MathText Component
 * Preprocesses LaTeX commands (linebreaks, display math blocks, formatting, loose math)
 */
const StaticMathTextImpl: React.FC<MathTextProps> = ({ text, className = '', revealFillBlanks = false }) => {
  if (!text) return null;

  const expandedText = expandFillBlanks(repairJsonTextCommandEscapes(text), revealFillBlanks);

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
          token.startsWith('\\begin{matrix') ||
          token.startsWith('\\begin{pmatrix') ||
          token.startsWith('\\begin{bmatrix');

        if (isDisplayMath) {
          return (
            <div key={`display-${tokenIdx}`} className="math-display">
              <MathFormula rawMath={token} display />
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

              if (linePart.startsWith('\\\\[') && linePart.endsWith(']')) {
                const heightVal = linePart.substring(3, linePart.length - 1);
                return <div key={`lb-${lineIdx}`} style={{ height: heightVal || '0.5em' }} />;
              }
              if (linePart === '\\\\' || linePart === '\\newline') {
                return <br key={`br-${lineIdx}`} />;
              }
              if (linePart === '\\par') {
                return <div key={`par-${lineIdx}`} className="h-2.5 print:h-1.5" />;
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

const StaticMathText = React.memo(StaticMathTextImpl);

interface ProgressivePiece {
  kind: 'text' | 'command';
  text: string;
  command?: 'only' | 'uncover' | 'visible' | 'invisible' | 'alert' | 'onslide';
  spec?: string;
  minStep: number;
}

function findClosingBrace(value: string, openingIndex: number): number {
  return findClosingBraceRespectingMath(value, openingIndex);
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

const handleMathDoubleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // 1. Double-clic sur une formule KaTeX / MathJax ou un bloc d'équation centrée
  const mathContainer = target.closest('.katex-formula-inline, .katex-formula-block, mjx-container, .math-display, .math-center, [jax="SVG"]');
  if (mathContainer) {
    e.preventDefault();
    e.stopPropagation();
    mathContainer.classList.toggle('math-highlight-rounded');
    return;
  }

  // 2. Double-clic sur un mot ou élément déjà surligné -> retrait fluide du surlignage
  const existingHighlight = target.closest('.math-highlight-rounded, mark');
  if (existingHighlight) {
    e.preventDefault();
    e.stopPropagation();
    existingHighlight.classList.remove('math-highlight-rounded');
    if (existingHighlight.tagName.toLowerCase() === 'mark') {
      const parent = existingHighlight.parentNode;
      if (parent) {
        while (existingHighlight.firstChild) {
          parent.insertBefore(existingHighlight.firstChild, existingHighlight);
        }
        parent.removeChild(existingHighlight);
      }
    }
    return;
  }

  // 3. Double-clic sur un mot du texte courant
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const selectedText = selection.toString().trim();
    if (selectedText) {
      const range = selection.getRangeAt(0);
      const parentNode = range.commonAncestorContainer.parentElement;

      if (parentNode && parentNode.classList.contains('math-highlight-rounded')) {
        e.preventDefault();
        e.stopPropagation();
        parentNode.classList.remove('math-highlight-rounded');
        if (parentNode.tagName.toLowerCase() === 'mark') {
          const grandParent = parentNode.parentNode;
          if (grandParent) {
            while (parentNode.firstChild) {
              grandParent.insertBefore(parentNode.firstChild, parentNode);
            }
            grandParent.removeChild(parentNode);
          }
        }
        selection.removeAllRanges();
        return;
      }

      try {
        const mark = document.createElement('mark');
        mark.className = 'math-highlight-rounded';
        mark.title = 'Double-cliquez pour retirer le surlignage';
        range.surroundContents(mark);
        selection.removeAllRanges();
        e.preventDefault();
        e.stopPropagation();
      } catch {
        if (parentNode && parentNode !== e.currentTarget) {
          parentNode.classList.toggle('math-highlight-rounded');
          selection.removeAllRanges();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  }
};

const MathTextImpl: React.FC<MathTextProps> = ({ text, className = '', revealFillBlanks = false, disableHighlight = false }) => {
  const { step } = useBeamerPresentation();
  if (!text) return null;

  return (
    <span className={`math-text-root ${className}`} onDoubleClick={disableHighlight ? undefined : handleMathDoubleClick}>
      <ProgressiveContent text={text} step={step} revealFillBlanks={revealFillBlanks} />
    </span>
  );
};

const MathText = React.memo(MathTextImpl);

export default MathText;
