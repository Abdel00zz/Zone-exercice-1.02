/** Every external resource has a deadline so Print can be retried after failure. */
export function withPrintDeadline<T>(operation: PromiseLike<T>, label: string, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} : délai de chargement dépassé. Réessayez l’impression.`)), timeoutMs);
    Promise.resolve(operation).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
