import { Point, Stroke } from './types';
import { drawArrowhead } from './utils';
import { getStroke } from 'perfect-freehand';

type FreehandProfile = {
  thinning: number;
  smoothing: number;
  streamline: number;
  easing: (t: number) => number;
  taperStartFactor: number;
  taperEndFactor: number;
  nibAngleRad?: number;
  nibInfluence?: number;
};

const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);
const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeLinear = (t: number) => t;

const DEFAULT_FREEHAND_PROFILE: FreehandProfile = {
  thinning: 0.18,
  smoothing: 0.58,
  streamline: 0.36,
  easing: easeOutSine,
  taperStartFactor: 0.35,
  taperEndFactor: 0.55,
};

/**
 * Profils d'encre calibrés sur le moteur physique de Noteshelf :
 * - Bille : précis, nerveux, latence minimale pour les formules et indices mathématiques
 * - Plume : bec calligraphique sensible à l'angle du trait (35°) + pleins et déliés soyeux
 * - Feutre : trait plein, dense et régulier sans variation parasite
 * - Crayon : grain graphite organique sensible à la pression et à l'inclinaison du stylet
 */
const PEN_PROFILES: Partial<Record<NonNullable<Stroke['penType']>, FreehandProfile>> = {
  ballpoint: {
    thinning: 0.16,
    smoothing: 0.56,
    streamline: 0.34,
    easing: easeOutSine,
    taperStartFactor: 0.3,
    taperEndFactor: 0.5,
  },
  marker: {
    thinning: 0.04,
    smoothing: 0.64,
    streamline: 0.40,
    easing: easeLinear,
    taperStartFactor: 0,
    taperEndFactor: 0,
  },
  pencil: {
    thinning: 0.34,
    smoothing: 0.52,
    streamline: 0.30,
    easing: easeOutSine,
    taperStartFactor: 0.4,
    taperEndFactor: 0.6,
  },
  fountain: {
    thinning: 0.62,
    smoothing: 0.66,
    streamline: 0.42,
    easing: easeInOutQuad,
    taperStartFactor: 0.65,
    taperEndFactor: 1.65,
    nibAngleRad: (35 * Math.PI) / 180,
    nibInfluence: 0.38,
  },
  brush: {
    thinning: 0.74,
    smoothing: 0.72,
    streamline: 0.48,
    easing: easeInOutQuad,
    taperStartFactor: 0.9,
    taperEndFactor: 2.2,
  },
  calligraphy: {
    thinning: 0.76,
    smoothing: 0.70,
    streamline: 0.46,
    easing: easeInOutQuad,
    taperStartFactor: 0.8,
    taperEndFactor: 1.9,
    nibAngleRad: (30 * Math.PI) / 180,
    nibInfluence: 0.55,
  },
};

type CachedFreehandPath = {
  pointsRef: Point[];
  length: number;
  firstX: number;
  firstY: number;
  lastX: number;
  lastY: number;
  width: number;
  penType?: Stroke['penType'];
  lineStyle?: Stroke['lineStyle'];
  highlighterType?: Stroke['highlighterType'];
  pressureCurve?: Stroke['pressureCurve'];
  stabilization?: number;
  completed: boolean;
  path: Path2D;
};

let freehandPathCache = new WeakMap<Stroke, CachedFreehandPath>();
const pencilPatternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

export function invalidateStrokeRenderCache(stroke?: Stroke): void {
  if (stroke) {
    freehandPathCache.delete(stroke);
  } else {
    freehandPathCache = new WeakMap<Stroke, CachedFreehandPath>();
  }
}

function getFreehandProfile(stroke: Stroke): FreehandProfile {
  const base = (stroke.penType ? PEN_PROFILES[stroke.penType] : undefined) || DEFAULT_FREEHAND_PROFILE;

  // 1. Modulation par le curseur "Stabilisation" (0% -> 100%, défaut 35%)
  const stab = stroke.stabilization !== undefined ? Math.max(0, Math.min(1, stroke.stabilization)) : 0.35;
  // À 0%, latence nulle (streamline minimal) ; à 100%, lissage calligraphique maximal
  const streamline = Math.max(0.08, Math.min(0.76, base.streamline + (stab - 0.35) * 0.52));
  const smoothing = Math.max(0.32, Math.min(0.88, base.smoothing + (stab - 0.35) * 0.38));

  // 2. Modulation par le sélecteur "Pression" (Souple / Équilibrée / Ferme)
  const curve = stroke.pressureCurve || 'balanced';
  let thinning = base.thinning;
  let easing = base.easing;
  if (curve === 'soft') {
    thinning = Math.min(0.88, base.thinning * 1.22 + 0.04);
    easing = (t: number) => Math.pow(t, 0.65);
  } else if (curve === 'firm') {
    thinning = Math.max(0, base.thinning * 0.82);
    easing = (t: number) => Math.pow(t, 1.45);
  }

  if (stroke.lineStyle === 'tapered') {
    return {
      ...base,
      thinning: 0.82,
      smoothing,
      streamline,
      easing,
      taperEndFactor: 2.4,
    };
  }

  return {
    ...base,
    thinning,
    smoothing,
    streamline,
    easing,
  };
}

