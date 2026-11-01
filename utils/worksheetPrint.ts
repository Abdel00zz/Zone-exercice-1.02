import { flushSync } from 'react-dom';

let printing = false;
let dialogOpen = false;
let lifecycleInstalled = false;
let lostDialogFocus = false;

export const isWorksheetPrinting = () => printing;

export function beginWorksheetPrintDialog(): void {
  dialogOpen = true;
  lostDialogFocus = false;
}

/** Mount lazy zones before asking their newly registered canvas to render. */
export function prepareWorksheetPrint(): Promise<void> {
  printing = true;
  flushSync(() => window.dispatchEvent(new Event('worksheet-mount-print')));
  const pending: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent('worksheet-render-print', { detail: { pending } }));
  return Promise.allSettled(pending).then(() => {});
}

export function finishWorksheetPrint(): void {
  const wasPrinting = printing || dialogOpen;
  printing = false;
  dialogOpen = false;
  lostDialogFocus = false;
  if (wasPrinting) window.dispatchEvent(new Event('worksheet-finish-print'));
}

/** Also covers Ctrl+P and the Android PrintDocumentAdapter lifecycle. */
export function installWorksheetPrintLifecycle(): void {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;
  const printMedia = window.matchMedia('print');
  const finishDialog = () => {
    if (!dialogOpen) return;
    finishWorksheetPrint();
  };
  window.addEventListener('beforeprint', () => {
    beginWorksheetPrintDialog();
    void prepareWorksheetPrint();
  });
  window.addEventListener('afterprint', finishDialog);
  window.addEventListener('worksheet-native-print-finished', finishDialog);
  printMedia.addEventListener('change', event => {
    if (event.matches) beginWorksheetPrintDialog();
    else finishDialog();
  });
  window.addEventListener('blur', () => { if (dialogOpen) lostDialogFocus = true; });
  window.addEventListener('focus', () => {
    if (lostDialogFocus && !printMedia.matches) finishDialog();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dialogOpen) lostDialogFocus = true;
    else if (document.visibilityState === 'visible' && lostDialogFocus && !printMedia.matches) finishDialog();
  });
}
