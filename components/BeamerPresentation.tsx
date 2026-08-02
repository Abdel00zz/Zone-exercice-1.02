import React, { createContext, useContext } from 'react';

interface BeamerPresentationValue {
  step: number;
}

const BeamerPresentationContext = createContext<BeamerPresentationValue>({ step: 1 });

export const BeamerPresentationProvider: React.FC<{
  step: number;
  children: React.ReactNode;
}> = ({ step, children }) => (
  <BeamerPresentationContext.Provider value={{ step: Math.max(1, step) }}>
    {children}
  </BeamerPresentationContext.Provider>
);

export const useBeamerPresentation = (): BeamerPresentationValue =>
  useContext(BeamerPresentationContext);

/** Retourne vrai lorsque l'étape courante appartient à une spécification Beamer. */
export function matchesOverlaySpec(spec: string, step: number, plusValue?: number): boolean {
  const normalized = spec.trim().replace(/\s+/g, '');
  if (!normalized) return true;

  return normalized.split(',').some(part => {
    const resolved = part.replace(/\+/g, String(plusValue ?? step));

    if (/^\d+$/.test(resolved)) return step === Number(resolved);

    const fromMatch = resolved.match(/^(\d+)-$/);
    if (fromMatch) return step >= Number(fromMatch[1]);

    const untilMatch = resolved.match(/^-(\d+)$/);
    if (untilMatch) return step <= Number(untilMatch[1]);

    const rangeMatch = resolved.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      return step >= Number(rangeMatch[1]) && step <= Number(rangeMatch[2]);
    }

    return true;
  });
}

function maxFromSpec(spec: string, fallback = 1): number {
  let max = fallback;
  for (const part of spec.split(',')) {
    const numbers = part.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length > 0) max = Math.max(max, ...numbers);
  }
  return max;
}

function maxStepInText(text: string): number {
  let max = 1;
  const pauseCount = text.match(/\\pause\b/g)?.length ?? 0;
  max = Math.max(max, pauseCount + 1);

  const commandSpecs = text.matchAll(
    /\\(?:onslide|only|uncover|visible|invisible|alert)\s*<([^>]+)>/g,
  );
  for (const match of commandSpecs) max = Math.max(max, maxFromSpec(match[1]));

  const itemizeMatches = text.matchAll(
    /\\begin\{itemize\}\s*\[\s*<([^>]+)>\s*\]([\s\S]*?)\\end\{itemize\}/g,
  );
  for (const match of itemizeMatches) {
    const spec = match[1];
    const itemCount = match[2].match(/\\item\b/g)?.length ?? 0;
    max = Math.max(max, spec.includes('+') ? itemCount : maxFromSpec(spec));
  }

  const itemSpecs = text.matchAll(/\\item\s*<([^>]+)>/g);
  for (const match of itemSpecs) max = Math.max(max, maxFromSpec(match[1]));

  return max;
}

/** Analyse récursivement une fiche sans dépendre de son type concret. */
export function getBeamerMaxStep(value: unknown): number {
  if (typeof value === 'string') return maxStepInText(value);
  if (Array.isArray(value)) {
    return value.reduce((max, item) => Math.max(max, getBeamerMaxStep(item)), 1);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce<number>(
      (max, item) => Math.max(max, getBeamerMaxStep(item)),
      1,
    );
  }
  return 1;
}