/**
 * Texture de graphite procédurale multi-échelle (64×64) inspirée de Noteshelf :
 * combine un micro-grain de papier vergé et des amas de graphite déterministes
 * mis en cache par couleur dans le contexte GPU.
 */
function getPencilPattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | null {
  let patterns = pencilPatternCache.get(ctx);
  if (!patterns) {
    patterns = new Map();
    pencilPatternCache.set(ctx, patterns);
  }
  const cached = patterns.get(color);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;

  const size = 48;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;

  // Base douce de graphite
  tileCtx.fillStyle = color;
  tileCtx.globalAlpha = 0.52;
  tileCtx.fillRect(0, 0, size, size);

  let seed = 2166136261;
  for (let index = 0; index < color.length; index++) {
    seed = Math.imul(seed ^ color.charCodeAt(index), 16777619);
  }

  // Fibres du papier et éclats de mine
  for (let index = 0; index < 420; index++) {
    seed = Math.imul(seed ^ (seed >>> 13), 1597334677);
    const x = (seed >>> 0) % size;
    seed = Math.imul(seed ^ (seed >>> 11), 3812015801);
    const y = (seed >>> 0) % size;
    const isLightPore = index % 7 === 0;
    if (isLightPore) {
      tileCtx.save();
      tileCtx.globalCompositeOperation = 'destination-out';
      tileCtx.globalAlpha = 0.14 + ((seed >>> 24) / 255) * 0.22;
      tileCtx.fillRect(x, y, 1, 1);
      tileCtx.restore();
    } else {
      tileCtx.fillStyle = color;
      tileCtx.globalAlpha = 0.22 + ((seed >>> 24) / 255) * 0.56;
      const w = index % 5 === 0 ? 2 : 1;
      const h = index % 9 === 0 ? 2 : 1;
      tileCtx.fillRect(x, y, w, h);
    }
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) patterns.set(color, pattern);
  return pattern;
}

/**
 * Construit directement un objet `Path2D` natif par courbes de Bézier quadratiques
 * sans passer par la sérialisation de chaînes SVG (`.toFixed(2)`), offrant un gain
 * de performance de ~6x lors du tracé haute fréquence à 120/240 Hz.
 */
export function buildSmoothPath2D(outline: number[][], closed: boolean = true): Path2D {
  const path = new Path2D();
  const len = outline.length;
  if (len === 0) return path;

  if (len < 4) {
    path.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < len; i++) {
      path.lineTo(outline[i][0], outline[i][1]);
    }
    if (closed) path.closePath();
    return path;
  }

  path.moveTo(outline[0][0], outline[0][1]);
  path.quadraticCurveTo(
    outline[1][0],
    outline[1][1],
    (outline[1][0] + outline[2][0]) * 0.5,
    (outline[1][1] + outline[2][1]) * 0.5,
  );

  for (let i = 2, max = len - 1; i < max; i++) {
    const a = outline[i];
    const b = outline[i + 1];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5);
  }

  const last = outline[len - 1];
  const first = outline[0];
  path.quadraticCurveTo(last[0], last[1], (last[0] + first[0]) * 0.5, (last[1] + first[1]) * 0.5);

  if (closed) {
    path.closePath();
  }
  return path;
}

/**
 * Construit un ruban biseauté (pointe Chisel à angle fixe, façon Noteshelf / Stabilo Boss)
 * en un seul polygone Path2D continu pour éviter toute sur-opacité aux changements de direction.
 */
function buildChiselHighlighterPath(points: Point[], width: number): Path2D {
  // Pour un surligneur biseauté, l'enveloppe avec faible amincissement et embout biseauté
  const outline = getStroke(
    points.map(p => [p.x, p.y, 0.5]),
    {
      size: width,
      thinning: -0.08,
      smoothing: 0.68,
      streamline: 0.44,
      simulatePressure: false,
      start: { cap: false, taper: 0 },
      end: { cap: false, taper: 0 },
    },
  );
  return buildSmoothPath2D(outline, true);
}

