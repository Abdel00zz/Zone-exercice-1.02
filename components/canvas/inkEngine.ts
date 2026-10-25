import type { PenType, Point, PressureCurve, ShapeType, Stroke } from './types';

export interface PressureSample {
  pressure: number;
  pointerType: string;
  tiltX?: number;
  tiltY?: number;
}

/**
 * Calibrage physique de la pression inspiré de Noteshelf :
 * - Courbe sigmoïde douce au contact initial (évite les pâtés à l'attaque du trait)
 * - Sensibilité à l'inclinaison du stylet (tiltX/tiltY) pour le crayon graphite et la plume
 */
export function calibratePressure(
  event: PressureSample,
  curve: PressureCurve,
  pencilTilt: boolean,
): number {
  let pressure = event.pointerType === 'mouse' ? 0.5 : event.pressure;
  if (!Number.isFinite(pressure) || pressure <= 0) {
    pressure = event.pointerType === 'pen' ? 0.16 : 0.5;
  }

  // Remappage doux de la zone morte basse des capteurs Wacom / Apple Pencil / S Pen
  pressure = Math.max(0, Math.min(1, (pressure - 0.015) / 0.965));

  if (curve === 'soft') {
    // Réponse rapide dès les pressions légères (écriture souple sans effort)
    pressure = Math.pow(pressure, 0.58);
  } else if (curve === 'firm') {
    // Contrôle accru dans les traits fins (idéal pour les indices mathématiques)
    pressure = Math.pow(pressure, 1.48);
  } else {
    // Courbe en S naturelle Noteshelf : attaque fine, corps expressif, saturation douce
    const t = pressure;
    const smoothstep = t * t * (3 - 2 * t);
    pressure = 0.55 * t + 0.45 * smoothstep;
  }

  if (pencilTilt) {
    const tiltMagnitude = Math.min(1, Math.hypot(event.tiltX || 0, event.tiltY || 0) / 75);
    pressure *= 1 + tiltMagnitude * 0.34;
  }
  return Math.max(0.04, Math.min(1, pressure));
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

  clone(): LowPass {
    const copy = new LowPass();
    copy.value = this.value;
    copy.initialized = this.initialized;
    return copy;
  }
}

class OneEuroFilter {
  private frequency = 120;
  private position = new LowPass();
  private derivative = new LowPass();
  private lastTime: number | null = null;

  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly derivativeCutoff = 1.2,
  ) {}

  private alpha(cutoff: number): number {
    const te = 1 / Math.max(30, Math.min(360, this.frequency));
    const tau = 1 / (2 * Math.PI * Math.max(0.05, cutoff));
    return 1 / (1 + tau / te);
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime != null && timestamp > this.lastTime) {
      const dt = timestamp - this.lastTime;
      if (dt > 0.2 && dt < 200) {
        this.frequency = 1000 / dt;
      }
    }
    this.lastTime = timestamp;
    const previous = this.position.hasLast() ? this.position.last() : value;
    const speed = (value - previous) * this.frequency;
    const filteredSpeed = this.derivative.filter(speed, this.alpha(this.derivativeCutoff));
    return this.position.filter(value, this.alpha(this.minCutoff + this.beta * Math.abs(filteredSpeed)));
  }

  clone(): OneEuroFilter {
    const copy = new OneEuroFilter(this.minCutoff, this.beta, this.derivativeCutoff);
    copy.frequency = this.frequency;
    copy.position = this.position.clone();
    copy.derivative = this.derivative.clone();
    copy.lastTime = this.lastTime;
    return copy;
  }
}

/**
 * Filtre One Euro adaptatif calibré par outil (type Noteshelf) :
 * - Réactivité maximale à basse vitesse pour les petits symboles mathématiques (+, =, indices)
 * - Stabilisation cinématique sur les courbes amples et les traits de plume
 * - Clonable sans coût pour filtrer les points prédits (`getPredictedEvents`) sans polluer l'état réel
 */
export class StrokeSmoother {
  private x: OneEuroFilter;
  private y: OneEuroFilter;
  private pressure: OneEuroFilter;

