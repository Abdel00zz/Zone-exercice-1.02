import type { Point, PressureCurve, ShapeType, Stroke } from './types';

export interface PressureSample {
  pressure: number;
  pointerType: string;
  tiltX?: number;
  tiltY?: number;
}

/** Calibrage repris du moteur Interactive Maths et adapté aux points de ce canvas. */
export function calibratePressure(
  event: PressureSample,
  curve: PressureCurve,
  pencilTilt: boolean,
): number {
  let pressure = event.pointerType === 'mouse' ? 0.5 : event.pressure;
  if (!Number.isFinite(pressure) || pressure <= 0) {
    pressure = event.pointerType === 'pen' ? 0.12 : 0.5;
  }
  if (curve === 'soft') pressure = Math.sqrt(pressure);
  else if (curve === 'firm') pressure = pressure ** 1.55;

  if (pencilTilt) {
    const tilt = Math.min(1, Math.hypot(event.tiltX || 0, event.tiltY || 0) / 80);
    pressure *= 1 + tilt * 0.28;
  }
  return Math.max(0.035, Math.min(1, pressure));
}

class LowPass {
  private value = 0;
  private initialized = false;

  filter(sample: number, alpha: number): number {
    this.value = this.initialized ? alpha * sample + (1 - alpha) * this.value : sample;
    this.initialized = true;
    return this.value;
  }

  hasLast(): boolean { return this.initialized; }
  last(): number { return this.value; }
}

class OneEuroFilter {
  private frequency = 120;
  private readonly position = new LowPass();
  private readonly derivative = new LowPass();
  private lastTime: number | null = null;

  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly derivativeCutoff = 1,
  ) {}

  private alpha(cutoff: number): number {
    const te = 1 / this.frequency;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime != null && timestamp > this.lastTime) {
      this.frequency = 1000 / (timestamp - this.lastTime);
    }
    this.lastTime = timestamp;
    const previous = this.position.hasLast() ? this.position.last() : value;
    const speed = (value - previous) * this.frequency;
    const filteredSpeed = this.derivative.filter(speed, this.alpha(this.derivativeCutoff));
    return this.position.filter(value, this.alpha(this.minCutoff + this.beta * Math.abs(filteredSpeed)));
  }
}

/** Filtre One Euro : stable au repos, réactif quand le stylet accélère. */
export class StrokeSmoother {
  private readonly x: OneEuroFilter;
  private readonly y: OneEuroFilter;
  private readonly pressure: OneEuroFilter;

  constructor(stabilization: number) {
    const value = Math.max(0, Math.min(1, stabilization));
    const minCutoff = 9 - 6.5 * value;
    const beta = 0.22 - 0.14 * value;
    this.x = new OneEuroFilter(minCutoff, beta);
    this.y = new OneEuroFilter(minCutoff, beta);
    this.pressure = new OneEuroFilter(3, 0.6);
  }

  seed(point: Point, timestamp: number): void {
    this.x.filter(point.x, timestamp);
    this.y.filter(point.y, timestamp);
    this.pressure.filter(point.pressure, timestamp);
  }

  next(point: Point, timestamp: number): Point {
    return {
      x: this.x.filter(point.x, timestamp),
      y: this.y.filter(point.y, timestamp),
      pressure: Math.max(0.02, Math.min(1, this.pressure.filter(point.pressure, timestamp))),
    };
  }
}

function pointToSegmentDistanceSquared(point: Point, start: Point, end: Point): { distance: number; ratio: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { distance: (point.x - start.x) ** 2 + (point.y - start.y) ** 2, ratio: 0 };
  }
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projectedX = start.x + ratio * dx;
  const projectedY = start.y + ratio * dy;
  return {
    distance: (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2,
    ratio,
  };
}

/**
 * Simplification Ramer–Douglas–Peucker itérative, enrichie par la pression.
 * Elle réduit les points redondants sans effacer les variations d'épaisseur
 * d'un vrai stylet et évite la récursion sur les très longs tracés.
 */
