import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../types';
import { buildWorksheetPagePlan } from '../../utils/questionLayout';

export function usePresentationNavigation(exercises: Exercise[], enabled: boolean, worksheetId?: string) {
  const pages = useMemo(() => buildWorksheetPagePlan(exercises), [exercises]);
  const [selection, setSelection] = useState<{ worksheetId?: string; id?: string }>({});
  const selectedIndex = selection.worksheetId === worksheetId ? pages.findIndex(page => page.id === selection.id) : -1;
  const index = Math.max(0, selectedIndex);
  const activePage = pages[index];
  const select = useCallback((nextIndex: number) => {
    const page = pages[Math.min(pages.length - 1, Math.max(0, nextIndex))];
    setSelection({ worksheetId, id: page?.id });
  }, [pages, worksheetId]);
  const previous = useCallback(() => select(index - 1), [index, select]);
  const next = useCallback(() => select(index + 1), [index, select]);

  useEffect(() => {
    if (!enabled || !activePage) return;
    const frame = requestAnimationFrame(() => {
      const page = Array.from(document.querySelectorAll<HTMLElement>('[data-question-page]'))
        .find(element => element.dataset.questionPage === activePage.id);
      page?.querySelector<HTMLElement>('.question-beamer-scope')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePage?.id, enabled, worksheetId]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"]')) return;
      if (event.key === 'PageDown' || event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault(); next();
      } else if (event.key === 'PageUp' || event.key === 'ArrowLeft') {
        event.preventDefault(); previous();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); select(event.key === 'Home' ? 0 : pages.length - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, next, pages.length, previous, select]);

  return { pages, index, activePage, select, previous, next };
}