  constructor(stabilization: number, penType?: PenType) {
    const value = Math.max(0, Math.min(1, stabilization));
    // Ajustement fin selon l'instrument : le stylo bille et le crayon privilégient
    // la précision immédiate ; la plume et le feutre lissent davantage les arabesques.
    const penBias = penType === 'fountain' || penType === 'calligraphy'
      ? 0.12
      : penType === 'ballpoint' || penType === 'pencil'
        ? -0.08
        : 0;
    const effective = Math.max(0, Math.min(1, value + penBias));

    const minCutoff = 11.5 - 8.2 * effective;
    const beta = 0.32 - 0.20 * effective;
    this.x = new OneEuroFilter(minCutoff, beta);
    this.y = new OneEuroFilter(minCutoff, beta);
    this.pressure = new OneEuroFilter(4.2, 0.45);
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
      pressure: Math.max(0.025, Math.min(1, this.pressure.filter(point.pressure, timestamp))),
      tiltX: point.tiltX,
      tiltY: point.tiltY,
      t: timestamp,
    };
  }

  clone(): StrokeSmoother {
    const copy = Object.create(StrokeSmoother.prototype) as StrokeSmoother;
    copy.x = this.x.clone();
    copy.y = this.y.clone();
    copy.pressure = this.pressure.clone();
    return copy;
  }
}

/**
 * Interpolation Catmull-Rom centripète sélective.
 * Quand le stylet accélère dans une boucle serrée (ex. lettre 'e', intégrale, infini),
 * même à 120 Hz deux échantillons peuvent être distants de 12–25 px avec un fort changement
 * d'angle. Insérer 1 à 2 points intermédiaires sur une spline Catmull-Rom garantit une
 * courbe d'encre fluide et organique façon Noteshelf sans alourdir les lignes droites.
 */
export function appendInterpolatedPoint(points: Point[], nextPoint: Point, minDistance: number): void {
  const len = points.length;
  if (len === 0) {
    points.push(nextPoint);
    return;
  }

  const p2 = points[len - 1];
  const dist = Math.hypot(nextPoint.x - p2.x, nextPoint.y - p2.y);

  if (len >= 2 && dist > Math.max(7, minDistance * 5.5)) {
    const p1 = points[len - 2];
    const p0 = len >= 3 ? points[len - 3] : p1;
    const p3 = nextPoint;

    // Mesure de courbure entre le segment précédent et le segment courant
    const v1x = p2.x - p1.x;
    const v1y = p2.y - p1.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = dist;

    if (l1 > 1.5 && l2 > 1.5) {
      const cosAngle = (v1x * v2x + v1y * v2y) / (l1 * l2);
      // Uniquement si le tracé tourne significativement (évite de sur-échantillonner les droites)
      if (cosAngle < 0.965) {
        const steps = dist > 22 ? 3 : 2;
        for (let step = 1; step < steps; step++) {
          const t = step / steps;
          const t2 = t * t;
          const t3 = t2 * t;
          // Formule matricielle Catmull-Rom uniforme tendue (tension 0.5)
          const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
          );
          const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
          );
          const pressure = p2.pressure + (p3.pressure - p2.pressure) * t;
          const tStamp = p2.t !== undefined && p3.t !== undefined ? p2.t + (p3.t - p2.t) * t : p3.t;
          points.push({
            x,
            y,
            pressure,
            tiltX: p3.tiltX,
            tiltY: p3.tiltY,
            t: tStamp,
          });
        }
      }
    }
  }

  points.push(nextPoint);
}

/**
 * Projette les points prédits par le navigateur (`event.getPredictedEvents()`)
 * en les amortissant progressivement vers la pointe du stylet pour éliminer
 * la latence d'affichage de 16 ms sans dépassement ("overshoot") dans les virages.
 */
