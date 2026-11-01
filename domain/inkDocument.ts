import type { Stroke } from './ink';

/** Mutable rendering caches and document snapshots never share point objects. */
export function copyInk(strokes: readonly Stroke[]): Stroke[] {
  return strokes.map(stroke => {
    const { imgElement: _image, ...data } = stroke as Stroke & { imgElement?: unknown };
    return { ...data, points: stroke.points.map(point => ({ x: point.x, y: point.y, pressure: point.pressure })) };
  });
}

function signature(stroke: Stroke): string {
  const { imgElement: _image, points, ...attributes } = stroke as Stroke & { imgElement?: unknown };
  return JSON.stringify([
    Object.entries(attributes).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)),
    points.map(point => [point.x, point.y, point.pressure]),
  ]);
}

export function findUniqueInkIndex(strokes: readonly Stroke[], original: Stroke): number | undefined {
  const key = signature(original);
  const matches = strokes.flatMap((stroke, index) => signature(stroke) === key ? [index] : []);
  return matches.length === 1 ? matches[0] : undefined;
}

function counts(strokes: readonly Stroke[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const stroke of strokes) {
    const key = signature(stroke);
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

/**
 * A remote snapshot can arrive during a pointer gesture. Rebase that gesture's
 * additions/removals onto it instead of overwriting either whole document.
 * Concurrent edits of the same legacy stroke keep both versions.
 */
export function rebaseInkGesture(base: readonly Stroke[], local: readonly Stroke[], incoming: readonly Stroke[]): Stroke[] {
  const remainingLocal = counts(local);
  const removals = new Map<string, number>();
  for (const stroke of base) {
    const key = signature(stroke);
    const remaining = remainingLocal.get(key) || 0;
    if (remaining) remainingLocal.set(key, remaining - 1);
    else removals.set(key, (removals.get(key) || 0) + 1);
  }
  const merged = incoming.filter(stroke => {
    const key = signature(stroke);
    const remove = removals.get(key) || 0;
    if (!remove) return true;
    removals.set(key, remove - 1);
    return false;
  });
  const remainingBase = counts(base);
  for (const stroke of local) {
    const key = signature(stroke);
    const remaining = remainingBase.get(key) || 0;
    if (remaining) remainingBase.set(key, remaining - 1);
    else merged.push(stroke);
  }
  return copyInk(merged);
}
