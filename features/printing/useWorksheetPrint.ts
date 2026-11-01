import { useCallback, useEffect, useRef, useState } from 'react';
import type { Worksheet } from '../../types';
import { beginWorksheetPrintDialog, finishWorksheetPrint, prepareWorksheetPrint } from '../../utils/worksheetPrint';
import { waitForMathTypesetting } from '../math/runtime';
import { withPrintDeadline } from './preparation';

export function useWorksheetPrint(worksheet: Worksheet | undefined, onError: (message: string) => void) {
  const pending = useRef(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const restoreRef = useRef<(() => void) | null>(null);
  useEffect(() => () => restoreRef.current?.(), []);

  const printWorksheet = useCallback(async () => {
    if (!worksheet || pending.current) return;
    pending.current = true;
    setIsPreparing(true);
    onError('');
    const previousTitle = document.title;
    const date = new Date();
    const name = worksheet.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    document.title = `${name}_${date.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}`;
    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      document.title = previousTitle;
      pending.current = false;
      setIsPreparing(false);
      window.removeEventListener('worksheet-finish-print', restore);
      restoreRef.current = null;
    };
    restoreRef.current = restore;
    window.addEventListener('worksheet-finish-print', restore);
    try {
      await withPrintDeadline(prepareWorksheetPrint(), 'Images du canvas');
      // Decorative web fonts can use their CSS fallback; they must not lock Print.
      await withPrintDeadline(document.fonts.ready, 'Polices', 2500).catch(() => {});
      await withPrintDeadline(Promise.allSettled(Array.from(document.images, image => image.decode())), 'Images du document');
      await withPrintDeadline(new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))), 'Mise en page');
      await withPrintDeadline(waitForMathTypesetting(), 'Composition des formules');
      await withPrintDeadline(prepareWorksheetPrint(), 'Rendu des annotations');
      if (finished) return;
      setIsPreparing(false);
      const native = (window as Window & { AndroidNative?: { printDocument: (name: string) => void } }).AndroidNative;
      beginWorksheetPrintDialog();
      if (native?.printDocument) native.printDocument(worksheet.name || name);
      else {
        try { window.print(); }
        finally {
          // Le retour de print() peut être le seul signal de fermeture. Certains
          // navigateurs omettent afterprint, notamment après une annulation.
          if (!window.matchMedia('print').matches) finishWorksheetPrint();
        }
      }
    } catch (error) {
      finishWorksheetPrint();
      onError(`Impossible de préparer l'impression : ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [onError, worksheet]);
  return { printWorksheet, isPreparing };
}