export function simplifyPoints(points: Point[], tolerance: number, pressureScale = 0): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const toleranceSquared = tolerance * tolerance;

  // Préfiltre radial O(n) : retire les échantillons quasi identiques avant RDP.
  const radial: Point[] = [points[0]];
  const radialThresholdSquared = toleranceSquared * 0.25;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const previous = radial[radial.length - 1];
    const spatial = (point.x - previous.x) ** 2 + (point.y - previous.y) ** 2;
    const pressureDistance = Math.abs(point.pressure - previous.pressure) * pressureScale;
    if (spatial >= radialThresholdSquared || pressureDistance >= tolerance * 0.5) radial.push(point);
  }
  radial.push(points[points.length - 1]);
  if (radial.length <= 2) return radial;

  const keep = new Uint8Array(radial.length);
  keep[0] = 1;
  keep[radial.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, radial.length - 1]];

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()!;
    const start = radial[startIndex];
    const end = radial[endIndex];
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;

    for (let index = startIndex + 1; index < endIndex; index++) {
      const point = radial[index];
      const spatial = pointToSegmentDistanceSquared(point, start, end);
      const expectedPressure = start.pressure + (end.pressure - start.pressure) * spatial.ratio;
      const pressureDistance = (point.pressure - expectedPressure) * pressureScale;
      const effectiveDistance = Math.max(spatial.distance, pressureDistance * pressureDistance);
      if (effectiveDistance > farthestDistance) {
        farthestDistance = effectiveDistance;
        farthestIndex = index;
      }
    }

    if (farthestIndex !== -1) {
      keep[farthestIndex] = 1;
      stack.push([startIndex, farthestIndex], [farthestIndex, endIndex]);
    }
  }

  return radial.filter((_, index) => keep[index] === 1);
}

/** Tolérance adaptée à l'outil : fine au crayon, plus forte pour les larges aplats. */
export function optimizeStrokePoints(stroke: Stroke): Point[] {
  if (stroke.points.length <= 2 || stroke.shapeType || stroke.isImage || stroke.isText) return stroke.points;
  const tolerance = stroke.isEraser
    ? Math.max(0.75, Math.min(2, stroke.width * 0.06))
    : stroke.isHighlighter
      ? Math.max(0.65, Math.min(1.6, stroke.width * 0.05))
      : Math.max(0.35, Math.min(1.1, stroke.width * 0.1));
  return simplifyPoints(stroke.points, tolerance, Math.max(2, stroke.width * 1.25));
}

/** Reconnaît une ligne, un rectangle ou une ellipse à partir d'un tracé libre. */
export function recognizeStrokeShape(stroke: Stroke): Stroke | null {
  const points = stroke.points;
  if (points.length < 8) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  if (diagonal < 25) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  if (length < 1) return null;

  if (chord / length > 0.9 && chord > 20) {
    return { ...stroke, points: [start, end], shapeType: 'line' };
  }
  if (chord > diagonal * 0.32) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max(width / 2, 1);
  const radiusY = Math.max(height / 2, 1);
  let ellipseError = 0;
  let rectangleError = 0;
  for (const point of points) {
    ellipseError += Math.abs(((point.x - centerX) / radiusX) ** 2 + ((point.y - centerY) / radiusY) ** 2 - 1);
    rectangleError += Math.min(
      Math.abs(point.x - minX), Math.abs(point.x - maxX),
      Math.abs(point.y - minY), Math.abs(point.y - maxY),
    ) / diagonal;
  }

  const shapeType: ShapeType = ellipseError / points.length <= (rectangleError / points.length) * 1.25
    ? 'circle'
    : 'rectangle';
  return {
    ...stroke,
    points: [
      { x: minX, y: minY, pressure: start.pressure },
      { x: maxX, y: maxY, pressure: end.pressure },
    ],
    shapeType,
  };
}

export function constrainShapePoint(
  start: Point,
  current: Point,
  shape: ShapeType,
  options: { snapGrid: boolean; angleSnap: boolean; angleStep: 15 | 30 | 45; regularShapes: boolean },
): Point {
  let x = options.snapGrid ? Math.round(current.x / 24) * 24 : current.x;
  let y = options.snapGrid ? Math.round(current.y / 24) * 24 : current.y;

  if (options.angleSnap && (shape === 'line' || shape === 'arrow' || shape === 'double-arrow' || shape === 'angle')) {
    const distance = Math.hypot(x - start.x, y - start.y);
    const step = options.angleStep * Math.PI / 180;
    const angle = Math.round(Math.atan2(y - start.y, x - start.x) / step) * step;
    x = start.x + Math.cos(angle) * distance;
    y = start.y + Math.sin(angle) * distance;
  }

  if (options.regularShapes && ['rectangle', 'circle', 'triangle', 'right-triangle', 'diamond', 'pentagon', 'hexagon'].includes(shape)) {
    const side = Math.max(Math.abs(x - start.x), Math.abs(y - start.y));
    x = start.x + (x >= start.x ? side : -side);
    y = start.y + (y >= start.y ? side : -side);
  }

  return { x, y, pressure: current.pressure };
}
