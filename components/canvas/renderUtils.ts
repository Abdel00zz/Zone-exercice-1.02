import { Stroke, Point } from './types';
import { drawArrowhead } from './utils';
import { getStroke } from 'perfect-freehand';

type FreehandProfile = {
  thinning: number;
  smoothing: number;
  streamline: number;
};

const DEFAULT_FREEHAND_PROFILE: FreehandProfile = {
  thinning: 0.15,
  smoothing: 0.6,
  streamline: 0.55,
};

/** Profils distincts : bille réactif, feutre uniforme, crayon plus sensible. */
const PEN_PROFILES: Partial<Record<NonNullable<Stroke['penType']>, FreehandProfile>> = {
  ballpoint: { thinning: 0.08, smoothing: 0.55, streamline: 0.38 },
  marker: { thinning: 0, smoothing: 0.78, streamline: 0.5 },
  pencil: { thinning: 0.45, smoothing: 0.52, streamline: 0.34 },
  fountain: { thinning: 0.6, smoothing: 0.62, streamline: 0.5 },
  brush: { thinning: 0.75, smoothing: 0.68, streamline: 0.55 },
  calligraphy: { thinning: 0.8, smoothing: 0.64, streamline: 0.5 },
};

type CachedFreehandPath = { key: string; path: Path2D };
const freehandPathCache = new WeakMap<Stroke, CachedFreehandPath>();
const pencilPatternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

function getFreehandProfile(stroke: Stroke): FreehandProfile {
  const base = stroke.penType ? PEN_PROFILES[stroke.penType] : undefined;
  if (stroke.lineStyle === 'tapered') {
    return { ...(base || DEFAULT_FREEHAND_PROFILE), thinning: 0.85 };
  }
  return base || DEFAULT_FREEHAND_PROFILE;
}

/**
 * Un motif minuscule et déterministe donne au crayon un grain de graphite sans
 * recalculer des centaines de particules le long du tracé à chaque frame.
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

  const size = 16;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;

  tileCtx.fillStyle = color;
  tileCtx.globalAlpha = 0.42;
  tileCtx.fillRect(0, 0, size, size);

  let seed = 2166136261;
  for (let index = 0; index < color.length; index++) {
    seed = Math.imul(seed ^ color.charCodeAt(index), 16777619);
  }
  for (let index = 0; index < 80; index++) {
    seed = Math.imul(seed ^ (seed >>> 13), 1597334677);
    const x = (seed >>> 0) % size;
    seed = Math.imul(seed ^ (seed >>> 11), 3812015801);
    const y = (seed >>> 0) % size;
    tileCtx.globalAlpha = 0.18 + ((seed >>> 24) / 255) * 0.52;
    tileCtx.fillRect(x, y, (index % 5 === 0) ? 2 : 1, 1);
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) patterns.set(color, pattern);
  return pattern;
}

function getFreehandPath(stroke: Stroke, completed: boolean): Path2D {
  const points = stroke.points;
  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  const profile = getFreehandProfile(stroke);
  const usesRealPressure = stroke.usesRealPressure ?? points.some(point => Math.abs(point.pressure - 0.5) > 0.05);
  const key = [
    points.length,
    first.x, first.y, first.pressure,
    middle.x, middle.y, middle.pressure,
    last.x, last.y, last.pressure,
    stroke.width, profile.thinning, profile.smoothing, profile.streamline,
    usesRealPressure ? 1 : 0,
    completed ? 1 : 0,
  ].join('|');
  const cached = freehandPathCache.get(stroke);
  if (cached?.key === key) return cached.path;

  // Les tuples évitent la conversion d'objets effectuée en interne par
  // perfect-freehand et réduisent sensiblement les allocations par rendu.
  const inputPoints = points.map(point => [point.x, point.y, point.pressure]);
  const outline = getStroke(inputPoints, {
    size: stroke.width,
    thinning: profile.thinning,
    smoothing: profile.smoothing,
    streamline: profile.streamline,
    simulatePressure: !usesRealPressure,
    last: completed,
  });
  const path = new Path2D(getSvgPathFromStroke(outline));
  freehandPathCache.set(stroke, { key, path });
  return path;
}

export function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  isSelected: boolean = false,
  completed: boolean = true,
) => {
  if (stroke.points.length === 0) return;
  
  if (stroke.isText && stroke.text) {
    ctx.save();
    ctx.font = `${stroke.fontSize || 24}px ${stroke.font || 'Caveat'}`;
    ctx.fillStyle = stroke.color || '#000000';
    ctx.textBaseline = 'top';
    const lines = stroke.text.split('\n');
    const lineHeight = (stroke.fontSize || 24) * 1.2;
    lines.forEach((line, i) => {
      ctx.fillText(line, stroke.points[0].x, stroke.points[0].y + i * lineHeight);
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
      ctx.strokeRect(stroke.points[0].x - 4, stroke.points[0].y - 4, maxWidth + 8, lines.length * lineHeight + 8);
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
       const p1 = stroke.points[0];
       const p2 = stroke.points[1];
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
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (stroke.isHighlighter) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity !== undefined ? stroke.opacity : 0.45;
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
      ctx.globalAlpha = stroke.opacity !== undefined && stroke.opacity < 1 ? stroke.opacity : 0.9;
    } else if (stroke.opacity !== undefined) {
      ctx.globalAlpha = stroke.opacity;
    } else if (stroke.penType === 'brush') {
      ctx.globalAlpha = 0.6;
    } else if (stroke.penType === 'marker') {
      ctx.globalAlpha = 1.0;
    } else if (stroke.penType === 'fountain') {
      ctx.globalAlpha = 0.95;
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
    const p1 = stroke.points[0];
    const p2 = stroke.points[stroke.points.length - 1];
    ctx.lineWidth = stroke.width;

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
      if (stroke.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  if (stroke.points.length === 1) {
    ctx.beginPath();
    const p = stroke.points[0];
    const pressure = p.pressure > 0 ? p.pressure : 0.5;
    let r = stroke.width / 2;
    
    if (!stroke.isHighlighter && !stroke.isEraser) {
       if (stroke.penType === 'fountain' || stroke.lineStyle === 'tapered') {
           r = (stroke.width * (0.5 + pressure * 1.5)) / 2;
       }
    }
    ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Freehand stroke
  const isDashedOrDotted = stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted';
  const usePerfectFreehand = !isDashedOrDotted && !stroke.isHighlighter && !stroke.isEraser;
                         
  if (usePerfectFreehand) {
     const path = getFreehandPath(stroke, completed);
     if (stroke.penType === 'pencil') {
       const graphite = getPencilPattern(ctx, stroke.color);
       if (graphite) ctx.fillStyle = graphite;
     }
     ctx.fill(path);
  } else {
     // Smooth curve for uniform width or dashed/dotted tools
     ctx.beginPath();
     ctx.lineWidth = Math.max(1, stroke.width);
     ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
     
     for (let i = 1; i < stroke.points.length - 1; i++) {
       const p1 = stroke.points[i];
       const p2 = stroke.points[i + 1];
       const midX = (p1.x + p2.x) / 2;
       const midY = (p1.y + p2.y) / 2;
       ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
     }
     
     if (stroke.points.length > 1) {
       const last = stroke.points[stroke.points.length - 1];
       ctx.lineTo(last.x, last.y);
     }
     ctx.stroke();
  }
  
  ctx.restore();
};
