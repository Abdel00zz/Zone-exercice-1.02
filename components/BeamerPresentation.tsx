import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { isWorksheetPrinting } from '../utils/worksheetPrint';

interface BeamerPresentationValue {
  step: number;
  revealAll: boolean;
}

const BeamerPresentationContext = createContext<BeamerPresentationValue>({ step: 1, revealAll: false });

// Une seule écoute du cycle d'impression, partagée par tous les textes,
// même ceux qui sont hors d'une question (énoncé et rappels de contexte).
const printSubscribers = new Set<() => void>();
const notifyPrint = () => {
  printSubscribers.forEach(notify => notify());
};
const subscribePrint = (notify: () => void) => {
  if (printSubscribers.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('worksheet-mount-print', notifyPrint);
    window.addEventListener('worksheet-finish-print', notifyPrint);
  }
  printSubscribers.add(notify);
  return () => {
    printSubscribers.delete(notify);
    if (printSubscribers.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('worksheet-mount-print', notifyPrint);
      window.removeEventListener('worksheet-finish-print', notifyPrint);
    }
  };
};

export const BeamerPresentationProvider: React.FC<{
  step: number;
  revealAll?: boolean;
  children: React.ReactNode;
}> = ({ step, revealAll = false, children }) => (
  <BeamerPresentationContext.Provider value={{ step: Math.max(1, step), revealAll }}>
    {children}
  </BeamerPresentationContext.Provider>
);

export const useBeamerPresentation = (): BeamerPresentationValue => {
  const context = useContext(BeamerPresentationContext);
  const revealAll = useSyncExternalStore(subscribePrint, isWorksheetPrinting, () => false);
  return { ...context, revealAll: context.revealAll || revealAll };
};

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

  const listMatches = text.matchAll(
    /\\begin\{(itemize|enumerate)\}(?:\s*\[\s*<([^>]+)>\s*\])?([\s\S]*?)\\end\{\1\}/g,
  );
  for (const match of listMatches) {
    const defaultSpec = match[2];
    const items = [...match[3].matchAll(/\\item\b(?:\s*<([^>]+)>)?/g)];
    items.forEach((item, index) => {
      const spec = item[1] ?? defaultSpec;
      if (spec) max = Math.max(max, maxFromSpec(spec.replace(/\+/g, String(index + 1))));
    });
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
