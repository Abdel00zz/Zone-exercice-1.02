export const MIN_ANSWER_HEIGHT = 40;
export const MAX_ANSWER_HEIGHT = 1600;
export const DEFAULT_ANSWER_HEIGHT = 120;

const validHeight = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Le minimum de la fiche s'applique aussi aux hauteurs déjà personnalisées. */
export const resolveAnswerSpaceMinimum = (minimum?: number): number =>
  Math.max(MIN_ANSWER_HEIGHT, Math.min(MAX_ANSWER_HEIGHT,
    validHeight(minimum) ? minimum : DEFAULT_ANSWER_HEIGHT));

export const resolveAnswerSpaceHeight = (height?: number, minimum?: number): number => {
  const floor = resolveAnswerSpaceMinimum(minimum);
  return Math.max(floor, Math.min(MAX_ANSWER_HEIGHT, validHeight(height) ? height : floor));
};