export function buildPredictedTail(
  committedPoints: Point[],
  rawPredicted: Point[],
  smoother: StrokeSmoother | null,
  baseTimestamp: number,
): Point[] {
  if (rawPredicted.length === 0 || committedPoints.length < 2) return [];
  const tempSmoother = smoother ? smoother.clone() : null;
  const maxPred = Math.min(3, rawPredicted.length);
  const lastCommitted = committedPoints[committedPoints.length - 1];
  const prevCommitted = committedPoints[committedPoints.length - 2];

  // Si le stylet est quasi à l'arrêt, ne pas projeter de queue prédite
  const currentVelocity = Math.hypot(lastCommitted.x - prevCommitted.x, lastCommitted.y - prevCommitted.y);
  if (currentVelocity < 1.2) return [];

  const result: Point[] = [];
  let prev = lastCommitted;

  for (let i = 0; i < maxPred; i++) {
    const raw = rawPredicted[i];
    const t = raw.t || (baseTimestamp + (i + 1) * 4);
    const filtered = tempSmoother ? tempSmoother.next(raw, t) : raw;
    // Amortissement progressif (confiance décroissante sur les points plus lointains)
    const damping = i === 0 ? 0.82 : i === 1 ? 0.62 : 0.42;
    const x = prev.x + (filtered.x - prev.x) * damping;
    const y = prev.y + (filtered.y - prev.y) * damping;
    const pt: Point = {
      x,
      y,
      pressure: filtered.pressure,
      tiltX: filtered.tiltX,
      tiltY: filtered.tiltY,
      t,
    };
    result.push(pt);
    prev = pt;
  }

  return result;
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
 * Simplification Ramer–Douglas–Peucker itérative, enrichie par la pression et l'inclinaison.
 * Elle réduit les points redondants sans effacer les variations d'épaisseur
 * d'un vrai stylet et évite la récursion sur les très longs tracés.
 */
export function simplifyPoints(points: Point[], tolerance: number, pressureScale = 0): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const toleranceSquared = tolerance * tolerance;

  // Préfiltre radial O(n) : retire les échantillons quasi identiques avant RDP.
  const radial: Point[] = [points[0]];
  const radialThresholdSquared = toleranceSquared * 0.22;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const previous = radial[radial.length - 1];
    const spatial = (point.x - previous.x) ** 2 + (point.y - previous.y) ** 2;
    const pressureDistance = Math.abs(point.pressure - previous.pressure) * pressureScale;
    if (spatial >= radialThresholdSquared || pressureDistance >= tolerance * 0.45) {
      radial.push(point);
    }
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

function compactPoint(p: Point): Point {
  const pt: Point = {
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
    pressure: Math.round(p.pressure * 1000) / 1000,
  };
  if (p.tiltX) pt.tiltX = Math.round(p.tiltX);
  if (p.tiltY) pt.tiltY = Math.round(p.tiltY);
  return pt;
}

/** Tolérance adaptée à l'outil : ultra-fine pour préserver les courbes de plume et petits symboles, suivie d'une compaction numérique pour alléger le JSON stocké. */
export function optimizeStrokePoints(stroke: Stroke): Point[] {
  if (stroke.isImage || stroke.isText) return stroke.points;
  if (stroke.points.length <= 2 || stroke.shapeType) {
    return stroke.points.map(compactPoint);
  }
  const tolerance = stroke.isEraser
    ? Math.max(0.75, Math.min(2, stroke.width * 0.06))
    : stroke.isHighlighter
      ? Math.max(0.55, Math.min(1.4, stroke.width * 0.045))
      : Math.max(0.24, Math.min(0.85, stroke.width * 0.075));
  return simplifyPoints(stroke.points, tolerance, Math.max(2.2, stroke.width * 1.4)).map(compactPoint);
}

/**
 * Redresse automatiquement les traits longs quasi rectilignes (barres de fraction,
 * soulignements, axes) lorsque l'option `straightenLines` est activée dans la barre.
 */
export function straightenStrokeIfEligible(stroke: Stroke, enabled: boolean): Stroke {
  if (!enabled || stroke.shapeType || stroke.isEraser || stroke.isImage || stroke.isText) {
    return stroke;
  }
  const pts = stroke.points;
  if (pts.length < 5) return stroke;

  const start = pts[0];
  let end = pts[pts.length - 1];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (chord < 42) return stroke;

  let pathLength = 0;
  let maxDeviation = 0;
  for (let i = 1; i < pts.length; i++) {
    pathLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const dev = Math.sqrt(pointToSegmentDistanceSquared(pts[i], start, end).distance);
    if (dev > maxDeviation) maxDeviation = dev;
  }

  if (pathLength <= 0 || chord / pathLength < 0.935 || maxDeviation > Math.max(9, chord * 0.065)) {
    return stroke;
  }

  // Aimantation douce à l'horizontale ou à la verticale si l'angle est < 3.5° (idéal pour les barres de fraction)
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const deg = Math.abs(angle * 180 / Math.PI);
  if (deg < 3.5 || deg > 176.5) {
    end = { ...end, y: start.y };
  } else if (Math.abs(deg - 90) < 3.5) {
    end = { ...end, x: start.x };
  }

  return {
    ...stroke,
    points: [start, end],
    shapeType: 'line',
  };
}

/**
 * Rééchantillonne un tracé en `targetCount` points équidistants le long de son abscisse curviligne.
 * Rend tous les calculs géométriques (aire, circularité, erreur radiale, courbure)
 * totalement indépendants de la vitesse du stylet (qui ralentit naturellement dans les coins).
 */
function resampleByArcLength(points: Point[], targetCount = 64): Point[] {
  if (points.length <= 2) return points.slice();
  const cumDist = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    cumDist[i] = cumDist[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const totalLength = cumDist[points.length - 1];
  if (totalLength < 1e-3) return points.slice(0, 2);

  const result: Point[] = [points[0]];
  let segIdx = 1;
  for (let k = 1; k < targetCount - 1; k++) {
    const targetDist = (k * totalLength) / (targetCount - 1);
    while (segIdx < points.length - 1 && cumDist[segIdx] < targetDist) {
      segIdx++;
    }
    const d0 = cumDist[segIdx - 1];
    const d1 = cumDist[segIdx];
    const alpha = d1 > d0 ? (targetDist - d0) / (d1 - d0) : 0;
    const p0 = points[segIdx - 1];
    const p1 = points[segIdx];
    result.push({
      x: p0.x + (p1.x - p0.x) * alpha,
      y: p0.y + (p1.y - p0.y) * alpha,
      pressure: p0.pressure + (p1.pressure - p0.pressure) * alpha,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Détecte si un tracé forme une boucle fermée (même avec un léger dépassement / recouvrement
 * en fin de cercle ou un petit écart de fermeture) et coupe la queue de dépassement éventuelle.
 */
function extractClosedLoop(points: Point[], diagonal: number, totalLength: number): { loopPoints: Point[]; isClosed: boolean } {
  const n = points.length;
  if (n < 8 || totalLength < diagonal * 1.45) {
    return { loopPoints: points, isClosed: false };
  }

  const start = points[0];
  const end = points[n - 1];
  const endpointGap = Math.hypot(end.x - start.x, end.y - start.y);

  // Cherche le point de rapprochement minimal entre le début (premiers 22%) et la fin (derniers 28%)
  // pour gérer proprement les cercles où la main dépasse légèrement le point de départ.
  const headLimit = Math.max(2, Math.floor(n * 0.22));
  const tailStart = Math.min(n - 2, Math.floor(n * 0.72));
  let bestDist = endpointGap;
  let bestHeadIdx = 0;
  let bestTailIdx = n - 1;

  for (let i = 0; i <= headLimit; i++) {
    for (let j = tailStart; j < n; j++) {
      const d = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestHeadIdx = i;
        bestTailIdx = j;
      }
    }
  }

  const isClosed = bestDist <= Math.max(diagonal * 0.44, totalLength * 0.18);
  if (!isClosed) {
    return { loopPoints: points, isClosed: false };
  }

  if (bestTailIdx - bestHeadIdx >= 6 && (bestHeadIdx > 0 || bestTailIdx < n - 1)) {
    return { loopPoints: points.slice(bestHeadIdx, bestTailIdx + 1), isClosed: true };
  }
  return { loopPoints: points, isClosed: true };
}

/**
 * Calcule la rectitude moyenne et minimale des arêtes entre les sommets candidats
 * d'un polygone fermé afin de ne jamais confondre un arc de cercle avec un côté de triangle/carré.
 */
function computePolygonEdgeStraightness(points: Point[], vertices: Point[]): { minStraightness: number; avgStraightness: number } {
  if (vertices.length < 3) return { minStraightness: 0, avgStraightness: 0 };

  // Associe chaque sommet à son indice le plus proche dans `points`
  const indices: number[] = vertices.map(v => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = (points[i].x - v.x) ** 2 + (points[i].y - v.y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }).sort((a, b) => a - b);

  let minStraightness = 1;
  let sumStraightness = 0;
  const k = indices.length;

  for (let e = 0; e < k; e++) {
    const i0 = indices[e];
    const i1 = indices[(e + 1) % k];
    const p0 = points[i0];
    const p1 = points[i1];
    const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    let arc = 0;
    if (i1 > i0) {
      for (let i = i0 + 1; i <= i1; i++) {
        arc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
    } else {
      for (let i = i0 + 1; i < points.length; i++) {
        arc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      arc += Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
      for (let i = 1; i <= i1; i++) {
        arc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
    }
    const ratio = arc > 1e-3 ? Math.min(1, chord / arc) : 1;
    if (ratio < minStraightness) minStraightness = ratio;
    sumStraightness += ratio;
  }

  return {
    minStraightness,
    avgStraightness: sumStraightness / k,
  };
}

/**
 * Moteur de reconnaissance géométrique au maintien (Hold-to-Shape façon Noteshelf / PaleoSketch) :
 * Combine :
 * 1. Rééchantillonnage curviligne uniforme (64 points) + découpe de dépassement de boucle
 * 2. Erreur radiale linéaire vraie d'ellipse/cercle ($\varepsilon_{\text{ellipse}}$)
 * 3. Quotient isopérimétrique de Shoelace ($4\pi A / P^2$) et ratio d'aire ($A / (W \cdot H)$)
 * 4. Vérification stricte de la rectitude des arêtes (ShortStraw / RDP) pour que les cercles
 *    ne soient jamais transformés par erreur en carrés ou en triangles.
 */
export function recognizeStrokeShape(stroke: Stroke): Stroke | null {
  const points = stroke.points;
  if (points.length < 6) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const rawDiagonal = Math.hypot(rawWidth, rawHeight);
  if (rawDiagonal < 20) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  if (length < 1) return null;

  // 1. Ligne droite (avec accrochage doux à 0° / 90° si très proche)
  if (chord / length > 0.89 && chord > 18) {
    const targetEnd = { ...end };
    const angleDeg = Math.abs(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI);
    if (angleDeg < 3.5 || angleDeg > 176.5) {
      targetEnd.y = start.y;
    } else if (Math.abs(angleDeg - 90) < 3.5) {
      targetEnd.x = start.x;
    }
    return { ...stroke, points: [start, targetEnd], shapeType: 'line' };
  }

  // 2. Test de fermeture (avec découpe automatique du léger dépassement de fin de cercle)
  const { loopPoints, isClosed } = extractClosedLoop(points, rawDiagonal, length);

  if (!isClosed) {
    const openVertices = simplifyPoints(points, Math.max(9, rawDiagonal * 0.1), 0);
    if (openVertices.length === 3) {
      const [v0, v1, v2] = openVertices;
      const seg1 = Math.hypot(v1.x - v0.x, v1.y - v0.y);
      const seg2 = Math.hypot(v2.x - v1.x, v2.y - v1.y);
      if (seg1 > rawDiagonal * 0.68 && seg2 < seg1 * 0.36 && seg2 > 8) {
        return { ...stroke, points: [v0, v1], shapeType: 'arrow' };
      }
      if (seg1 > rawDiagonal * 0.35 && seg2 > rawDiagonal * 0.35) {
        return { ...stroke, points: [v1, v0], shapeType: 'angle' };
      }
    }
    return null;
  }

  // 3. Analyse géométrique haute précision sur la boucle fermée rééchantillonnée
  const uniform = resampleByArcLength(loopPoints, 64);
  minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
  for (const p of uniform) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  if (width < 14 || height < 14 || diagonal < 20) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max(width / 2, 1);
  const radiusY = Math.max(height / 2, 1);
  const minRadius = Math.max(Math.min(radiusX, radiusY), 1);

  // Erreur radiale linéaire d'ellipse (|rho - 1|) vs erreur de bord rectangulaire normalisée par minRadius
  let radialEllipseErrorSum = 0;
  let rectEdgeErrorSum = 0;
  let shoelaceTwiceArea = 0;
  let normShoelaceTwiceArea = 0;
  let normPerimeter = 0;

  for (let i = 0; i < uniform.length; i++) {
    const p = uniform[i];
    const q = uniform[(i + 1) % uniform.length];
    const nx = (p.x - centerX) / radiusX;
    const ny = (p.y - centerY) / radiusY;
    const qnx = (q.x - centerX) / radiusX;
    const qny = (q.y - centerY) / radiusY;

    const rho = Math.hypot(nx, ny);
    radialEllipseErrorSum += Math.abs(rho - 1);

    const distToBoxEdge = Math.min(
      Math.abs(p.x - minX),
      Math.abs(p.x - maxX),
      Math.abs(p.y - minY),
      Math.abs(p.y - maxY),
    );
    rectEdgeErrorSum += distToBoxEdge / minRadius;

    shoelaceTwiceArea += p.x * q.y - q.x * p.y;
    normShoelaceTwiceArea += nx * qny - qnx * ny;
    normPerimeter += Math.hypot(qnx - nx, qny - ny);
  }

  const ellipseRadialError = radialEllipseErrorSum / uniform.length; // ~0.02..0.11 pour un cercle tracé à la main
  const rectEdgeError = rectEdgeErrorSum / uniform.length;           // ~0.36 pour un cercle, ~0.04..0.11 pour un rectangle
  const enclosedArea = Math.abs(shoelaceTwiceArea) * 0.5;
  const areaToBoxRatio = enclosedArea / Math.max(1, width * height); // Cercle ≈ 0.785, Carré ≈ 0.92+, Triangle ≈ 0.50
  const normArea = Math.abs(normShoelaceTwiceArea) * 0.5;
  const normCircularity = normPerimeter > 1e-3 ? (4 * Math.PI * normArea) / (normPerimeter * normPerimeter) : 0;

  // Sommets candidats pour polygones (Triangle / Rectangle)
  const rawVertices = simplifyPoints(uniform, Math.max(8, diagonal * 0.095), 0);
  const closedVertices = rawVertices.length > 1 && Math.hypot(
    rawVertices[rawVertices.length - 1].x - rawVertices[0].x,
    rawVertices[rawVertices.length - 1].y - rawVertices[0].y,
  ) < diagonal * 0.34
    ? rawVertices.slice(0, -1)
    : rawVertices;

  const { minStraightness, avgStraightness } = computePolygonEdgeStraightness(uniform, closedVertices);

  // A. Détection stricte du Triangle :
  // Exige 3 sommets nets, 3 côtés véritablement droits (avgStraightness >= 0.92),
  // un ratio d'aire compatible avec un triangle (< 0.66) et une erreur d'ellipse élevée (> 0.13).
  if (
    closedVertices.length === 3 &&
    avgStraightness >= 0.92 &&
    minStraightness >= 0.87 &&
    areaToBoxRatio < 0.68 &&
    ellipseRadialError > 0.13
  ) {
    let hasRightAngle = false;
    for (let i = 0; i < 3; i++) {
      const a = closedVertices[i];
      const b = closedVertices[(i + 1) % 3];
      const c = closedVertices[(i + 2) % 3];
      const v1x = a.x - b.x, v1y = a.y - b.y;
      const v2x = c.x - b.x, v2y = c.y - b.y;
      const d1 = Math.hypot(v1x, v1y), d2 = Math.hypot(v2x, v2y);
      if (d1 > 10 && d2 > 10) {
        const cos = Math.abs((v1x * v2x + v1y * v2y) / (d1 * d2));
        if (cos < 0.22) {
          hasRightAngle = true;
          break;
        }
      }
    }
    return {
      ...stroke,
      points: [
        { x: minX, y: minY, pressure: start.pressure },
        { x: maxX, y: maxY, pressure: end.pressure },
      ],
      shapeType: hasRightAngle ? 'right-triangle' : 'triangle',
    };
  }

  // B. Distinction Cercle / Ellipse vs Rectangle / Carré :
  // Un tracé fermé est un rectangle UNIQUEMENT si ses bords collent nettement mieux au cadre
  // rectangulaire qu'à l'ellipse ET que ses côtés sont droits (pas une courbe continue).
  const isRectangle =
    rectEdgeError < ellipseRadialError * 0.78 &&
    normCircularity < 0.86 &&
    areaToBoxRatio > 0.80 &&
    avgStraightness >= 0.89;

  const shapeType: ShapeType = isRectangle ? 'rectangle' : 'circle';

  // Dans Noteshelf, un cercle tracé à la main (ratio largeur/hauteur entre 0.76 et 1.30)
  // s'aimante automatiquement sur un cercle parfait centré !
  const aspectRatio = width / Math.max(1, height);
  const regularSnap = shapeType === 'circle'
    ? (aspectRatio >= 0.76 && aspectRatio <= 1.30)
    : (aspectRatio >= 0.84 && aspectRatio <= 1.18);

  if (regularSnap) {
    // Pour un cercle, on calcule le rayon moyen par moindres carrés autour du centre
    const meanRadius = shapeType === 'circle'
      ? uniform.reduce((sum, p) => sum + Math.hypot(p.x - centerX, p.y - centerY), 0) / uniform.length
      : (width + height) / 4;
    const half = Math.max(10, meanRadius);
    return {
      ...stroke,
      points: [
        { x: centerX - half, y: centerY - half, pressure: start.pressure },
        { x: centerX + half, y: centerY + half, pressure: end.pressure },
      ],
      shapeType,
    };
  }

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

  return { x, y, pressure: current.pressure, tiltX: current.tiltX, tiltY: current.tiltY, t: current.t };
}