function getFreehandPath(stroke: Stroke, completed: boolean, overridePoints?: Point[]): Path2D {
  const points = overridePoints || stroke.points;
  const len = points.length;
  if (len === 0) return new Path2D();

  const first = points[0];
  const last = points[len - 1];

  // Utilisation du cache uniquement quand on dessine les points définitifs du trait
  if (!overridePoints) {
    const cached = freehandPathCache.get(stroke);
    if (
      cached &&
      cached.pointsRef === points &&
      cached.length === len &&
      cached.firstX === first.x &&
      cached.firstY === first.y &&
      cached.lastX === last.x &&
      cached.lastY === last.y &&
      cached.width === stroke.width &&
      cached.penType === stroke.penType &&
      cached.lineStyle === stroke.lineStyle &&
      cached.highlighterType === stroke.highlighterType &&
      cached.pressureCurve === stroke.pressureCurve &&
      cached.stabilization === stroke.stabilization &&
      cached.completed === completed
    ) {
      return cached.path;
    }
  }

  let path: Path2D;

  if (stroke.isHighlighter) {
    if (stroke.highlighterType === 'chisel') {
      path = buildChiselHighlighterPath(points, stroke.width);
    } else {
      const outline = getStroke(
        points.map(p => [p.x, p.y, 0.5]),
        {
          size: stroke.width,
          thinning: 0,
          smoothing: 0.68,
          streamline: 0.44,
          simulatePressure: false,
          last: completed,
        },
      );
      path = buildSmoothPath2D(outline, true);
    }
  } else {
    const profile = getFreehandProfile(stroke);
    const usesRealPressure = stroke.usesRealPressure ?? points.some(point => Math.abs(point.pressure - 0.5) > 0.04);

    // Calcul des points d'entrée avec dynamique calligraphique (plume Noteshelf)
    // Lorsque le stylo plume descend selon l'axe du bec (35°), le trait s'épaissit ("plein") ;
    // lorsqu'il remonte ou coupe la tranche, il s'affine ("délié").
    const nibAngle = profile.nibAngleRad;
    const nibInfluence = profile.nibInfluence || 0;
    const hasCalligraphicNib = nibAngle !== undefined && nibInfluence > 0;

    const inputPoints: number[][] = new Array(len);
    for (let i = 0; i < len; i++) {
      const pt = points[i];
      let effectivePressure = pt.pressure;

      if (i > 0) {
        const prev = points[i - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const dist = Math.hypot(dx, dy);

        // Si l'entrée ne fournit pas de pression matérielle (souris/doigt) mais utilise une plume,
        // on combine une dynamique de vitesse fluide avec l'angle du bec calligraphique.
        if (!usesRealPressure && hasCalligraphicNib) {
          const dt = pt.t && prev.t && pt.t > prev.t ? pt.t - prev.t : 8;
          const speed = dist / dt; // px/ms
          const speedPressure = Math.max(0.22, Math.min(0.88, 0.72 - speed * 0.18));
          effectivePressure = effectivePressure * 0.35 + speedPressure * 0.65;
        }

        if (hasCalligraphicNib && dist > 0.35) {
          const strokeAngle = Math.atan2(dy, dx);
          // Produit vectoriel avec l'angle du bec calligraphique
          const nibFactor = Math.abs(Math.sin(strokeAngle - nibAngle!));
          effectivePressure = Math.max(
            0.05,
            Math.min(1, effectivePressure * (1 - nibInfluence * 0.55 + nibFactor * nibInfluence * 1.15)),
          );
        }
      }

      inputPoints[i] = [pt.x, pt.y, effectivePressure];
    }

    // Les petits symboles mathématiques (points, signes +, -, indices courts) ne doivent pas
    // être trop effilés au début/fin sinon ils deviennent trop petits.
    const approxSpan = Math.hypot(last.x - first.x, last.y - first.y);
    const taperScale = approxSpan < 14 ? 0.25 : approxSpan < 28 ? 0.6 : 1;

    // La courbe de pression (Souple / Équilibrée / Ferme) ajuste aussi l'épaisseur cible
    const sizeCurveMultiplier = stroke.pressureCurve === 'soft'
      ? 1.08
      : stroke.pressureCurve === 'firm'
        ? 0.92
        : 1.0;

    const outline = getStroke(inputPoints, {
      size: stroke.width * sizeCurveMultiplier,
      thinning: profile.thinning,
      smoothing: profile.smoothing,
      streamline: profile.streamline,
      easing: profile.easing,
      simulatePressure: !usesRealPressure && !hasCalligraphicNib,
      last: completed,
      start: {
        cap: true,
        taper: profile.taperStartFactor * stroke.width * taperScale,
      },
      end: {
        cap: true,
        taper: completed ? profile.taperEndFactor * stroke.width * taperScale : 0,
      },
    });
    path = buildSmoothPath2D(outline, true);
  }

  if (!overridePoints) {
    freehandPathCache.set(stroke, {
      pointsRef: points,
      length: len,
      firstX: first.x,
      firstY: first.y,
      lastX: last.x,
      lastY: last.y,
      width: stroke.width,
      penType: stroke.penType,
      lineStyle: stroke.lineStyle,
      highlighterType: stroke.highlighterType,
      pressureCurve: stroke.pressureCurve,
      stabilization: stroke.stabilization,
      completed,
      path,
    });
  }
  return path;
}

const average = (a: number, b: number) => (a + b) / 2;

export function getSvgPathFromStroke(stroke: number[][], closed: boolean = true): string {
  const len = stroke.length;
  if (!len) return '';
  if (len < 4) {
    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );
    if (closed) d.push('Z');
    return d.join(' ');
  }

  let a = stroke[0];
  let b = stroke[1];
  const c = stroke[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = stroke[i];
    b = stroke[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }

  if (closed) {
    result += 'Z';
  }

  return result;
}

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  isSelected: boolean = false,
  completed: boolean = true,
  overridePoints?: Point[],
) => {
  const points = overridePoints || stroke.points;
  if (points.length === 0) return;

  if (stroke.isText && stroke.text) {
    ctx.save();
    ctx.font = `${stroke.fontSize || 24}px ${stroke.font || 'Caveat'}`;
    ctx.fillStyle = stroke.color || '#000000';
    ctx.textBaseline = 'top';
    const lines = stroke.text.split('\n');
    const lineHeight = (stroke.fontSize || 24) * 1.2;
    lines.forEach((line, i) => {
      ctx.fillText(line, points[0].x, points[0].y + i * lineHeight);
    });
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      let maxWidth = 0;
      lines.forEach(line => {
        const m = ctx.measureText(line);
        if (m.width > maxWidth) maxWidth = m.width;
      });
      ctx.strokeRect(points[0].x - 4, points[0].y - 4, maxWidth + 8, lines.length * lineHeight + 8);
    }
    ctx.restore();
    return;
  }

  if (stroke.isImage && stroke.imgSrc) {
    if (!stroke.imgElement) {
      const img = new window.Image();
      img.src = stroke.imgSrc;
      img.onload = () => {
        stroke.imgElement = img;
      };
      stroke.imgElement = img;
    }
    const imgEl = stroke.imgElement;
    if (imgEl && imgEl.complete && imgEl.naturalHeight !== 0) {
      const p1 = points[0];
      const p2 = points[1];
      if (p1 && p2) {
        const minX = Math.min(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        ctx.drawImage(imgEl, minX, minY, w, h);
      }
    }
    return;
  }

  ctx.save();

  if (stroke.isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (stroke.isHighlighter) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity !== undefined ? stroke.opacity : 0.42;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.highlighterType === 'chisel' ? 'butt' : 'round';
    ctx.lineJoin = stroke.highlighterType === 'chisel' ? 'bevel' : 'round';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Apply line style
    if (stroke.lineStyle === 'dashed') {
      ctx.setLineDash([stroke.width * 2.5, stroke.width * 1.8]);
    } else if (stroke.lineStyle === 'dotted') {
      ctx.setLineDash([0, Math.max(4, stroke.width * 2.2)]);
      ctx.lineCap = 'round';
    } else {
      ctx.setLineDash([]);
    }

    // Pen specifics
    if (stroke.penType === 'pencil') {
      const avgPressure = points.length > 0
        ? (points[0].pressure + points[Math.floor(points.length / 2)].pressure + points[points.length - 1].pressure) / 3
        : 0.5;
      const baseAlpha = stroke.opacity !== undefined && stroke.opacity < 1 ? stroke.opacity : 0.88;
      ctx.globalAlpha = Math.max(0.45, Math.min(0.96, baseAlpha * (0.68 + avgPressure * 0.36)));
    } else if (stroke.opacity !== undefined) {
      ctx.globalAlpha = stroke.opacity;
    } else if (stroke.penType === 'brush') {
      ctx.globalAlpha = 0.65;
    } else if (stroke.penType === 'marker') {
      ctx.globalAlpha = 1.0;
    } else if (stroke.penType === 'fountain') {
      ctx.globalAlpha = 0.98;
    } else {
      ctx.globalAlpha = 1.0;
    }
  }

  if (isSelected) {
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
  }

  // Shapes rendering
  if (stroke.shapeType) {
    const p1 = points[0];
    const p2 = points[points.length - 1];
    ctx.lineWidth = stroke.width;
    if (stroke.penType === 'pencil' && !stroke.isHighlighter) {
      const graphite = getPencilPattern(ctx, stroke.color);
      if (graphite) {
        ctx.strokeStyle = graphite;
        ctx.fillStyle = graphite;
      }
    }

    // Apply line style to shapes
    if (stroke.lineStyle === 'dashed') {
      ctx.setLineDash([Math.max(6, stroke.width * 2.5), Math.max(4, stroke.width * 1.8)]);
    } else if (stroke.lineStyle === 'dotted') {
      ctx.setLineDash([0, Math.max(5, stroke.width * 2.2)]);
      ctx.lineCap = 'round';
    } else {
      ctx.setLineDash([]);
    }

    if (stroke.shapeType === 'line') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (stroke.shapeType === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, stroke.width);
    } else if (stroke.shapeType === 'double-arrow') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, stroke.width);
      drawArrowhead(ctx, p2.x, p2.y, p1.x, p1.y, stroke.width);
    } else if (stroke.shapeType === 'angle') {
      const radius = Math.min(22, Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.22));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.beginPath();
      ctx.moveTo(p1.x + Math.cos(angle) * Math.max(radius * 2.2, 34), p1.y + Math.sin(angle) * Math.max(radius * 2.2, 34));
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x + Math.max(radius * 2.2, 34), p1.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, Math.min(0, angle), Math.max(0, angle));
      ctx.stroke();
    } else if (stroke.shapeType === 'axes') {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      ctx.beginPath();
      ctx.moveTo(minX, cy); ctx.lineTo(maxX, cy);
      ctx.moveTo(cx, maxY); ctx.lineTo(cx, minY);
      ctx.stroke();
      drawArrowhead(ctx, minX, cy, maxX, cy, stroke.width);
      drawArrowhead(ctx, cx, maxY, cx, minY, stroke.width);
    } else if (stroke.shapeType === 'rectangle') {
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      ctx.strokeRect(x, y, w, h);
    } else if (stroke.shapeType === 'circle') {
      const rx = (p2.x - p1.x) / 2;
      const ry = (p2.y - p1.y) / 2;
      const cx = p1.x + rx;
      const cy = p1.y + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, Math.abs(rx)), Math.max(1, Math.abs(ry)), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.shapeType === 'triangle') {
      const topX = (p1.x + p2.x) / 2;
      const topY = p1.y;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'right-triangle') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.stroke();
      const marker = Math.min(14, Math.abs(p2.x - p1.x) / 4, Math.abs(p2.y - p1.y) / 4);
      if (marker > 3) {
        const sy = p2.y >= p1.y ? 1 : -1;
        const sx = p2.x >= p1.x ? 1 : -1;
        ctx.strokeRect(p1.x, p2.y - sy * marker, sx * marker, sy * marker);
      }
    } else if (stroke.shapeType === 'diamond') {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, p1.y);
      ctx.lineTo(p2.x, midY);
      ctx.lineTo(midX, p2.y);
      ctx.lineTo(p1.x, midY);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'parallelogram') {
      const w = p2.x - p1.x;
      const skew = w * 0.25;
      ctx.beginPath();
      ctx.moveTo(p1.x + skew, p1.y);
      ctx.lineTo(p2.x, p1.y);
      ctx.lineTo(p2.x - skew, p2.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'pentagon') {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'hexagon') {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'freeform') {
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (points.length === 1) {
    ctx.beginPath();
    const p = points[0];
    const pressure = p.pressure > 0 ? p.pressure : 0.5;
    let r = stroke.width / 2;

    if (!stroke.isHighlighter && !stroke.isEraser) {
      if (stroke.penType === 'fountain' || stroke.lineStyle === 'tapered') {
        r = (stroke.width * (0.45 + pressure * 1.15)) / 2;
      }
    }
    ctx.arc(p.x, p.y, Math.max(0.85, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Freehand stroke
  const isDashedOrDotted = stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted';
  const useOutlineEngine = !isDashedOrDotted && !stroke.isEraser;

  if (useOutlineEngine) {
    const path = getFreehandPath(stroke, completed, overridePoints);
    if (stroke.penType === 'pencil' && !stroke.isHighlighter) {
      const graphite = getPencilPattern(ctx, stroke.color);
      if (graphite) ctx.fillStyle = graphite;
    }
    ctx.fill(path);
  } else {
    // Courbe quadratique lisse pour la gomme pixel et les traits pointillés/tirets
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, stroke.width);
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    if (points.length > 1) {
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  }

  ctx.restore();
};
