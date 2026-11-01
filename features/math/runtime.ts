interface MathRuntime {
  startup?: { promise?: Promise<unknown> };
  whenReady?: (action: () => void) => Promise<unknown>;
}

let resolveRuntime: (runtime: MathRuntime) => void;
let rejectRuntime: (error: Error) => void;
const ready = new Promise<MathRuntime>((resolve, reject) => {
  resolveRuntime = resolve;
  rejectRuntime = reject;
});
// A failure can happen before anyone clicks Print.
void ready.catch(() => {});

export function registerMathRuntime(value: unknown): void {
  resolveRuntime(value as MathRuntime);
}

export function failMathRuntime(): void {
  rejectRuntime(new Error('Le moteur de formules local ne s’est pas chargé. Rechargez la page avant de réessayer.'));
}

/** whenReady waits for MathJax v4's serial typesetting queue, including React
 * updates caused by revealing print-only Beamer content. */
export async function waitForMathTypesetting(): Promise<void> {
  const runtime = await ready;
  await runtime.startup?.promise;
  await runtime.whenReady?.(() => {});
}
